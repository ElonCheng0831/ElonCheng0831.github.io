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
  var concState = { last: "w", showRho: false };

  function concEls() {
    return {
      formula: $("#conc-formula"),
      mass: $("#conc-mass"),
      w: $("#conc-w"),
      c: $("#conc-c"),
      rho: $("#conc-rho"),
      rhoField: $("#conc-rho-field"),
      ref: $("#conc-densref"),
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

  /* 最近手填的是 c 还是 w；另一栏自动算。密度永远是输入 */
  function derivedField() {
    return concState.last === "w" ? "c" : "w";
  }

  function markAuto(el) {
    var map = { w: el.w, c: el.c };
    var auto = derivedField();
    Object.keys(map).forEach(function (k) {
      var field = map[k].closest ? map[k].closest(".calc-field") : null;
      if (field) field.classList.toggle("is-auto", auto === k);
    });
  }

  /* 参考密度：有表就渲染浓度点并让密度栏可见；没表就把密度栏收起来，避免让人填一个没有依据的数 */
  function renderDensityRef(el) {
    var host = el.ref;
    if (!host) return;
    var raw = (el.formula.value || "").trim();
    if (!raw) {
      host.innerHTML = "";
      if (el.rhoField) el.rhoField.classList.remove("is-hidden");
      return;
    }
    var ref = Core.densityRef ? Core.densityRef(raw) : null;
    if (!ref) {
      host.innerHTML = "";
      return;
    }
    var cur = parseFloat(el.w.value);

    if (!ref.ok) {
      var revealed = !!concState.showRho;
      if (el.rhoField) el.rhoField.classList.toggle("is-hidden", !revealed);
      host.innerHTML =
        '<div class="dens-head"><b>没有「' + esc(raw) + '」的密度对照表</b><span>' + ref.temp + " ℃</span></div>" +
        '<p class="dens-none">这种溶质没有现成的浓度-密度数据，密度栏先收起来了，按稀溶液 ρ≈1.00 估算（' +
        ref.range[0].toFixed(2) + "–" + ref.range[1].toFixed(2) + " g/mL）。手上有实测值的话 " +
        '<button type="button" class="dens-reveal" data-show-rho="1">' + (revealed ? "隐藏密度栏" : "填实际密度") + "</button>" +
        "</p>";
      return;
    }

    if (el.rhoField) el.rhoField.classList.remove("is-hidden");
    var chips = ref.points.map(function (p) {
      var on = isFinite(cur) && Math.abs(cur - p[0]) < 0.005;
      return '<button type="button" class="dens-chip' + (on ? " is-cur" : "") + '" data-w="' + p[0] + '" data-rho="' + p[1] + '">' +
        p[0] + "% <i>" + p[1].toFixed(3) + "</i></button>";
    }).join("");

    var near = isFinite(cur) ? Core.densityAt(raw, cur) : null;
    var top = ref.points[ref.points.length - 1][0];
    var over = isFinite(cur) && cur > top;
    host.innerHTML =
      '<div class="dens-head"><b>' + esc(ref.name) + " · " + ref.temp + " ℃ 参考密度</b><span>点一个浓度点，浓度和密度一起填好；改了质量分数也会自动带出密度</span></div>" +
      '<div class="dens-points">' + chips + "</div>" +
      (near !== null && near !== undefined
        ? '<p class="dens-note">' + (over
            ? "质量分数超过表格上限（" + top + "%），先按 " + top + "% 的值 " + near.toFixed(3) + " g/mL 计。"
            : "按相邻两点插值：质量分数 " + fmt(cur, 2) + "% 时约 " + near.toFixed(3) + " g/mL。") + "</p>"
        : "");
  }

  /* 有对照表时，按当前质量分数把密度填进去（输入框失焦或换溶质时触发） */
  function autoFillRho(el) {
    var raw = (el.formula.value || "").trim();
    if (!raw || !el.rho) return;
    var ref = Core.densityRef ? Core.densityRef(raw) : null;
    if (!ref || !ref.ok) return;
    var w = parseFloat(el.w.value);
    if (!isFinite(w)) return;
    var near = Core.densityAt(raw, w);
    if (near === null || near === undefined) return;
    el.rho.value = near.toFixed(3);
    computeConc();
  }

  function computeConc() {
    var el = concEls();
    var mm = renderMolarMass(el);
    markAuto(el);
    renderDensityRef(el);
    if (!mm) {
      el.out.innerHTML = "";
      el.dout.textContent = "—";
      return;
    }

    var hidden = !!(el.rhoField && el.rhoField.classList.contains("is-hidden"));
    var rho = hidden ? 1.0 : parseFloat(el.rho.value);
    var w = parseFloat(el.w.value);
    var c = parseFloat(el.c.value);
    var res;

    if (!isFinite(rho) || rho <= 0) {
      el.out.innerHTML = errLine("密度要填一个大于 0 的数。");
    } else if (derivedField() === "c") {
      if (!isFinite(w)) {
        el.out.innerHTML = '<p class="calc-hint">填一个质量分数，浓度就自动算出来了。</p>';
      } else {
        res = Core.massPercentToMolar(w, rho, mm.mass);
        if (res.ok) {
          el.c.value = fmt(res.value, 4);
          el.out.innerHTML = line("质量分数 " + fmt(w, 3) + "% × 密度 " + fmt(rho, 3) + (hidden ? "（按 1.00 估算）" : "") + " → 浓度", fmt(res.value, 4) + " mol/L");
        } else {
          el.out.innerHTML = errLine(res.error);
        }
      }
    } else {
      if (!isFinite(c)) {
        el.out.innerHTML = '<p class="calc-hint">填一个浓度，质量分数就自动算出来了。</p>';
      } else {
        res = Core.molarToMassPercent(c, rho, mm.mass);
        if (res.ok) {
          el.w.value = fmt(res.value, 4);
          el.out.innerHTML = line("浓度 " + fmt(c, 4) + " mol/L × 密度 " + fmt(rho, 3) + (hidden ? "（按 1.00 估算）" : "") + " → 质量分数", fmt(res.value, 3) + "%");
        } else {
          el.out.innerHTML = errLine(res.error);
        }
      }
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
    el.formula.addEventListener("input", function () {
      concState.showRho = false;
      computeConc();
      autoFillRho(el);
    });
    el.rho.addEventListener("input", function () { onEdit("rho"); });
    el.w.addEventListener("input", function () { onEdit("w"); });
    el.c.addEventListener("input", function () { onEdit("c"); });

    /* 质量分数输完（失焦/回车）：有对照表就把密度自动带出来 */
    el.w.addEventListener("change", function () { autoFillRho(el); });

    /* 手填 w 就让 c 跟着算，手填 c 就让 w 跟着算；改密度则重算「不是刚手填的那一个」 */
    function onEdit(field) {
      if (field === "w" || field === "c") concState.last = field;
      computeConc();
    }
    el.m.addEventListener("input", function () { computeConc(); });
    el.v.addEventListener("input", function () { computeConc(); });

    /* 参考密度：点一个点，同时填好质量分数与密度 */
    if (el.ref) {
      el.ref.addEventListener("click", function (e) {
        var reveal = e.target && e.target.closest ? e.target.closest("[data-show-rho]") : null;
        if (reveal) {
          concState.showRho = !concState.showRho;
          renderDensityRef(el);
          return;
        }
        var chip = e.target && e.target.closest ? e.target.closest(".dens-chip") : null;
        if (!chip) return;
        el.w.value = chip.getAttribute("data-w");
        el.rho.value = chip.getAttribute("data-rho");
        concState.last = "w";
        computeConc();
      });
    }

    $$("[data-fill]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        el.formula.value = btn.getAttribute("data-fill");
        computeConc();
      });
    });

    /* 初始：给一个常见值；有对照表就按 36% 把密度带出来 */
    el.w.value = "36";
    el.rho.value = "1.34";
    concState.last = "w";
    computeConc();
    autoFillRho(el);
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
