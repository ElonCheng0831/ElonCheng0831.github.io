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
    var panels = { conc: $("#panel-conc"), eq: $("#panel-eq"), lib: $("#panel-lib"), tit: $("#panel-tit") };
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
      .replace(/[=＝]\s*$/, "")   /* 结尾的等号只是"帮我补全"的提示符，不参与解析 */
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
    cand = dedupeCand(cand);

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
      // 只有敲完等号才补全产物；没写等号时什么都不做（顺手清掉旧提示）
      if (/[=＝]\s*$/.test(v)) { timer = setTimeout(runEquation, 120); }
      else if (status) { status.textContent = ""; status.className = "calc-status"; }
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
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

    initEqBank(input);

    runEquation({ noComplete: true });
  }

  /* ---------------- 方程式题库 ---------------- */
  /* 数据来自 assets/data-equations.js（由药品制法 / 化学实验的 principle 抽题并校验） */
  var eqBankState = { q: "", src: "all", shown: 30 };

  function eqBankAll() {
    var bank = Array.isArray(window.EQUATION_BANK) ? window.EQUATION_BANK : [];
    return bank;
  }

  function eqBankMatch(item, q) {
    if (!q) return true;
    var hay = (item.eq + " " + item.name + " " + (item.cat || "") + " " + (item.cond || "")).toLowerCase();
    var needle = q.toLowerCase();
    /* 化学式里常写成下标/全角，这里把两边都压平再比 */
    var flatHay = hay.replace(/[₀-₉]/g, function (ch) { return String("₀₁₂₃₄₅₆₇₈₉".indexOf(ch)); }).replace(/\s+/g, "");
    var flatNeedle = needle.replace(/[₀-₉]/g, function (ch) { return String("₀₁₂₃₄₅₆₇₈₉".indexOf(ch)); }).replace(/\s+/g, "");
    return hay.indexOf(needle) >= 0 || flatHay.indexOf(flatNeedle) >= 0;
  }

  function renderEqBank(input) {
    var list = $("#eq-bank-list");
    if (!list) return;
    var all = eqBankAll();
    var q = eqBankState.q.trim();
    var filtered = all.filter(function (item) {
      if (eqBankState.src !== "all" && item.kind !== eqBankState.src) return false;
      return eqBankMatch(item, q);
    });

    var countEl = $("#eq-bank-count");
    if (countEl) countEl.textContent = filtered.length === all.length ? String(all.length) : filtered.length + " / " + all.length;

    var slice = filtered.slice(0, eqBankState.shown);
    if (!slice.length) {
      list.innerHTML = '<p class="eq-bank-empty">没找到匹配的方程式，换个关键词试试（可以搜物质名、化学式或类别）。</p>';
    } else {
      list.innerHTML = slice.map(function (item, i) {
        var srcLabel = item.kind === "prep" ? "制法 · " + item.name : "实验 · " + item.name;
        return '<button type="button" class="eq-bank-item" data-bank-idx="' + i + '">' +
          '<span class="eb-eq">' + esc(item.eq) + "</span>" +
          (item.cond ? '<span class="eb-cond">' + esc(item.cond) + "</span>" : "") +
          '<span class="eb-src">' + esc(srcLabel) + "</span>" +
          "</button>";
      }).join("");
      list.querySelectorAll(".eq-bank-item").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = parseInt(btn.getAttribute("data-bank-idx"), 10);
          var item = slice[idx];
          if (!item) return;
          input.value = item.eq;
          if (input.focus) input.focus();
          runEquation({ noComplete: true });
          var res = $("#eq-result");
          if (res && res.scrollIntoView) res.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      });
    }

    var moreWrap = $("#eq-bank-more-wrap");
    var moreBtn = $("#eq-bank-more");
    var shownEl = $("#eq-bank-shown");
    if (moreWrap && moreBtn) {
      var hasMore = filtered.length > eqBankState.shown;
      moreWrap.hidden = !hasMore;
      if (shownEl) shownEl.textContent = "已显示 " + slice.length + " / " + filtered.length;
      moreBtn.onclick = function () {
        eqBankState.shown += 30;
        renderEqBank(input);
      };
    }
  }

  function initEqBank(input) {
    var list = $("#eq-bank-list");
    if (!list) return;
    var all = eqBankAll();
    if (!all.length) {
      var card = $("#eq-bank-card");
      if (card) card.hidden = true;
      return;
    }

    var search = $("#eq-bank-search");
    if (search) {
      var timer = null;
      search.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          eqBankState.q = search.value || "";
          eqBankState.shown = 30;
          renderEqBank(input);
        }, 160);
      });
    }

    $$("[data-bank-src]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        eqBankState.src = btn.getAttribute("data-bank-src") || "all";
        eqBankState.shown = 30;
        $$("[data-bank-src]").forEach(function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        renderEqBank(input);
      });
    });

    renderEqBank(input);
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
    cand = dedupeCand(cand);
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
  

