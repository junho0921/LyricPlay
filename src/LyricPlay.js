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
  * 1, 不渲染歌名
  * 2, 接受多行的渲染
  * todo
  * 1, 容错: 换行间隔是负数
  * 2, 测试: 浏览器的停止渲染
  * 3, 解耦: 计算与渲染
  * 4, 开始等候的静止模式
  *
  * 优势
  * 1, 在浏览器渲染的时机才进行歌词渲染, 同时保证精准歌词
  * 2, 可以配置每秒最大渲染帧数
  * 3, 性能优化: 除了翻页, 其他不需要操作dom, 滚动动画是通过清理画板的原理, 性能友好
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
  var canvasConfig = {

  };
  var _config = {
    //canvas: {
    //  view: 'body',     // 生成歌词播放canvas所在的容器
    //  rows: 6,         // 显示歌词行数
    //  height: 300,
    //  lineHeight: 40,
    //  fontSize: 30,
    //  width: 200,
    //  opacity: 1,
    //  color: '#666',
    //  fontFamily: 'Microsoft YaHei',
    //  highLightColor: '#0C7',
    //  paddingRight: 40, // 歌词显示的最右边距
    //  /*阴影*/
    //  shadowBlur: 3,
    //  shadowOffsetX: 0,
    //  shadowOffsetY: 0,
    //  shadowColor: '#fff'
    //},
    play: {
      // 画板配置
      // 播放配置
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
      this.memo = {
        initPosition: 0, // 渲染的时间戳
        initRenderTime: 0, // 渲染的时间戳
      };
      // 构建配置
      this.config = $.extend(true, {}, _config, config);
      console.log('this.canvas', this.canvas);
      this.config.lyricRows = this.canvas.config.rows;
      // 播放歌词的行的索引值
      this.showIndex = Math.round((this.config.lyricRows-1) / 2);
      // 初始化歌曲缓存
      this.song = {rows:{}};
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
      // 记录播放的初始数据, 用于控制播放的精准度
      this.memo.initPosition = +song.position;
      this.memo.initRenderTime = Date.now();

      this.song.currentRowIndex = +song.currentRowIndex; // todo currentRowIndex 与 currentWordIndex划入memo属性，因为只是内部方便计算位置的状态数据而已
      this.song.currentWordIndex = +song.currentWordIndex;

      // 加工数据并缓存
      processData(song, this);
      // 清理定时器
      this.gapHandler.clear();
      if(this.getCurrentRow()){
        // todo 测试使用
        this.test_changRowGap = Date.now();
        this.triggerPaint();
      }
    },
    /*
    * 获取当前的歌句
    * 不独立为一个状态是因有当前歌句索引值作为状态了，另外新建状态标记可能隐藏混乱的风险
    * */
    getCurrentRow: function(){
      return this.song.rows[this.song.currentRowIndex];
    },

    /*
    * 触发渲染
    * */
    triggerPaint: function () {
      var row = this.getCurrentRow();
      if(row){
        if(!row.posAry){
          calcRowPos(row, this.canvas._calcWordWidth.bind(this.canvas));
        }
        if(row.posAry){
          this.renderProgress(this.toPaintLyric.bind(this));
        }
      }else{
        this.trigger('onError', ['没有可以渲染的歌词']);
      }
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
    renderProgress: function (beforeRender) {
      // 获取当前的进度 todo 思考是否可以优化缓存，避免太多计算
      var currentProgress = this.getProgress();
      // 当获取当前进度是有效长度
      if(!isNaN(currentProgress)){
        //beforeRender && beforeRender.apply(this, []);
        $.isFunction(beforeRender) && beforeRender.apply(this, []);
        // 渲染当前进度
          this.canvas._drawProgress(currentProgress, this.showIndex);
        // 继续调用间隔工具来渲染
        return this.gapHandler.nextGap(this.renderProgress);
      }else{
        var st = currentProgress;// todo 是否可以解耦数据，宽度与状态
        switch (st.status){
          case 'wait':
            console.error('wait', st);
            this.canvas._drawProgress(this.getCurrentRow().posAry[this.getCurrentRow().posAry.length-1], this.showIndex);
            this.gapHandler.setTimeout(this.nextRow, st.wait);
            break;
          case 'end':
            console.error('end', this.config.remainTime - st.overGap);
            this.gapHandler.setTimeout(this.hide, this.config.remainTime - st.overGap);
            break;
          case 'next':
            console.error('next', st);
            return this.nextRow();
            break;
        }
      }
    },
    _testAcc: function () {
      // 换行 todo 收到数时, 检查是否有换行的数据
      var now = Date.now();
      console.warn('-------test_changRowGap----------', now - this.test_changRowGap);
      this.test_changRowGap = now;

      // todo 测试代码, 可以作为精准歌词的参考
      var idealTime = this.getCurrentRow().startPoint - this.memo.initPosition;
      var truthTime = now - this.memo.initRenderTime;
      console.log('理论的本行与初始的间距', idealTime);
      console.log('实际的本行与初始的间距', truthTime);
      console.log('相差', truthTime - idealTime);
    },
    /*
    * func nextRow
    * @desc 换行方法
    * */
    nextRow: function () {
      // 调整状态
      this.song.currentRowIndex++;
      this.song.currentWordIndex = 0;
      // 重新渲染run长度为零
      var row = this.getCurrentRow();
      // 测试
      this._testAcc();

      if(row){
        this.triggerPaint();
      }else{
        this.triggerEnd(); // todo 终止方法需要剩余的显示时间， 请确认
      }
    },
    triggerEnd: function () {
      console.error('end');
    },
    /*
    * func getProgress
    * @desc 获取当前进度长度
    * 优化，因为是一个比较频繁调用的方法，所以要注意
    * */
    getProgress: function () {
      var
        song = this.song,
        row = this.getCurrentRow(),
        onShowWord = row.content[song.currentWordIndex],
        onShowWordWith = row.posAry[song.currentWordIndex] - (row.posAry[song.currentWordIndex-1] || 0), // todo 优化
        wordRemainTime = (onShowWord.startPoint + onShowWord.duration + row.startPoint) - this._getPos();

      if(wordRemainTime>0){
        return row.posAry[song.currentWordIndex] - (wordRemainTime / onShowWord.duration * onShowWordWith)
      }else{
        song.currentWordIndex++;
        if(row.content[song.currentWordIndex]){
          return this.getProgress();
        }else{
          return this.calcWaitTime(-wordRemainTime);
        }
      }
    },
    /*
    * @param gap = 总的耗费时间 - 当前本行结尾时间
    * */
    calcWaitTime: function (rowOverGap) { // 命名为rowOverGap
      var
        song = this.song,
        nextRow = song.rows[song.currentRowIndex+1];
      if(nextRow){
        var
          currentRow = this.getCurrentRow(),
          rowWaitGap = nextRow.startPoint - (currentRow.startPoint + currentRow.duration);
        if(rowWaitGap < 0){
          return this.trigger('special', ['合唱歌词']);
        }
        if(rowWaitGap > rowOverGap){
          return {
            status: 'wait',
            wait: rowWaitGap - rowOverGap
          }
        }else{
          return {
            status: 'next',
            overGap: rowOverGap - rowWaitGap
          };
        }
      }else{
        return {
          status: 'end',
          overGap: rowOverGap
        };
      }
    },
    /*
    * 获取指定歌句的文案 todo 考虑优化
    * */
    _getTxt: function (row) {
      if(!row){return null;}
      if(row.strAry){
        return row.strAry;
      }else{
        return row.strAry = row.content.map(function(w){return w.str;}).join('');
      }
    },
    /*
     * func toPaintLyric
     * @desc 渲染歌词方法，有两层歌词重叠作为进度显示的实现基础
     * */
    toPaintLyric: function () {
      // 渲染
      var index = this.song.currentRowIndex;
      var r = (this.config.lyricRows-1) / 2;
      var upIndex = index - Math.round(r);
      var downIndex = index + Math.floor(r);
      var rows = this.song.rows;
      var ary = [];
      for(var ri = upIndex; ri <= downIndex; ri++){
        ary.push(this._getTxt(rows[ri]));
      }
      this.canvas.paintLyric(ary, this.showIndex);
    },
    /*
     * func hide
     * @desc 停止播放歌词
     * */
    stop: function () {
      this.gapHandler.clear();
      this.canvas.clear();
      //this.resetMemo(); // todo
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
