/**
 * 右侧「字体」切换按钮（2026-09-15 站主要求）
 *
 * 位置：右侧可隐藏按钮组（#rightside-config-hide）内、繁体切换按钮（#translateLink）正上方。
 * 功能：点击弹出 5 档字体面板，选定后全站正文生效，写入 localStorage 持久化。
 *
 * 五档：宋体 / 默认 / 楷体 / 圆体 / 霞鹜文楷（顺序即站主指定的顺序）
 *   -「默认」= 系统无衬线（苹方 / 微软雅黑），即加本功能之前站点的实际观感。
 *     必须显式声明并排除 LXGW WenKai：主题字体栈是
 *       "LXGW WenKai Lite", "LXGW WenKai", "PingFang SC", ...
 *     一旦「霞鹜文楷」的 web font 被加载过（其 @font-face 族名正是 LXGW WenKai），
 *     不排除就会在「默认」档被次顺位误命中，导致默认看起来就是文楷。
 *   -「霞鹜文楷」的 web font 按需加载：只在首次选中该档时插入样式表，
 *     主源 npm.elemecdn.com（实测 0.06s）、失败自动回退 cdn.jsdelivr.net；
 *     不选该档则完全不产生字体网络请求（沿用 2026-09-10「移除常驻文楷分包 CDN」的结论）。
 *
 * 实现要点：
 *   - 字体开关落在 document.documentElement 的 data-font 属性上；CSS 侧用
 *     html[data-font="x"] body 覆盖主题的 body font-family（特异性 0,1,1 > 主题 0,0,1，
 *     且 inject.head 的 <style> 渲染在 css/index.css 之后，无需 !important）。
 *   - #rightside 位于 #body-wrap 之外（layout.pug 第 183 行），pjax 只替换 #body-wrap，
 *     故按钮只需注入一次；仍挂 pjax:complete 做幂等保险。
 *   - 刷新不闪烁：head 里另有一段内联脚本在首帧前同步读取 localStorage 并设属性，
 *     本文件的初始化负责兜底（head 脚本被 CSP 拦截等场景）与补齐按钮。
 */
