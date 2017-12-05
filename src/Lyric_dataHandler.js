/**
 * Created by jun.ho on 2017/11/25.
 */
function processData (song, _this) {
  try{
    var rows;
    if(_this.song.name !== song.name){
      rows = {};
    }else{
      rows = _this.song.rows;
    }
    Object.keys(song.rows).forEach(function (songIndex) {
      if(!isNaN(songIndex) && !rows[songIndex]){
        var r = rows[songIndex] = {},
          o = song.rows[songIndex];
        r.startPoint = +o.startPoint;
        r.duration = +o.duration;
        r.content = o.content.map(function (w) {return {
          startPoint: +w.startPoint,
          duration: +w.duration,
          str: w.str
        };});
      }
    });
    _this.song.rows = rows;
    _this.song.name = song.name;
    return true;
  }catch (e){
    return false;
  }
}

/*
 * 对当前歌句中每字的宽度与相对位置
 * */
function calcRowPos(row, calcHandler) {
  if(!row || !row.content[0] || row.content[0].right){return false;}

  var sum = 0;
  row.strAry = '';
  // 遍历每字获取每字的宽度与位置
  row.content.forEach(function (word) {
    var width = calcHandler(word.str);
    sum += width;
    // 每字的位置
    word.right = sum;
    // 每字的宽度
    word.width = width;
    // 计算每字的最后播放时间戳
    word.endPos = word.startPoint + word.duration + row.startPoint;
    // 每句的文案
    row.strAry += word.str;
  });
}

/*
* todo 必须在接收数据的时候就要找到存在的rowIndex值, 否则, LyricPlay是没有做容错处理
* */


var API = {};

function checkDataCorrect (songData) {
  // todo 当收到数据的时候就检查数据是否符合预期, 若不符合预期, 那么之后所有的逻辑都会隐藏错误的可能
  /*
  * 客户端协议:
  * 1, 逐句
  * 2, 数据格式:
  * 2-1, 必须有字段: position, rows, songName
  * 2-2, rows字段的keys必须是数字, 表示歌句的索引值
  * 2-3, rows字段的values必须是字符串
  *   . 必须以[数字,数字]开头, 表示每句歌词的时间
  *   . 字符串的标记 <数字,数字,数字>文字表示每歌字的时间与文案,
  * 3, position的值必须是在rows字段提供的歌词范围内.
  * */
  return true;
}

/*
* 缓存歌词数据:
* 收到客户端的五句歌词
* 意义
* 1, 展示已唱歌词
* 2, 当收到新的歌词的时候对比, 不需要重复渲染
* 3, 自动播放下一句歌词
* 4, 数据必须方便比较, 用于精确找到当前的字
* */
// var STRUCTURE_ROW = {
//   startPoint: null,
//   duration: null,
//   content: [],
// };
// var STRUCTURE_SONG = {
//   position:null,
//   rows: {},
// };
// var STRUCTURE_WORD = {
//   startPoint: null,
//   duration: null,
//   content: [],
// };
// function getStructure (STRUCTURE) {
//   return window.$.extend(true, {}, STRUCTURE);
// }
var currentSong = {
  /*
    name: ,
    position:,
    currentRowIndex:,
    currentWordIndex:,
    rows:{
      1:{
        startPoint: null,
        duration: null,
        content: [
          {startPoint: 0, duration:100, word:'1'},
          {startPoint: 0, duration:100, word:'2'},
          ...
          ...
        ],
      },
      ...
      ...
      9:{
        startPoint: null,
        duration: null,
        content: [
          {startPoint: 0, duration:100, word:'1'},
          {startPoint: 0, duration:100, word:'2'},
          ...
          ...
        ],
      }
    }
  */
};

window._getData = function (result) {
  console.log('result', result);
  var song = handlerData(result);
  if(song && checkDataCorrect(song)){
    // console.log('新', song);
    if(currentSong.name == song.name){
      $.extend(true, currentSong, song);
    }else{
      currentSong = song;
    }
    console.log('===currentSong', currentSong);
    API.onNewData && API.onNewData(currentSong);
  }
};

/*
* 整理数据并缓存
* */
function handlerData(result) {
  // 整理数据
  var song = {
    position:result.position,
    name: result.songName,
    rows:{}
  };
  $.each(result.rows, function (_rowIndex, _rd) {
    // 缓存每句歌词数据
    song.rows[_rowIndex] = filterRowData(_rd);
  });
  if(!$.isEmptyObject(song.rows)){
    getCurrentRowWord(song);
    return song;
  }
}

function getCurrentRowWord (song) {
  if(isNaN(song.position)){return false;}
  // 计算出当前的歌句index值
  song.currentRowIndex = findCurrentRow(song);
  // 计算出当前的歌词index值
  song.currentWordIndex = findCurrentWord(song);
}

var demo_str = "[178956,3190]<0,180,0>记<180,170,0>忆<350,320,0>中<670,280,0>曾<950,360,0>被<1310,700,0>爱<2010,300,0>的<2310,670,0>味<2980,210,0>道";
var rgx = /<\d+,\d+,\d+>[^<]*/g;
function getUnit (str) {
  return rgx.exec(str);
}
function takeMatchStr (re) {
  return function (str) {
    var match = str.match(re);
    return match && match[1];
  }
}
function isIn (pos, data) {
  return pos >= +data.startPoint && pos <= ((+data.startPoint) + (+data.duration));
}
function findCurrentWord(song){
  if(isNaN(song.currentRowIndex)){
    return false;
  }
  var
    rowData = song.rows[song.currentRowIndex],
    words = rowData.content,
    pos = song.position - rowData.startPoint,
    currentWordIndex;
  if(words && words.length){
    words.some(function (w, i) {
      if(isIn(pos, w)){
        currentWordIndex = i;
        return true;
      }
    });
  }
  return currentWordIndex;
}
function findCurrentRow(song){
  if(song && !isNaN(song.position)){
    var currentRow;
    $.each(song.rows, function (_index, _d) {
      if(isNaN(currentRow) && !isNaN(_index)){
        if(isIn(song.position, _d)){
          currentRow = +_index;
        }
      }
    });
    return currentRow;
  }
}
var
  getRowStartTime = takeMatchStr(/\[(\d+),\d+\]/),
  getRowDuration = takeMatchStr(/\[\d+,(\d+)\]/),
  getWordStartTime = takeMatchStr(/<(\d+),\d+,\d+>[^<]/),
  getWordDuration = takeMatchStr(/<\d+,(\d+),\d+>[^<]/),
  getWord= takeMatchStr(/<\d+,\d+,\d+>([^<])/);
function filterRowData(str){
  var row = {};// var row = getStructure(STRUCTURE_ROW);
  row.startPoint = getRowStartTime(str);
  row.duration = getRowDuration(str);
  row.content = getWords(str);
  return row;
}
function getWords(str) {
  var unit;
  var words = [];
  while(unit = getUnit(str)){
    var
      word = {}, // word = getStructure(STRUCTURE_WORD);
      data = unit[0];
    word.startPoint = getWordStartTime(data);
    word.duration = getWordDuration(data);
    word.str = getWord(data);
    if(word.str){
      words.push(word);
    }
  }
  return words;
}
// 测试
window._d = API.currentSong = currentSong;
API.onNewData = null;
