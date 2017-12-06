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
  /*
  * 歌词播放
  * todo
  * 1, 容错: 换行间隔是负数时候的数据处理；
  * 2, 开始等候的静止模式
  *
  * 优势
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
    // 画板配置
    canvas: {
     view: 'body',     // 生成歌词播放canvas所在的容器
     rows: 6,         // 显示歌词行数
     height: 300,
     lineHeight: 40,
     fontSize: 30,
     width: 200,
     opacity: 1,
     color: '#666',
     fontFamily: 'Microsoft YaHei',
     highLightColor: '#0C7',
     paddingRight: 40, // 歌词显示的最右边距
     /*阴影*/
     shadowBlur: 3,
     shadowOffsetX: 0,
     shadowOffsetY: 0,
     shadowColor: '#fff'
    },
    // 播放配置
    play: {
      frames: 60,       // 每秒显示的帧数
      remainTime: 3000, // 歌词播放结束后的保留显示时间
    }
  };
  /**
   * @class LyricPlay
   * @classdesc 歌词播放模块
   * @example var fw = new LyricPlay()
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
      // 获取歌词行数
      this.config.lyricRows = this.canvas.config.rows;
      // 播放歌词的行的索引值
      this.runningIndex = Math.round((this.config.lyricRows-1) / 2);
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
    *
    * */
    receiveData: function (data) {
      if(!this.isNotChangeSong(data)){
        // $.extend(true, this.song, data);
        this.song.position = data.position;
        var songRows = this.song.rows;
        $.each(data.rows, function (_rowIndex, _rd) {
          if(!isNaN(_rowIndex) && !songRows[_rowIndex]) {
            songRows[_rowIndex] = _rd;
          }
        });
      }else{
        this.song = data;
      }
    },
    // 创建并缓存歌词播放信息的Message实例
    /*
    * func render
    * @desc 渲染歌词方法，对外API
    * @param song [object] 歌词信息
    * @param song.position [number] 歌词播放位置
    * @param song.currentRowIndex [number] 歌词播放的歌句索引值
    * @param song.currentWordIndex [number] 歌词播放的歌字索引值
    * @param song.rows [array] 歌句数据
    * @param song.rows[0].content [array] 歌句的歌字数据
    * @param song.rows[0].startPoint [number] 歌句的开始时间
    * @param song.rows[0].duration [number] 歌句的播放时间
    * */
    render: function (song) {
      // 加工数据
      var data = reducer(song);
      if(data){
        this.receiveData(data);
        // 记录播放的初始数据, 用于控制播放的精准度
        this.memo.initPosition = data.position;
        this.memo.initRenderTime = Date.now();
        // 标记（当前句与字的索引值只是提供方便计算）
        this.memo.currentRowIndex = data.currentRowIndex; // currentRowIndex 与 currentWordIndex划入memo属性，因为只是内部方便计算位置的状态数据而已
        this.memo.currentWordIndex = data.currentWordIndex;
        // 重置
        this._reset();
        // 无论有没有当前的歌句都显示，查找的任务交给计算方法
        this.splitFlow();
      }
    },
    _reset: function () {
      // 清理定时器
      this.gapHandler.clear();
      // todo 测试使用
      this.test_changRowGap = Date.now();
    },
    /*
    * 获取当前的歌句
    * 不独立为一个状态是因有当前歌句索引值作为状态了，另外新建状态标记可能隐藏混乱的风险
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
    * func renderProgress
    * @desc 渲染进度方法， 是每次间隔的方法
    *     间隔callback的内容是获取当前的进度去渲染
    * @param beforeRender  [function] 渲染前的回调函数 todo 优化为判断来执行
    * */
    splitFlow: function () {
      var st = this.getProgress();
      // st.status !== 'running' && console.log('status -> ', st);
      switch (st.status){
        case 'running':
          this.paint(st.width);
          return this.gapHandler.nextGap(this.splitFlow);
          break;
        case 'nextWord':
          this.memo.currentWordIndex++;
          return this.splitFlow();
          break;
        case 'waitNext':
          this.memo.currentRowIndex++;
          this.memo.currentWordIndex = 0;
          this._resetOnShowLyric();
          this.paint(0);
          return this.gapHandler.setTimeout(function () {
            this._testAcc();// 测试
            return this.splitFlow();
          }, st.wait);
          break;
        case 'nextRow':
          this.memo.currentRowIndex++;
          this.memo.currentWordIndex = 0;
          this._testAcc();// 测试
          this._resetOnShowLyric();
          return this.splitFlow();
          break;
        case 'end':
          return this.gapHandler.setTimeout(this.stop, this.config.remainTime - st.overGap);
          break;
        case 'preWord':
          this.memo.currentWordIndex--;
          return this.splitFlow();
          break;
        case 'preRow':
          this.memo.currentRowIndex--;
          this.memo.currentWordIndex = 0; // 修正当前歌字的索引值为0
          this._resetOnShowLyric();
          return this.splitFlow();
          break;
        case 'preWait':// 最开始的等待或者每句开始前的等待
        case 'waitBeginning':// 最开始的等待或者每句开始前的等待
          this.paint(0);
          return this.gapHandler.setTimeout(this.splitFlow, st.wait);
          break;
      }
    },
    /*
    * 测试代码, 可以作为精准歌词的参考, 请在换行并修正当前的索引值后使用
    * */
    _testAcc: function () {
      var now = Date.now();
      console.warn('-------test_changRowGap----------', now - this.test_changRowGap);
      this.test_changRowGap = now;
      var idealTime = this.getCurrentRow().startPoint - this.memo.initPosition;
      var truthTime = now - this.memo.initRenderTime;
      console.log('理论的本行与初始的间距', idealTime);
      console.log('实际的本行与初始的间距', truthTime);
      console.log('相差', truthTime - idealTime);
    },
    /*
    * func getProgress
    * @desc 获取当前进度长度
    * 优化，因为是一个比较频繁调用的方法，所以要注意
    * */
    getProgress: function () {
      var row = this.getCurrentRow();
      if(!row){return false;}
      // 计算每句的数据
      calcRowPos(row, this.canvas._calcWordWidth.bind(this.canvas));
      var
        memo = this.memo,
        onShowWord = row.content[memo.currentWordIndex],
        wordRemainTime = onShowWord.endPos - this._getPos();
      if(wordRemainTime > 0){
        if(wordRemainTime <= onShowWord.duration){
          return {status: 'running', width: onShowWord.right - (wordRemainTime / onShowWord.duration * onShowWord.width)};
        }else{
          if(this.memo.currentWordIndex > 0){
            return {status: 'preWord'};
          }else{
            if(this.song.rows[memo.currentRowIndex-1]){
              return {status: 'preRow'};
            }else{
              return {status: 'preWait', wait: wordRemainTime - onShowWord.duration};
            }
          }
        }
      }else{
        if(memo.currentWordIndex < (row.content.length - 1)){
          return {status: 'nextWord'};
        }else{
          var nextRow = this.song.rows[this.memo.currentRowIndex+1];
          var rowOverGap = -wordRemainTime;
          if(nextRow){
            var rowWaitGap = nextRow.startPoint - (row.startPoint + row.duration);
            // if(rowWaitGap < 0){
            //   console.error('合唱歌词', rowWaitGap);
            //   return this.trigger('special', ['合唱歌词']);
            // }
            if(rowWaitGap > rowOverGap){
              return {status: 'waitNext', wait: rowWaitGap - rowOverGap}
            }else{
              return {status: 'nextRow', overGap: rowOverGap - rowWaitGap};
            }
          }else{
            return {status: 'end', overGap: rowOverGap};
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
      this.canvas.draw(this._getPaintLyric(), this.runningIndex, width);
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
        var index = memo.currentRowIndex;
        var upIndex = index - this.runningIndex;
        var downIndex = index + this.runningIndex -1;
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
    },
    resetMemo: function(){
      this.memo = {
        initPosition: 0, // 渲染的时间戳
        initRenderTime: 0, // 渲染的时间戳
      };
    },
    /**
     * @func onError
     * @desc 报错时触发的方法
     * @param errorMsg {String} 报错信息
     */
    onError: null,
  };

  return LyricPlay;
});
