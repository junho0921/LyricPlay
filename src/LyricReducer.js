/**
 * Created by jun.ho on 2017/11/25.
 */
/*
 * 对当前歌句中每字的宽度与相对位置, 这个计算不需要每歌句计算, 所以是按需调用的
 * */
function calcRowPos(row, calcHandler) {
  if(!row || !row.content[0] || row.content[0].right){return false;}

  var sum = 0;
  row.strAry = '';
  // 遍历每字获取每字的宽度与位置
  row.content.forEach(function (word) {
    var width = calcHandler(word.str);
    sum += width;
    // 每字的位置(右侧)
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
* 客户端协议:
* 1, 数据格式:
* 1-1, 必须有字段: position, rows, songName, singerName, userId
* 1-2, rows字段的keys必须是数字, 表示歌句的索引值
* 1-3, rows字段的values必须是字符串
*      . 必须以[数字,数字]开头, 表示每句歌词的时间
*      . 字符串的标记 <数字,数字,数字>文字表示每歌字的时间与文案,
* 1-4, rows内容必须有当前播放的与未来播放的歌句信息
* 2, position的值必须是在rows字段提供的歌词范围内.
* */

/*
* func lyricReducer
* @desc 整理数据并输出以下格式的数据
* @param {object} [result] 数据
* 处理后的输出数据格式:
var currentSong = {
  name: ,     // 歌名
  singer: ,   // 歌名
  position:,  // 播放位置
  currentRowIndex:,     // 当前播放的歌句索引值
  currentWordIndex:,    // 当前播放的歌字索引值
  rows:{      // 歌词内容
    1:{       // 歌句索引值
      startPoint: null, // 歌句的开始时间戳
      duration: null,   // 歌句的播放时长
      content: [        // 歌句里的歌字信息
        {startPoint: 0, duration:100, word:'1'}, // 歌字开始时间戳, 歌字播放时长, 歌字内容
        ...
      ],
    },
    ...
  }
};
* */
function lyricReducer(result) {
  // 整理数据
  var
    song = {
      position: +result.position,
      name: result.songName,
      singer: result.singerName,
      rows: {}
    };
  try{
    // 遍历歌句数据处理
    $.each(result.rows, function (_rowIndex, _rd) {
      if(!isNaN(_rowIndex) && _rd) {
        // 缓存每句歌词数据
        song.rows[_rowIndex] = filterRowData(_rd);
      }
    });
  }catch(e){}
  // 或是有歌句信息, 那么, 根据播放位置来获取当前句与当前字
  if(!$.isEmptyObject(song.rows) && getCurrentRowWord(song)){
    return song;
  }else{
    return null;
  }
}

function getCurrentRowWord (song) {
  // 计算出当前的歌句index值
  song.currentRowIndex = findCurrentRow(song);
  // 计算出当前的歌词index值
  song.currentWordIndex = 0;
  return !(isNaN(song.currentRowIndex) || isNaN(song.currentWordIndex));
}

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

/*
* func findCurrentRow
* 必须在接收数据的时候就要找到存在的rowIndex值, 否则, LyricPlay是没有做容错处理
* */
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
    if(isNaN(currentRow)){
      currentRow = +Object.keys(song.rows)[0];
    }
    return currentRow;
  }
}
var
  getRowStartTime = takeMatchStr(/\[(\d+),\d+\]/),
  getRowDuration = takeMatchStr(/\[\d+,(\d+)\]/),
  getWordStartTime = takeMatchStr(/<(\d+),\d+,\d+>[^<]/),
  getWordDuration = takeMatchStr(/<\d+,(\d+),\d+>[^<]/),
  getWord= takeMatchStr(/<\d+,\d+,\d+>([^<]*)/);
function filterRowData(str){
  var row = {};
  row.startPoint = +getRowStartTime(str);
  row.duration = +getRowDuration(str);
  checkType(row);
  row.content = getWords(str);
  return row;
}
function getWords(str) {
  var unit;
  var words = [];
  while(unit = getUnit(str)){
    var
      word = {},
      data = unit[0];
    word.startPoint = +getWordStartTime(data);
    word.duration = +getWordDuration(data);
    word.str = getWord(data);
    checkType(word);
    if(word.str){
      words.push(word);
    }
  }
  return words;
}
// 检测数据的类型是否错误
function checkType (data) {
  if(isNaN(data.startPoint) || isNaN(data.duration)){
    throw new Error('数据类型错误:'+ JSON.stringify(data));
  }
}
