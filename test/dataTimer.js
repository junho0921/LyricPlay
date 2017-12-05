fxDefine('timer', function () {
  'use strict';
  __inline('/static/room/modules/accLyric/mock.js');

  function splitLyric (songData) {
    return songData.match(/\[.+\].+\r\n/g);
  }
  function splitPoint (songData) {
    return songData.match(/\[\d+,\d+\]/g);
  }
  function getSongName (songData) {
    // [ti:5868_99022_国语-卓依婷-味道]
    var fileName = songData.match(/\[ti:([^\[]+)\]/);
    if(fileName){
      var splits = fileName[1].split('-');
      return splits[splits.length-1];
    }
  }
  function getStartTime (str) {
    var match = str.match(/\[(\d+),\d+\]/);
    return match && match[1];
  }
  function getPoints (songData) {
    var spots = splitPoint(songData);
    return spots.map(function (s) {
      return {
        starPoint:s.match(/\[(\d+)/)[1],
        duration:s.match(/(\d+)\]/)[1]
      }
    })
  }

  var currentRow = 2;
  var songData = window.mock.lyric.song_2;
  var rows = splitLyric(songData);
  var points = getPoints(songData);
  var songName = getSongName(songData);

  /*测试使用的歌词信息定时器*/
  function runTimer () {
    if(currentRow >= points.length){
      window._onEnd && window._onEnd();
      return false;
    }
    // 发射歌词
    var sendRows = {};
    sendRows[currentRow] = rows[currentRow];
    sendRows[currentRow+1] = rows[currentRow+1];
    sendRows[currentRow+2] = rows[currentRow+2];

    var sendData = {
      songName: songName,
      rows: sendRows,
      position: +getStartTime(rows[currentRow]) + 10 // 测试模式下的开始位置后移10ms
    };
    window._getData && window._getData(sendData);
    // 获取本歌词的过渡时间
    var duration = points[currentRow].duration;
    // 在歌词过渡时间后再触发歌词发射
    setTimeout(runTimer, duration);
    currentRow++;
  }
  runTimer();

});