(function () {
  "use strict";

  var ATTR = "data-font";
  var STORE_KEY = "anzhiyu-font";
  var WEBFONT_ID = "wenkai-webfont";

  // 霞鹜文楷 web font（仅 Regular 一个字重；分包 CSS 约 103KB / 97 个 unicode-range 子集，
  // 浏览器只拉命中字符的子集）。CSS 内 @font-face 的族名是 "LXGW WenKai"。
  var WEBFONT_SRC = [
    "https://npm.elemecdn.com/lxgw-wenkai-webfont@1.7.0/lxgwwenkai-regular.css",
    "https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/lxgwwenkai-regular.css"
  ];

  // 顺序 = 面板显示顺序（站主指定：宋体、默认、楷体、圆体、霞鹜文楷）
  var FONTS = [
    {
      key: "song",
      label: "宋体",
      stack: '"Songti SC", "SimSun", "STSong", "宋体", serif'
    },
    {
      key: "default",
      label: "默认",
      stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    },
    {
      key: "kai",
      label: "楷体",
      stack: '"Kaiti SC", "KaiTi", "STKaiti", "楷体", serif'
    },
    {
      key: "yuan",
      label: "圆体",
      stack: '"Yuanti SC", "YouYuan", "圆体-简", "Hiragino Maru Gothic ProN", "Quicksand", sans-serif'
    },
    {
      key: "wenkai",
      label: "霞鹜文楷",
      stack: '"LXGW WenKai", "LXGW WenKai Lite", "LXGW WenKai Mono", "霞鹜文楷", sans-serif',
      web: true
    }
  ];

  function find(key) {
    for (var i = 0; i < FONTS.length; i++) {
      if (FONTS[i].key === key) return FONTS[i];
    }
    return null;
  }

  function el(id) {
    return document.getElementById(id);
  }

  /* ---------- 字体加载与应用 ---------- */

  var webfontTried = false;

  function ensureWebfont() {
    if (document.getElementById(WEBFONT_ID)) return;
    var link = document.createElement("link");
    link.id = WEBFONT_ID;
    link.rel = "stylesheet";
    link.href = WEBFONT_SRC[0];
    // 主源失败 → 回退到备用源（只在还没降级过时替换，避免多源 ping-pong）
    var idx = 0;
    link.addEventListener("error", function () {
      if (idx >= WEBFONT_SRC.length - 1) return;
      idx += 1;
      link.href = WEBFONT_SRC[idx];
    });
    document.head.appendChild(link);
    webfontTried = true;
  }

  function currentKey() {
    var k = null;
    try {
      k = localStorage.getItem(STORE_KEY);
    } catch (e) {
      k = null;
    }
    return find(k) ? k : "default";
  }

  function apply(key) {
    var conf = find(key) || find("default");
    document.documentElement.setAttribute(ATTR, conf.key);
    if (conf.web) ensureWebfont();
    try {
      localStorage.setItem(STORE_KEY, conf.key);
    } catch (e) {
      /* 隐私模式下 localStorage 不可写：本次会话内仍生效 */
    }
    syncActive(conf.key);
  }

  /* ---------- 按钮 ---------- */

  function ensureButton() {
    if (document.getElementById("font-switch")) return;
    var host = document.getElementById("rightside-config-hide");
    if (!host) {
      var rs = document.getElementById("rightside");
      if (!rs) return;
      host = rs;
    }
    var btn = document.createElement("button");
    btn.id = "font-switch";
    btn.type = "button";
    btn.title = "切换字体";
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    // 与繁体按钮的「繁」同为纯文字按钮，视觉一致；样式由 #rightside > div > button 命中
    btn.textContent = "字";
    var tr = document.getElementById("translateLink");
    if (tr && tr.parentNode === host) {
      // 紧贴繁体按钮上方
      host.insertBefore(btn, tr);
    } else {
      host.insertBefore(btn, host.firstChild);
    }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var panel = document.getElementById("font-panel");
      if (panel && panel.classList.contains("show")) closePanel();
      else openPanel();
    });
  }

  /* ---------- 面板 ---------- */

  function ensurePanel() {
    var panel = document.getElementById("font-panel");
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = "font-panel";
    panel.setAttribute("role", "menu");

    var head = document.createElement("div");
    head.className = "font-panel-head";
    head.textContent = "字体";
    panel.appendChild(head);

    FONTS.forEach(function (f) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "font-panel-item";
      item.setAttribute("data-font-key", f.key);
      item.setAttribute("role", "menuitem");
      item.textContent = f.label;
      // 每项用自身字体渲染，直接预览效果
      item.style.fontFamily = f.stack;
      item.addEventListener("click", function (e) {
        e.stopPropagation();
        apply(f.key);
        closePanel();
      });
      panel.appendChild(item);
    });

    document.body.appendChild(panel);
    return panel;
  }

  function syncActive(key) {
    var panel = document.getElementById("font-panel");
    if (!panel) return;
    var items = panel.querySelectorAll("[data-font-key]");
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle("active", items[i].getAttribute("data-font-key") === key);
    }
  }

  function place(panel, btn) {
    var r = btn.getBoundingClientRect();
    // 用 offsetWidth/Height 而不是 getBoundingClientRect：面板带 scale(.96) 的入场变换，
    // 过渡进行中 getBoundingClientRect 会返回中间值、把定位算偏；offset* 不受 transform 影响。
    // 纵向、横向都夹在视口内：#rightside 基础位置是 right:-48px（靠 main.js 的 inline
    // transform 才移入视口），按钮坐标可能贴近甚至超出右缘，面板照搬会落到屏幕外。
    var pw = panel.offsetWidth || 136;
    var ph = panel.offsetHeight || 200;
    var gap = 12;
    var top = r.top + r.height / 2 - ph / 2;
    top = Math.min(Math.max(top, 8), Math.max(8, window.innerHeight - ph - 8));
    var left = r.left - pw - gap;
    if (left < 8) left = r.right + gap; // 左侧放不下 → 改放按钮右侧
    left = Math.min(Math.max(left, 8), Math.max(8, window.innerWidth - pw - 8));
    panel.style.top = top + "px";
    panel.style.left = left + "px";
  }

  // 面板挂在 body 下、不在 #rightside 内，滚动时主题的 scrollFn 会把 #rightside
  // 置为 opacity:0，按钮消失而面板悬空。打开期间锁住按钮组可见性（样式用 !important
  // 压过主题的内联赋值）。
  function lockRightside(on) {
    var rs = el("rightside");
    if (!rs) return;
    rs.classList[on ? "add" : "remove"]("panel-locked");
  }

  // 按钮点亮：面板打开时把触发按钮染成主题主色，建立「按钮 ↔ 面板」的视觉关联。
  function setBtnOn(on) {
    var btn = el("font-switch");
    if (!btn) return;
    btn.classList[on ? "add" : "remove"]("panel-on");
    btn.setAttribute("aria-expanded", on ? "true" : "false");
  }

  /* ---------- 跟随按钮定位 ---------- */

  // #rightside 自带 transition: all .5s（主题 main.js 读写 inline transform 来显隐位移）。
  // 打开面板的瞬间它往往还在过渡中，此刻量到的按钮坐标是中间值，面板会落在错误位置
  // （实测偏差 ~11px，面板右缘只剩 1px 贴住按钮，失去设计间距）。
  // 故开面板后按帧跟随几帧，直到按钮坐标稳定或超时。
  var settleRaf = 0;

  function placeFollowing(panel, btn) {
    var lastKey = "";
    var t0 = Date.now();
    function step() {
      var r = btn.getBoundingClientRect();
      var key = Math.round(r.left) + "," + Math.round(r.top) + "," + Math.round(r.width) + "," + Math.round(r.height);
      place(panel, btn);
      if (key !== lastKey && Date.now() - t0 < 800) {
        lastKey = key;
        settleRaf = window.requestAnimationFrame(step);
      } else {
        settleRaf = 0;
      }
    }
    stopFollowing();
    step();
  }

  function stopFollowing() {
    if (settleRaf) {
      window.cancelAnimationFrame(settleRaf);
      settleRaf = 0;
    }
  }

  function onDocClick(e) {
    var panel = document.getElementById("font-panel");
    var btn = document.getElementById("font-switch");
    if (panel && panel.contains(e.target)) return;
    if (btn && btn.contains(e.target)) return;
    closePanel();
  }

  function onKeydown(e) {
    if (e.key === "Escape" || e.keyCode === 27) closePanel();
  }

  function openPanel() {
    var panel = ensurePanel();
    var btn = document.getElementById("font-switch");
    if (!panel || !btn) return;
    syncActive(currentKey());
    // 首次打开时面板是刚创建的：必须先强制一次 reflow 建立起始态（visibility:hidden +
    // opacity:0 + scale(.96)），否则浏览器会把加 .show 视为元素初始状态，过渡不播。
    void panel.offsetWidth;
    panel.classList.add("show");
    placeFollowing(panel, btn); // show 之后再测量，保证有尺寸
    setBtnOn(true);
    lockRightside(true);
    document.addEventListener("click", onDocClick, true);
    document.addEventListener("keydown", onKeydown);
    window.addEventListener("resize", onResize);
  }

  function onResize() {
    var panel = document.getElementById("font-panel");
    var btn = document.getElementById("font-switch");
    if (panel && btn && panel.classList.contains("show")) place(panel, btn);
  }

  function closePanel() {
    var panel = document.getElementById("font-panel");
    if (panel) panel.classList.remove("show");
    stopFollowing();
    setBtnOn(false);
    lockRightside(false);
    document.removeEventListener("click", onDocClick, true);
    document.removeEventListener("keydown", onKeydown);
    window.removeEventListener("resize", onResize);
  }

  /* ---------- 初始化 ---------- */

  function init() {
    ensureButton();
    // 仅在存在存档时落 data-font：从未选过字体的访客保持主题原始字体栈
    // （即加本功能之前的样子），不做任何额外干预。
    var saved = null;
    try {
      saved = localStorage.getItem(STORE_KEY);
    } catch (e) {
      saved = null;
    }
    if (find(saved)) {
      document.documentElement.setAttribute(ATTR, saved);
      if (saved === "wenkai") ensureWebfont();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // pjax 只替换 #body-wrap，#rightside 不在其中，正常情况下按钮无需重建；
  // 这里做幂等保险（ensureButton 命中已存在元素时直接返回）。
  document.addEventListener("pjax:complete", function () {
    ensureButton();
  });
})();