/* ================= 滴定计算 ================= */
function initTitration(){
  var c = $("#tit-c"), v = $("#tit-v"), vx = $("#tit-vx");
  var a = $("#tit-a"), b = $("#tit-b"), m = $("#tit-m"), ms = $("#tit-ms");
  var out = $("#tit-out"), steps = $("#tit-steps");
  if (!c || !v || !out) return;

  function num(el){ var x = parseFloat(String(el && el.value || "").replace(/[^\d.\-]/g, "")); return isFinite(x) ? x : NaN; }

  function compute(){
    var cs = num(c), vs = num(v), vxs = num(vx);
    var na = Math.max(1, Math.round(num(a) || 1)), nb = Math.max(1, Math.round(num(b) || 1));
    var M = num(m), m0 = num(ms);

    if (!isFinite(cs) || !isFinite(vs) || !isFinite(vxs) || cs <= 0 || vs <= 0 || vxs <= 0){
      out.innerHTML = '<p class="calc-hint">填好标准液浓度、消耗体积和取样体积就能算。</p>';
      if (steps) steps.innerHTML = "";
      return;
    }
    var nStd = cs * vs / 1000;
    var nX = nStd * na / nb;
    var cx = nX / (vxs / 1000);

    var rows = [];
    rows.push(["待测物物质的量 n", nX.toPrecision(4) + " mol"]);
    rows.push(["待测液浓度 c", cx.toPrecision(4) + " mol/L"]);
    if (isFinite(M) && M > 0) rows.push(["待测物质量 m", (nX * M).toPrecision(4) + " g"]);
    if (isFinite(M) && M > 0 && isFinite(m0) && m0 > 0){
      var w = nX * M / m0 * 100;
      rows.push(["纯度", w.toPrecision(4) + " %"]);
    }
    out.innerHTML = rows.map(function (r) {
      return '<div class="calc-out-row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
    }).join("");

    if (steps){
      steps.innerHTML =
        '<p>n(标准) = c × V = ' + cs + ' × ' + vs + ' / 1000 = <b>' + nStd.toPrecision(4) + '</b> mol</p>' +
        '<p>n(待测) = n(标准) × ' + na + ' / ' + nb + ' = <b>' + nX.toPrecision(4) + '</b> mol</p>' +
        '<p>c(待测) = n / V = ' + nX.toPrecision(4) + ' / ' + (vxs / 1000) + ' = <b>' + cx.toPrecision(4) + '</b> mol/L</p>';
    }
  }

  [c, v, vx, a, b, m, ms].forEach(function (el) {
    if (el) { el.addEventListener("input", compute); el.addEventListener("change", compute); }
  });
  compute();
}

