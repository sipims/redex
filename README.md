Redex
===================

Realtime full text indexing powered by redis & node.js.

Redex can index JSON items and search through 5 million items within 70ms.

Redex is a great solution for MongoDB external full text indexing;-)

## Features

### Built-in Features

- Insanely fast searching
- Realtime indexing
- Fuzzy Query
- Automatic caching
- JSON input/output
- Sorting with options
- Levenshtein Distance or lexical closest gussing
- Flexible and simple APIs

### Extending

- Chinese 'Pin Yin' support: [PJPinyin](https://github.com/peakji/PJPinyin "PJPinyin")
- CJK word split / segmentation: [node-segment](https://github.com/peakji/node-segment "node-segment")

## Install

<pre>
  npm install redex
</pre>

Or from source:

<pre>
  git clone git://github.com/peakji/redex.git
  cd redex
  npm link
</pre>


## Usage

### init

Initialize Redis Connection.

```javascript
function init(config, callback)
```

Call this manually only if you want to set confs from your code, or your redis server requires password. Otherwise Redex will init it self with the default settings on the first add/search call.

- **config** is optional, same as conf.json
- **callback** is optional, it should be something like function(msg){...}

```javascript
// Default settings
redex.init();

// Password & port
redex.init({
	"redis_port":1234,
	"password":"foobar"
});
```

### add

Add Item

```javascript
add(json, indexKeyOrKeyowrds, callback)
```

Save a JSON item as a hash map into Redis and index it.

- **indexKeyOrKeyowrds** can be the key of the indexing attr, or an array of keyowrds.
- **callback** is optional, it should be something like function(err){...}

```javascript
var json1 = {word:"Peak Ji rocks",mongoID:1001,score:998};

// Index on the 'word' attribute
redex.add(json1,'word');

// Index by given keywords
redex.add(json1,['peak','sucks']);
```

### search

Search with Keywords

```javascript
search(keywords, options, callback)
```

Search and return matched records.

- **keywords** can be a keyword string or an array of keywords;
- **options** :

  - `fuzzy` (int) - redex can abandon [fuzzy] prefix & suffix keywords to make fuzzy query
  - `closest` (string) - sort by the closest guess on the key [closest]
  - `sort` (string) - sort on the [sort] key
  - `order` (string/int) - 'ASCE' = 1 or 'DESC' = -1
  - `leven` (string) - use Levenshtein Distance to determine the closest item on key [leven]
  - `expire` (int) - cache search result for [expire] secondes
  - `key` (string/array) - key string or an array of keys of the attribute(s) that you want
  - `limit` (int) - max items count
  - `start` & `end` (int) - sorting range

- **callback** : function to get the results `function(data){...}`

```javascript
// Search for items with 'peak' and 'rock', then sort by 'score'
redex.search(['peak','rocks'],{sort:'score'},function(data){
    console.log(data);
    redex.quit();
});
```

### quit

Disconnect from Redis

```javascript
function quit()
```

```javascript
redex.quit();
```

## TO-DO

- Namespace for Multiple Indexes (actually now I use multiple Redex instances...)
- OR searching
- API for rebuild index
- API for DELETE items
- Code is still dirty

## License

 This code is distributed under the terms and conditions of the MIT license.

 Copyright (c) 2013 Yichao 'Peak' Ji

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
