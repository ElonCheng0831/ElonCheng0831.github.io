/* 百度统计：化境 ChemLab
 * 站点 ID：569fda17ecdd950834495bdae87446d9
 * 只在 http/https 下加载，避免本地双击打开时把 file:// 访问计入统计。
 */
(function () {
  if (location.protocol !== "http:" && location.protocol !== "https:") return;
  window._hmt = window._hmt || [];
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?569fda17ecdd950834495bdae87446d9";
  hm.async = true;
  var s = document.getElementsByTagName("script")[0];
  if (s && s.parentNode) s.parentNode.insertBefore(hm, s);
  else document.head.appendChild(hm);
})();
