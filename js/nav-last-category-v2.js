/**
 * 「分类」导航默认进入上次浏览的分类（2026-09-15 站主要求）
 *
 * 背景：站点分类页形如 /categories/<名称>/，而导航「分类」指向 /categories/ 总览页
 * （只有分类名、没有文章列表）。站主反馈点「分类」进去是"哪个分类都没进"的状态，
 * 希望默认回到上一次进入的分类。
 *
 * 机制：
 *  1) 访问具体分类页、且该页确实渲染出了文章条目时，把路径写进 localStorage；
 *  2) 把导航里指向 /categories/ 的链接（桌面导航 + 移动端侧边栏）改写到"上次浏览的分类"；
 *     **没有任何历史时**（首次访问），改写到默认的第一个分类（GLOBAL_CONFIG.firstCategory，
 *     由 config.pug 按分类总览页的排序——文章数降序——算出）；
 *  3) 只有在拿不到具体分类路径时才不改写（例如站点还没有任何分类）。
 *     分类条上的「更多」(.catalog-more) 始终指向 /categories/ 总览，不动。
 *  4) 记住的分类若已消失（文章归类调整导致该分类页不再生成），那个路径就是 404：
 *     用 HEAD 校验后清掉记忆、回退到第一个分类（2026-09-15 站主反馈「分类第一个 404」后补）。
 *
 * 注意：header/nav 位于 #body-wrap 内，pjax 会替换它，故每次 pjax:complete 都要重新应用。
 *
 * 文件名带 -v2 后缀：站点静态资源的 Cache-Control 是 max-age=600，且 Fastly 忽略查询串，
 * 改名（而非给 URL 加 ?v=）是唯一能让浏览器与 CDN 立刻拿到新版本的办法（2026-09-15）。
 */
(function () {
  "use strict";
  var KEY = "anzhiyu-last-category";
  var CATEGORY_RE = /^\/categories\/[^/]+\/$/; // 只匹配具体分类页，不含 /categories/ 总览
  var APPLIED_ATTR = "data-last-cat-applied";

  function readLast() {
    try {
      return localStorage.getItem(KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function writeLast(v) {
    try {
      localStorage.setItem(KEY, v);
    } catch (e) {}
  }

  // 没有浏览历史时的默认落点：分类总览页里排第一的分类
  // （由 themes/anzhiyu/layout/includes/head/config.pug 按文章数降序算好写进 GLOBAL_CONFIG.firstCategory）
  function defaultCategory() {
    // 注意：站点的 GLOBAL_CONFIG 是用 `const` 在 <script> 顶层声明的 → 只能按名字访问，
    // window.GLOBAL_CONFIG 是 undefined（踩过：用 window.GLOBAL_CONFIG 取不到值）
    var cfg = typeof GLOBAL_CONFIG !== "undefined" ? GLOBAL_CONFIG : null;
    var v = cfg && cfg.firstCategory;
    if (typeof v !== "string") return "";
    v = v.replace(/^\/+/, "/");
    return CATEGORY_RE.test(v) ? v : ""; // 只接受具体分类路径；总览 /categories/ 或空值一律不改写
  }

  // 记住当前页：仅当它是具体分类页、且页面上真的有文章条目（避免记住 404 / 空分类）
  function remember() {
    if (!CATEGORY_RE.test(location.pathname)) return;
    if (!document.querySelector(".article-sort-item")) return;
    writeLast(location.pathname);
  }

  // 把导航里的「分类」链接改写到指定分类页
  // 选择器同时覆盖"仍指向总览的"与"本脚本已改写过的"链接，便于失效时二次回退
  function rewrite(target) {
    var links = document.querySelectorAll('a[href="/categories/"], a[' + APPLIED_ATTR + '="1"]');
    Array.prototype.forEach.call(links, function (a) {
      if (a.classList.contains("catalog-more")) return; // 分类条「更多」仍去总览
      a.setAttribute(APPLIED_ATTR, "1");
      a.setAttribute("href", target);
      var t = a.getAttribute("title");
      if (!t || t.indexOf("分类：") === 0) {
        a.setAttribute("title", "分类：" + decodeURIComponent(target.replace(/^\/categories\/|\/$/g, "")));
      }
    });
  }

  // 记住的分类可能因文章归类调整而消失（例如某分类的最后一篇文章被并入别处），
  // 此时那个路径就是 404（站主反馈过：点「分类」进 404）。所以对"记住的"路径
  // 做一次 HEAD 校验，失效就清掉记忆并回退到构建期算出的第一个分类。
  function verify(target) {
    if (typeof fetch !== "function") return;
    fetch(target, { method: "HEAD" })
      .then(function (res) {
        if (res.ok) return;
        writeLast("");
        var fallback = defaultCategory();
        if (fallback && fallback !== target) rewrite(fallback);
      })
      .catch(function () {});
  }

  function apply() {
    var remembered = readLast();
    // 记忆值必须是合法的分类页路径；格式非法（历史遗留、被手工改过）一律丢弃，
    // 否则它会被原样塞进 href，把导航目标变成非分类页地址。
    if (remembered && !CATEGORY_RE.test(remembered)) {
      writeLast("");
      remembered = "";
    }
    var target = remembered || defaultCategory();
    if (!target) return;
    rewrite(target);
    if (remembered) verify(remembered); // 默认路径由构建期算出，无需校验
  }

  function run() {
    remember();
    apply();
  }

  run();
  document.addEventListener("pjax:complete", run);
  window.addEventListener("popstate", run);
})();
