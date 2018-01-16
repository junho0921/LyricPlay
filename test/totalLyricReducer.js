(function () {
  'use strict';
  function splitLyric (songData) {
    return songData.match(/\[.+\].+\r\n/g);
  }
  function getSongName (songData) {
    // [ti:5868_99022_国语-卓依婷-味道]
    var fileName = songData.match(/\[ti:([^\[]+)\]/);
    if(fileName){
      var splits = fileName[1].split('-');
      return splits[splits.length-1];
    }
  }
  window.totalLyricReducer = function (songData, startPos) {
    var rows = splitLyric(songData);
    var songName = getSongName(songData);
    return {
      songName: songName,
      rows: rows,
      position: startPos // 测试模式下的开始位置后移10ms
    };
  }
})();
