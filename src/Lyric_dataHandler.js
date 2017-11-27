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


