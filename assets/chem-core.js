/* 化境 ChemLab · 计算核心
   化学式解析 / 摩尔质量 / 方程式配平 / 质量比。
   纯计算，不碰 DOM，浏览器与 Node 都能用（Node 下走 module.exports）。 */
(function (root) {
  "use strict";

  /* ---------------- 原子量 ---------------- */
  var AW = {
    H: 1.008, He: 4.003, Li: 6.94, Be: 9.012, B: 10.81, C: 12.011, N: 14.007,
    O: 15.999, F: 18.998, Ne: 20.18, Na: 22.99, Mg: 24.305, Al: 26.982,
    Si: 28.085, P: 30.974, S: 32.06, Cl: 35.45, Ar: 39.948, K: 39.098,
    Ca: 40.078, Sc: 44.956, Ti: 47.867, V: 50.942, Cr: 51.996, Mn: 54.938,
    Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38, Ga: 69.723,
    Ge: 72.63, As: 74.922, Se: 78.971, Br: 79.904, Kr: 83.798, Rb: 85.468,
    Sr: 87.62, Y: 88.906, Zr: 91.224, Nb: 92.906, Mo: 95.95, Ru: 101.07,
    Rh: 102.91, Pd: 106.42, Ag: 107.87, Cd: 112.41, In: 114.82, Sn: 118.71,
    Sb: 121.76, Te: 127.6, I: 126.9, Xe: 131.29, Cs: 132.91, Ba: 137.33,
    La: 138.91, Ce: 140.12, W: 183.84, Pt: 195.08, Au: 196.97, Hg: 200.59,
    Tl: 204.38, Pb: 207.2, Bi: 208.98, U: 238.03
  };

  var SUB = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉" };

  function subscript(n) {
    return String(n).split("").map(function (ch) { return SUB[ch] || ch; }).join("");
  }

  /* ---------------- 化学式解析 ---------------- */
  /* 支持：元素、括号 ()[]、数字下标、结晶水（· 或 *，可带前导系数，如 CuSO4·5H2O） */
  function parseFormula(raw) {
    if (!raw) return { ok: false, error: "化学式为空" };
    var s = String(raw)
      .replace(/\s+/g, "")
      /* 下标数字（₂₃₄…）与上标（²³）统一成普通数字，站内数据和教材写法都带这种字符 */
      .replace(/[₀-₉]/g, function (ch) { return String("₀₁₂₃₄₅₆₇₈₉".indexOf(ch)); })
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, function (ch) { return String("⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(ch)); })
      .replace(/[（]/g, "(").replace(/[）]/g, ")")
      .replace(/[【\[]/g, "(").replace(/[】\]]/g, ")")
      .replace(/[.。]/g, "·");
    if (!s) return { ok: false, error: "化学式为空" };

    var total = {};
    var parts = s.split(/[·*]/);

    /* 前导系数写在第一个片段上时，它乘的是整个物种：
       3NH3·H2O = 3 × (NH3·H2O)，而不是 3×NH3 + H2O。
       而 CuSO4·5H2O 里的 5 属于第二个片段，只乘 H2O。 */
    var overall = 1;
    if (parts.length > 1) {
      var firstLead = parts[0].match(/^(\d+)/);
      if (firstLead) {
        overall = parseInt(firstLead[1], 10);
        parts[0] = parts[0].slice(firstLead[1].length);
      }
    }

    for (var pi = 0; pi < parts.length; pi++) {
      var part = parts[pi];
      if (!part) continue;
      var lead = part.match(/^(\d+)/);
      var outer = overall;
      if (lead) {
        outer = parseInt(lead[1], 10) * overall;
        part = part.slice(lead[1].length);
      }
      var parsed = parseGroup(part);
      if (!parsed.ok) return parsed;
      for (var el in parsed.counts) {
        if (!Object.prototype.hasOwnProperty.call(parsed.counts, el)) continue;
        total[el] = (total[el] || 0) + parsed.counts[el] * outer;
      }
    }

    if (!Object.keys(total).length) return { ok: false, error: "没读到元素符号" };

    var unknown = [];
    for (var e2 in total) {
      if (AW[e2] === undefined) unknown.push(e2);
    }
    if (unknown.length) return { ok: false, error: "不认识的元素：" + unknown.join("、") };

    return { ok: true, counts: total };
  }

  function parseGroup(str) {
    var stack = [{}];
    var i = 0;

    function top() { return stack[stack.length - 1]; }

    while (i < str.length) {
      var ch = str[i];

      if (ch === "(") {
        stack.push({});
        i++;
        continue;
      }

      if (ch === ")") {
        if (stack.length < 2) return { ok: false, error: "括号不配对" };
        var inner = stack.pop();
        i++;
        var mult = readNumber(str, i);
        i = mult.end;
        var k = mult.value || 1;
        var parent = top();
        for (var el in inner) {
          if (!Object.prototype.hasOwnProperty.call(inner, el)) continue;
          parent[el] = (parent[el] || 0) + inner[el] * k;
        }
        continue;
      }

      var upper = ch.toUpperCase();
      if (upper !== ch || /[A-Z]/.test(ch)) {
        var sym = ch;
        i++;
        if (i < str.length && /[a-z]/.test(str[i])) {
          sym += str[i];
          i++;
        }
        var num = readNumber(str, i);
        i = num.end;
        top()[sym] = (top()[sym] || 0) + (num.value || 1);
        continue;
      }

      i++;
    }

    if (stack.length !== 1) return { ok: false, error: "括号不配对" };
    return { ok: true, counts: stack[0] };
  }

  function readNumber(str, i) {
    var start = i;
    while (i < str.length && /\d/.test(str[i])) i++;
    if (i === start) return { value: 0, end: i };
    return { value: parseInt(str.slice(start, i), 10), end: i };
  }

  /* ---------------- 摩尔质量 ---------------- */
  function molarMass(formula) {
    var p = typeof formula === "string" ? parseFormula(formula) : formula;
    if (!p || !p.ok) return { ok: false, error: (p && p.error) || "化学式解析失败" };
    var sum = 0;
    var detail = [];
    for (var el in p.counts) {
      if (!Object.prototype.hasOwnProperty.call(p.counts, el)) continue;
      var n = p.counts[el];
      var m = AW[el] * n;
      sum += m;
      detail.push({ el: el, n: n, mass: m });
    }
    detail.sort(function (a, b) { return b.mass - a.mass; });
    return { ok: true, mass: sum, detail: detail, counts: p.counts };
  }

  /* ---------------- 分数运算（配平用） ---------------- */
  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { var t = a % b; a = b; b = t; }
    return a || 1;
  }
  function lcm(a, b) { return Math.abs(a * b) / gcd(a, b); }

  function F(n, d) {
    if (d === undefined) d = 1;
    if (d < 0) { n = -n; d = -d; }
    var g = gcd(n, d);
    return { n: n / g, d: d / g };
  }
  function fAdd(a, b) { return F(a.n * b.d + b.n * a.d, a.d * b.d); }
  function fSub(a, b) { return F(a.n * b.d - b.n * a.d, a.d * b.d); }
  function fMul(a, b) { return F(a.n * b.n, a.d * b.d); }
  function fDiv(a, b) { return F(a.n * b.d, a.d * b.n); }
  function fIsZero(a) { return a.n === 0; }

  /* ---------------- 方程式配平 ---------------- */
  function splitEquation(input) {
    var text = String(input || "").trim();
    if (!text) return { ok: false, error: "还没有输入方程式" };
    text = text.replace(/[＝=]/g, "->").replace(/→/g, "->").replace(/⇌/g, "->");
    var sides = text.split(/->/);
    if (sides.length !== 2) return { ok: false, error: "请用 -> 或 = 连接反应物和生成物" };

    function terms(side) {
      return side.split(/[+＋]/).map(function (t) { return t.trim(); }).filter(Boolean);
    }

    var lhs = terms(sides[0]);
    var rhs = terms(sides[1]);
    if (!lhs.length || !rhs.length) return { ok: false, error: "方程式两边都要有物质" };
    if (lhs.length + rhs.length > 8) return { ok: false, error: "一次最多配平 8 种物质" };
    return { ok: true, lhs: lhs, rhs: rhs };
  }

  function balance(input) {
    var sp = splitEquation(input);
    if (!sp.ok) return sp;

    var species = sp.lhs.concat(sp.rhs);
    var counts = [];
    var elements = [];
    var seen = {};

    for (var i = 0; i < species.length; i++) {
      var p = parseFormula(species[i]);
      if (!p.ok) return { ok: false, error: "「" + species[i] + "」" + p.error };
      counts.push(p.counts);
      for (var el in p.counts) {
        if (!Object.prototype.hasOwnProperty.call(p.counts, el)) continue;
        if (!seen[el]) { seen[el] = true; elements.push(el); }
      }
    }

    var n = species.length;
    var m = elements.length;

    /* 矩阵 A：元素 × 物质，反应物取负、生成物取正，求 A·x = 0 */
    var A = [];
    for (var r = 0; r < m; r++) {
      var row = [];
      for (var c = 0; c < n; c++) {
        var k = counts[c][elements[r]] || 0;
        var sign = c < sp.lhs.length ? -1 : 1;
        row.push(F(sign * k, 1));
      }
      A.push(row);
    }

    /* 高斯消元 → 行最简形 */
    var pivots = [];
    var rowIdx = 0;
    for (var col = 0; col < n && rowIdx < m; col++) {
      var pick = -1;
      for (var rr = rowIdx; rr < m; rr++) {
        if (!fIsZero(A[rr][col])) { pick = rr; break; }
      }
      if (pick === -1) continue;

      var tmp = A[pick]; A[pick] = A[rowIdx]; A[rowIdx] = tmp;

      var pv = A[rowIdx][col];
      for (var cc = 0; cc < n; cc++) A[rowIdx][cc] = fDiv(A[rowIdx][cc], pv);

      for (var r2 = 0; r2 < m; r2++) {
        if (r2 === rowIdx) continue;
        var factor = A[r2][col];
        if (fIsZero(factor)) continue;
        for (var c2 = 0; c2 < n; c2++) {
          A[r2][c2] = fSub(A[r2][c2], fMul(factor, A[rowIdx][c2]));
        }
      }

      pivots.push(col);
      rowIdx++;
    }

    var free = [];
    for (var c3 = 0; c3 < n; c3++) {
      if (pivots.indexOf(c3) === -1) free.push(c3);
    }
    if (!free.length) return { ok: false, error: "这条方程式只有全零解，请检查物质是否守恒" };

    if (free.length > 1) {
      return { ok: false, error: "这条方程式有多个独立配平方式（可能是并列反应），请拆成两条分别配平" };
    }

    var f = free[0];
    var x = new Array(n).fill(null);
    x[f] = F(1, 1);

    for (var pi = 0; pi < pivots.length; pi++) {
      var pc = pivots[pi];
      var val = F(0, 1);
      for (var c4 = 0; c4 < n; c4++) {
        if (c4 === pc) continue;
        if (fIsZero(A[pi][c4])) continue;
        val = fSub(val, fMul(A[pi][c4], x[c4] || F(0, 1)));
      }
      x[pc] = val;
    }

    /* 全部同乘一个数，让自由变量所在的一组为正 */
    var sign = 1;
    for (var s2 = 0; s2 < n; s2++) {
      var v = x[s2];
      if (!fIsZero(v)) { sign = v.n > 0 ? 1 : -1; break; }
    }
    if (sign < 0) {
      for (var s3 = 0; s3 < n; s3++) x[s3] = F(-x[s3].n, x[s3].d);
    }

    /* 乘以分母的最小公倍数 → 整数，再除以最大公约数 → 最简 */
    var den = 1;
    for (var s4 = 0; s4 < n; s4++) den = lcm(den, x[s4].d);
    var ints = x.map(function (fv) { return fv.n * (den / fv.d); });
    var g = 0;
    for (var s5 = 0; s5 < n; s5++) g = gcd(g, ints[s5]);
    if (g > 1) ints = ints.map(function (v2) { return v2 / g; });

    var negative = ints.filter(function (v3) { return v3 <= 0; });
    if (negative.length) {
      return { ok: false, error: "配平后出现非正系数，请检查方程式两边是否写反" };
    }

    /* 质量比 */
    var masses = species.map(function (formula) {
      var mm = molarMass(formula);
      return mm.ok ? mm.mass : null;
    });

    var rawMass = species.map(function (_, idx2) { return masses[idx2] === null ? null : ints[idx2] * masses[idx2]; });
    var simpleMass = massRatio(rawMass);

    return {
      ok: true,
      species: species,
      lhsCount: sp.lhs.length,
      coefs: ints,
      elements: elements,
      matrix: A,
      masses: masses,
      rawMass: rawMass,
      simpleMass: simpleMass,
      massConserved: sumsEqual(rawMass, sp.lhs.length)
    };
  }

  /* 把一组质量折成「小整数比」，例如 223.4 : 96.0 : 319.4 → 7 : 3 : 10 */
  function massRatio(masses) {
    if (masses.some(function (m) { return m === null || !(m > 0); })) return null;
    var min = Math.min.apply(null, masses);
    if (!(min > 0)) return null;

    for (var k = 1; k <= 240; k++) {
      var scaled = masses.map(function (m) { return (m / min) * k; });
      var ok = scaled.every(function (v) {
        var r = Math.round(v);
        return r >= 1 && Math.abs(v - r) <= Math.max(0.08, r * 0.02);
      });
      if (ok) {
        var ints = scaled.map(function (v) { return Math.round(v); });
        var g = 0;
        ints.forEach(function (v) { g = gcd(g, v); });
        return g > 1 ? ints.map(function (v) { return v / g; }) : ints;
      }
    }
    return null;
  }

  function sumsEqual(arr, split) {
    var l = 0, r = 0;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] === null) return false;
      if (i < split) l += arr[i]; else r += arr[i];
    }
    return Math.abs(l - r) < 0.5;
  }

  /* 配平结果排成一行文本（给 title / aria 用） */
  function equationText(res) {
    if (!res || !res.ok) return "";
    var lhs = [], rhs = [];
    for (var i = 0; i < res.species.length; i++) {
      var t = (res.coefs[i] > 1 ? res.coefs[i] : "") + res.species[i];
      if (i < res.lhsCount) lhs.push(t); else rhs.push(t);
    }
    return lhs.join(" + ") + " -> " + rhs.join(" + ");
  }

  /* ---------------- 浓度换算 ---------------- */
  /* 物质的量浓度 c(mol/L) 与质量分数 w(0~100) 互转：w = c·M/(10ρ)，c = 10ρw/M */
  function massPercentToMolar(w, rho, M) {
    if (!(M > 0)) return { ok: false, error: "摩尔质量必须大于 0" };
    if (!(rho > 0)) return { ok: false, error: "密度必须大于 0" };
    if (!(w > 0) || w >= 100) return { ok: false, error: "质量分数应在 0 到 100 之间（不含两端）" };
    return { ok: true, value: (10 * rho * w) / M };
  }

  function molarToMassPercent(c, rho, M) {
    if (!(M > 0)) return { ok: false, error: "摩尔质量必须大于 0" };
    if (!(rho > 0)) return { ok: false, error: "密度必须大于 0" };
    if (!(c > 0)) return { ok: false, error: "浓度必须大于 0" };
    var w = (c * M) / (10 * rho);
    if (w >= 100) return { ok: false, error: "算出的质量分数 ≥ 100%，请检查密度或浓度" };
    return { ok: true, value: w };
  }

  /* c 与溶解质量 m、体积 V 的关系：c = m/(M·V(L)) */
  function dissolveToMolar(massG, volumeMl, M) {
    if (!(M > 0)) return { ok: false, error: "摩尔质量必须大于 0" };
    if (!(massG > 0)) return { ok: false, error: "质量必须大于 0" };
    if (!(volumeMl > 0)) return { ok: false, error: "体积必须大于 0" };
    return { ok: true, value: massG / (M * volumeMl / 1000) };
  }

  /* ---------------------------------------------------------------
     20 ℃ 常见水溶液的「质量分数 → 密度」参考点（g/mL）。
     数据取自通行化学手册的整数浓度点，只用于估算；中间值可按相邻两点线性插值。
     --------------------------------------------------------------- */
  var DENSITY_TEMP = 20;
  var DENSITY_REF = {
    H2SO4: { name: "硫酸", points: [[5, 1.032], [10, 1.066], [15, 1.103], [20, 1.139], [25, 1.178], [30, 1.219], [35, 1.260], [40, 1.303], [50, 1.395], [60, 1.498], [70, 1.611], [80, 1.727], [90, 1.814], [98, 1.837]] },
    NAOH: { name: "氢氧化钠", points: [[4, 1.043], [10, 1.109], [15, 1.164], [20, 1.219], [25, 1.274], [30, 1.328], [40, 1.430], [50, 1.525]] },
    HCL: { name: "盐酸", points: [[5, 1.024], [10, 1.048], [15, 1.073], [20, 1.098], [25, 1.123], [30, 1.149], [32, 1.159], [37, 1.184]] },
    HNO3: { name: "硝酸", points: [[5, 1.026], [10, 1.054], [15, 1.084], [20, 1.115], [30, 1.180], [40, 1.246], [50, 1.310], [60, 1.366], [68, 1.405]] },
    H3PO4: { name: "磷酸", points: [[5, 1.026], [10, 1.053], [20, 1.113], [30, 1.181], [40, 1.254], [50, 1.335], [60, 1.426], [75, 1.579], [85, 1.685]] },
    CH3COOH: { name: "乙酸", points: [[5, 1.006], [10, 1.014], [15, 1.020], [20, 1.026], [30, 1.039], [40, 1.049], [50, 1.058]] },
    NH3: { name: "氨水", points: [[5, 0.979], [10, 0.958], [15, 0.939], [20, 0.923], [25, 0.907], [28, 0.899]] },
    C2H5OH: { name: "乙醇", points: [[5, 0.989], [10, 0.982], [20, 0.969], [30, 0.953], [40, 0.935], [50, 0.914], [60, 0.891], [70, 0.868], [80, 0.843], [90, 0.818], [95, 0.804], [100, 0.789]] },
    NACL: { name: "氯化钠", points: [[5, 1.034], [10, 1.067], [15, 1.109], [20, 1.148], [26, 1.197]] },
    KOH: { name: "氢氧化钾", points: [[5, 1.044], [10, 1.092], [20, 1.188], [30, 1.288], [40, 1.399]] },
    NA2CO3: { name: "碳酸钠", points: [[5, 1.051], [10, 1.105], [15, 1.161], [20, 1.219]] },
    CUSO4: { name: "硫酸铜", points: [[5, 1.051], [10, 1.107], [15, 1.164], [20, 1.223]] },
    C12H22O11: { name: "蔗糖", points: [[5, 1.019], [10, 1.038], [20, 1.081], [30, 1.127], [40, 1.176], [50, 1.229], [60, 1.286]] },
    C6H12O6: { name: "葡萄糖", points: [[5, 1.017], [10, 1.036], [20, 1.074], [30, 1.113], [40, 1.153]] }
  };

  /* 别名 → 主键（同一物质的不同写法） */
  var DENSITY_ALIAS = {
    C2H6O: "C2H5OH", CH3CH2OH: "C2H5OH",
    C2H4O2: "CH3COOH", CH3CO2H: "CH3COOH",
    C12H22O11: "C12H22O11"
  };

  function densityKey(formula) {
    var s = String(formula || "").replace(/\s+/g, "").replace(/[₀-₉]/g, function (ch) {
      return String("₀₁₂₃₄₅₆₇₈₉".indexOf(ch));
    });
    s = s.replace(/[（）]/g, function (ch) { return ch === "（" ? "(" : ")"; });
    /* 结晶水按无水物查表：CuSO4·5H2O → CuSO4 */
    s = s.replace(/[·*].*$/, "");
    s = s.toUpperCase();
    return DENSITY_ALIAS[s] || s;
  }

  /* 返回 {ok, name, temp, points, range}；没有对照表时给区间而不是编数字 */
  function densityRef(formula) {
    var key = densityKey(formula);
    var hit = DENSITY_REF[key];
    if (hit) {
      return { ok: true, key: key, name: hit.name, temp: DENSITY_TEMP, points: hit.points.slice() };
    }
    return {
      ok: false,
      key: key,
      temp: DENSITY_TEMP,
      range: [1.0, 1.2],
      note: "常见水溶液（质量分数低于 20%）"
    };
  }

  /* 在参考点之间线性插值，给出某个质量分数下的参考密度 */
  function densityAt(formula, w) {
    var ref = densityRef(formula);
    if (!ref.ok || !(w >= 0)) return null;
    var pts = ref.points;
    if (w <= pts[0][0]) return pts[0][1];
    if (w >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
    for (var i = 1; i < pts.length; i++) {
      if (w <= pts[i][0]) {
        var w0 = pts[i - 1][0], w1 = pts[i][0];
        var d0 = pts[i - 1][1], d1 = pts[i][1];
        return d0 + ((w - w0) / (w1 - w0)) * (d1 - d0);
      }
    }
    return null;
  }

  /* ---------------- 沸点参考（常压 101.325 kPa，单位 ℃） ---------------- */
  var BOILING = [
    { f: "H2O", n: "水", bp: 100, note: "标准沸点，定义 100 ℃ 的来源" },
    { f: "H2O2", n: "过氧化氢", bp: 150.2, note: "受热易分解，蒸馏需减压" },
    { f: "NH3", n: "氨", bp: -33.34, note: "极易液化，液氨可作溶剂" },
    { f: "HCl", n: "氯化氢", bp: -85.05, note: "水溶液为盐酸；浓盐酸 110 ℃ 共沸" },
    { f: "H2SO4", n: "硫酸", bp: 337, note: "浓硫酸受热先失水，338 ℃ 左右分解" },
    { f: "HNO3", n: "硝酸", bp: 83, note: "68% 硝酸 120.5 ℃ 共沸" },
    { f: "H3PO4", n: "磷酸", bp: 213, note: "受热脱水成焦磷酸" },
    { f: "CH3COOH", n: "乙酸", bp: 118.1, note: "有刺激性酸味" },
    { f: "C2H5OH", n: "乙醇", bp: 78.37, note: "95% 乙醇 78.15 ℃ 共沸" },
    { f: "CH3OH", n: "甲醇", bp: 64.7, note: "有毒，不可饮用" },
    { f: "CH3COCH3", n: "丙酮", bp: 56.05, note: "易挥发，常用洗剂" },
    { f: "C6H6", n: "苯", bp: 80.1, note: "致癌，实验室多改用甲苯" },
    { f: "C6H5CH3", n: "甲苯", bp: 110.6, note: "常用非极性溶剂" },
    { f: "CHCl3", n: "三氯甲烷（氯仿）", bp: 61.2, note: "光气前体，需避光" },
    { f: "CCl4", n: "四氯化碳", bp: 76.72, note: "曾作灭火剂，臭氧层损耗物" },
    { f: "CH2Cl2", n: "二氯甲烷", bp: 39.6, note: "低沸点萃取剂" },
    { f: "C6H12", n: "环己烷", bp: 80.7, note: "非极性，常用于重结晶" },
    { f: "C6H14", n: "正己烷", bp: 68.7, note: "萃取与清洗" },
    { f: "C2H5OC2H5", n: "乙醚", bp: 34.6, note: "极易挥发、易燃" },
    { f: "C4H8O2", n: "乙酸乙酯", bp: 77.1, note: "果香，常用萃取剂" },
    { f: "C3H6O2", n: "丙酸", bp: 141.1, note: "防腐剂原料" },
    { f: "C6H5OH", n: "苯酚", bp: 181.7, note: "腐蚀性强，微溶于冷水" },
    { f: "C6H5NH2", n: "苯胺", bp: 184.1, note: "有毒，易氧化变深" },
    { f: "C6H5NO2", n: "硝基苯", bp: 210.9, note: "苦杏仁味，有毒" },
    { f: "C3H8O3", n: "甘油", bp: 290, note: "受热分解，减压蒸馏" },
    { f: "C2H6O2", n: "乙二醇", bp: 197.3, note: "防冻液主成分" },
    { f: "CO2", n: "二氧化碳", bp: -78.5, note: "升华点，干冰温度" },
    { f: "SO2", n: "二氧化硫", bp: -10, note: "刺激性气体，易液化" },
    { f: "Cl2", n: "氯气", bp: -34.04, note: "黄绿色，钢瓶常为液氯" },
    { f: "Br2", n: "溴", bp: 58.8, note: "红棕色液体，易挥发" },
    { f: "I2", n: "碘", bp: 184.3, note: "易升华，紫色蒸气" },
    { f: "Hg", n: "汞", bp: 356.7, note: "常温唯一液态金属" },
    { f: "S", n: "硫", bp: 444.6, note: "先熔化成黄色液体" },
    { f: "Na", n: "钠", bp: 883, note: "常存煤油中" },
    { f: "K", n: "钾", bp: 759, note: "比钠更活泼" },
    { f: "Mg", n: "镁", bp: 1090, note: "燃烧时温度极高" },
    { f: "Al", n: "铝", bp: 2467, note: "电解铝需冰晶石助熔" },
    { f: "Fe", n: "铁", bp: 2861, note: "高炉出铁约 1500 ℃" },
    { f: "Cu", n: "铜", bp: 2562, note: "导电导热优良" },
    { f: "Zn", n: "锌", bp: 907, note: "镀锌防腐" },
    { f: "Ag", n: "银", bp: 2162, note: "导电性最好" },
    { f: "Au", n: "金", bp: 2856, note: "化学性质稳定" },
    { f: "Pb", n: "铅", bp: 1749, note: "有毒重金属" },
    { f: "N2", n: "氮气", bp: -195.8, note: "液氮常用冷媒" },
    { f: "O2", n: "氧气", bp: -183, note: "液氧淡蓝色" },
    { f: "Ar", n: "氩", bp: -185.9, note: "焊接保护气" },
    { f: "He", n: "氦", bp: -268.9, note: "沸点最低的元素" },
    { f: "H2", n: "氢气", bp: -252.9, note: "液氢作火箭燃料" },
    { f: "C10H8", n: "萘", bp: 218, note: "易升华" },
    { f: "C6H5COOH", n: "苯甲酸", bp: 249.2, note: "食品防腐剂" },
    { f: "Na2CO3", n: "碳酸钠", bp: null, decomp: 851, note: "高温分解" },
    { f: "CaCO3", n: "碳酸钙", bp: null, decomp: 825, note: "煅烧分解" },
    { f: "KMnO4", n: "高锰酸钾", bp: null, decomp: 240, note: "受热分解" },
    { f: "CuSO4·5H2O", n: "胆矾", bp: null, decomp: 250, note: "先失去结晶水" }
  ];

  // ---- 溶液沸点：随浓度变化 ----
  // 1) 少数有实测点的物质查表并线性插值；2) 其余按沸点升高公式估算（Kb=0.512）；
  // 3) 易挥发溶质（乙醇/氨水等）沸点会随浓度下降，这里不给数，只提示。
  var KB_WATER = 0.512;
  var SOLUTION_BP = {
    H2SO4: [[10, 102.6], [20, 105.4], [30, 108.5], [40, 114.0], [50, 123.5], [60, 141.0], [70, 166.0], [80, 199.0], [90, 263.0], [98, 338.0]],
    NaOH: [[10, 105.2], [20, 109.7], [30, 115.3], [40, 124.0], [50, 142.0]],
    NaCl: [[10, 101.8], [20, 105.3], [26, 108.7]],
    HCl: [[10, 103.0], [20, 108.6], [30, 114.2]],
    HNO3: [[10, 102.0], [20, 103.5], [30, 106.0], [50, 116.0], [68, 120.5]],
    Na2CO3: [[10, 102.0], [20, 105.0]],
    KCl: [[10, 101.6], [20, 104.6]]
  };
  var VOLATILE_WITH_WATER = { NH3: 1, C2H5OH: 1, C2H6O: 1, CH3OH: 1, CH3COOH: 1, CH3COCH3: 1, C3H6O: 1, C6H6: 1, HCHO: 1 };
  var IONS_PER_MOL = { NaCl: 2, KCl: 2, NaOH: 2, KOH: 2, HCl: 2, HNO3: 2, H2SO4: 2.5, Na2CO3: 3, CaCl2: 3, CuSO4: 2 };

  function solutionBp(formula, wPercent) {
    if (!formula) return null;
    var want = String(formula).replace(/\s+/g, "");
    var w = Number(wPercent);
    if (!isFinite(w) || w <= 0 || w >= 100) return null;
    var pure = boilingOf(want);
    if (VOLATILE_WITH_WATER[want]) {
      return { kind: "volatile", value: pure && pure.bp !== null ? pure.bp : null, pure: pure, detail: "易挥发溶质，水溶液沸点会低于纯水" };
    }
    var pts = SOLUTION_BP[want];
    if (pts) {
      var x = Math.min(Math.max(w, pts[0][0]), pts[pts.length - 1][0]);
      for (var i = 0; i < pts.length - 1; i++) {
        var a = pts[i], b = pts[i + 1];
        if (x >= a[0] && x <= b[0]) {
          var t = (x - a[0]) / (b[0] - a[0] || 1);
          var v = a[1] + t * (b[1] - a[1]);
          return { kind: "table", value: Math.round(v * 10) / 10, pure: pure, detail: "查表：约 " + w + "% 水溶液" };
        }
      }
      return { kind: "table", value: pts[pts.length - 1][1], pure: pure, detail: "查表：接近饱和" };
    }
    var M = null;
    try {
      var mm = molarMass(want);
      M = mm && typeof mm === "object" ? (mm.ok === false ? null : mm.mass) : mm;
    } catch (e) { M = null; }
    if (!M || !isFinite(M) || M <= 0) return null;
    var molality = (1000 * w) / (M * (100 - w));
    var i2 = IONS_PER_MOL[want] || 1;
    var dT = KB_WATER * i2 * molality;
    if (dT > 40) dT = 40;
    return { kind: "estimate", value: Math.round((100 + dT) * 10) / 10, pure: pure, detail: "估算：按沸点升高 " + (i2 > 1 ? "（近似完全电离）" : "") };
  }

  function boilingOf(formula) {
    if (!formula) return null;
    var want = String(formula).replace(/\s+/g, "").replace(/[₀-₉]/g, function (ch) { return String("₀₁₂₃₄₅₆₇₈₉".indexOf(ch)); });
    for (var i = 0; i < BOILING.length; i++) {
      if (BOILING[i].f.replace(/\s+/g, "") === want) return BOILING[i];
    }
    return null;
  }

  var API = {
    AW: AW,
    parseFormula: parseFormula,
    molarMass: molarMass,
    balance: balance,
    equationText: equationText,
    subscript: subscript,
    massPercentToMolar: massPercentToMolar,
    molarToMassPercent: molarToMassPercent,
    dissolveToMolar: dissolveToMolar,
    densityRef: densityRef,
    densityAt: densityAt,
    DENSITY_REF: DENSITY_REF,
    BOILING: BOILING,
    boilingOf: boilingOf,
    solutionBp: solutionBp
  };

  root.ChemCore = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
