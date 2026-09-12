/**
 * 右下角挂件：仅保留 SakanaWidget（石蒜）
 * 2026-09-10 按站主要求：只保留第三个挂件。看板娘/猫/切换按钮的历史代码
 * 以逐行注释形式保留在本文件尾部，需要恢复时取消行注释即可。
 */
(function () {
  "use strict";
  if (window.__widgetSystem) return;
  window.__widgetSystem = true;

  // sakana-widget 3.1.0 本地化（2026-09-10）：jsdelivr 在大陆网络间歇不可达，
  // 挂件会整个不出现；库文件与角色图（base64 内嵌）均在 vendor/ 下，不再依赖 CDN
  var SAKANA_SRC = "/js/vendor/sakana-widget.umd.min.js";

  function loadSakana() {
    var s = document.createElement("script");
    s.src = SAKANA_SRC;
    s.async = true;
    s.onload = function () {
      try {
        var mountEl = document.createElement("div");
        mountEl.id = "sakana-widget";
        mountEl.style.cssText =
          "position:fixed;right:0;bottom:0;z-index:9998;width:240px;height:200px;";
        document.body.appendChild(mountEl);
        var widget = new SakanaWidget({ character: "chisato", size: 180 });
        widget.mount("#sakana-widget");
        // 进站即静止但可见：hide() 停循环+关闭自动施力 → 状态归零（初始
        // y:40 压弯势能会在循环启动瞬间引发 40px 级垂直回弹）→ 恢复容器
        // 显示 → 手动补画直立静止帧（库的循环有 _running 守卫且状态收敛
        // 自停，mount 后同步 hide 会导致一帧都不画，弹簧杆缺失）
        widget.hide();
        widget.setState({ r: 0, y: 0, t: 0, w: 0 });
        if (widget._domWrapper) widget._domWrapper.style.display = "";
        try { widget._draw(); } catch (e) {}
        // 首次交互唤醒：show() 重启循环 + 只给 1 度级小冲量做「被轻碰一下」
        // 的回应（库 auto mode 的随机施力是 ±100 度/帧级猛甩，弹射元凶，
        // 保持关闭不启用；后续大幅动作用户可拖拽，走库原生回弹路径）
        var woken = false;
        var wake = function () {
          if (woken) return;
          woken = true;
          try {
            widget.show();
            widget.setState({ w: 1.2, t: 1.2 });
          } catch (e) {}
        };
        var handler = function (e) {
          var t = e.target;
          if (t && t.closest && t.closest("#sakana-widget")) wake();
        };
        document.addEventListener("mouseover", handler, true);
        document.addEventListener("touchstart", handler, true);
        document.addEventListener("click", handler, true);
      } catch (e) {}
    };
    document.head.appendChild(s);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadSakana);
  } else {
    loadSakana();
  }
})();

// ============================================================================
// 历史挂件切换系统代码（已停用，逐行注释保留；恢复时取消行注释即可）
// ============================================================================

