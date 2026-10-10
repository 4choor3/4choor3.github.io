(function () {
  var URL = "/img/home-hero.webp";
  var RETRIES = [1000, 3000, 7000];
  var started = false;

  function getSheet() {
    var c = document.getElementById("home-media-container");
    return c ? c.querySelector(".home-media-sheet") : null;
  }

  // 每次调用都重新查询 .home-media-sheet，确保 pjax 回首页新建的 sheet 也能被覆盖
  function apply() {
    var sheet = getSheet();
    if (sheet) sheet.style.backgroundImage = 'url("' + URL + '")';
  }

  function tryLoad(attempt) {
    var img = new Image();
    var src = attempt > 0 ? URL + "?r=" + attempt : URL;
    img.onload = function () {
      apply();
    };
    img.onerror = function () {
      if (attempt < RETRIES.length) {
        setTimeout(function () {
          tryLoad(attempt + 1);
        }, RETRIES[attempt]);
      } else {
        // 全部失败：保留 CSS 兜底底色 #1b2430，仅告警不打断页面
        console.warn("[home-hero] 头图加载失败，已使用兜底底色：", URL);
      }
    };
    img.src = src;
  }

  function start() {
    if (started) return;
    started = true;
    tryLoad(0);
  }

  // 立即尝试；pjax 回首页后新建的 sheet 需要重新走一次"预加载 + 失败重试"链路
  start();
  function onNav() {
    if (/^\/(page\/\d+\/?)?$/.test(location.pathname)) tryLoad(0);
  }
  document.addEventListener("pjax:complete", onNav);
  window.addEventListener("popstate", onNav);
})();
