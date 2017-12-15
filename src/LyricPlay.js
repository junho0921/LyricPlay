(function(factory){
  'use strict';
  var isDefined = false;

  if(typeof define === 'function'){
    define('LyricPlay', factory);
    isDefined = true;
  }

  if(typeof fxDefine === 'function'){
    fxDefine('LyricPlay', factory);
    isDefined = true;
  }

  if(!isDefined){
    window.LyricPlay = factory();
  }

})(function() {
  'use strict';
  // 引入依赖的模块
  __inline('/static/room/modules/LyricPlay/src/GapHandler.js');
  __inline('/static/room/modules/LyricPlay/src/LyricCanvas.js');
  __inline('/static/room/modules/LyricPlay/src/LyricReducer.js');
  /*
  * LyricPlay歌词播放模块的优点:
  * 1, 在浏览器渲染的时机才进行歌词渲染, 同时保证精准歌词
  * 2, 可以配置每秒最大渲染帧数
  * 3, 性能优化: 除了翻页, 其他不需要操作dom, 滚动动画是通过清理画板的原理, 性能友好
  * 4, 多行的渲染
  * */
  // 触发生命周期钩子的工具
  function trigger (type, arg) {
    var handler = this[type];
    if(typeof handler === 'function'){
      handler.apply(this, arg);
    }
  }
  /*
   * LyricPlay的默认配置属性
   * */
  var _config = {
    // 画板配置 具体配置条件请看LyricCanvas.js
    canvas: {},
    // 播放配置
    play: {
      frames: 25,       // 每秒显示的帧数
      remainTime: 3000  // 歌词播放结束后的保留显示时间
    }
  };
  /**
   * @class LyricPlay
   * @classdesc 歌词播放模块
   * @example var fw = new LyricPlay({canvas:{lineHeight:40}, play:{frames: 60}});
   * @param config {Object} 配置: 接受的配置的内容是默认配置对象_config的属性, 请看_config的配置说明
   */
  function LyricPlay (config) {
    // 初始化画板
    this.canvas = new LyricCanvas(config.canvas);
    // 初始化配置
    this._init(config.play);
    // 间隔管理器
    this.gapHandler = new GapHandler({loopGap: Math.floor(1000 / this.config.frames), context: this});
    return this;
  }
  LyricPlay.prototype = {
    // 触发生命周期钩子的工具
    trigger: trigger,
    // 初始化
    _init: function (config) {
      // 构建记忆缓存
      this.resetMemo();
      // 构建配置
      this.config = $.extend(true, {}, _config.play, config);
      // 获取歌词行数, 需要从画板的属性里获取
      this.config.lyricRows = this.canvas.config.rows;
      // 播放歌词的行的索引值, 用于计算显示的播放歌句
      this.preRunningIndex = Math.round((this.config.lyricRows-1) / 2);
      this.nextRunningIndex = Math.floor((this.config.lyricRows-1) / 2);
      // 初始化歌曲缓存
      this.song = {rows:{}, name:null, singer: null};
    },
    /*
    * 判断数据是否已经换歌
    * */
    isNotChangeSong : function (data) {
      return data && data.name === this.song.name && data.singer === this.song.singer;
    },
    /*
    * 接受歌词数据
    * @desc 若同一首歌曲的话就使用拷贝方法
    * @param {object} [data] 接收的数据
    * */
    receiveData: function (data) {

      // 记录播放的初始数据, 用于控制播放的精准度
      this.memo.initPosition = data.position;
      this.memo.initRenderTime = Date.now();

      if(!this.isNotChangeSong(data)){
        // 若没有换歌, 那么继续添加歌词信息缓存就可以
        $.extend(this.song.rows, data.rows);
        if(this.memo.currentRowIndex !== data.currentRowIndex){
          // 标记（当前句与字的索引值只是提供方便计算）
          this.memo.currentRowIndex = data.currentRowIndex; // currentRowIndex 与 currentWordIndex划入memo属性，因为只是内部方便计算位置的状态数据而已
          this.memo.currentWordIndex = data.currentWordIndex;
        }
      }else{
        // 若换歌了, 那么直接替换数据就可以
        this.song = data;
        // 标记（当前句与字的索引值只是提供方便计算）
        this.memo.currentRowIndex = data.currentRowIndex; // currentRowIndex 与 currentWordIndex划入memo属性，因为只是内部方便计算位置的状态数据而已
        this.memo.currentWordIndex = data.currentWordIndex;
        // 换歌
        this.canvas.clear();
      }
    },
    /*
    * func render
    * @desc 渲染歌词方法，对外API
    * @param {object} [song] 歌词信息, 这是来源于客户端的报文, 遵循报文协议
    * */
    render: function (song) {
      // 处理数据获取指定格式的数据
      var data = lyricReducer(song);
      if(data){
        this.receiveData(data);
        // 清理定时器, 阻止之前触发的动画
        this.gapHandler.clear();
        // 触发计算并渲染, 无论有没有当前的歌句都显示，查找的任务交给计算方法
        this._loopFun();
        // 触发事件
        this.trigger('onShow', [data]);
      }
    },
    /*
    * 获取当前的歌句
    * 不独立为一个状态是因有当前歌句索引值作为状态了，另外新建状态标记可能隐藏的混乱的风险
    * */
    getCurrentRow: function(){
      return this.song.rows[this.memo.currentRowIndex];
    },
    /*
    * 获取当前播放进度的统一方法, 用于控制播放的精准度
    * */
    _getPos: function () {
      return Date.now() - this.memo.initRenderTime + this.memo.initPosition;
    },
    /*
    * func _loopFun
    * @desc 间隔渲染方法, 获取获取当前的渲染进度, 并设置间隔来反复执行
    * */
    _loopFun: function () {
      var st = this.getProgress(this._getPos());
      if(st.isEnd){
        st.wait > 0 && this.paint(st.width);
        return this.gapHandler.setTimeout(this.stop, st.wait);
      }
      this.paint(st.width);
      if(st.wait > 0){
        return this.gapHandler.setTimeout(this._loopFun, st.wait);
      }else if(st.wait === 0){
        return this.gapHandler.nextGap(this._loopFun);
      }
    },
    /*
    * func getProgress
    * @desc 获取当前进度长度
    * @param {number} [currentPos] 当前的播放进度
    * */
    getProgress: function (currentPos) {
      var row = this.getCurrentRow();
      if(!row){return false;}
      // 计算每句的数据
      calcRowPos(row, this.canvas._calcWordWidth.bind(this.canvas));
      var
        memo = this.memo,
        onShowWord = row.content[memo.currentWordIndex],
        wordRemainTime = onShowWord.endPos - currentPos; // 当前字的保留显示时间
      if(wordRemainTime >= 0){
        // 当前字的保留显示时间有剩余', wordRemainTime , onShowWord.duration);
        if(wordRemainTime <= onShowWord.duration){
          // [状态"running"] : 当前字的保留显示时间是本字的过渡时间范围内, 表示进度是当前的歌字范围, 播放显示');
          return {width: onShowWord.right - (wordRemainTime / onShowWord.duration * onShowWord.width), wait: 0};
        }else{
          // 当前字的保留显示时间是超过本字的过渡时间范围内, 表示进度是上一个歌字的范围');
          if(memo.currentWordIndex > 0){
            // [状态"preWord"] : 有上一字, 往上一字计算');
            memo.currentWordIndex--;
            return this.getProgress(currentPos);
          }else{
            if(this.song.rows[memo.currentRowIndex-1]){
              // [状态"preRow"] : 没有有上一字, 往上一句计算');
              memo.currentRowIndex--;
              memo.currentWordIndex = 0; // 修正当前歌字的索引值为0
              this._resetOnShowLyric();
              return this.getProgress(currentPos);
            }else{
              // [状态"preWait"] : 没有有上一字且上一句, 等待显示');
              return {width: 0, wait: onShowWord.startPoint - currentPos};
            }
          }
        }
      }else{
        // 当前字的保留显示时间没有剩余');
        var nextWord = row.content[memo.currentWordIndex+1];
        if(nextWord){
          // 有下一字');
          var wordWait = nextWord.startPoint - currentPos;
          if(wordWait >= 0){
            // [状态"waitWord"] : 但没有到下一字的开始时间, 等待显示');
            memo.currentWordIndex++;
            return {width: onShowWord.right, wait: wordWait};
          }else{
            // [状态"nextWord"] : 满足下一字的开始时间, 进入下一字的计算' + memo.currentWordIndex);
            memo.currentWordIndex++;
            return this.getProgress(currentPos);
          }
        }else{
          var nextRow = this.song.rows[memo.currentRowIndex+1];
          if(nextRow){
            var waitTime = nextRow.startPoint - currentPos;
            // 没有下一字, 但有下一句' , waitTime);
            if(waitTime >= 0 ){
              // [状态"waitNext"] : 但没有到下一句的开始时间, 等待显示' + waitTime);
              memo.currentRowIndex++;
              memo.currentWordIndex = 0;
              this._resetOnShowLyric();
              return {width: 0, wait: waitTime}
            }else{
              // [状态"nextRow"] : 满足下一句的开始时间, 计算');
              memo.currentRowIndex++;
              memo.currentWordIndex = 0;
              this._resetOnShowLyric();
              return this.getProgress(currentPos);
            }
          }else{
            // [状态"end"] : 没有下一字也没有下一句, 结束');
            return {isEnd: true, wait: this.config.remainTime + wordRemainTime, width: onShowWord.right};
          }
        }
      }
    },
    /*
    * 获取指定歌句的文案
    * */
    _getTxt: function (row) {
      if(!row){return null;}
      if(row.strAry){
        return row.strAry;
      }else{
        return row.strAry = row.content.map(function(w){return w.str;}).join('');
      }
    },
    paint: function (width) {
      // 调用画板渲染, 传参渲染的歌词与索引值
      this.canvas.draw(this._getPaintLyric(), this.preRunningIndex, width);
    },
    /*
     * func _getPaintLyric
     * @desc 获取歌词方法, 优先使用缓存, 没有就计算出来
     * */
    _getPaintLyric: function () {
      var memo = this.memo;
      var notChangeSong = this.isNotChangeSong(memo.lyricStr);
      // 由于memo.currentRowIndex已经是最新状态, 用于判断歌词缓存是否最新
      var notChangeIndex = memo.lyricStr && memo.lyricStr.index === memo.currentRowIndex;
      if(notChangeSong && notChangeIndex){
        return memo.lyricStr;
      }else{
        // 渲染
        var
          index = memo.currentRowIndex,
          upIndex = index - this.preRunningIndex,
          downIndex = index + this.nextRunningIndex;
        var rows = this.song.rows;
        var ary = [];
        for(var ri = upIndex; ri <= downIndex; ri++){
          ary.push(this._getTxt(rows[ri]));
        }
        ary.index = index;
        ary.name = this.song.name;
        ary.singer = this.song.singer;
        // 记录已经渲染的状态
        memo.lyricStr = ary;
        return ary;
      }
    },
    /*
    * 清理缓存的渲染歌词, 清理后会让下次渲染歌词前重新计算渲染歌词
    * */
    _resetOnShowLyric: function () {
      this.memo.lyricStr = null;
    },
    /*
     * func hide
     * @desc 停止播放歌词
     * */
    stop: function () {
      this.gapHandler.clear();
      this.canvas.clear();
      this.resetMemo();
      // 触发事件
      this.trigger('onStop');
    },
    resetMemo: function(){
      this.memo = {
        initPosition: 0,     // 渲染的时间戳
        initRenderTime: 0,   // 渲染的时间戳
        currentRowIndex: 0,  // 当前渲染的歌句索引值
        currentWordIndex: 0  // 当前渲染的歌字索引值
      };
    }
  };
  return LyricPlay;
});
