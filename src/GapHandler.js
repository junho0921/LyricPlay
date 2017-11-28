/**
 * Created by jun.ho on 2017/11/25.
 */

/*
 * class GapHandler
 * @desc 间隔工具, 优先使用浏览器的api：requestAnimationFrame, 往下兼容使用setTimeout
 * @param callback [function] 间隔回调函数，必须
 * @param time [number] 间隔时间，配置了就使用浏览器定时器，没有配置就是用rAF
 * */
function GapHandler (config){
  // 配置间隔
  this.loopGap = config.loopGap;
  // callback执行的上下文
  this.context = config.context;
  // 间隔工具记录
  this.timer = {
    loopPoint: null,
    loop: this.MARK_NONE,
    timeout: null,
  };
  if(this.rAF){
    this.nextGap = this.loopByRAF;
  }else{
    this.nextGap = this.loopByTimeout;
  }
  return this;
}
GapHandler.prototype = {
  rAF: window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame,
  MARK_LOOP: 'rafLoop',
  MARK_NONE: 'stop',
  isNoLoop: function () {
    return this.timer.loop === this.MARK_NONE;
  },
  hasLoopCallback: function () {
    return window.$.isFunction(this.loopCallback);
  },
  isInLoopGap: function () {
    return (Date.now() - this.timer.loopPoint) < this.loopGap;
  },
  isRunCallback: function (callback) {
    return callback && !callback.isStop;
  },
  loopByRAF: function (callback) {
    if(this.hasLoopCallback()){return false;}
    return this._loopByRAF_repeat(callback);
  },
  _loopByRAF_repeat: function (callback) {
    // 缓存callback
    this.loopCallback = callback;
    return this.rAF.apply(window, [this.loopCB_rAF(callback)]);
  },
  loopByTimeout: function (callback) {
    if(!this.isNoLoop()){return false;}
    return this.timer.loop = setTimeout(this.loopCB_timeout(callback), this.loopGap);
  },
  loopCB_timeout: function (cb) {
    var _this = this;
    return function () {
      // 清理标记
      _this.timer.loop = _this.MARK_NONE;
      return cb.apply(_this.context, []);
    }
  },
  loopCB_rAF: function (callback) {
    var _this = this;
    return function () {
      // 清理标记
      var isStop = !_this.isRunCallback(callback);
      if (isStop) {
        console.error('终止了');
        callback.isStop = false;
        return false;
      } else {
        if (_this.isInLoopGap()) {
          // 间距太短
          return _this._loopByRAF_repeat(callback);
        }else{
          var now = Date.now();
          _this.timer.loopPoint = now;
          _this.loopCallback = null;
          return callback.apply(_this.context, [now]);
        }
      }
    };
  },
  setTimeout: function (callback, time, context) {
    context = context || this.context;
    var _this = this;
    function cb() {
      _this.clearTimeout();
      return callback.apply(context, []);
    }
    return this.timer.timeout = setTimeout(cb, time);
  },
  clearTimeout: function () {
    if (this.timer.timeout) {
      window.clearTimeout(this.timer.timeout);
    }
    this.timer.timeout = null;
  },
  /*
   * 外部主动关闭loop的方法
   * */
  clearLoop: function () {
    // 清理定时器
    if(!this.rAF && this.timer.loop){
      window.clearTimeout(this.timer.loop);
    }
    if(this.hasLoopCallback()){
      this.loopCallback.isStop = true;
    }
    this.loopCallback = null;
    // 标记loop为null用于阻止rAF
    this.timer.loop = this.MARK_NONE;
  },
  /*
   * 外部主动关闭所有间隔工具方法
   * */
  clear: function () {
    this.clearLoop();
    this.clearTimeout();
  }
};