// /**
//  * 左下角挂件切换系统 v2
//  * - 🐱 live2d-widget（默认看板娘，多模型换装）
//  * - 🐹 tororo 猫（L2Dwidget 动态加载，原右下角猫）
//  * - 🐟 SakanaWidget（石蒜摆件）
//  * - 🙈 全部隐藏
//  * 选择记忆 localStorage['widget']
//  * 兼容 live2d-widget 内部状态机（waifu-hidden / waifu-display / waifu-toggle）
//  */
// (function () {
//   "use strict";
//   if (window.__widgetSystem) return;
//   window.__widgetSystem = true;
//
//   var SAKANA_CDN = "https://cdn.jsdelivr.net/npm/sakana-widget@3.1.0/lib/index.umd.min.js";
//   var LIVE2D_WAIFU_CDN = "https://fastly.jsdelivr.net/npm/live2d-widgets@1.0.1/dist/autoload.js";
//   var TORORO_LIB_CDN = "https://cdn.jsdelivr.net/npm/live2d-widget@3.1.4/lib/L2Dwidget.min.js";
//   var TORORO_MODEL_CDN = "https://cdn.jsdelivr.net/npm/live2d-widget-model-tororo@1.0.5/assets/tororo.model.json";
//
//   var sakanaWidget = null;
//   var sakanaMountEl = null;
//
//   var tororoLoaded = false;
//   var tororoLibLoading = false;
//
//   // 当前选择（与 localStorage 同步），供 waifu 异步渲染完成后对齐显隐
//   var currentWidget = "waifu";
//
//   function el(id) {
//     return document.getElementById(id);
//   }
//
//   /* ---------- live2d-widget（看板娘） ---------- */
//   function showWaifu() {
//     var w = el("waifu");
//     if (w) {
//       w.classList.remove("widget-hidden");
//       // 兼容其内部状态：若此前用它自带的关闭按钮收起，这里直接帮它展开
//       w.classList.remove("waifu-hidden");
//       w.style.display = "";
//     }
//     var t = el("waifu-toggle");
//     if (t) t.classList.remove("waifu-toggle-active");
//     try { localStorage.removeItem("waifu-display"); } catch (e) {}
//   }
//
//   function hideWaifu() {
//     var w = el("waifu");
//     if (w) w.classList.add("widget-hidden"); // css !important，不影响其内部 class
//   }
//
//   function loadWaifu() {
//     if (el("waifu") || el("waifu-toggle")) return; // 已加载
//     var s = document.createElement("script");
//     s.src = LIVE2D_WAIFU_CDN;
//     s.async = true;
//     document.head.appendChild(s);
//   }
//
//   /* ---------- tororo 猫（L2Dwidget） ---------- */
//   function showTororo() {
//     if (tororoLoaded) {
//       var dom = el("live2d-widget");
//       if (dom) dom.style.display = "";
//       return;
//     }
//     if (tororoLibLoading) return;
//     tororoLibLoading = true;
//     var s = document.createElement("script");
//     s.src = TORORO_LIB_CDN;
//     s.async = true;
//     s.onload = function () {
//       try {
//         window.L2Dwidget.init({
//           model: { jsonPath: TORORO_MODEL_CDN, scale: 1 },
//           display: { position: "right", width: 150, height: 300, hOffset: 0, vOffset: -20 },
//           mobile: { show: false },
//           react: { opacity: 0.7 },
//         });
//         tororoLoaded = true;
//       } catch (e) {
//         tororoLibLoading = false;
//       }
//     };
//     s.onerror = function () { tororoLibLoading = false; };
//     document.head.appendChild(s);
//   }
//
//   function hideTororo() {
//     var dom = el("live2d-widget");
//     if (dom) dom.style.display = "none";
//   }
//
//   /* ---------- sakana 石蒜 ---------- */
//   function mountSakana() {
//     if (sakanaWidget) return;
//     sakanaMountEl = document.createElement("div");
//     sakanaMountEl.id = "sakana-widget";
//     sakanaMountEl.style.cssText =
//       "position:fixed;right:0;bottom:0;z-index:9998;width:240px;height:200px;";
//     document.body.appendChild(sakanaMountEl);
//     sakanaWidget = new SakanaWidget({ character: "chisato", size: 180 });
//     sakanaWidget.mount("#sakana-widget");
//   }
//
//   function hideSakana() {
//     // 用官方 hide() 暂停动画帧循环（省 CPU），保留实例与 DOM，避免反复 mount 导致的交互失效
//     if (sakanaWidget) {
//       try { sakanaWidget.hide(); } catch (e) {}
//     }
//     if (sakanaMountEl) sakanaMountEl.style.display = "none";
//   }
//
//   function showSakana() {
//     if (!sakanaWidget) {
//       mountSakana();
//       return;
//     }
//     if (sakanaMountEl) sakanaMountEl.style.display = "";
//     try { sakanaWidget.show(); } catch (e) {}
//   }
//
//   function loadSakana(cb) {
//     if (window.SakanaWidget) { cb(); return; }
//     var s = document.createElement("script");
//     s.src = SAKANA_CDN;
//     s.async = true;
//     s.onload = cb;
//     document.head.appendChild(s);
//   }
//
//   /* ---------- 切换逻辑 ---------- */
//   function switchWidget(w) {
//     currentWidget = w;
//     try { localStorage.setItem("widget", w); } catch (e) {}
//     if (w === "waifu") {
//       loadWaifu();
//       showWaifu();
//       hideTororo();
//       hideSakana();
//     } else if (w === "tororo") {
//       hideWaifu();
//       showTororo();
//       hideSakana();
//     } else if (w === "sakana") {
//       hideWaifu();
//       hideTororo();
//       loadSakana(function () {
//         try { showSakana(); } catch (e) {}
//       });
//     } else {
//       hideWaifu();
//       hideTororo();
//       hideSakana();
//     }
//     highlightButtons(w);
//   }
//
//   function highlightButtons(w) {
//     var bar = el("widget-switcher");
//     if (!bar) return;
//     var btns = bar.querySelectorAll("button");
//     for (var i = 0; i < btns.length; i++) {
//       btns[i].classList.toggle("active", btns[i].getAttribute("data-w") === w);
//     }
//   }
//
//   function createSwitcher() {
//     var bar = document.createElement("div");
//     bar.id = "widget-switcher";
//     bar.innerHTML =
//       '<button data-w="waifu" title="看板娘">🐱</button>' +
//       '<button data-w="tororo" title="猫">🐹</button>' +
//       '<button data-w="sakana" title="石蒜摆件">🐟</button>' +
//       '<button data-w="off" title="隐藏">🙈</button>';
//     document.body.appendChild(bar);
//     bar.addEventListener("click", function (e) {
//       var w = e.target.getAttribute("data-w");
//       if (w) switchWidget(w);
//     });
//   }
//
//   function init() {
//     createSwitcher();
//     // 默认不加载看板娘（站主要求注释保留：默认只显示第三个挂件石蒜，点 🐱 时才懒加载看板娘）
//     // loadWaifu();
//
//     var saved = null;
//     try { saved = localStorage.getItem("widget"); } catch (e) {}
//     var initial = saved || "sakana"; // 默认第三个：石蒜
//
//     // waifu 由 CDN 异步渲染（懒加载场景）：监听其出现，若用户已选其他挂件则立即隐藏，避免竞态
//     new MutationObserver(function () {
//       if (el("waifu") && currentWidget !== "waifu") {
//         hideWaifu();
//       }
//     }).observe(document.body, { childList: true, subtree: true });
//
//     // 兼容唤起按钮：用户点 waifu-toggle 唤回看板娘时，同步清掉我们加上的隐藏类与选择状态
//     document.addEventListener("click", function (e) {
//       var t = el("waifu-toggle");
//       if (t && t.contains(e.target)) {
//         var w = el("waifu");
//         if (w) w.classList.remove("widget-hidden");
//         currentWidget = "waifu";
//         try { localStorage.setItem("widget", "waifu"); } catch (err) {}
//         highlightButtons("waifu");
//       }
//     });
//
//     if (initial === "waifu") {
//       currentWidget = "waifu";
//       loadWaifu();
//       highlightButtons("waifu");
//     } else {
//       currentWidget = initial;
//       switchWidget(initial);
//     }
//   }
//
//   if (document.readyState === "loading") {
//     document.addEventListener("DOMContentLoaded", init);
//   } else {
//     init();
//   }
// })();
//
