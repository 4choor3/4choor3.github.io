/**
 * 圆形扩散主题切换（View Transitions API）
 * 以点击点为圆心 clip-path circle 扩散切换日夜主题；不支持 VT 或用户开启
 * prefers-reduced-motion 时降级为瞬时切换。效果参考 rle.wiki，已规避其
 * 线上「切换结束白闪一帧」bug（动画必须 fill:"forwards"）。
 * 拦截 4 个主题切换触发点：#darkmode（右侧按钮委托）、#menu-darkmode（右键菜单）、
 * .darkmode_switchbutton（sidebar / console）。
 */
(function () {
  'use strict';
  var root = document.documentElement;
  var px = window.innerWidth / 2, py = window.innerHeight / 2;

  function supportsVt() {
    return 'startViewTransition' in document
      && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
  }

  window.addEventListener('pointerdown', function (e) {
    px = e.clientX; py = e.clientY;
  }, { capture: true, passive: true });

  // 应用主题并复刻主题原逻辑（activate* 为 head 内联全局函数）
  function applyAndPersist(nextDark) {
    if (nextDark) activateDarkMode(); else activateLightMode();
    try { saveToLocal.set('theme', nextDark ? 'dark' : 'light', 2); } catch (e) {}
    if (typeof handleThemeChange === 'function') { try { handleThemeChange(); } catch (e) {} }
  }

  window.circularThemeSwitch = function () {
    var nextDark = root.getAttribute('data-theme') !== 'dark';
    // preloader（#loading-box）在 window.load 触发前一直显示，VT 快照会拍到它的
    // 全屏遮罩（浅色下是 card-bg 白色 → 看起来「除了头像框外面全白」）。
    // 这里提前走主题自己的隐藏路径，并跳掉遮罩 0.2s 淡出，保证快照是真实页面。
    try {
      var lb = document.getElementById('loading-box');
      if (lb && !lb.classList.contains('loaded')) {
        lb.classList.add('loaded');
        var lbBg = lb.querySelector('.loading-bg');
        if (lbBg) lbBg.style.transition = 'none';
      }
    } catch (e) {}
    if (!supportsVt()) { applyAndPersist(nextDark); return true; }  // 降级：拦截层已阻断原逻辑，必须自己完成切换

    var x = px, y = py;
    var endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    var clip = ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + endRadius + 'px at ' + x + 'px ' + y + 'px)'];

    var t = document.startViewTransition(function () {
      root.classList.add('vt-no-transition');
      applyAndPersist(nextDark);
    });
    t.ready.then(function () {
      // 始终对 new(root) 做圆形展开：View Transition 中 new 视图默认堆叠在 old 之上，
      // 只有裁剪 new 才能让圈外继续显示 old（旧主题色）。之前 dark→light 方向错误地只动画
      // old(root) 反向收缩，new(light 白) 未被裁剪且浮在上层，导致圈外直接露出白色。
      // 统一对 new 从点击点由小圆展开到大圆，无论 dark→light 还是 light→dark 都正确。
      root.animate(
        { clipPath: clip },
        { duration: 500, easing: 'ease-in', fill: 'forwards',
          pseudoElement: '::view-transition-new(root)' }
      );
    });
    t.finished.finally(function () { root.classList.remove('vt-no-transition'); }).catch(function () {});
    return true;
  };

  document.addEventListener('click', function (e) {
    if (!(e.target && e.target.closest && e.target.closest('#darkmode, #menu-darkmode, .darkmode_switchbutton'))) return;
    e.preventDefault();
    e.stopPropagation();  // capture 阶段阻断主题委托（#rightside bubble）与直接绑定
    window.circularThemeSwitch();
  }, true);
})();
