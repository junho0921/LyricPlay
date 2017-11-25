/**
 * Created by Administrator on 2017/11/25.
 */
function processData (song, _this) {
  var rows = _this.song.rows;
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
}

/*
 * 对当前歌句中每字的宽度与相对位置
 * */
function calcRowPos(row, calcHandler) {
  var sum = 0;
  if(row.posAry){return false;}
  row.posAry = [];
  row.strAry = '';
  row.content.forEach(function (word, i) {
    sum += calcHandler(word.str);
    row.posAry[i] = sum;
    row.strAry += word.str;
  });
}


