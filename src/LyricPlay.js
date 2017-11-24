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
  var rAF =  window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame;
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
    return this;
  };

  LyricPlay.prototype = {
    // 触发生命周期钩子的工具
    trigger: trigger,
    // 初始化
    _init: function (config) {
      // 构建记忆缓存
      this.memo = {
        timer: null,   // 定时器
        rAF: 0,        // rAF
        renderPoint: 0 // 渲染的时间戳
      };
      // 配置
      this.config = $.extend(true, {}, _config, config);

      this.runIndex = Math.round((this.config.lyricRows-1) / 2);

      // 配置间隔
      this.animationGap = Math.floor(1000 / this.config.frames);
      // 初始化歌曲缓存
      this.song = {rows:{}};
      // 创建歌词播放DOM与canvas
      this._renderContainer();
    },
    _loop: function (callback, time) {
      var _this = this;
      function cb () {
        var isStop = isNaN(time) && rAF && _this.memo.rAF!==1;
        _this._clearTimer();
        if(isStop){
          return false;
        }else{
          callback.apply(_this, []);
        }
      }
      if(time){
        return this.memo.timer = setTimeout(cb, time);
      }else{
        if(rAF){
          this.memo.rAF = 1;
          return rAF.apply(window, [cb]);
        }else{
          return this.memo.timer = setTimeout(cb, this.animationGap);
        }
      }
    },
    _clearTimer: function () {
      this.memo.rAF = 0;
      if(this.memo.timer){
        window.clearTimeout(this.memo.timer);
      }
      this.memo.timer = null;
    },
    hide: function () {
      this._clearTimer();
      this.$wrap.hide();
      this.clearRect();
    },
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
    _calcWordWidth: function (word) {
      return this.context_txt.measureText(word).width;
    },
    cacheData: function (song) {
      // 记录播放的初始数据, 用于控制播放的精准度
      this.memo.initPosition = +song.position;
      this.memo.initRenderTime = Date.now();

      this.song.currentRowIndex = +song.currentRowIndex;
      this.song.currentWordIndex = +song.currentWordIndex;
      var rows = this.song.rows;
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
    },
    // 创建并缓存歌词播放信息的Message实例
    render: function (song) {
      this.cacheData(song);
      // 清理定时器
      this._clearTimer();
      // todo 测试使用
      this.test = this.test || {};
      this.test.initRowIndex = this.song.currentRowIndex;

      if(this.getCurrentRow()){
        this.test.changRowGap = Date.now();
        this.triggerPaint();
      }
    },
    getCurrentRow: function(){
      return this.song.rows[this.song.currentRowIndex];
    },
    calcPos: function () {
      var
        _this = this,
        row = this.getCurrentRow(),
        sum = 0;
      if(row.posAry){return false;}
      row.posAry = [];
      row.strAry = '';
      row.content.forEach(function (word, i) {
        sum += _this._calcWordWidth(word.str);
        row.posAry[i] = sum;
        row.strAry += word.str;
      });
    },
    triggerPaint: function () {
      var row = this.getCurrentRow();
      if(row){
        if(!row.posAry){
          this.calcPos();
        }
        if(row.posAry){
          this.handlerByGap(function () {
            console.warn('渲染底层');
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
      return this.memo.position = Date.now() - this.memo.initRenderTime + this.memo.initPosition;
    },
    handlerByGap: function (beforeRender) {
      var currentWith = this.getCurrentWidth();

      if(!isNaN(currentWith)){
        beforeRender && beforeRender.apply(this, []);
        this.setCurrentWidth(currentWith);
        return this._loop(this._every);
      }else{
        var st = currentWith;
        switch (st.status){
          case 'wait':
            console.error('wait', st);
            this.setCurrentWidth(this.getCurrentRow().posAry[this.getCurrentRow().posAry.length-1]);
            this._loop(this.nextRow, st.wait);
            break;
          case 'end':
            console.error('end', this.config.remainTime - st.overGap);
            this._loop(this.hide, this.config.remainTime - st.overGap);
            break;
          case 'next':
            console.error('next', st);
            return this.nextRow();
            break;
        }
      }
    },
    _every: function () {
      var renderGap = Date.now() - this.memo.renderPoint;
      if(renderGap > 3000){
        alert('比较多了')
      }
      if(renderGap < this.animationGap){
        // 间距太短
        return this._loop(this._every);
      }
      return this.handlerByGap();
    },
    nextRow: function () {
      // 换行 todo 收到数时, 检查是否有换行的数据
      var now = Date.now();
      console.warn('-------test.changRowGap----------', now - this.test.changRowGap);
      this.test.changRowGap = now;
      // 调整状态
      this.song.currentRowIndex++;
      this.song.currentWordIndex = 0;
      // 重新渲染run长度为零
      var row = this.getCurrentRow();

      // todo 测试代码, 可以作为精准歌词的参考
      var idealTime = row.startPoint - this.memo.initPosition;
      var truthTime = now - this.memo.initRenderTime;
      console.log('理论的本行与初始的间距', idealTime);
      console.log('实际的本行与初始的间距', truthTime);
      console.log('相差', truthTime - idealTime);

      if(row){
        this.triggerPaint();
      }else{
        this.triggerEnd();
      }
    },
    triggerEnd: function () {
      console.error('end');
    },
    _adjustCanvasPos: function (currentWith) {
      var overLeft = currentWith + this.config.paddingRight - this.config.css.width;
      if(overLeft > 0){
        this.$wrap_inner.css('left', -overLeft);
      }
    },
    setCurrentWidth: function (currentWith) {
      // 渲染的时候记录渲染时间戳, 这个时间戳很重要
      this.memo.renderPoint = Date.now();
      // 记录位置
      this.memo.width = currentWith;
      /*side-effect: 渲染页面*/
      // 调整位置
      this._adjustCanvasPos(currentWith);
      // 渲染长度
      var lh = this.config.css.lineHeight;
      try{
        console.log('渲染', this.song.rows[this.song.currentRowIndex].content[this.song.currentWordIndex].str);
      }catch (e){}
      this.context_run.clearRect(0, lh * this.runIndex, currentWith, lh);
    },
    getCurrentWidth: function () {
      var
        song = this.song,
        row = this.getCurrentRow(),
        onShowWord = row.content[song.currentWordIndex],
        onShowWordWith = row.posAry[song.currentWordIndex] - (row.posAry[song.currentWordIndex-1] || 0),
        wordRemainTime = (onShowWord.startPoint + onShowWord.duration + row.startPoint) - this._getPos();

      if(wordRemainTime>0){
        return row.posAry[song.currentWordIndex] - (wordRemainTime / onShowWord.duration * onShowWordWith)
      }else{
        song.currentWordIndex++;
        if(row.content[song.currentWordIndex]){
          return this.getCurrentWidth();
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
    paintTxt: function () {
      this.clearRect();
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
    _getTxt: function (row) {
      if(!row){
        return null;
      }else{
        if(row.strAry){
          return row.strAry;
        }else{
          return row.strAry = row.content.map(function(w){return w.str;}).join('');
        }
      }
    },
    _drawTxt: function (txt, i) {
      i = i+1;
      if(!txt){return false;}
      var lH = this.config.css.lineHeight;
      var fixH = (lH - this.config.css.fontSize) / 2;
      this.context_txt.fillText(txt, 0, (lH * i) - fixH);
      if(i >= this.runIndex+1){
        this.context_run.fillText(txt, 0, (lH * i) - fixH);
      }
    },
    clearRect: function () {
      var h = this.config.css.lineHeight * this.config.lyricRows;
      this.context_txt.clearRect(0, 0, staticCss.canvas.width, h);
      this.context_run.clearRect(0, 0, staticCss.canvas.width, h);
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
  };

  return LyricPlay;
});
