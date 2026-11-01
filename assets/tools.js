/* 化境 ChemLab · 计算工具页逻辑（工具页专用，不含站点通用逻辑） */
(function () {
  "use strict";

  var Core = window.ChemCore;
  var INDEX = window.CHEM_INDEX || [];
  if (!Core) return;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* 化学式 → 带下标的 HTML */
  function subHTML(formula) {
    return esc(formula).replace(/([A-Za-z\)\]])(\d+)/g, function (m, head, num) {
      return head + "<sub>" + num + "</sub>";
    });
  }

  function normalFormula(s) {
    return String(s || "")
      .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, function (ch) { return "₀₁₂₃₄₅₆₇₈₉".indexOf(ch); })
      .replace(/\s+/g, "")
      .replace(/[（）]/g, function (ch) { return ch === "（" ? "(" : ")"; })
      .replace(/[.。]/g, "·")
      .toLowerCase();
  }

  var LOOKUP = (function () {
    var map = {};
    INDEX.forEach(function (row) {
      var key = normalFormula(row[3]);
      if (!key) return;
      (map[key] || (map[key] = [])).push({ kind: row[0], id: row[1], name: row[2], formula: row[3], cat: row[4] });
    });
    return map;
  })();

  function matchesFor(formula) {
    var key = normalFormula(formula);
    return LOOKUP[key] || [];
  }

  function jumpChips(formula) {
    var hits = matchesFor(formula);
    if (!hits.length) return '<span class="jump-none">站内未收录</span>';
    return hits.slice(0, 3).map(function (h) {
      var href = (h.kind === "p" ? "preparations.html#p/" : "experiments.html#e/") + h.id;
      var label = h.kind === "p" ? "制法" : "实验";
      return '<a class="jump" href="' + href + '">' + esc(h.name) + '<small>' + label + '</small></a>';
    }).join("");
  }

  /* ---------------- 标签页 ---------------- */
  function initTabs() {
    var tabs = $$(".calc-tab");
    var panels = { conc: $("#panel-conc"), eq: $("#panel-eq") };
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var name = tab.getAttribute("data-panel");
        tabs.forEach(function (t) {
          var on = t === tab;
          t.classList.toggle("is-on", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        Object.keys(panels).forEach(function (k) {
          if (!panels[k]) return;
          var on = k === name;
          panels[k].classList.toggle("is-on", on);
          if (on) panels[k].removeAttribute("hidden");
          else panels[k].setAttribute("hidden", "");
        });
        if (name === "eq") runEquation();
      });
    });
  }

  /* ---------------- 浓度换算 ---------------- */
  var concState = { last: "w" };

  function concEls() {
    return {
      formula: $("#conc-formula"),
      mass: $("#conc-mass"),
      w: $("#conc-w"),
      c: $("#conc-c"),
      rho: $("#conc-rho"),
      out: $("#conc-out"),
      m: $("#diss-m"),
      v: $("#diss-v"),
      dout: $("#diss-out")
    };
  }

  function fmt(n, digits) {
    if (!isFinite(n)) return "—";
    var d = digits === undefined ? 4 : digits;
    var s = n.toFixed(d);
    s = s.replace(/\.?0+$/, "");
    return s;
  }

  function renderMolarMass(el) {
    var raw = (el.formula.value || "").trim();
    if (!raw) {
      el.mass.innerHTML = '<p class="calc-err">先写一个化学式。</p>';
      return null;
    }
    var mm = Core.molarMass(raw);
    if (!mm.ok) {
      el.mass.innerHTML = '<p class="calc-err">' + esc(mm.error) + "</p>";
      return null;
    }
    var parts = mm.detail.map(function (d) {
      return "<span>" + esc(d.el) + " × " + d.n + " = " + fmt(d.mass, 2) + "</span>";
    }).join("");
    el.mass.innerHTML =
      '<div class="mass-top"><b>M = ' + fmt(mm.mass, 3) + '</b><span>g/mol</span></div>' +
      '<div class="mass-parts">' + parts + "</div>" +
      '<div class="mass-jump">' + jumpChips(raw) + "</div>";
    return mm;
  }

  function computeConc() {
    var el = concEls();
    var mm = renderMolarMass(el);
    var rho = parseFloat(el.rho.value);
    if (!mm) {
      el.out.innerHTML = "";
      el.dout.textContent = "—";
      return;
    }

    var w = parseFloat(el.w.value);
    var c = parseFloat(el.c.value);

    if (concState.last === "w" && isFinite(w)) {
      var r1 = Core.massPercentToMolar(w, rho, mm.mass);
      if (r1.ok) {
        el.c.value = fmt(r1.value, 4);
        el.out.innerHTML = line("质量分数 " + fmt(w, 3) + "% → 浓度", fmt(r1.value, 4) + " mol/L");
      } else {
        el.out.innerHTML = errLine(r1.error);
      }
    } else if (concState.last === "c" && isFinite(c)) {
      var r2 = Core.molarToMassPercent(c, rho, mm.mass);
      if (r2.ok) {
        el.w.value = fmt(r2.value, 4);
        el.out.innerHTML = line("浓度 " + fmt(c, 4) + " mol/L → 质量分数", fmt(r2.value, 3) + "%");
      } else {
        el.out.innerHTML = errLine(r2.error);
      }
    } else {
      el.out.innerHTML = '<p class="calc-hint">在上面填一个已知量（质量分数或浓度），另一边会自动算出来。</p>';
    }

    /* 固体溶解 → 浓度 */
    var m = parseFloat(el.m.value);
    var v = parseFloat(el.v.value);
    var r3 = Core.dissolveToMolar(m, v, mm.mass);
    el.dout.innerHTML = r3.ok
      ? '<b>' + fmt(r3.value, 4) + '</b> mol/L'
      : '<span class="calc-err">' + esc(r3.error) + "</span>";
  }

  function line(label, value) {
    return '<div class="out-line"><span>' + esc(label) + '</span><b>' + esc(value) + "</b></div>";
  }
  function errLine(msg) {
    return '<p class="calc-err">' + esc(msg) + "</p>";
  }

  function initConc() {
    var el = concEls();
    el.formula.addEventListener("input", function () { computeConc(); });
    el.rho.addEventListener("input", function () { computeConc(); });
    el.w.addEventListener("input", function () { concState.last = "w"; computeConc(); });
    el.c.addEventListener("input", function () { concState.last = "c"; computeConc(); });
    el.m.addEventListener("input", function () { computeConc(); });
    el.v.addEventListener("input", function () { computeConc(); });

    $$("[data-fill]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        el.formula.value = btn.getAttribute("data-fill");
        computeConc();
      });
    });

    /* 初始：给一个常见值 */
    el.w.value = "36";
    el.rho.value = "1.34";
    computeConc();
  }

  /* ---------------- 方程式配平 ---------------- */
  function runEquation() {
    var input = $("#eq-input");
    var out = $("#eq-result");
    var status = $("#eq-status");
    if (!input || !out) return;

    var res = Core.balance(input.value);
    if (!res.ok) {
      status.textContent = "";
      status.className = "calc-status is-bad";
      status.textContent = res.error;
      out.innerHTML = "";
      return;
    }

    status.className = "calc-status is-ok";
    status.textContent = "原子守恒 ✓";

    var lhs = [], rhs = [];
    for (var i = 0; i < res.species.length; i++) {
      var coef = res.coefs[i];
      var piece = (coef > 1 ? '<b class="coef">' + coef + "</b>" : "") + subHTML(res.species[i]);
      if (i < res.lhsCount) lhs.push(piece); else rhs.push(piece);
    }

    var ratio = res.coefs.join(" : ");
    var massRatio = res.simpleMass ? res.simpleMass.join(" : ") : "无法折成小整数比";

    var rows = res.species.map(function (name, idx) {
      var mm = res.masses[idx];
      var mass = res.rawMass[idx];
      var role = idx < res.lhsCount ? "反应物" : "生成物";
      return "<tr>" +
        '<td><b class="coef">' + res.coefs[idx] + "</b>" + subHTML(name) + "</td>" +
        "<td>" + role + "</td>" +
        "<td>" + (mm === null ? "—" : fmt(mm, 2)) + "</td>" +
        "<td>" + (mass === null ? "—" : fmt(mass, 2)) + "</td>" +
        '<td class="jump-cell">' + jumpChips(name) + "</td>" +
        "</tr>";
    }).join("");

    out.innerHTML =
      '<div class="eq-line">' + lhs.join(' <span class="plus">+</span> ') +
      ' <span class="arrow">→</span> ' + rhs.join(' <span class="plus">+</span> ') + "</div>" +
      '<div class="eq-stats">' +
      '<div class="eq-stat"><span>摩尔比</span><b>' + ratio + "</b></div>" +
      '<div class="eq-stat"><span>简化质量比</span><b>' + esc(massRatio) + "</b></div>" +
      '<div class="eq-stat"><span>质量守恒</span><b>' + (res.massConserved ? "两边相等 ✓" : "有出入，请复核") + "</b></div>" +
      "</div>" +
      '<table class="eq-table"><thead><tr><th>物质</th><th>角色</th><th>摩尔质量 g/mol</th><th>相对质量</th><th>站内</th></tr></thead>' +
      "<tbody>" + rows + "</tbody></table>";
  }

  function initEq() {
    var input = $("#eq-input");
    var run = $("#eq-run");
    if (!input) return;

    run.addEventListener("click", runEquation);
    var timer = null;
    input.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(runEquation, 320);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        runEquation();
      }
    });

    $$("[data-eq]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        input.value = btn.getAttribute("data-eq");
        runEquation();
      });
    });

    runEquation();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTabs();
    initConc();
    initEq();
  });
})();
