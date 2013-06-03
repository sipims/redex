var redex = require('./redex.js');
//var redex = require('./unstable/redex-dev-unstable.js');


var json1 = {word:"Someone named Peak",lemma:1001,score:1};
var json2 = {word:"Someone named Tom",lemma:1002,score:5};
var json3 = {word:"Peak is a boy",lemma:1003,score:9};
var json4 = {word:"Tom is a boy, too",lemma:1004,score:20};
var json5 = {word:"Peak loves Tom",lemma:1005,score:19};
var json6 = {word:"Peak is not a boy",lemma:1006,score:9};


/*
redex.add(json1,'word');
redex.add(json2,'word');
redex.add(json3,'word');
redex.add(json4,'word');
redex.add(json6,'word');

// Using a keyword array
redex.add(json5,['peak','hates','tom']);
*/

var date1 = (new Date()).getTime();
redex.search(['peak','boy','fakesuffix'],{fuzzy:2,leven:'word'},function(data){
	console.log('Responsed in: '+ ((new Date()).getTime()-date1) +' ms');
    console.log(data);
    redex.quit();
});
