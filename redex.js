/*
    ///////////////////////////////////////////////////
    /// redex - node.js + redis full text indexing  ///
    ///      v0.1  By Yichao 'Peak' Ji  2013.6      ///
    ///    www.peakji.com | peakji@peak-labs.com    ///
    ///////////////////////////////////////////////////
*/

var conf = null, KW, RC, RCcounter;
var redis = require("redis"), client = null;

/*
    Initialize Redis Connection
    Call this manually only if you want to set confs from your code, or your redis server requires password
*/

function init(config, callback){
    if(!client)
    {
        if(config){
            conf = config;
        }
        else
        {
            var fs = require('fs');
            try{
                conf = JSON.parse(fs.readFileSync("conf.json"));
            }
            catch(e)
            {
                conf = {
                    "redex_prefix": "_REDEX",
                    "redis_port": 6379,
                    "max_results": 10,
                    "max_levenshtein_dept": 8
                };
            }
        }

        conf.max_levenshtein_dept = conf.max_levenshtein_dept?conf.max_levenshtein_dept:8;

        var prefix = conf.redex_prefix?conf.redex_prefix:"_REDEX";

        KW = prefix+"KW:"; 
        RC = prefix+"RC:";
        RCcounter= prefix+"RC_counter";

        client = redis.createClient((conf.redis_port?conf.redis_port:6379));
        client.on("error", function (err) {
            console.log("Error " + err);
        });

        if(conf.password){
            client.auth(conf.password,function(err,reply){
                if(callback){
                    process.nextTick(function(){
                        callback(reply);
                    });
                }
            });
        }
        else
        {
            if(callback){
                process.nextTick(function(){
                    callback('done');
                });
            }
        }
    }
}

/*
    Disconnect from Redis
*/

function quit(){
    if(client!=null)
    {
        client.quit();
    }
}

/*
    Word Split Proxy - DEV VERSION
    !!! Use your own segmentation module !!!
    For Chinese 'Pin Yin' support, you may use PJPinyin: https://github.com/peakji/PJPinyin
    node-segment is a good choice for CJK word split: https://github.com/leizongmin/node-segment
*/

function seg(text, callback){
    var data = text.split(' ');
    process.nextTick(function(){
        callback(data);
    });
}

/*
    Levenshtein Distance
    Sorting option...
    !!! heavy work, NOT recommended !!!
    If you want to get the 'Closest Guess', you may add a 'word_len' attr holding the length of the index key,
    and use options.closest:"word_len"; or use options.sort:"word_len" + options.order:"ASCE";
*/



function levenshteinDistance (s, t, dept) {

    if(dept==undefined) dept=0;
    if(dept>=conf.max_levenshtein_dept) return Math.min(t.length,s.length);
    if (s.length==0) return t.length;
    if (t.length==0) return s.length;

    return Math.min(
            levenshteinDistance(s.substr(1), t, dept+1) + 1,
            levenshteinDistance(t.substr(1), s, dept+1) + 1,
            levenshteinDistance(s.substr(1), t.substr(1), dept+1) + (s[0] !== t[0] ? 1 : 0)
    );
}

/*
    Add Item
    Save a JSON item as a hash map into Redis and index it.

    @param json - the item to be added
    @param index_key - can be the 'key' of the text attribute, or an array of keywords
    @optional callback - error log...
*/

function add(json, index_key, callback){

    init();

    var __add = function(json, kws, callback){
        client.incr(RCcounter, function (err, reply){
            if(!err)
            {
                var item = [(RC+reply.toString())];
                for(var a in json){
                    item.push(a);
                    item.push(json[a]);
                }
                client.hmset(item, placeholder);
                var index = parseInt(reply.toString());
                for(var i=0;i<kws.length;i++){
                    client.sadd(KW+kws[i].toLowerCase(),index, placeholder);
                }
                if(callback)
                {
                    process.nextTick(function(){
                        callback();
                    });
                }
            }
        });
    }

    if(!json||!index_key)
    {
        process.nextTick(function(){
            callback('Missing Param!');
        });
    }
    // No need for segmentation
    else if(typeof(index_key)=='object'){
        __add(json,index_key,callback);
    }
    // Needs segmentation
    else if(typeof(json[index_key])=='string')
    {
        seg(json[index_key],function(kws){
            if(kws)
            {
                __add(json,kws,callback);
            }
            else
            {
                process.nextTick(function(){
                    callback('Segmentation Error!');
                });
            }
        });
    }
    else
    {
        process.nextTick(function(){
            callback('Index Key or Keywords Error!');
        });
    }
}


