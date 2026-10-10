/**
 * 侧栏 X 翻转卡（2026-10-06 站主要求）
 *
 * 背景：原主题「公众号」翻转卡（#card-wechat）的图是主题作者的远程图且背面图已 404，
 * 站主要把它换成自己的 X 入口：正面是「X 账号」宣传图，背面是 X 主页截图，
 * hover 翻转、点击打开 https://x.com/4choor3，翻转效果与原卡一致。
 *
 * 实现：主题模板 card_weixin.pug 写死了图片与 onclick，没有可配置项，故
 * _config.anzhiyu.yml 里 aside.card_weixin.enable=false 关掉原卡，由本脚本在
 * 同一位置（.card-announcement 之后）插一张结构相同的卡。
 *
 * 关键点：
 *  1) 外层 id 沿用 card-wechat——翻转卡的全部样式（110px 高、深浅两套背景色、
 *     perspective、hover rotateY）都挂在这个 id 与 #flip-wrapper/#flip-content/.face 上，
 *     主题模板已关闭不会渲染，id 不会重复，直接借用可零 CSS 获得同款翻转。
 *  2) 两张面图用内联 background 写 cover + center（覆盖主题的 background-size:100%），
 *     两张图都预先裁成容器比例（约 2.133:1），这样 cover 不裁任何边、整图正好铺满。
 *     背面截图的裁切（v3 定稿）：原图 1280×693 里，左端 96px、右端 56px 是 X 深色页面
 *     两侧的纯黑留白——cover 铺满后这些黑边照样露在卡片两侧，看着就是「没放大、两边空白」。
 *     先裁掉黑边（1128×693），再按容器比例居中裁成 1128×529，内容这才顶到两边。
 *     正面图不裁：它上下各有近百 px 黑边（宣传图自身的设计留白），裁掉会变成 3.3:1，
 *     比容器更扁，cover 反而要裁左右、把中间那行字切了。
 *  3) 原模板的 onclick 是写死的 window.open("/")（渲染出来还是坏的），点击行为由这里
 *     addEventListener 补上，新窗口打开 X 主页。
 *  4) #aside-content 在 #body-wrap 内会被 pjax 整体替换，故 pjax:complete 后重插；
 *     getElementById 幂等判断防重复。
 *  5) 文件名不带旧版复用：站点静态资源 Cache-Control max-age=600 且 Fastly 忽略查询串，
 *     改 JS 必须换文件名（前作 x-entry-card.js 是「标题+按钮」形态，已删除）。
 */
(function () {
  "use strict";
  var ID = "card-wechat";
  var HREF = "https://x.com/4choor3";
  var FACE = "/img/x-card/front.webp";
  var BACK = "/img/x-card/back-v3.webp";

  function build() {
    var card = document.createElement("div");
    card.className = "card-widget anzhiyu-right-widget";
    card.id = ID;
    card.title = "进入X";
    card.innerHTML =
      '<div id="flip-wrapper"><div id="flip-content">' +
      '<div class="face" style="background:url(' +
      FACE +
      ') center center / cover no-repeat"></div>' +
      '<div class="back face" style="background:url(' +
      BACK +
      ') center center / cover no-repeat"></div>' +
      "</div></div>";
    card.addEventListener("click", function () {
      window.open(HREF, "_blank", "noopener");
    });
    return card;
  }

  function insert() {
    var aside = document.querySelector("#aside-content");
    if (!aside || document.getElementById(ID)) return;
    var anchor = aside.querySelector(".card-announcement");
    if (anchor) {
      aside.insertBefore(build(), anchor.nextSibling);
    } else {
      aside.insertBefore(build(), aside.firstChild);
    }
  }

  insert();
  document.addEventListener("pjax:complete", insert);
})();
