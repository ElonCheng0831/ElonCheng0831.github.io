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
      .replace(/[（]/g, "(").replace(/[）]/g, ")")
      .replace(/[【\[]/g, "(").replace(/[】\]]/g, ")")
      .replace(/[.。]/g, "·");
    if (!s) return { ok: false, error: "化学式为空" };

    var total = {};
    var parts = s.split(/[·*]/);

    for (var pi = 0; pi < parts.length; pi++) {
      var part = parts[pi];
      if (!part) continue;
      var lead = part.match(/^(\d+)/);
      var outer = 1;
      if (lead) {
        outer = parseInt(lead[1], 10);
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
    DENSITY_REF: DENSITY_REF
  };

  root.ChemCore = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
