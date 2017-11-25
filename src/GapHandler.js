/**
 * Created by Administrator on 2017/11/25.
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
  console.log('loopGap', this.loopGap)
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
  isInLoopGap: function () {
    console.warn(this.loopGap, Date.now() - this.timer.loopPoint);
    return (Date.now() - this.timer.loopPoint) < this.loopGap;
  },
  isRunLoopCallback: function () {
    return this.timer.loop !== this.MARK_LOOP;
  },
  loopByRAF: function (callback) {
    if(!this.isNoLoop()){return false;}
    // 记录
    this.timer.loop = this.MARK_LOOP;
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
  loopCB_rAF: function (cb) {
    var _this = this;
    return function () {
      var isStop = _this.isRunLoopCallback();
      // 清理标记
      _this.timer.loop = _this.MARK_NONE;
      if (isStop) {
        return false;
      } else {
        if (_this.isInLoopGap()) {
          // 间距太短
          return _this.loopByRAF(cb);
        }else{
          var now = Date.now();
          _this.timer.loopPoint = now;
          return cb.apply(_this.context, [now]);
        }
      }
    }
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
    // 标记loop为null用于阻止rAF
    this.timer.loop = this.MARK_NONE;
    // 清理定时器
    if(!this.rAF && this.timer.loop){
      window.clearTimeout(this.timer.loop);
    }
  },
  /*
   * 外部主动关闭所有间隔工具方法
   * */
  clear: function () {
    this.clearLoop();
    this.clearTimeout();
  }
};
