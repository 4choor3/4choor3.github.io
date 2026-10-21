/**
 * img-predownload.js — 懒加载图片提前下载（2026-10-20 站主要求）
 *
 * 背景：主题用 vanilla-lazyload 做「翻到视口才开始下载」，弱网下要滚到那张图
 * 的位置才看到它开始转圈，之前一直是占位图。站主要求改成：
 * 「完全进入网站后就要下载，只是翻到才开始渲染和加载而已」。
 *
 * 做法：完全不碰 data-lazy-src 属性、不提前改 src，只用 new Image() 把真实
 * 地址拉进 HTTP 缓存。vanilla-lazyload 之后滚动到位时替换 src，直接命中缓存，
 * 视觉上就是「早就下好了，翻到就出现」——下载提前，渲染/显示仍然按需。
 *
 * 时序：window load + 300ms 后启动（不用 requestIdleCallback，避免被无限
 * 推迟）；pjax 页面切换后重新扫一遍新 DOM。
 * 并发限 4 个，不与前台请求抢带宽；每张图只尝试一次，失败不重试
 * （lazyload 换 src 时会自然再走一次网络，届时由它自己的 onerror 兜底）。
 */
(function () {
  'use strict';

  var CONCURRENCY = 4;
  var queue = [];
  var running = 0;
  var seen = Object.create(null);

  function scan() {
    var imgs = document.querySelectorAll('img[data-lazy-src]');
    for (var i = 0; i < imgs.length; i++) {
      var url = imgs[i].getAttribute('data-lazy-src');
      // 跳过空值与 data URI 占位图（那本来就没有网络请求）
      if (!url || url.indexOf('data:') === 0) continue;
      // 已入过队的不重复（pjax 前后会有同一 URL 的多个 img）
      if (seen[url]) continue;
      seen[url] = true;
      queue.push(url);
    }
    pump();
  }

  function pump() {
    while (running < CONCURRENCY && queue.length) {
      var url = queue.shift();
      running++;
      var img = new Image();
      img.onload = img.onerror = function () {
        running--;
        pump();
      };
      img.src = url;
    }
  }

  if (document.readyState === 'complete') {
    setTimeout(scan, 300);
  } else {
    window.addEventListener('load', function () { setTimeout(scan, 300); });
  }

  // pjax 切换页面后，新 DOM 里的懒加载图同样提前下
  document.addEventListener('pjax:complete', function () {
    setTimeout(scan, 300);
  });
})();