/* ================= 试剂物质库 ================= */
var libMolarCache = Object.create(null);
function libMolar(f){
  if (f in libMolarCache) return libMolarCache[f];
  try {
    var mm = window.ChemCore && ChemCore.molarMass ? ChemCore.molarMass(f) : null;
    var val = (mm && typeof mm === "object" && typeof mm.mass === "number") ? mm.mass
            : (typeof mm === "number" && isFinite(mm) ? mm : null);
    libMolarCache[f] = val;
    return val;
  } catch (e) { return null; }
}
function initLib(){
  var list = $("#lib-list"), search = $("#lib-search"), more = $("#lib-more"), cnt = $("#lib-count");
  if (!list || !window.SUBSTANCES) return;
  var all = window.SUBSTANCES.slice().sort(function (a, b) { return a.n.localeCompare(b.n, "zh-Hans-CN"); });
  var data = all, shown = 60, STEP = 60;
  if (cnt) cnt.textContent = String(all.length);

  function row(o){
    var m = libMolar(o.f);
    return '<div class="lib-row" data-f="' + esc(o.f) + '">' +
      '<div class="lib-name"><b>' + esc(o.n) + '</b><span>' + esc(o.k || "") + '</span></div>' +
      '<div class="lib-formula">' + esc(o.f) + '</div>' +
      '<div class="lib-mass">' + (m == null ? "—" : m.toFixed(2)) + '</div>' +
      '<button type="button" class="mini lib-use">填进换算</button>' +
    '</div>';
  }
  function paint(){
    var slice = data.slice(0, shown);
    list.innerHTML = slice.length
      ? '<div class="lib-head"><span>名称</span><span>化学式</span><span>M g/mol</span><span></span></div>' + slice.map(row).join("")
      : '<p class="calc-hint">没找到，换个中文名或化学式试试。</p>';
    if (more) more.hidden = shown >= data.length;
  }
  function render(){
    var q = String(search && search.value || "").trim().toLowerCase();
    data = !q ? all : all.filter(function (o) {
      return o.n.toLowerCase().indexOf(q) >= 0 || o.f.toLowerCase().indexOf(q) >= 0;
    });
    shown = STEP;
    paint();
  }
  if (search) search.addEventListener("input", function () {
    clearTimeout(search._t);
    search._t = setTimeout(render, 120);
  });
  if (more) more.addEventListener("click", function () { shown += STEP; paint(); });
  list.addEventListener("click", function (e) {
    var btn = e.target.closest(".lib-use");
    if (!btn) return;
    var rowEl = btn.closest(".lib-row");
    var f = rowEl && rowEl.getAttribute("data-f");
    if (!f) return;
    var input = $("#conc-formula");
    if (input) {
      input.value = f;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    var tab = document.querySelector('[data-panel="conc"]');
    if (tab) tab.click();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  render();
}

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
    safeInit("lib", initLib);
    safeInit("tit", initTitration);
  });
})();

/* 同一组反应物在不同表/规则里可能给出完全相同产物，弹窗前按产物签名合并：
   保留说明最长的那一条（人工条目通常比规则推断写得具体） */
function dedupeCand(list) {
  var order = [], seen = {}, i, c, key, note;
  for (i = 0; i < list.length; i++) {
    c = list[i];
    if (!c || !c.p || !c.p.length) { order.push(c); continue; }
    key = c.p.join("|");
    note = String(c.note || c.why || "");
    if (!seen[key]) { seen[key] = { item: c, len: note.length, pos: order.length }; order.push(key); }
    else if (note.length > seen[key].len) { seen[key] = { item: c, len: note.length, pos: seen[key].pos }; }
  }
  var out = [], u, k;
  for (i = 0; i < order.length; i++) {
    k = order[i];
    if (typeof k === "string" && seen[k]) { out.push(seen[k].item); }
    else if (typeof k !== "string") { out.push(k); }
  }
  /* 去重后保持原顺序 */
  var rank = {}; list.forEach(function (x, idx) { if (x && x.p) rank[x.p.join("|")] = idx; });
  out.sort(function (x, y) { return (rank[x.p.join("|")] || 0) - (rank[y.p.join("|")] || 0); });
  return out;
}
