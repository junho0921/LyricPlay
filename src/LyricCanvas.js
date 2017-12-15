/**
 * Created by jun.ho on 2017/11/26.
 */
// 固定配置
var staticCss = {
  wrap_outer: {
    overflow:'hidden'
  },
  wrap_inner: {
    position: 'relative',
    width:'auto'
  },
  canvas:{
    position: 'absolute',
    width: 900,
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
var defaultHeight = 40;
var defaultRows = 1;
var _canvasConfig = {
  view: 'body',     // 生成歌词播放canvas所在的容器
  rows: 1,          // 显示歌词行数
  height: null,     // 歌词画板高度, 默认没有值, 通过lightHeight与rows计算得出
  width: 500,       // 歌词画板宽度
  lineHeight: 22,   // 歌词行高
  fontSize: 16,     // 歌词字体大小
  opacity: 1,       // 歌词显示透明度
  color: '#999',    // 歌词颜色
  highLightColor: '#0C7',        // 歌词高亮颜色
  fontFamily: 'Microsoft YaHei', // 歌词字体类型
  paddingRight: 40, // 歌词显示的最右边距
  /*阴影*/
  shadowBlur: 3,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowColor: '#fff'
};

/*
 * 歌词画板方法，与song数据结构无关，只关心渲染的字符与进度条宽度
 * */
function LyricCanvas(config){
  // 构建配置
  this.config = $.extend({}, _canvasConfig, config);
  this.config.height = this.config.height || (this.config.lineHeight * this.config.rows) || defaultHeight;
  this.config.rows = this.config.rows || Math.floor(this.config.height / this.config.lineHeight) || defaultRows;
  // 创建缓存, 用于优化重复渲染
  this.memo = {runningIndex:0, currentWith:0, lyrics:[]};
  // 创建歌词播放DOM与canvas
  this._renderContainer();
  return this;
}
LyricCanvas.prototype = {
  /*
   * func hide
   * @desc 隐藏画板
   * */
  clear: function () {
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
    var overLeft = currentWith + this.config.paddingRight - this.config.width;
    if(overLeft > 0){
      this.$wrap_inner.css('left', -overLeft);
    }
  },
  /*
   * func draw
   * @desc 渲染进度条方法
   * @param currentWith [number] 当前的进度宽度
   * */
  draw: function (lyrics, runningIndex, currentWith) {
    // 判断是否需要重新渲染
    if(this.isNeedRePaint(lyrics, runningIndex, currentWith)){
      // 渲染歌词文案
      this.paintLyric(lyrics, runningIndex);
    }
    // 渲染歌词播放进度
    this.paintProgress(runningIndex, currentWith);
  },
  /*
   * func paintProgress
   * 渲染歌词播发进度方法
   * */
  paintProgress: function (runningIndex, currentWith) {
    // 调整位置, 让当前进度可以出现在可视范围
    this._adjustCanvasPos(currentWith);
    // 渲染长度
    var lh = this.config.lineHeight;
    this.context_run.clearRect(0, lh * runningIndex, currentWith, lh);
    // 存储已经渲染的状态
    this.memo.currentWith = currentWith;
  },
  /*
  * 调整画板的显示宽度
  * */
  resize: function (config) {
    this.config.width = config.width || this.config.width;
    this.config.height = config.height || this.config.height;
    this.resizeCanvas();
  },
  resizeCanvas: function () {
    this.$wrap.width(this.config.width);
    this.$wrap_inner.height(this.config.height);
  },
  /*
   * func isNeedRePaint
   * 判断是否需要重新渲染
   * */
  isNeedRePaint: function (lyrics, runningIndex, currentWith) {
    var changeIndex = this.memo.runningIndex !== runningIndex;
    var changeProgress = this.memo.currentWith > currentWith;
    var changeLyrics = this.memo.lyrics !== lyrics;
    return changeLyrics || changeProgress || changeIndex;
  },
  /*
   * func _clearRect
   * @desc 清理画板方法
   * */
  _clearRect: function () {
    this.context_txt.clearRect(0, 0, staticCss.canvas.width, this.config.height);
    this.context_run.clearRect(0, 0, staticCss.canvas.width, this.config.height);
  },
  /*
   * func _drawTxt
   * @desc 渲染歌词方法，有两层歌词重叠作为进度显示的实现基础
   * @param txt 渲染的歌词文本
   * @param i 渲染的歌句索引值
   * */
  _drawTxt: function (txt, i, runningIndex) {
    i = i+1;
    if(!txt){return false;}
    var lH = this.config.lineHeight;
    var fixH = (lH - this.config.fontSize) / 2;
    this.context_txt.fillText(txt, 0, (lH * i) - fixH);
    if(i >= runningIndex+1){
      this.context_run.fillText(txt, 0, (lH * i) - fixH);
    }
  },
  /*
   * func _renderContainer
   * @desc 渲染画板
   * */
  _renderContainer: function () {
    // 底层文案的canvas
    var dom_txt = this._renderCanvas(staticCss.className.txt);
    this.context_txt = dom_txt[0].getContext('2d');
    // 顶层文案的canvas
    var dom_run = this._renderCanvas(staticCss.className.run);
    this.context_run = dom_run[0].getContext('2d');
    // 配置画板
    this.staticConfig();
  },
  /*
   * func staticConfig
   * @desc 配置画板
   * */
  staticConfig: function () {
    var css = this.config;
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
  _renderCanvas: function (className) {
    var cf = this.config;
    var canvasCss = staticCss.canvas;
    if(!this.$wrap){
      this.$wrap = $('<div>').css(staticCss.wrap_outer).attr('class', staticCss.className.wrap);
      this.$wrap_inner = $('<div>').appendTo(this.$wrap).css(staticCss.wrap_inner);
      this.resizeCanvas();
      $(cf.view).append(this.$wrap);
    }
    this.$wrap_inner.append(
      "<canvas class='"+className+"' height='"+cf.height+"px' width='"+canvasCss.width+"px'></canvas>"
    );
    return this.$wrap_inner.find('.'+className).css(canvasCss);
  },
  /*
   * 渲染歌词
   * */
  paintLyric: function(lyrics, runningIndex){
    this.$wrap.show();
    this.$wrap_inner.css('left', 0);
    this._clearRect();
    for(var i = 0, len = lyrics.length; i < len; i++){
      this._drawTxt(lyrics[i], i, runningIndex);
    }
    // 存储已经渲染的状态
    this.memo.runningIndex = runningIndex;
    this.memo.lyrics = lyrics;
  }
};
