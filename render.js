var pako = require('pako');
var fs = require("fs") ;
var decodeMethod = require('./decodeMethod');

const path = require('path');
const dirName = "krc_data/";
const targetDir = path.join(__dirname, dirName);
const isKrcFile = (name) => name.slice(-4) === '.krc';

// fs.readFile(filePath.file, "utf8", function (error, basicHtml) {
//
// });

function readCb (result) {
  var intArr = decodeMethod(result);
  // console.log('===>    ', intArr);
  fs.writeFile(targetDir + '/result.js', JSON.stringify(intArr));
  // var res = pako.inflate(intArr, {to: 'string'});
  // console.log(res);
}

function render() {
  var filesArr = [];
  fs.readdirSync(targetDir).forEach(function (secFile) {
    if(isKrcFile(secFile)){
      filesArr.push(path.join(targetDir, secFile));
    }
  });
  return filesArr;
}

const fileData = render();
// console.log(fileData[1]);

fs.readFile(fileData[1], "utf8", function (error, data) {
    // console.log('data', data);

  readCb(data);
});
// fileData.re
// fs.writeFile(__dirname+'/routes.js', 'window.routes = '+JSON.stringify(fileData));