/*
    Search with Keywords
    Search and return matched records.

    @param keywords - keyword string or an array of keywords
    @optional options - 
        .closest - sort by the closest guess
        .sort - sort on the given key
        .order - 'ASCE' = 1 or 'DESC' = -1
        .leven - use Levenshtein Distance to determine the closest item
        .expire - cache search result for X secondes
        .key - key string or an array of keys of the attribute(s) that you want
        .limit - max items count
        .start & .end - sorting range
    @param callback - results...

*/

// Step 1

function search(keywords, options, callback){

    init();

    if(typeof(options)=='function')
    {
        callback = options;
        options = null;
    }

    options = options||{};

    if(typeof(keywords)=='string')
    {
        keywords = [keywords];
    }

    var newkey = keywords.join('+');

    // Check for cache
    client.exists(KW+newkey,function(err,reply){
        if(reply=='0')
        {
            // Not in cache
            var items = [(KW+newkey)];
            for(var i=0;i<keywords.length;i++)
            {
                items.push(KW+keywords[i]);
            }
            client.sinterstore(items,function(err,reply){
                if(!err)
                {
                    client.expire(KW+newkey,(options.expire?options.expire:120),placeholder);
                    msort(KW+newkey,keywords,options,callback);
                }
                else
                {
                    process.nextTick(function(){
                        callback([]);
                    });
                }
            });
        }
        else
        {
            // Cached
            msort(KW+newkey,keywords,options,callback);
        }
    });
    
}

// Step 2

function msort(fullNewKey, keywords, options, callback){
    client.smembers(fullNewKey,function(err,replies){
        if(!err&&replies.length>0)
        {

            var getItems = function(indexes){
                var keys = null;
                if(options.key){
                    if(typeof(options.key)=='string'){
                        options.key = [options.key];
                    }
                    keys = options.key;
                }
                retrieve(0,indexes.length-1,keys,indexes,[],options.leven,keywords.join(''),callback);
                
            }

            // Sorting
            if(options.sort||options.closest)
            {
                var start = 0,end = 10;
                if(options.limit!=undefined){
                    end = options.limit;
                }
                else if(options.start!=undefined&&options.end!=undefined)
                {
                    start = options.start;
                    end = options.end;
                }

                var order = 'DESC';
                if(options.closest||options.order=='ASCE'||options.order>=0){
                    order = 1;
                }
                
                options.sort = options.closest?options.closest:options.sort;

                var sorter = function(err,order){
                    if(!err&&order)
                    {
                        getItems(order);
                    }
                    else
                    {
                        process.nextTick(function(){
                            callback([]);
                        });
                    }
                }

                if(order==1)
                {
                    client.sort(fullNewKey,"by",RC+'*->'+options.sort,'LIMIT',start,end,sorter);
                }
                else
                {
                    client.sort(fullNewKey,"by",RC+'*->'+options.sort,order,'LIMIT',start,end,sorter);
                }
            }
            else
            {
                getItems(replies);
            }

        }
        else
        {
            process.nextTick(function(){
                callback([]);
            });
        }
    });
}

// Step 3

function retrieve(index,end,keys,indexes,results,leven,words,callback){

    if(index>end||index>=conf.max_results)
    {
        if(leven!=undefined){
            results.sort(function(a,b){
                try
                {
                    return levenshteinDistance(words,a[leven])-levenshteinDistance(words,b[leven]);
                }
                catch(e)
                {
                    return 0;
                }
            });
        }
        process.nextTick(function(){
            callback(results);
        });
        return;
    }
    else
    {
        if(!keys)
        {
            client.hgetall(RC+indexes[index],function(err,json){
                if(!err&&json) results.push(json);
                setImmediate(retrieve,index+1,end,keys,indexes,results,leven,words,callback);
            });
        }
        else
        {
            client.hmget(RC+indexes[index],keys,function(err,replies){
                if(!err&&replies) (replies.length==1)?results.push(replies[0]):results.push(replies);
                setImmediate(retrieve,index+1,end,keys,indexes,results,leven,words,callback);
            });
        }
    }
}

exports.init = init;
exports.add = add;
exports.search = search;
exports.quit = quit;

/*
    Reply Log Placeholder
    Replacing redis.print...
*/

function placeholder(err, reply){}

