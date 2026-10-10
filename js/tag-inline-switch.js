/**
 * 标签页原地切换（2026-10-06 站主要求）
 *
 * 站主反馈：在 /tags/ 点一个标签，整个页面会重构一遍，他只希望「把变化的文章渲染出来」。
 *
 * 背景：站点开了 pjax，主题的 selectors 里写死替换 `#body-wrap`（整块内容区 + 侧栏 + 头图），
 * 所以每次点标签都像重开一页。缩小 pjax 替换范围这条路走不通：标签总览页有 `#page` 容器、
 * 标签详情页没有，换 selectors 会让跳转后内容对不上。
 *
 * 做法：拦截标签云里的链接，自己 fetch 目标页，只把 `#tag` 这一块换掉。
 *   两边页面的结构是：
 *     /tags/       #tag > #tag-page-tags（标签云）
 *     /tags/xxx/   #tag > #tag-page-tags（标签云，当前项带 selected）+ .article-sort*（文章列表）
 *   所以换掉 #tag 的 innerHTML，标签云和文章列表就都是目标页的样子，而侧栏、头图、滚动位置
 *   原样不动 —— 正是站主要的「只渲染变化的文章」。
 *   头图上的大标题（#page-site-info 里的 h1）另行动更新，否则会一直停在「标签」。
 *
 * 几个实现细节：
 *  - 监听放在捕获阶段，抢在 pjax 的冒泡监听之前，preventDefault 才拦得住。
 *  - 新插入的文章链接仍然是普通站内链接，pjax 的 document 级监听照样接管，点进文章正常。
 *  - 失败（fetch 出错、目标页结构不对）就退回整页跳转，不硬撑。
 *  - 浏览器前进/后退用整页重载兜底，不做 history 状态复原（那套容易出错，收益也小）。
 */
(function () {
  "use strict";
  var TAGS_BOX = "tag-page-tags";

  function updateHeading(doc) {
    var cur = document.querySelector("#page-site-info h1, #page-header h1#site-title");
    var next = doc.querySelector("#page-site-info h1, #page-header h1#site-title");
    if (cur && next && next.textContent.trim()) {
      cur.textContent = next.textContent.trim();
    }
  }

  // 主题只写了 .selected 的样式，没有任何地方加这个类，标签云里的当前标签一直没高亮。
  // 这里按当前地址补上（原地切换与 pjax 导航后都同步一次）。
  function syncSelected() {
    var path = window.location.pathname;
    var links = document.querySelectorAll("#" + TAGS_BOX + " a");
    Array.prototype.forEach.call(links, function (a) {
      a.classList.toggle("selected", a.getAttribute("href") === path);
    });
  }

  function apply(html, url) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var nextTag = doc.getElementById("tag");
    var curTag = document.getElementById("tag");
    if (!nextTag || !curTag) return false;

    curTag.innerHTML = nextTag.innerHTML;

    var t = doc.querySelector("title");
    if (t) document.title = t.textContent;

    updateHeading(doc);

    // 先改地址再同步选中态：syncSelected 是拿 location.pathname 比对的，
    // 顺序反了会把所有标签的高亮都去掉（旧地址匹配不上任何一个）。
    history.pushState({ tagUrl: url }, "", url);
    syncSelected();

    if (window.lazyLoadInstance && typeof window.lazyLoadInstance.update === "function") {
      window.lazyLoadInstance.update();
    }
    return true;
  }

  function onClick(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest("#" + TAGS_BOX + " a") : null;
    if (!a) return;

    var href = a.getAttribute("href") || "";
    if (href.indexOf("/tags/") !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    fetch(href)
      .then(function (res) {
        if (!res.ok) throw new Error("bad status");
        return res.text();
      })
      .then(function (html) {
        if (!apply(html, href)) throw new Error("bad structure");
      })
      .catch(function () {
        window.location.href = href;
      });
  }

  document.addEventListener("click", onClick, true);

  // pjax 整块换掉内容后（例如从文章页点进标签），选中态也要跟着同步
  document.addEventListener("pjax:complete", syncSelected);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncSelected);
  } else {
    syncSelected();
  }

  window.addEventListener("popstate", function () {
    // 前进/后退时不做局部复原，直接整页加载目标地址，行为可预期
    if (document.getElementById(TAGS_BOX)) window.location.reload();
  });
})();
