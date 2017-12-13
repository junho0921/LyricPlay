/**
 * Created by jun.ho on 2017/11/25.
 */

/*
 * class GapHandler
 * @desc 间隔工具, 优先使用浏览器的api：requestAnimationFrame, 往下兼容使用setTimeout
 * @param {object} [config] 间隔回调函数，必须
 * @param {number} [config.loopGap] 执行间隔, 配置了就使用浏览器定时器，没有配置就是用rAF
 * @param {object} [config.context] 执行回调函数的上下文
 * 优点:
 * 1, 间隔管理, 可以指定执行间隔
 * 2, 兼容setTimeout
 * 3, 可以清理间隔callback的执行, 有效控制异步回调的执行
 * 4, 统一管理setTimeout与RAF的callback
 * todo
 * 1, 最大等待时间
* */
function GapHandler (config){
  // 配置间隔
  this.loopGap = config.loopGap;
  // callback执行的上下文
  this.context = config.context;
  // 间隔工具记录
  this.timer = {
    loopPoint: null, // 记录loop的实际执行时间点, 用于RAF的间隔控制
    loopTimer: null, // 记录基于setTimeout的loop的定时器ID
    timeout:   null  // 记录基于setTimeout的定时器ID
  };
  if(this.rAF){
    this.nextGap = this.loopByRAF;
    this.clearLoop = this.clearRAFLoop;
  }else{
    this.nextGap = this.loopByTimeout;
    this.clearLoop = this.clearTimeoutLoop;
  }
  return this;
}
GapHandler.prototype = {
  /*raf*/
  rAF: window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame,
  hasLoopCallback: function () {
    // 是否要准备执行的loopCallback
    return typeof this.loopCallback === 'function';
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
    // 缓存准备执行的loopCallback, 用于提供阻止回调执行
    this.loopCallback = callback;
    return this.rAF.apply(window, [this.loopCB_rAF(callback)]);
  },
  loopCB_rAF: function (callback) { // callback通过参数来传递而不是用this.loopCallback, 是因为clear方法可以清空缓存this.loopCallback, 之后nextGap更新loopCallback, 因此不可以使用缓存callback
    var _this = this;
    return function () {
      // 清理标记
      var isStop = !_this.isRunCallback(callback);
      if (isStop) {
        callback.isStop = false;
        return false;
      } else {
        // 判断是否在指定的间隔范围
        if (_this.isInLoopGap()) {
          // 间距太短
          return _this._loopByRAF_repeat(callback);
        }else{
          // 间隔合理, 执行callback, 先记录执行loop的时间戳
          var now = Date.now();
          _this.timer.loopPoint = now;
          // 清理缓存callback, 表示没有准备执行的callback, 提供接收下一个loopCallback的空间
          _this.loopCallback = null;
          return callback.apply(_this.context, [now]);
        }
      }
    };
  },
  clearRAFLoop: function () {
    // 清理loop的方法
    if(this.hasLoopCallback()){
      this.loopCallback.isStop = true; // 标记此函数是要停止的, 这样可以在执行callback前获取此状态
    }
    this.loopCallback = null;
  },
  /*setTimeout_loop*/
  isNoLoop: function () {
    return this.timer.loopTimer === null;
  },
  loopByTimeout: function (callback) {
    if(!this.isNoLoop()){return false;}
    return this.timer.loopTimer = setTimeout(this.loopCB_timeout(callback), this.loopGap);
  },
  loopCB_timeout: function (cb) {
    var _this = this;
    return function () {
      // 清理标记
      _this.timer.loopTimer = null;
      return cb.apply(_this.context, []);
    }
  },
  clearTimeoutLoop: function () {
    // 清理loop的方法
    if (this.timer.loopTimer) {
      window.clearTimeout(this.timer.loopTimer);
    }
    this.timer.loopTimer = null;
  },
  /*setTimeout*/
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
   * 外部主动关闭所有间隔工具方法
   * */
  clear: function () {
    this.clearLoop();
    this.clearTimeout();
  }
};
