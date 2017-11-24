(function(factory){
  'use strict';
  var isDefined = false;

  if(typeof define === 'function'){
    define('FlyMsg', factory);
    isDefined = true;
  }

  if(typeof fxDefine === 'function'){
    fxDefine('FlyMsg', factory);
    isDefined = true;
  }

  if(!isDefined){
    window.FlyMsg = factory();
  }

})(function() {
  'use strict';
  /*
    * 继续优化点: 添加staticCanvasConfig
    * */
  var
    Ie9 =  !!document.all && /msie 9.0/gi.test(window.navigator.appVersion),
    Ie10 =  !!document.all && /msie 10.0/gi.test(window.navigator.appVersion),
    isLessShadow = (Ie9 || Ie10), // ie9与ie10采用降级方案: 更少的文字阴影
    animationGap = Math.floor(1000 / 60), // 理想的每帧动画间隔
    _loop = (function(){
      return  window.requestAnimationFrame   ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame    ||
        function( callback ){
          window.setTimeout(callback, animationGap);
        };
    })();
  function isVal (value) {return value === 0 || !!value;}
  // 触发生命周期钩子的工具
  function trigger (type, arg) {
    var handler = this[type];
    if(typeof handler === 'function'){
      handler.apply(this, arg);
    }
  }
  // 加载图片的方法
  function renderImg (url) {
    var img = new Image();
    img.src = url;
    return img;
  }
  // 本排版方法只适用于繁星飞屏格式, 不通用
  function typesetting (css, str, ctx, imgWrapMark) {
    var
      lineWordsAry = [],
      lineWidth = 0,
      lineWords = '',
      imgOuterWidth = css.imgWidth + css.imgPadding*2;

    // 设置画板的字体为本msg的配置, 用于计算本msg的字体大小
    ctx.font = css.fontSize + "px " + css.fontFamily;
    css.wordWidth = ctx.measureText('汉').width;
    var spaceWord = '', imgGapWord = ' ';
    var spaceGap = ctx.measureText(imgGapWord).width;
    var imgGapWordNum = Math.round(imgOuterWidth /spaceGap);
    while (imgGapWordNum--){
      spaceWord += imgGapWord;
    }

    function pushLine () {
      lineWordsAry.push(lineWords);
      // 预留头像的空间
      lineWidth = css.isRemainPreGap ? imgOuterWidth : 0;
      lineWords = '';
    }

    var strParts = str.split('|');
    var imgAry = [];
    strParts.forEach(function (str) {
      var matchImg = str.match(imgWrapMark);
      if(matchImg){
        if(css.width - lineWidth < imgOuterWidth){
          pushLine();
        }
        var
          imgDOM = renderImg(matchImg[1]),
          data = {
            relativeX: lineWidth,
            relativeY: lineWordsAry.length * css.lineHeight,
            dom: null
          };
        imgDOM.onload = function () {data.dom = imgDOM;};

        imgAry.push(data);
        // 占位符: 以计算出符合图片尺寸的数个空格
        lineWords += spaceWord;
        // 本行长度加上图片宽度
        lineWidth += imgOuterWidth;
        // 缓存图片DOM与其渲染相对位置
      }else{
        for(var x = 0; x < str.length; x++){
          // 超过长度的话, 换行
          var thisWordWidth;
          if(str.charCodeAt(x) > 128){
            thisWordWidth = css.wordWidth;
          }else{
            thisWordWidth = ctx.measureText(str[x]).width;
          }
          if(css.width - lineWidth < thisWordWidth){
            pushLine();
          }
          lineWidth+= thisWordWidth;
          lineWords += str[x];
        }
      }
    });
    pushLine();
    return {
      imgAry: imgAry,
      lineWords: lineWordsAry
    };
  }

  var _config = {
    view: 'body', // 生成飞屏canvas所在的容器
    containerClass: 'flyMsg', // 飞屏的类名
    duration:{
      slideUp: 1000 * 0.4　// 滑上去的过渡时间
    },
    containerCss:{ // 飞屏canvas的尺寸与样式设置
      height: 300,
      width: 1080,
      left: 100,
      top: 0,
      position: 'absolute',
      zIndex: 3002,
      pointerEvents: 'none'
    },
    msgCss:{  // 飞屏信息尺寸与样式设置
      width: 584, // 消息宽度
      fontSize: 30,// 字体大小 px
      lineHeight: 40, // 行距 px
      right:0, // 位置, 默认是靠右
      bottom:0, // 位置, 默认是靠底部
      color: '#fff', // 字体颜色
      opacity: 0.01, // 消息透明度, 初始是透明, 但不能为0
      fontFamily: 'Microsoft YaHei',
      shadowBlur: isLessShadow ? 2: 10,
      imgWidth: 40, // 飞屏图片的尺寸
      imgHeight: 40, // 飞屏图片的尺寸
      imgPadding: 4, // 飞屏图片的间距
    },
    msgAnimation:[
      {type:'transition', duration: 1000 * 1.3, css:{left:0, opacity:1}}, // 从左滑入
      {type:'transition', duration: 1000 * 1.1, css:{left:126}}, // 从左滑入后回滚
      {type:'wait', duration: 1000 * 10}, // 内容的展示时间
      {type:'transition', duration: 1000 * 1.2, css:{opacity:0}}, // 内容消失
    ],
    style:{
      fontColor: '#fff',
      flag_0: '#FF005F', // 配置0: 普通
      flag_1: '#00D7E6', // 配置1: 守护
      flag_2: '#CD4A00', // 配置2: 普通VIP
      flag_3: '#5600FF', // 配置3: 白金VIP
    },
    imgWrapMark: /^<(.+)>$/,
  };
  var _msgId = 1; // 飞屏信息的内部id
  // 图片的占位文本, 使用空格, spaceWord会以实际空格的宽度计算出
  var defaultCss = {
    opacity:1,
    lineHeight:0
  };
  function Msg (canvas, contentStr, initCss, imgWrapMark){
    // 内部id
    this._id = _msgId++;
    // 基本配置
    this.ctx = canvas.getContext('2d');
    // 初始化要素
    this.toCSS = {};
    this.speed = {};
    this._nextAnimation = [];
    this.CSS = $.extend({}, defaultCss, initCss);
    // 文本与图片排版
    var re = typesetting(this.CSS, contentStr, this.ctx, imgWrapMark);
    this.lineWords = re.lineWords;
    this.img = re.imgAry;
    this.CSS.height = this.lineWords.length * this.CSS.lineHeight;
    // 修正坐标
    if(!isVal(initCss.left)){
      this.CSS.left = isVal(initCss.right) ? canvas.width - initCss.right: 0;
    }
    if(!isVal(initCss.top)){
      this.CSS.top = isVal(initCss.bottom) ? canvas.height + this.CSS.lineHeight - this.CSS.shadowBlur - this.CSS.height - initCss.bottom:0;
    }
    return this;
  }

  Msg.prototype = {
    trigger: trigger,
    animationTimer: null, // 动画延时器
    /*
        * @func transition
        * @desc 这是公开api, 接受转换的样式并立即执行, 区别于animation的排队机制
        * */
    transition: function (props, duration) {
      if(!duration){
        throw new Error('transition方法必须要传参过渡时间');
      }
      $.extend(this.toCSS, props);
      this._calcSpeed(duration);
      this._loopStep();
    },
    thenAnimate: function (data) {
      this._nextAnimation.push(data);
      return this;
    },
    runAnimation: function () {
      if(this._nextAnimation.length) {
        var  _this = this, newStatus = this._nextAnimation.shift(), lastStatus = this.animationStatus;
        this.animationStatus = newStatus;
        this.trigger('onChangeTransition', [newStatus, lastStatus]);
        switch (newStatus.type){
          case 'transition':
            this.transition(newStatus.css, newStatus.duration);
            break;
          case 'wait':
            this.animationTimer = setTimeout(function () {
              _this.animationTimer = null;
              _this.runAnimation();
            }, newStatus.duration);
            break;
        }
      }else{
        this.animationStatus = 'animationEnd';
        this.trigger('onAnimationEnd');
        return 'noNext';
      }
    },
    _calcSpeed: function (duration) {
      var nowCss = this.CSS,
        toCss = this.toCSS,
        speed = this.speed;
      Object.keys(toCss).forEach(function (key) {
        nowCss[key] = nowCss[key] || 0;
        speed[key] = +((nowCss[key] - toCss[key]) / (duration / animationGap)).toFixed(3);
      });
    },
    _loopStep: function () {
      // 检测状态, 若是已经设置了定时触发就不需要再次调用
      if(this.runningLoop){return false;}
      var _this = this;
      this.paint();
      // 计算出下一次的渲染样式
      var nextCss = this.calcNextCss();
      if(nextCss){
        this.runningLoop = 1;
        return _loop(function () {
          _this.runningLoop = 0;
          // 若有更新, 那么可以清理本飞屏信息的渲染痕迹.
          _this._clearPast();
          // 更新css
          $.extend(_this.CSS, nextCss);
          // 递归
          return _this._loopStep();
        });
      }else{
        this.trigger('transitionEnd');
        // 当完成了样式变化后, 那么检查有没有排队中的动画状态, 进入下一个动画样式变化
        if(this.animationTimer === null){ // 若是设定了动画的延时器, 那么等延时器自己去抽取动画状态执行.
          this.runAnimation();
        }
      }
    },
    calcNextCss: function () {
      var
        nowCss = this.CSS,
        speed = this.speed,
        toCss = this.toCSS,
        newCss = {};
      var isHide = nowCss.opacity <= 0;
      // 若是透明就表示没渲染, 或是休眠状态, 所以, 不需要更新状态
      if(isHide){return false;}

      var isUpdate;
      Object.keys(speed).forEach(function (speedKey) {
        var _speed = speed[speedKey];
        if(_speed === 0) {return;}
        // 样式值累减速度值
        newCss[speedKey] = nowCss[speedKey] - _speed;
        // 当样式值超出目标值, 修正为目标值, 且速度重置为零, 表示下一次不需要更新样式值
        if(
          (_speed > 0 && newCss[speedKey] < toCss[speedKey]) ||
          (_speed < 0 && newCss[speedKey] > toCss[speedKey])
        ){
          speed[speedKey] = 0;
          newCss[speedKey] = toCss[speedKey];
        }
        isUpdate = true;
      });

      return isUpdate && newCss;
    },
    // 清理上一次的本飞屏信息的渲染痕迹, 只清理本信息的
    _clearPast: function () {
      var css = this.CSS,
        clearPosX = css.left - css.shadowBlur,
        clearPosY = css.top - css.lineHeight,
        clearWidth = css.width + css.wordWidth*2,
        clearHeight = css.height+ css.lineHeight*2/3;
      this.ctx.clearRect(clearPosX, clearPosY, clearWidth, clearHeight);
    },
    // 本飞屏消息的渲染方法
    paint: function () {
      var
        nowCss = this.CSS,
        ctx = this.ctx,
        lineHeight = nowCss.lineHeight,
        msgPoxX = nowCss.left,
        msgPoxY = nowCss.top;
      // 设置渲染的透明度
      ctx.globalAlpha = nowCss.opacity < 0 ? 0 : nowCss.opacity;
      // 渲染图片
      if(this.img && this.img.length){
        var msgY = msgPoxY - lineHeight/1.5;
        this.img.forEach(function (imgObj) {
          // 遍历各个图片, 以图片的相对位置+飞屏信息的位置来渲染图片
          if(imgObj.dom){
            ctx.drawImage(imgObj.dom, msgPoxX+imgObj.relativeX, msgY+imgObj.relativeY-nowCss.imgPadding + 3, nowCss.imgWidth, nowCss.imgHeight);
          }
        });
      }
      ctx.save();
      ctx.font = nowCss.fontSize + "px "+ nowCss.fontFamily;
      ctx.fillStyle = nowCss.color;
      ctx.shadowOffsetX = nowCss.shadowOffsetX || 0;
      ctx.shadowOffsetY = nowCss.shadowOffsetY || 0;
      ctx.shadowBlur = nowCss.shadowBlur;
      // 设置阴影颜色
      ctx.shadowColor = nowCss.shadowColor;
      var padding_left = nowCss.isRemainPreGap ? nowCss.imgWidth + nowCss.imgPadding*2 : 0;
      this.lineWords.forEach(function (line, i) {
        var _posX = i > 0 ? msgPoxX + padding_left : msgPoxX;
        ctx.fillText(line, _posX, msgPoxY + i*lineHeight);
      });
      // 恢复之前的状态, 目的是为了清理阴影, 避免影响其他, 只有文字需要阴影
      ctx.restore();
    }
  };

  /**
   * @class FlyMsg
   * @classdesc 飞屏模块
   * @example var fw = new FlyMsg()
   * @param config {Object} 配置: 接受的配置的内容是默认配置对象_config的属性, 请看_config的配置说明
   */
  var FlyMsg = function (config) {
    // 初始化
    this.init(config);
    return this;
  };

  FlyMsg.prototype = {
    _data: null, // 飞屏飞屏信息对象的缓存, 内容是基本的飞屏文本信息
    _msgList:null, // 飞屏信息对象的缓存, 内容是Message的实例
    _isEmitting:false, // 发射状态, 新的飞屏滑进的时候切换为true, 当该飞屏滑入后静止下来切换为false
    // 触发生命周期钩子的工具
    trigger: trigger,
    // 初始化
    init: function (config) {
      // 重置飞屏模块的缓存与状态
      this._reset();
      // 配置
      this.config = $.extend(true, {}, _config, config);
      // 创建飞屏DOM与canvas
      this._renderContainer();
    },
    // 重置飞屏模块的缓存与状态
    _reset: function () {
      this._data = [];
      this._msgList = [];
      this._isEmitting = false;
    },
    _hide: function () {
      this.$wrap.hide();
      this._context.clearRect(0, 0, this.config.containerCss.width, this.config.containerCss.height);
    },
    _renderContainer: function () {
      var _wrap = $('<div>');
      $(this.config.view).append(_wrap);
      var containerCss = this.config.containerCss;
      _wrap.html(
        "<canvas class='"+this.config.containerClass.split('.').join(' ')+"' height='"+containerCss.height+"px' width='"+containerCss.width+"px'></canvas>"
      );
      _wrap.find('canvas').css(containerCss);
      this.$wrap = _wrap;
      // 获取渲染上下文
      this._context = _wrap.find('canvas')[0].getContext('2d');
      this.canvas = _wrap.find('canvas')[0];
    },
    // 创建并缓存飞屏信息的Message实例
    addNewMessage: function (contentStr, level) {
      // 实例化
      var fwConfig = this.config,
        msgConfig = $.extend({}, fwConfig.msgCss);
      msgConfig.isRemainPreGap= level > 1;
      msgConfig.shadowColor= fwConfig.style['flag_'+level];
      var newMsg = new Msg(this.canvas, contentStr, msgConfig, fwConfig.imgWrapMark);

      // 每个已有的飞屏信息提高ｙ轴位置
      this._msgList.forEach(function (msg) {
        msg.transition({
          top: (msg.toCSS.top || msg.CSS.top) - newMsg.CSS.height - newMsg.CSS.lineHeight/2
        }, fwConfig.duration.slideUp);
      });

      // 对于已经超过可视范围的item进行清理
      this._clearCache();

      // 放入新飞屏信息到数据
      this._msgList.push(newMsg);

      this.trigger('onEmitNewMessage', [newMsg]);

      return newMsg;
    },
    // 清理缓存的方法
    _clearCache:function () {
      this._msgList = this._msgList.filter(function(msg){
        // 若是透明或是显示位置不在可视范围, 便可以过滤掉
        var isVisible = msg.CSS.opacity > 0 && msg.CSS.top > - msg.CSS.height;
        return isVisible;
      });
    },
    // 发射飞屏方法
    _emit: function () {
      if(!this._data.length){return false;}
      // 抽取飞屏的基本文本信息
      var msgObj = this._data.shift(), _this = this, config = this.config;
      // 设置状态为发射状态
      this._isEmitting = true;
      // 显示DOM
      this.$wrap.show();
      // 新飞屏滑入静止后的回调
      function afterSlideIn () {
        // 触发飞屏模块的新消息滑入事件
        _this.trigger('afterSlideIn', [msgObj]);
        // 设置状态为非发射状态
        _this._isEmitting = false;
        // 若没有更新了, 那, 继续发射缓存中的飞屏, 因为飞屏的业务逻辑是等新的飞屏滑入静止后才发射下一个新的飞屏
        _this._emit();
      }

      function checkClearAll(){
        // 清理缓存数据
        _this._clearCache();
        // 当没有了数据时, 表示是飞屏模块结束动画了.
        if(!_this._msgList.length){
          _this._hide();
          _this.trigger('onAllAnimationEnd');
        }
      }

      var newMsg = this.addNewMessage(msgObj.contentStr, msgObj.level);

      config.msgAnimation.forEach(function (data) {
        newMsg.thenAnimate(data);
      });

      newMsg.onChangeTransition = function (newStatus, preStatus) {
        if(newStatus.type === 'wait'){
          afterSlideIn();
        }
      };
      newMsg.onAnimationEnd = checkClearAll;
      newMsg.runAnimation();
    },

    /**
     * @func flashFlyScreen
     * @desc 发送飞屏内容的方法
     * @param contentStr {string} 飞屏信息, 必须
     * @param level {number} 飞屏信息对象
     */
    flyScreen: function (contentStr, level){
      // 飞屏信息的格式是这样的: data = "|<http://p3.fx.kgimg.com/v2/fxuserlogo/T1nJKbBKbT1RCvBVdK.jpg_45x45.jpg>|zhusdcet4说:你好.""
      // 飞屏信息是包含图片与文本, 所以需要抽取图片加载与渲染, 给图片预留一定空间渲染
      // 飞屏信息是等级区分显示的文本阴影.
      this._data.push({
        contentStr: contentStr,
        level: level || 0
      });
      // 若飞屏模块正在执行新飞屏信息滑入且还没有结束, 需要等到结束后才能发射, 这是业务逻辑
      if(!this._isEmitting){
        this._emit();
      }
    },
    /**
     * @func clear
     * @desc 清屏方法clear, 可以清理当前的飞屏模块并隐藏起来
     */
    clear: function () {
      this._reset();
      this._hide();
    },
    /**
     * @func onEmitNewMessage
     * @desc 当新的飞屏信息发射时, 触发本方法
     * @param newMsg {Object} 飞屏信息, 是Message的实例
     */
    onEmitNewMessage: null,
    /**
     * @func onAllAnimationEnd
     * @desc 飞屏模块结束所有动画要隐藏canvas时触发本方法
     */
    onAllAnimationEnd: null,
    /**
     * @func afterSlideIn
     * @desc 当新的飞屏信息滑入至静止时, 触发本方法
     * @param newMsg {Object} 飞屏信息, 是Message的实例
     */
    afterSlideIn: null,
    /**
     * @func onError
     * @desc 报错时触发的方法
     * @param errorMsg {String} 报错信息
     */
    onError: null,
  };

  return FlyMsg;
});
