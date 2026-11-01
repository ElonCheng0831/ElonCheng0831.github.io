/* 化境 ChemLab · 资料说明（来源 / 核验状态 / 更新日期）
   本站所有制法与实验都是编者整理的科普资料：没有逐条对照教材原文，也没有做实验复核。
   这里只做一件事——把"这条内容哪来的、核验到什么程度、什么时候更新的"说清楚，
   并且明确区分"操作风险"（hazard，有多危险）与"学习难度"（difficulty，学起来有多难）。 */
(function () {
  var UPDATED = "2026-11-01";

  var LEVELS = {
    curated: {
      key: "curated",
      label: "编者整理",
      cls: "prov-curated",
      source: "通行教材与常规实验讲义",
      verify: "未逐条核对原文，未做实验复核"
    },
    popular: {
      key: "popular",
      label: "通行说法",
      cls: "prov-popular",
      source: "生活经验与网络通行科普说法",
      verify: "只作原理说明，未经实验验证"
    },
    high: {
      key: "high",
      label: "仅原理说明",
      cls: "prov-high",
      source: "通行教材与实验讲义（原理部分）",
      verify: "未做实验复核，须由专业人员操作"
    }
  };

  var DIFFICULTY = { 1: "基础", 2: "进阶", 3: "挑战" };

  function levelOf(item) {
    if (!item) return LEVELS.curated;
    if (item.hazard === 3) return LEVELS.high;
    var cat = item.category || "";
    if (cat === "生活材料" || cat === "生活化学" || cat === "趣味演示") return LEVELS.popular;
    return LEVELS.curated;
  }

  function difficultyText(item, type) {
    if (type !== "e" || !item.difficulty) return "";
    return item.difficulty + "/3「" + (DIFFICULTY[item.difficulty] || "") + "」";
  }

  function blockHTML(item, type) {
    var lv = levelOf(item);
    var diff = difficultyText(item, type);
    var rows = [];
    rows.push('<li><span class="prov-k">来源</span><span class="prov-v">' + lv.source + "</span></li>");
    rows.push('<li><span class="prov-k">核验</span><span class="prov-v"><b class="prov-badge ' + lv.cls + '">' + lv.label + "</b><span class=\"prov-note\">" + lv.verify + "</span>" + "</span></li>");
    rows.push('<li><span class="prov-k">更新</span><span class="prov-v">' + UPDATED + "</span></li>");
    rows.push(
      "<li><span class=\"prov-k\">两个刻度</span><span class=\"prov-v\">风险 " + (item.hazard || 1) + "/3 是<em>操作有多危险</em>" +
        (diff ? "；学习难度 " + diff + " 是<em>原理与步骤有多复杂</em>" : "；实验条目的学习难度另标") +
        "。两者互不换算，低危也可以很难，高危也可以只是看懂。</span></li>"
    );
    return '<div class="block prov-block"><h4>资料说明</h4><ul class="prov-list">' + rows.join("") + "</ul></div>";
  }

  window.CHEMLAB_SOURCE = {
    updated: UPDATED,
    levels: LEVELS,
    levelOf: levelOf,
    blockHTML: blockHTML
  };
})();
