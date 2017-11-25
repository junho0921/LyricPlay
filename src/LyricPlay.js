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
  // 固定配置
  var staticCss = {
    wrap_outer: {
      overflow:'hidden'
    },
    wrap_inner: {
      position: 'relative'
    },
    canvas:{
      position: 'absolute',
      width: 2000,
      top: 0,
      left: 0
    },
    className:{
      wrap: 'LyricPlay_wrap',
      txt: 'LyricPlay_txt',
      run: 'LyricPlay_run'
    }
  };

  /*
  * LyricPlay的默认配置属性
  * */
  var _config = {
    view: 'body',     // 生成歌词播放canvas所在的容器
    lyricRows: 6,     // 显示歌词行数
    frames: 60,       // 每秒显示的帧数
    paddingRight: 40, // 歌词显示的最右边距
    remainTime: 3000, // 歌词播放结束后的保留显示时间
    css: {            // 歌词播放的样式
      lineHeight: 40,
      fontSize: 30,
      width: 200,
      opacity: 1,
      color: '#666',
      fontFamily: 'Microsoft YaHei',
      highLightColor: '#0C7',
      /*阴影*/
      shadowBlur: 3,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowColor: '#fff'
    }
  };

  /**
   * @class LyricPlay
   * @classdesc 歌词播放模块
   * @example var fw = new LyricPlay()
   * @param config {Object} 配置: 接受的配置的内容是默认配置对象_config的属性, 请看_config的配置说明
   */
  var LyricPlay = function (config) {
    // 初始化
    this._init(config);
    // 创建歌词播放DOM与canvas
    this._renderContainer();
    // 间隔管理器
    this.gapHandler = new GapHandler({loopGap: this.animationGap, context: this});
    return this;
  };

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
      // 播放歌词的行的索引值
      this.showIndex = Math.round((this.config.lyricRows-1) / 2);
      console.log('onshowIndex', this.showIndex);
      // 配置间隔
      this.animationGap = Math.floor(1000 / this.config.frames);
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
      // todo 测试使用
      this.test = this.test || {};
      this.test.initRowIndex = this.song.currentRowIndex;

      if(this.getCurrentRow()){
        this.test.changRowGap = Date.now();
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
          calcRowPos(row, this._calcWordWidth.bind(this));
        }
        if(row.posAry){
          this.renderProgress(function () {
            //console.warn('渲染底层');
            this.$wrap_inner.css('left', 0);
            this.paintTxt();
          });
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
        this._drawProgress(currentProgress);
        // 继续调用间隔工具来渲染
        return this.gapHandler.nextGap(this.renderProgress);
      }else{
        var st = currentProgress;// todo 是否可以解耦数据，宽度与状态
        switch (st.status){
          case 'wait':
            console.error('wait', st);
            this._drawProgress(this.getCurrentRow().posAry[this.getCurrentRow().posAry.length-1]);
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
      console.warn('-------test.changRowGap----------', now - this.test.changRowGap);
      this.test.changRowGap = now;

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
    /**
     * @func clear
     * @desc 清屏方法clear, 可以清理当前的歌词播放模块并隐藏起来
     */
    clear: function () {
      this.hide();
    },
    /**
     * @func onError
     * @desc 报错时触发的方法
     * @param errorMsg {String} 报错信息
     */
    onError: null,



    /*sideEffect*/

    /*
     * func hide
     * @desc 隐藏画板
     * */
    hide: function () {
      this.gapHandler.clear();
      this.$wrap.hide();
      this._clearRect();
    },
    /*
     * func _calcWordWidth
     * @desc 获取当前画板的字符宽度
     * @param word [string] 字符
     * */
    _calcWordWidth: function (word) {
      return this.context_txt.measureText(word).width;
    },
    /*
     * func _adjustCanvasPos
     * @desc 调整画板的显示位置，当显示进度超过画板可视范围，通过调整画板位置来保证当前进度可视
     * @param currentWith [number] 当前的进度宽度
     * */
    _adjustCanvasPos: function (currentWith) {
      var overLeft = currentWith + this.config.paddingRight - this.config.css.width;
      if(overLeft > 0){
        this.$wrap_inner.css('left', -overLeft);
      }
    },
    /*
     * func _drawProgress
     * @desc 渲染进度条方法
     * @param currentWith [number] 当前的进度宽度
     * */
    _drawProgress: function (currentWith) {
      // 调整位置
      this._adjustCanvasPos(currentWith);
      // 渲染长度
      var lh = this.config.css.lineHeight;
      try{
        //console.log('渲染', this.song.rows[this.song.currentRowIndex].content[this.song.currentWordIndex].str);
      }catch (e){}
      // todo 优化:应该动态计算当前播放index
      this.context_run.clearRect(0, lh * this.showIndex, currentWith, lh);
    },
    /*
     * func _clearRect
     * @desc 清理画板方法
     * */
    _clearRect: function () {
      var h = this.config.css.lineHeight * this.config.lyricRows;
      this.context_txt.clearRect(0, 0, staticCss.canvas.width, h);
      this.context_run.clearRect(0, 0, staticCss.canvas.width, h);
    },
    /*
     * func _drawTxt
     * @desc 渲染歌词方法，有两层歌词重叠作为进度显示的实现基础
     * @param txt 渲染的歌词文本
     * @param i 渲染的歌句索引值
     * */
    _drawTxt: function (txt, i) {
      i = i+1;
      if(!txt){return false;}
      var lH = this.config.css.lineHeight;
      var fixH = (lH - this.config.css.fontSize) / 2;
      this.context_txt.fillText(txt, 0, (lH * i) - fixH);
      if(i >= this.showIndex+1){
        this.context_run.fillText(txt, 0, (lH * i) - fixH);
      }
    },
    /*
     * func paintTxt
     * @desc 渲染歌词方法，有两层歌词重叠作为进度显示的实现基础
     * */
    paintTxt: function () {
      this._clearRect();
      var index = this.song.currentRowIndex;
      var r = (this.config.lyricRows-1) / 2;
      var upIndex = index - Math.round(r);
      var downIndex = index + Math.floor(r);
      var rows = this.song.rows;
      for(var ri = upIndex; ri <= downIndex; ri++){
        this._drawTxt(
          this._getTxt(rows[ri]),
          ri - upIndex
        );
      }
    },
    /*
     * func _renderContainer
     * @desc 渲染画板
     * */
    _renderContainer: function () {
      // 底层文案的canvas
      var dom_txt = this._renderCanvas(
        staticCss.canvas,
        staticCss.className.txt
      );
      this.context_txt = dom_txt[0].getContext('2d');
      // 顶层文案的canvas
      var dom_run = this._renderCanvas(
        staticCss.canvas,
        staticCss.className.run
      );
      this.context_run = dom_run[0].getContext('2d');
      // 配置画板
      this.staticConfig();
    },
    /*
     * func staticConfig
     * @desc 配置画板
     * */
    staticConfig: function () {
      var css = this.config.css;
      // 设置渲染的透明度
      this.context_run.globalAlpha = this.context_txt.globalAlpha = css.opacity;
      // 字体
      this.context_run.font = this.context_txt.font = css.fontSize + "px "+ css.fontFamily;
      // 字体颜色
      this.context_run.fillStyle = css.color;
      this.context_txt.fillStyle = css.highLightColor;
      // 阴影
      this.context_run.shadowOffsetX = this.context_txt.shadowOffsetX = css.shadowOffsetX || 0;
      this.context_run.shadowOffsetY = this.context_txt.shadowOffsetY = css.shadowOffsetY || 0;
      this.context_run.shadowBlur = this.context_txt.shadowBlur = css.shadowBlur;
      this.context_run.shadowColor = css.shadowColor;
    },
    /*
     * func _renderCanvas
     * @desc 渲染画板
     * */
    _renderCanvas: function (canvasCss, className) {
      var cf = this.config;
      var h = cf.css.lineHeight*cf.lyricRows;
      if(!this.$wrap){
        this.$wrap = $('<div>').css(staticCss.wrap_outer).width(cf.css.width).attr('class', staticCss.className.wrap);
        this.$wrap_inner = $('<div>').appendTo(this.$wrap).css({position: 'relative', width:staticCss.canvas.width, height: h});
        $(cf.view).append(this.$wrap);
      }
      this.$wrap_inner.append(
        "<canvas class='"+className+"' height='"+h+"px' width='"+canvasCss.width+"px'></canvas>"
      );
      return this.$wrap_inner.find('.'+className).css(canvasCss);
    },
  };

  return LyricPlay;
});
