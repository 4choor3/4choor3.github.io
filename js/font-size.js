/**
 * 右侧「字号」调节按钮（2026-09-15 站主要求：把简繁切换按钮改成调节字号）
 *
 * 位置：占据原繁体切换按钮（#translateLink）的位置 —— 本脚本先把字号按钮插到它前面，
 * 再把繁体按钮从 DOM 移除，等效于「把简繁按钮改成字号调节」。
 * 为什么不用主题配置 translate.enable=false 关掉繁体：那样 #translateLink 根本不渲染，
 * 按钮就失去定位锚点，只能落到按钮组最前面，与字体按钮的相对位置也不稳定。
 *
 * 原理：主题所有正文字号都走 CSS 变量 --global-font-size（:root 里定义为站点
 * font.global-font-size = 16px，被 body / nav / site-card / folding / span 等继承），
 * 所以只需在 <html> 上内联这一个变量即可全站缩放，不用改任何样式表。
 * 「默认」档是把内联变量**移除**、回到主题编译值，而不是写死 16px。
 *
 * 切换要「一步到位」而不是「整页渐变」：主题给几乎每个元素都挂了 transition:all，
 * 直接改根字号会让几百个元素同时起过渡（实测 316 个元素的字号处于中间态、持续约 400ms），
 * 观感就是站主反馈的「所有字体都在动，显得卡」。故 applySize 在改值前后压一个 fs-switching
 * 窗口，用 ensureSuppressStyle 注入的规则关掉 transition，并强制一次 reflow —— 详见两处注释。
 *
 * 持久化：localStorage `anzhiyu-font-size`，存 px 数值字符串。
 *
 * 附带职责：清理繁体切换遗留的 localStorage 键 `translate-chn-cht`。繁体按钮被本按钮取代后，
 * 主题的 tw_cn.js 仍会加载并读取该键，一旦为 1 就会把整页自动转成繁体，而切换入口已不存在。
 */
