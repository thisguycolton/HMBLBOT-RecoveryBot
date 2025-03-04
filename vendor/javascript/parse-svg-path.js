// parse-svg-path@0.1.2 downloaded from https://ga.jspm.io/npm:parse-svg-path@0.1.2/index.js

var a={};a=parse;var r={a:7,c:6,h:1,l:2,m:2,q:4,s:4,t:2,v:1,z:0};var e=/([astvzqmhlc])([^astvzqmhlc]*)/gi;function parse(a){var t=[];a.replace(e,(function(a,e,l){var n=e.toLowerCase();l=parseValues(l);if("m"==n&&l.length>2){t.push([e].concat(l.splice(0,2)));n="l";e="m"==e?"l":"L"}while(true){if(l.length==r[n]){l.unshift(e);return t.push(l)}if(l.length<r[n])throw new Error("malformed path data");t.push([e].concat(l.splice(0,r[n])))}}));return t}var t=/-?[0-9]*\.?[0-9]+(?:e[-+]?\d+)?/gi;function parseValues(a){var r=a.match(t);return r?r.map(Number):[]}var l=a;export default l;

