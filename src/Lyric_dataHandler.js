/**
 * Created by jun.ho on 2017/11/25.
 */
function processData (song, _this) {
  try{
    var rows = _this.song.rows; // todo 不合理
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
    return true;
  }catch (e){
    return false;
  }
}

/*
 * 对当前歌句中每字的宽度与相对位置
 * */
function calcRowPos(row, calcHandler) {
  if(row.posAry){return false;}
  var sum = 0;
  // 每字的位置
  row.posAry = [];
  // 每字的宽度
  row.withAry = [];
  // 每句的文案
  row.strAry = '';
  // 遍历每字获取每字的宽度与位置
  row.content.forEach(function (word, i) {
    var width = calcHandler(word.str);
    sum += width;
    row.posAry[i] = sum;
    row.withAry[i] = width;
    row.strAry += word.str;
    // 计算每字的位置
    word.endPos = word.startPoint + word.duration + row.startPoint;
  });
}