(function () {
  "use strict";

  var STORE_KEY = "anzhiyu-font-size";
  var BASE = 16; // 站点 font.global-font-size
  var PANEL_ID = "font-size-panel";
  var BTN_ID = "font-size-btn";
  var SWITCH_CLASS = "fs-switching";

  // 顺序即菜单顺序
  var SIZES = [
    { px: 14, label: "小" },
    { px: BASE, label: "默认" },
    { px: 18, label: "大" },
    { px: 20, label: "特大" },
    { px: 22, label: "超大" }
  ];

  var panelOpen = false;

  function el(id) {
    return document.getElementById(id);
  }

  function readSaved() {
    try {
      var v = parseInt(localStorage.getItem(STORE_KEY), 10);
      return isNaN(v) ? null : v;
    } catch (e) {
      return null;
    }
  }

  function writeSaved(px) {
    try {
      localStorage.setItem(STORE_KEY, String(px));
    } catch (e) {
      /* 隐私模式下忽略 */
    }
  }

  /* ---------- 切换瞬间关闭过渡 ---------- */
  var STYLE_ID = "font-size-suppress";

  // 主题给几乎每个元素都挂了 transition:all（实测全站 891 个元素全部命中，其中 873 个是 all）。
  // 直接改根字号会让几百个元素的 font-size 同时进入过渡——实测切换后 316 个元素的字号
  // 处于中间态、持续约 400ms，并伴随 300 个并发过渡、最大帧间隔 59ms，观感正是站主反馈的
  // 「所有字体都在动，显得卡」。这里在切换的那一瞬间关掉过渡，让新字号一步到位：
  // 实测中间态元素从 316 降到 16（16 即「全程关过渡」口径下的理论下限）。
  //
  // 只关 transition、不动 animation：背景飘移粒子、Live2D 这类持续动画不受影响。
  // 规则由脚本自注入，与按钮、面板一样自包含——删掉本脚本即彻底移除，也不会与对同一份
  // 主题配置的并发改动互相干扰。
  //
  // 规则写两份：
  //   ① 装进 @layer 的那份——按层叠层规则，分层样式里的 !important **优先于未分层的
  //      !important**，与特异性无关。这是必须的：主题把 `#site-name` 写成
  //      `transition: .3s !important`（head.styl），同为 !important 时靠特异性决胜，
  //      它的 (1,0,0) 压过本规则的 (0,1,1)，站点名会照旧缓慢缩放。
  //   ② 未分层的那份作兜底：老内核不认 @layer 会整块忽略 ①，此时 ② 仍能压住绝大多数元素
  //      （仅少数 ID 级规则逃逸），退化为与本改动之前相同的表现，不会更差。
  var SUPPRESS_RULE =
    "html." + SWITCH_CLASS + ",html." + SWITCH_CLASS + " *," +
    "html." + SWITCH_CLASS + " *::before,html." + SWITCH_CLASS + " *::after{transition:none!important}";
  var SUPPRESS_CSS = "@layer fs-suppress{" + SUPPRESS_RULE + "}" + SUPPRESS_RULE;

  function ensureSuppressStyle() {
    if (el(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = SUPPRESS_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  /* ---------- 应用 ---------- */
  function applySize(px) {
    var v = parseInt(px, 10);
    if (isNaN(v)) return;
    var root = document.documentElement;

    // 在改值的前后压一个「过渡关闭」窗口，让新字号一步到位（规则见 ensureSuppressStyle）。
    //
    // 两个要点，缺一不可：
    //   ① 中间必须强制一次 reflow（void root.offsetHeight）。否则这段 JS 结束时浏览器
    //      才做唯一一次样式重算，而那时类已经被移除、过渡已恢复 → 仍会从旧值起步。
    //      实测：加锁但不强制 reflow，偏离最终字号的元素仍有 200+ 个，抑制等于没做。
    //   ② 上锁与解锁压在同一帧内同步完成。类只存在几微秒、从不进入绘制，因此既不会
    //      影响面板自己的淡出动画（选完档位紧接着就 closePanel），也不会打断任何
    //      正在进行的交互过渡。
    ensureSuppressStyle();
    root.classList.add(SWITCH_CLASS);
    if (v === BASE) {
      // 默认档：移除内联覆盖，回到主题 :root 编译值
      root.style.removeProperty("--global-font-size");
    } else {
      root.style.setProperty("--global-font-size", v + "px");
    }
    void root.offsetHeight;
    root.classList.remove(SWITCH_CLASS);

    writeSaved(v);
  }

  function currentSize() {
    var v = readSaved();
    return v === null ? BASE : v;
  }

  /* ---------- 按钮 ---------- */
  function ensureButton() {
    var existing = el(BTN_ID);
    if (existing) return existing;

    var host = el("rightside-config-hide") || el("rightside");
    if (!host) return null;

    var btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.title = "调节字号";
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    btn.textContent = "A";

    var translate = el("translateLink");
    if (translate && translate.parentNode === host) {
      // 占住繁体按钮的位置，再把繁体按钮移除
      host.insertBefore(btn, translate);
      translate.remove();
    } else {
      // 繁体按钮不存在（如主题配置已关）时退化为插在组首
      host.insertBefore(btn, host.firstChild);
    }

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
    });
    return btn;
  }

  /* ---------- 面板 ---------- */
  function ensurePanel() {
    var existing = el(PANEL_ID);
    if (existing) return existing;

    var panel = document.createElement("div");
    panel.id = PANEL_ID;

    var head = document.createElement("div");
    head.className = "font-panel-head";
    head.textContent = "字号";
    panel.appendChild(head);

    SIZES.forEach(function (s) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "font-panel-item";
      item.setAttribute("data-size", String(s.px));
      item.textContent = s.label;
      // 用对应字号渲染标签，直接体现大小差别
      item.style.fontSize = s.px + "px";
      item.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        applySize(s.px);
        syncActive();
        closePanel();
      });
      panel.appendChild(item);
    });

    document.body.appendChild(panel);
    return panel;
  }

  function syncActive() {
    var panel = el(PANEL_ID);
    if (!panel) return;
    var cur = currentSize();
    Array.prototype.forEach.call(panel.querySelectorAll("[data-size]"), function (item) {
      var on = parseInt(item.getAttribute("data-size"), 10) === cur;
      item.classList[on ? "add" : "remove"]("active");
    });
  }

  function place(panel, btn) {
    var r = btn.getBoundingClientRect();
    // 用 offsetWidth/Height 而不是 getBoundingClientRect：面板带 scale(.96) 的入场变换，
    // 过渡进行中 getBoundingClientRect 会返回中间值、把定位算偏；offset* 不受 transform 影响。
    // 纵向、横向都夹在视口内：#rightside 基础位置是 right:-48px（靠 main.js 的 inline
    // transform 才移入视口），按钮坐标可能贴近甚至超出右缘，面板照搬会落到屏幕外。
    var pw = panel.offsetWidth || 136;
    var ph = panel.offsetHeight || 220;
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
    var btn = el(BTN_ID);
    if (!btn) return;
    btn.classList[on ? "add" : "remove"]("panel-on");
    btn.setAttribute("aria-expanded", on ? "true" : "false");
  }

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
    if (!panelOpen) return;
    var panel = el(PANEL_ID);
    var btn = el(BTN_ID);
    if (panel && (panel.contains(e.target) || (btn && btn.contains(e.target)))) return;
    closePanel();
  }

  function onKey(e) {
    if (e.key === "Escape") closePanel();
  }

  function openPanel() {
    var panel = ensurePanel();
    var btn = el(BTN_ID);
    if (!panel || !btn) return;
    syncActive();
    // 首次打开时面板是刚创建的：必须先强制一次 reflow 建立起始态（visibility:hidden +
    // opacity:0 + scale(.96)），否则浏览器会把加 .show 视为元素初始状态，过渡不播。
    void panel.offsetWidth;
    panel.classList.add("show");
    placeFollowing(panel, btn);
    panelOpen = true;
    setBtnOn(true);
    lockRightside(true);
    document.addEventListener("click", onDocClick, true);
    document.addEventListener("keydown", onKey);
  }

  function closePanel() {
    var panel = el(PANEL_ID);
    if (panel) panel.classList.remove("show");
    panelOpen = false;
    stopFollowing();
    setBtnOn(false);
    lockRightside(false);
    document.removeEventListener("click", onDocClick, true);
    document.removeEventListener("keydown", onKey);
  }

  function togglePanel() {
    if (panelOpen) closePanel();
    else openPanel();
  }

  /* ---------- 初始化 ---------- */
  function init() {
    ensureSuppressStyle();
    ensureButton();
    // 兜底清理繁体切换的遗留状态（head 内联脚本已做过一次）：覆盖 pjax、多标签页等场景，
    // 避免主题 tw_cn.js 依据残留状态把整页自动转成繁体，而用户已无切换入口。
    try {
      localStorage.removeItem("translate-chn-cht");
    } catch (e) {
      /* 隐私模式下忽略 */
    }
    // 只在有存档时覆盖变量：没调过字号的访客保持主题基准值，不做任何干预。
    var saved = readSaved();
    if (saved !== null && saved !== BASE) {
      document.documentElement.style.setProperty("--global-font-size", saved + "px");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // #rightside 在 #body-wrap 之外（layout.pug），pjax 不会替换它，按钮只需注入一次；
  // 这里仍挂一次 pjax:complete 做幂等保险（重复调用 ensureButton 会直接返回）。
  window.addEventListener("pjax:complete", init);
})();
