/**
 * 全站背景：彩色粒子水平飘移（2026-09-14 站主要求：先要纯白，随后改为彩色）
 *
 * 替代原来两套粒子：
 *   - 主题 universe（dark.js）：淡黄方块 + 蓝紫大星 + 白色彗星，向上斜飘且闪烁，多色
 *   - canvas_nest：绿色粒子连线（78,154,78），带连线
 * 现在：彩色圆点、水平横向匀速飘移，每个粒子从调色板随机取一色并固定保持。
 *
 * 关键实现点：
 *   - canvas position:fixed inset:0，z-index:-1，与正文/头图层(z:0)保持原有层级关系
 *   - 从右向左飘（vx 为负），出左边界后从右边界外重新进入，形成"从一边到另一边"的循环
 *   - 垂直方向只做极轻微正弦起伏（不上下乱漂），透明度做轻微呼吸，避免机械感
 *   - 性能：只在 visibilitychange 可见时跑 rAF；粒子数按屏宽自适应并封顶；
 *     绘制用 globalAlpha 复用同一 fillStyle，避免每帧拼字符串
 */
(function () {
  "use strict";
  if (window.__whiteParticles) return;
  window.__whiteParticles = true;

  var TAU = Math.PI * 2;
  var canvas = null;
  var ctx = null;
  var W = 0;
  var H = 0;
  var list = [];
  var rafId = null;

  var isMobile = window.matchMedia("(max-width: 768px)").matches;
  // 尊重系统"减少动态效果"偏好：不渲染任何粒子
  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 彩色粒子调色板（2026-09-14 站主要求"改成彩色粒子"）：随主题两套，
  // 保证在对应背景上都清晰 —— 黑底用亮色系，白底用深色系；均低-中饱和不刺眼
  var PALETTE_DARK = ["#7ec8f0", "#8fd694", "#f0cf7a", "#c3a6f7", "#f2a2b8", "#7fe3d4"];
  var PALETTE_LIGHT = ["#2f7fc4", "#2e8b57", "#b8860b", "#7a4fbf", "#c2456a", "#0e7c86"];

  var palette = PALETTE_DARK;

  function pickColor() {
    return palette[Math.floor(Math.random() * palette.length)];
  }

  function currentTheme() {
    var t =
      (document.documentElement && document.documentElement.getAttribute("data-theme")) ||
      (document.body && document.body.getAttribute("data-theme"));
    return t || "";
  }

  // 按当前主题切换调色板；已在场粒子重新着色，主题切换后立即生效
  function syncPalette() {
    palette = currentTheme() === "light" ? PALETTE_LIGHT : PALETTE_DARK;
    for (var i = 0; i < list.length; i++) {
      list[i].color = pickColor();
    }
  }

  // 主题切换（html[data-theme] 变化）时即时换色，不用刷新页面
  function watchThemeChange() {
    if (!window.MutationObserver) return;
    var obs = new MutationObserver(syncPalette);
    var opts = { attributes: true, attributeFilter: ["data-theme"] };
    obs.observe(document.documentElement, opts);
    if (document.body) obs.observe(document.body, opts);
  }

  function particleCount() {
    var base = Math.round(window.innerWidth / 11); // 1440 → 131
    base = Math.min(base, 140);
    return isMobile ? Math.max(24, Math.round(base * 0.5)) : Math.max(40, base);
  }

  function reset(p, initial) {
    p.r = 0.8 + Math.random() * 1.2; // 半径 0.8 ~ 2.0（"普通"的小点）
    p.y0 = Math.random() * H; // 基准水平线
    p.x = initial ? Math.random() * W : W + 8 + Math.random() * 60; // 从右侧外进入
    p.vx = -(0.15 + Math.random() * 0.3); // 0.15 ~ 0.45 px/帧，从右向左
    p.base = 0.2 + Math.random() * 0.5; // 透明度基准 0.2 ~ 0.7
    p.breathe = 0.1 + Math.random() * 0.22; // 呼吸幅度
    p.phase = Math.random() * TAU; // 呼吸相位
    p.sway = 3 + Math.random() * 9; // 垂直起伏幅度 3 ~ 12px（很轻微）
    p.swayPhase = Math.random() * TAU;
    p.swayFreq = 0.004 + Math.random() * 0.008;
    p.color = pickColor(); // 彩色：每个粒子固定一色（出界重生时重新抽色）
  }

  function build() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 高清屏下按 CSS 像素绘制

    var n = particleCount();
    list.length = 0;
    for (var i = 0; i < n; i++) {
      var p = {};
      reset(p, true);
      p.y0 = Math.random() * H;
      list.push(p);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < list.length; i++) {
      var p = list[i];

      // 水平飘移 + 出界循环
      p.x += p.vx;
      if (p.x < -10) reset(p, false);

      // 垂直：绕基准线极轻微起伏
      p.swayPhase += p.swayFreq;
      var y = p.y0 + Math.sin(p.swayPhase) * p.sway;
      if (y < -10) y = -10;
      if (y > H + 10) y = H + 10;

      // 透明度呼吸：0.08 ~ 0.9
      p.phase += 0.012;
      var a = p.base + Math.sin(p.phase) * p.breathe;
      if (a < 0.08) a = 0.08;
      else if (a > 0.9) a = 0.9;

      ctx.globalAlpha = a;
      ctx.fillStyle = p.color; // 彩色粒子：每粒子一色（值为常量字符串引用，解析开销可忽略）
      ctx.beginPath();
      ctx.arc(p.x, y, p.r, 0, TAU, false);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function loop() {
    draw();
    rafId = window.requestAnimationFrame(loop);
  }

  function start() {
    if (rafId !== null) return;
    if (document.hidden) return;
    loop();
  }

  function stop() {
    if (rafId === null) return;
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }

  function init() {
    if (reduceMotion) return; // 用户禁用了动效：不加任何粒子层

    canvas = document.createElement("canvas");
    canvas.id = "white-particles";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;" +
      "z-index:-1;pointer-events:none;";
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    if (!ctx) return;

    syncPalette(); // 先定调色板（暗色亮彩 / 浅色深彩），build 时粒子据此着色
    build();
    watchThemeChange(); // 点右下角主题按钮切换时即时换调色板并重着色
    start();

    // 标签页切到后台时停掉 rAF（省电、防 Mac 发热）
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else start();
    });

    // 尺寸变化：防抖重建（阈值过滤地址栏收缩这类微抖动）
    var lastW = W;
    var lastH = H;
    var timer = null;
    window.addEventListener("resize", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (Math.abs(window.innerWidth - lastW) < 2 && Math.abs(window.innerHeight - lastH) < 80) return;
        isMobile = window.matchMedia("(max-width: 768px)").matches;
        build();
        lastW = W;
        lastH = H;
      }, 300);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
