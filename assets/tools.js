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
        if (name === "eq") runEquation({ noComplete: true });
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
      bp: $("#conc-bp"),
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

  // 溶质的常压沸点（查 chem-core 的 BOILING 表）
  function renderBoiling(el) {
    var box = el.bp;
    if (!box || !el.formula) return;
    var name = String(el.formula.value || "").trim();
    if (!name) { box.value = "—"; box.removeAttribute("title"); box.classList.remove("is-muted"); return; }

    var w = parseFloat(el.w.value);
    var pure = Core.boilingOf ? Core.boilingOf(name) : null;
    var sol = (Core.solutionBp && isFinite(w)) ? Core.solutionBp(name, w) : null;

    if (sol) {
      if (sol.kind === "volatile") {
        box.value = sol.value === null ? "—" : sol.value;
        box.title = (pure ? pure.n + " 纯物质 " + pure.bp + " ℃；" : "") + sol.detail;
        box.classList.add("is-muted");
        return;
      }
      box.value = (sol.kind === "estimate" ? "≈" : "") + sol.value;
      box.title = (isFinite(w) ? "按 " + fmt(w, 2) + "% 计 · " : "") + (sol.detail || "");
      box.classList.toggle("is-muted", sol.kind === "estimate");
      return;
    }

    if (!pure) { box.value = "—"; box.title = "沸点表里没有「" + name + "」"; box.classList.remove("is-muted"); return; }
    box.value = pure.bp === null ? pure.decomp + "（分解）" : pure.bp;
    box.title = pure.n + " · 纯物质 " + (pure.bp === null ? pure.decomp + " ℃ 受热分解" : pure.bp + " ℃") + (pure.note ? " · " + pure.note : "");
    box.classList.remove("is-muted");
  }

  function computeConc() {
    var el = concEls();
    var mm = renderMolarMass(el);
    renderBoiling(el);
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
  function runEquation(opts) {
    var noComplete = !!(opts && opts.noComplete);
    var input = $("#eq-input");
    var out = $("#eq-result");
    var status = $("#eq-status");
    if (!input || !out) return;
    if (noComplete) {
      if (!/->/.test(String(input.value || ""))) return;
    } else {
      var done = eqComplete(input, status);
      if (done === "pending" || done === "none") return;
    }

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

  // 只写反应物（不必写等号）时，按常见反应表补全产物，再交给配平
  function eqComplete(input, status) {
    var raw = String(input.value || "")
      .replace(/［＝]/g, "=")
      .replace(/[－—–]/g, "-")
      .replace(/-+>/g, "->")
      .replace(/=>/g, "->")
      .replace(/→/g, "->")
      .trim();
    if (!raw) return "skip";

    var parts = raw.split(/->/);
    var lhs = (parts[0] || "").trim();
    var rhs = (parts[1] || "").trim();
    if (rhs) return "skip";              // 已经写了产物，直接配平

    // 反应物去掉前面的系数（2H2 -> H2），只用于查表
    var terms = lhs.split(/[+＋,，、;；]/).map(function (s) {
      return s.trim().replace(/^\d+(?=[A-Za-z(（])/, "");
    }).filter(Boolean);
    var reactants = rxParse(terms.join("+"));
    if (!reactants.length) return "skip";

    var inferred = false;
    var hit = rxMatch(reactants);
    var cand = hit.exact.length ? hit.exact.slice() : (reactants.length === 1 ? hit.partial.slice() : []);

    // 表里没有：按性质规律推断（复分解看沉淀/气体/水、金属活动性、铵盐遇碱…）
    if (!cand.length && window.RxRules) {
      var inf = window.RxRules.infer(reactants);
      if (inf.length) {
        inferred = true;
        cand = inf.map(function (x) {
          return {
            r: reactants.slice(),
            cond: x.cond,
            p: x.p,
            note: "【规则推断】" + x.why,
            inferred: true,
            rule: x.rule
          };
        });
      }
    }

    if (!cand.length) {
      if (status) {
        var near = rxNear(reactants);
        status.className = "calc-status is-bad";
        status.innerHTML = "常见反应表里没有这组组合。把产物写上也能直接配平，例如 <code>" + esc(lhs) + " -&gt; 产物</code>。"
          + (near.length ? "<br><span class=\"rx-near-label\">表里相近的条目：</span>" + near.map(function (e) {
              return '<button type="button" class="rx-near" data-eq="' + esc(e.r.join(" + ") + " -> " + e.p.join(" + ")) + '">'
                + esc(e.r.join(" + ")) + " → " + esc(e.p.join(" + ")) + "</button>";
            }).join("") : "");
      }
      return "none";
    }

    var lhsClean = terms.join(" + ");
    if (cand.length === 1) {
      input.value = lhsClean + " -> " + cand[0].p.join(" + ");
      if (status) {
        status.className = "calc-status";
        status.textContent = "已补全产物（" + cand[0].cond + "）并配平";
      }
      return "filled";
    }

    rxPick(cand, status, function (entry) {
      input.value = lhsClean + " -> " + entry.p.join(" + ");
      runEquation();
    });
    return "pending";
  }

  function initEq() {
    var input = $("#eq-input");
    var run = $("#eq-run");
    if (!input) return;

    run.addEventListener("click", runEquation);
    var timer = null;
    input.addEventListener("input", function () {
      clearTimeout(timer);
      var v = String(input.value || "");
      if (/[=＝]\s*$/.test(v)) { runEquation(); return; }   // 敲完等号立即补全
      timer = setTimeout(runEquation, 320);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        runEquation();
      }
    });
    input.addEventListener("blur", function () { if (input.value.trim()) runEquation(); });

    $$("[data-eq]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        input.value = btn.getAttribute("data-eq");
        runEquation();
      });
    });

    runEquation({ noComplete: true });
  }

  /* ---------------- 反应预测 ---------------- */
  // 保留大小写的化学式归一化：处理下标、全角括号、空格；
  // 全小写输入用元素表做贪心还原（hcl -> HCl）
  function rxNorm(s) {
    var t = String(s || "")
      .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, function (ch) { return String("₀₁₂₃₄₅₆₇₈₉".indexOf(ch)); })
      .replace(/\s+/g, "")
      .replace(/[（）]/g, function (ch) { return ch === "（" ? "(" : ")"; })
      .replace(/[.。]/g, "·");
    if (!t) return "";
    var letters = t.replace(/[^A-Za-z]/g, "");
    if (letters && letters === letters.toLowerCase()) {
      var AW = (Core.AW || {});
      var out = "", i = 0;
      while (i < t.length) {
        var ch = t.charAt(i);
        if (!/[A-Za-z]/.test(ch)) { out += ch; i++; continue; }
        var two = ch.toUpperCase() + t.charAt(i + 1).toLowerCase();
        if (/[A-Za-z]/.test(t.charAt(i + 1)) && AW[two]) { out += two; i += 2; continue; }
        out += ch.toUpperCase();
        i++;
      }
      t = out;
    }
    return t;
  }

  function rxParse(str) {
    return String(str || "")
      .split(/[+＋,，、;；]/)
      .map(function (s) { return rxNorm(s).trim(); })
      .filter(Boolean);
  }

  // 找不到完全匹配时，按“至少共享一个反应物”给出最多 3 条相近条目
  function rxNear(list) {
    var table = window.REACTIONS || [];
    var out = [];
    for (var i = 0; i < table.length; i++) {
      var e = table[i];
      var shared = e.r.some(function (f) { return list.indexOf(f) >= 0; });
      if (shared) out.push(e);
      if (out.length >= 3) break;
    }
    return out;
  }

  function rxMatch(list) {
    var table = window.REACTIONS || [];
    var want = list.slice().sort().join("|");
    var exact = [], partial = [];
    table.forEach(function (e) {
      if (e.r.slice().sort().join("|") === want) exact.push(e);
      else if (e.r.every(function (f) { return list.indexOf(f) >= 0; })) partial.push(e);
    });
    return { exact: exact, partial: partial };
  }

  function rxEqHTML(entry) {
    var lhs = entry.r.join(" + ");
    var rhs = entry.p.join(" + ");
    var res = Core.balance(lhs + " -> " + rhs);
    var line;
    if (res && res.ok) {
      var l = [], r = [];
      for (var i = 0; i < res.species.length; i++) {
        var piece = (res.coefs[i] > 1 ? '<b class="coef">' + res.coefs[i] + "</b>" : "") + subHTML(res.species[i]);
        (i < res.lhsCount ? l : r).push(piece);
      }
      line = '<div class="eq-line">' + l.join(' <span class="plus">+</span> ') +
        ' <span class="arrow">→</span> ' + r.join(' <span class="plus">+</span> ') + "</div>";
    } else {
      line = '<div class="eq-line rx-raw">' + subHTML(lhs) + ' <span class="arrow">→</span> ' + subHTML(rhs) +
        (res ? ' <span class="rx-warn">配平失败：' + esc(res.error) + "</span>" : "") + "</div>";
    }
    return '<article class="rx-item">' +
      '<div class="rx-head"><span class="rx-cond">' + esc(entry.cond) + "</span>" +
      (entry.note ? '<span class="rx-note">' + esc(entry.note) + "</span>" : "") + "</div>" +
      line +
      '<div class="rx-foot">生成物：' + entry.p.map(function (f) { return subHTML(f); }).join("、") + "</div></article>";
  }

  function rxRender(entry, status) {
    var out = $("#rx-result");
    if (!out || !entry) return;
    out.innerHTML = rxEqHTML(entry);
    if (entry.inferred) out.setAttribute("data-inferred", "1");
    else out.removeAttribute("data-inferred");
    if (status) {
      status.className = "calc-status is-ok";
      status.textContent = "条件：" + entry.cond;
    }
  }

  function rxEqText(entry) {
    var res = Core.balance(entry.r.join(" + ") + " -> " + entry.p.join(" + "));
    if (!res || !res.ok) return subHTML(entry.r.join(" + ")) + ' <span class="arrow">→</span> ' + subHTML(entry.p.join(" + "));
    var l = [], r = [];
    for (var i = 0; i < res.species.length; i++) {
      var piece = (res.coefs[i] > 1 ? '<b class="coef">' + res.coefs[i] + "</b>" : "") + subHTML(res.species[i]);
      (i < res.lhsCount ? l : r).push(piece);
    }
    return l.join(' <span class="plus">+</span> ') + ' <span class="arrow">→</span> ' + r.join(' <span class="plus">+</span> ');
  }

  function rxPick(list, status, onPick) {
    var opened = document.querySelector("dialog.rx-dialog[open]");
    if (opened) { opened.close("cancel"); }
    var dlg = document.createElement("dialog");
    dlg.className = "rx-dialog";
    var rows = list.map(function (e, i) {
      return '<label class="rx-opt">' +
        '<input type="radio" name="rx-pick" value="' + i + '"' + (i === 0 ? " checked" : "") + ">" +
        '<span class="rx-opt-body"><span class="rx-opt-eq">' + rxEqText(e) + "</span>" +
        '<span class="rx-opt-cond">条件：' + esc(e.cond) + (e.note ? " · " + esc(e.note) : "") + "</span></span></label>";
    }).join("");
    dlg.innerHTML = '<form method="dialog" class="rx-dialog-inner">' +
      "<h3>这组反应物有 " + list.length + " 种可能</h3>" +
      '<p class="rx-dialog-hint">同样的反应物，条件不同产物会不一样。挑一条查看配平结果。</p>' +
      '<div class="rx-opts">' + rows + "</div>" +
      '<div class="rx-dialog-actions">' +
      '<button value="ok" class="btn btn-accent">用这条</button>' +
      '<button value="cancel" class="btn btn-ghost">取消</button></div></form>';
    document.body.appendChild(dlg);
    dlg.addEventListener("close", function () {
      var checked = dlg.querySelector('input[name="rx-pick"]:checked');
      var idx = dlg.returnValue === "ok" && checked ? Number(checked.value) : -1;
      if (idx >= 0 && list[idx]) {
        if (typeof onPick === "function") onPick(list[idx]);
        else rxRender(list[idx], status);
      }
      else if (status) {
        status.className = "calc-status";
        status.textContent = "已取消，未选择产物";
      }
      dlg.remove();
    });
    dlg.showModal();
  }

  function rxRun(opts) {
    var quiet = !!(opts && opts.quiet);
    var input = $("#rx-input");
    var out = $("#rx-result");
    var status = $("#rx-status");
    var condEl = $("#rx-cond");
    if (!input || !out || !status) return;

    var list = rxParse(input.value);
    out.innerHTML = "";
    if (!list.length) {
      status.className = "calc-status is-bad";
      status.textContent = "先写反应物，例如 Fe + O2";
      return;
    }

    var m = rxMatch(list);
    // 只有一个反应物时才允许退到“单物质分解”条目；
    // 多个反应物必须整套命中，避免 A + B 被误判成 A 自己的反应
    var cand = m.exact.length ? m.exact.slice() : (list.length === 1 ? m.partial.slice() : []);
    var cond = condEl ? condEl.value : "";
    if (cond) {
      var narrowed = cand.filter(function (e) { return String(e.cond).indexOf(cond) >= 0; });
      if (narrowed.length) cand = narrowed;
    }

    if (!cand.length) {
      status.className = "calc-status is-bad";
      status.textContent = "表里没有这条组合";
      out.innerHTML = '<p class="rx-empty">「' + esc(list.join(" + ")) +
        "」不在常见反应表里。可以换化学式写法，或到「方程式配平」里把产物也写全。</p>";
      return;
    }
    if (cand.length === 1) {
      rxRender(cand[0], status);
      return;
    }
    status.className = "calc-status";
    if (quiet) {
      status.textContent = "有 " + cand.length + " 种条件/产物，点「生成方程式」选择";
      return;
    }
    status.textContent = "有 " + cand.length + " 种条件/产物，请在弹窗中选择";
    rxPick(cand, status);
  }

  function initReactions() {
    var input = $("#rx-input");
    var run = $("#rx-run");
    if (!input || !run) return;

    run.addEventListener("click", rxRun);
    var timer = null;
    input.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(rxRun, 320);
    });
    var cond = $("#rx-cond");
    if (cond) cond.addEventListener("change", rxRun);
    Array.prototype.forEach.call(document.querySelectorAll("[data-rx]"), function (btn) {
      btn.addEventListener("click", function () {
        input.value = btn.getAttribute("data-rx");
        rxRun();
      });
    });
    rxRun({ quiet: true });
  }

  /* ---------------- 沸点参考 ---------------- */
  function initBoiling() {
    var box = $("#bp-table");
    var search = $("#bp-search");
    var count = $("#bp-count");
    if (!box || !search) return;

    var list = (Core.BOILING || []).slice().sort(function (a, b) {
      var av = a.bp === null ? a.decomp : a.bp;
      var bv = b.bp === null ? b.decomp : b.bp;
      return av - bv;
    });

    function render() {
      var q = String(search.value || "").trim().toLowerCase();
      var hit = list.filter(function (s) {
        if (!q) return true;
        return s.n.toLowerCase().indexOf(q) >= 0 || s.f.toLowerCase().indexOf(q) >= 0;
      });
      if (count) count.textContent = hit.length + " / " + list.length + " 条";
      if (!hit.length) {
        box.innerHTML = '<p class="rx-empty">没有匹配的条目，换个关键词试试。</p>';
        return;
      }
      box.innerHTML = '<table class="bp-table"><thead><tr><th>物质</th><th>化学式</th><th>温度 ℃</th><th>说明</th></tr></thead><tbody>' +
        hit.map(function (s) {
          var temp = s.bp === null ? '<span class="bp-decomp">' + s.decomp + "（分解）</span>" : s.bp;
          return "<tr><td>" + esc(s.n) + '</td><td class="mono">' + subHTML(s.f) + "</td><td>" + temp +
            "</td><td>" + esc(s.note || "") + "</td></tr>";
        }).join("") + "</tbody></table>";
    }

    search.addEventListener("input", render);
    render();
  }

  // 单个模块出错不该拖垮整页：逐个初始化并记录
  window.__initErrs = [];
  function safeInit(name, fn) {
    try { fn(); } catch (e) {
      window.__initErrs.push(name + ": " + (e && e.message ? e.message : String(e)));
      if (window.console && console.error) console.error("[init:" + name + "]", e);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    safeInit("tabs", initTabs);
    safeInit("conc", initConc);
    safeInit("eq", initEq);
    safeInit("reactions", initReactions);
    safeInit("boiling", initBoiling);
  });
})();
