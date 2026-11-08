/* 化境 ChemLab · 反应规则推断
   目标：不在「常见反应表」里的组合，也能按中学化学的性质规律推出产物，
   并说明依据（生成沉淀 / 气体 / 水、金属活动性、置换位置）。
   原则：
   1) 只推中学教材范围内的规律，超出范围返回空（不瞎猜）；
   2) 推出来的式子一律再过一遍配平校验，配不平就丢掉；
   3) 结果带 inferred 标记，界面上要和「表内条目」区分开。
   数据来源：常见离子电荷与溶解性表（中学版），不保证覆盖全部真实情况。 */
(function (root) {
  "use strict";

  /* ---------------- 离子 ---------------- */
  // 阳离子：符号 -> 电荷
  var CATION = {
    H: 1, NH4: 1, K: 1, Na: 1, Ba: 2, Ca: 2, Mg: 2, Al: 3,
    Zn: 2, Fe: 2, Cu: 2, Ag: 1, Pb: 2, Mn: 2, Hg: 2
  };
  // 阴离子：符号 -> 电荷
  var ANION = {
    OH: 1, Cl: 1, Br: 1, I: 1, NO3: 1, SO4: 2, CO3: 2, HCO3: 1,
    SO3: 2, S: 2, PO4: 3, CH3COO: 1, SiO3: 2, ClO: 1, MnO4: 1
  };
  var POLY = {
    NH4: 1, OH: 1, NO3: 1, SO4: 1, CO3: 1, HCO3: 1, SO3: 1,
    PO4: 1, CH3COO: 1, SiO3: 1, ClO: 1, MnO4: 1
  };

  // 常见酸碱盐 -> [阳离子, 阴离子]
  var SALT = {
    HCl: ["H", "Cl"], H2SO4: ["H", "SO4"], HNO3: ["H", "NO3"],
    H2CO3: ["H", "CO3"], H2SO3: ["H", "SO3"], H2S: ["H", "S"],
    CH3COOH: ["H", "CH3COO"], H3PO4: ["H", "PO4"], H2SiO3: ["H", "SiO3"],

    NaOH: ["Na", "OH"], KOH: ["K", "OH"], BaOH2: ["Ba", "OH"],
    CaOH2: ["Ca", "OH"], MgOH2: ["Mg", "OH"], CuOH2: ["Cu", "OH"],
    FeOH2: ["Fe", "OH"], FeOH3: ["Fe", "OH"], AlOH3: ["Al", "OH"],
    NH3H2O: ["NH4", "OH"],

    NaCl: ["Na", "Cl"], KCl: ["K", "Cl"], AgNO3: ["Ag", "NO3"],
    NaNO3: ["Na", "NO3"], KNO3: ["K", "NO3"], BaNO3_2: ["Ba", "NO3"],
    CuNO3_2: ["Cu", "NO3"], FeNO3_3: ["Fe", "NO3"],

    Na2SO4: ["Na", "SO4"], K2SO4: ["K", "SO4"], BaCl2: ["Ba", "Cl"],
    CaCl2: ["Ca", "Cl"], MgCl2: ["Mg", "Cl"], ZnCl2: ["Zn", "Cl"],
    CuCl2: ["Cu", "Cl"], FeCl2: ["Fe", "Cl"], FeCl3: ["Fe", "Cl"],
    AlCl3: ["Al", "Cl"], BaSO4: ["Ba", "SO4"], CuSO4: ["Cu", "SO4"],
    FeSO4: ["Fe", "SO4"], ZnSO4: ["Zn", "SO4"], MgSO4: ["Mg", "SO4"],
    AgSO4: ["Ag", "SO4"], CaSO4: ["Ca", "SO4"], Al2SO4_3: ["Al", "SO4"],

    Na2CO3: ["Na", "CO3"], K2CO3: ["K", "CO3"], CaCO3: ["Ca", "CO3"],
    BaCO3: ["Ba", "CO3"], MgCO3: ["Mg", "CO3"], CuCO3: ["Cu", "CO3"],
    NaHCO3: ["Na", "HCO3"], KHCO3: ["K", "HCO3"], CaHCO3_2: ["Ca", "HCO3"],

    Na2SO3: ["Na", "SO3"], Na2S: ["Na", "S"], Na2SiO3: ["Na", "SiO3"],
    Na3PO4: ["Na", "PO4"], Na2SO4_: ["Na", "SO4"],
    CH3COONa: ["Na", "CH3COO"], NaClO: ["Na", "ClO"], KMnO4: ["K", "MnO4"],
    AgCl: ["Ag", "Cl"], AgBr: ["Ag", "Br"], AgI: ["Ag", "I"],
    NH4Cl: ["NH4", "Cl"], NH4NO3: ["NH4", "NO3"], NH42SO4: ["NH4", "SO4"],
    NH42CO3: ["NH4", "CO3"], NH42S: ["NH4", "S"]
  };

  // 碱式/酸根特殊：写法在站点里可能出现的大小写与括号差异，统一后再查
  function normalizeFormula(f) {
    return String(f || "")
      .replace(/\s+/g, "")
      .replace(/[₀-₉]/g, function (ch) { return String("₀₁₂₃₄₅₆₇₈₉".indexOf(ch)); })
      .replace(/（/g, "(").replace(/）/g, ")")
      .replace(/·.*$/, "")
      .replace(/\((s|aq|l|g)\)$/i, "");
  }

  // 常见别名 -> 规范式
  var ALIAS = {
    HCL: "HCl", NAOH: "NaOH", NACL: "NaCl", AGNO3: "AgNO3",
    BASO4: "BaSO4", CACO3: "CaCO3", CUSO4: "CuSO4", NA2CO3: "Na2CO3",
    NAHCO3: "NaHCO3", NH4CL: "NH4Cl", NA2SO4: "Na2SO4", BACL2: "BaCl2",
    CACL2: "CaCl2", CUOH2: "Cu(OH)2", MGCL2: "MgCl2", FE: "Fe", ZN: "Zn",
    CU: "Cu", MG: "Mg", AL: "Al", AG: "Ag", NA: "Na", K: "K", CA: "Ca",
    HCL_: "HCl"
  };

  function lookupSalt(raw) {
    var f = normalizeFormula(raw);
    var key = ALIAS[f.toUpperCase()] || f;
    if (SALT[key]) return { cation: SALT[key][0], anion: SALT[key][1], formula: key };
    // 尝试碱的写法：Ca(OH)2 / Cu(OH)2
    var m = key.match(/^([A-Z][a-z]?|NH4)\(OH\)(\d?)$/);
    if (m && CATION[m[1]]) return { cation: m[1], anion: "OH", formula: key };
    return null;
  }

  /* ---------------- 溶解性 ---------------- */
  var ALWAYS_SOLUBLE_CATION = { K: 1, Na: 1, NH4: 1 };
  var ALWAYS_SOLUBLE_ANION = { NO3: 1, CH3COO: 1, ClO: 1, MnO4: 1 };

  // 返回 "soluble" | "insoluble" | "slight" | "unknown"
  function solubility(cation, anion) {
    if (cation === "H") return "soluble";
    if (ALWAYS_SOLUBLE_CATION[cation]) return "soluble";
    if (ALWAYS_SOLUBLE_ANION[anion]) return "soluble";
    if (anion === "Cl" || anion === "Br" || anion === "I") {
      if (cation === "Ag") return "insoluble";
      if (cation === "Pb") return "slight";
      return "soluble";
    }
    if (anion === "SO4") {
      if (cation === "Ba" || cation === "Pb") return "insoluble";
      if (cation === "Ca" || cation === "Ag") return "slight";
      return "soluble";
    }
    if (anion === "OH") {
      if (cation === "Ba") return "soluble";
      if (cation === "Ca") return "slight";
      return "insoluble";
    }
    if (anion === "CO3" || anion === "PO4" || anion === "SiO3" || anion === "S" || anion === "SO3") {
      return "insoluble";
    }
    if (anion === "HCO3") return "soluble";
    return "unknown";
  }

  /* ---------------- 组合化学式 ---------------- */
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  function sub(n) {
    var map = { 2: "2", 3: "3", 4: "4", 5: "5", 6: "6" };
    return n > 1 ? (map[n] || String(n)) : "";
  }

  // 由离子拼化学式；未知离子返回 null
  function compose(cation, anion) {
    if (cation === "H" && anion === "OH") return "H2O";
    var zc = CATION[cation], za = ANION[anion];
    if (!zc || !za) return null;
    var g = gcd(zc, za);
    var nC = za / g, nA = zc / g;
    var cat = (POLY[cation] && nC > 1) ? "(" + cation + ")" : cation;
    var an = (POLY[anion] && nA > 1) ? "(" + anion + ")" : anion;
    return cat + sub(nC) + an + sub(nA);
  }

  /* ---------------- 活动性顺序 ---------------- */
  var ACTIVITY = ["K", "Ca", "Na", "Mg", "Al", "Zn", "Fe", "Sn", "Pb", "H", "Cu", "Hg", "Ag", "Pt", "Au"];
  function activityOf(sym) { return ACTIVITY.indexOf(sym); }

  var METALS = { K: 1, Ca: 1, Na: 1, Mg: 1, Al: 1, Zn: 1, Fe: 1, Cu: 1, Ag: 1 };

  /* ---------------- 产物整理 ---------------- */
  // 不稳定产物展开：H2CO3 -> CO2 + H2O 等
  function expand(products) {
    var out = [], notes = [];
    products.forEach(function (f) {
      if (f === "H2CO3") { out.push("CO2"); out.push("H2O"); notes.push("碳酸分解出二氧化碳"); }
      else if (f === "H2SO3") { out.push("SO2"); out.push("H2O"); notes.push("亚硫酸分解出二氧化硫"); }
      else if (f === "NH4OH" || f === "NH3H2O") { out.push("NH3"); out.push("H2O"); notes.push("生成一水合氨（受热放出氨气）"); }
      else out.push(f);
    });
    return { list: out, notes: notes };
  }

  /* ---------------- 推断主入口 ---------------- */
  // list: 反应物化学式数组
  // 返回：[{ p:[产物], cond, why, rule }]
  function infer(list) {
    var Core = root.ChemCore;
    if (!Core || !list || !list.length) return [];
    var reactants = list.map(normalizeFormula);
    var results = [];

    function push(candidate) {
      if (!candidate || !candidate.p || !candidate.p.length) return;
      var eq = reactants.join(" + ") + " -> " + candidate.p.join(" + ");
      var res = Core.balance(eq);
      if (!res.ok) return;                    // 配不平就不提
      // 反应物与产物完全相同（没反应）也丢掉
      var same = res.species.slice(0, reactants.length).sort().join("|") ===
        res.species.slice(reactants.length).sort().join("|");
      if (same) return;
      candidate.eq = res.species.join(" + ");
      candidate.coefs = res.coefs;
      results.push(candidate);
    }

    /* --- 规则 1：复分解（AB + CD -> AD + CB） --- */
    if (reactants.length === 2) {
      var A = lookupSalt(reactants[0]), B = lookupSalt(reactants[1]);
      if (A && B && (A.cation !== B.cation) && (A.anion !== B.anion)) {
        var p1 = compose(A.cation, B.anion);   // A+ 与 B-
        var p2 = compose(B.cation, A.anion);   // B+ 与 A-
        if (p1 && p2) {
          var expanded = expand([p1, p2]);
          var prods = expanded.list;
          var reasons = [];
          // 判定能否发生：生成沉淀 / 气体 / 水
          [[A.cation, B.anion, p1], [B.cation, A.anion, p2]].forEach(function (t) {
            var sol = solubility(t[0], t[1]);
            if (sol === "insoluble") reasons.push("生成沉淀 " + t[2]);
            else if (sol === "slight") reasons.push("生成微溶物 " + t[2]);
          });
          expanded.notes.forEach(function (n) { reasons.push(n); });
          if (prods.indexOf("H2O") >= 0 && reactants.some(function (f) { return /^H\d?/.test(f) && !SALT[f]; })) {
            reasons.push("生成水");
          }
          if (reasons.length) {
            push({
              p: prods,
              cond: "常温",
              why: reasons.join("；"),
              rule: "复分解：交换阴阳离子后生成沉淀、气体或水，反应才能发生"
            });
          }
        }
      }
    }

    /* --- 规则 1b：酸 + 碱中和（一定发生） --- */
    if (reactants.length === 2) {
      var ac0 = null, bs0 = null;
      reactants.forEach(function (f) {
        var s = lookupSalt(f);
        if (!s) return;
        if (s.cation === "H") ac0 = s;
        else if (s.anion === "OH") bs0 = s;
      });
      if (ac0 && bs0) {
        var s1 = compose(bs0.cation, ac0.anion);
        if (s1) {
          push({
            p: [s1, "H2O"],
            cond: "常温",
            why: "氢离子与氢氧根结合成水",
            rule: "酸 + 碱 → 盐 + 水（中和）"
          });
        }
      }
    }

    /* --- 规则 2：金属 + 稀酸 -> 盐 + H2 --- */
    if (reactants.length === 2) {
      var metalA = null, acid = null;
      reactants.forEach(function (f) {
        if (METALS[f]) metalA = f;
        if (f === "HCl" || f === "H2SO4") acid = f;
      });
      if (metalA && acid) {
        var mi = activityOf(metalA);
        if (mi >= 0 && mi < activityOf("H")) {
          var saltA = lookupSalt(acid);
          var saltF = compose(metalA, saltA.anion);
          if (saltF) {
            push({
              p: [saltF, "H2"],
              cond: "常温",
              why: metalA + " 排在氢前面，能置换出酸里的氢",
              rule: "活泼金属 + 稀酸 → 盐 + 氢气（硝酸、浓硫酸不适用）"
            });
          }
        }
      }
    }

    /* --- 规则 3：金属 + 盐溶液 -> 新金属 + 新盐 --- */
    if (reactants.length === 2) {
      var m1 = null, saltB = null;
      reactants.forEach(function (f) {
        if (METALS[f]) m1 = f;
        else if (lookupSalt(f)) saltB = f;
      });
      var B2 = saltB ? lookupSalt(saltB) : null;
      if (m1 && B2 && METALS[B2.cation] && m1 !== B2.cation) {
        if (activityOf(m1) < activityOf(B2.cation)) {
          var newSalt = compose(m1, B2.anion);
          var newM = B2.cation;
          if (newSalt) {
            push({
              p: [newSalt, newM],
              cond: "常温",
              why: m1 + " 比 " + B2.cation + " 活泼，能把后者从盐溶液里置换出来",
              rule: "金属 + 盐溶液 → 新盐 + 新金属（前置换后）"
            });
          }
        }
      }
    }

    /* --- 规则 4：铵盐 + 强碱 -> 氨气 --- */
    if (reactants.length === 2) {
      var amSalt = null, strongBase = null;
      reactants.forEach(function (f) {
        var s = lookupSalt(f);
        if (!s) return;
        if (s.cation === "NH4") amSalt = s;
        else if (s.anion === "OH" && (s.cation === "Na" || s.cation === "K" || s.cation === "Ba" || s.cation === "Ca")) strongBase = s;
      });
      if (amSalt && strongBase) {
        var saltP = compose(strongBase.cation, amSalt.anion);
        if (saltP) {
          push({
            p: [saltP, "NH3", "H2O"],
            cond: "加热",
            why: "铵根遇氢氧根生成一水合氨，受热放出氨气",
            rule: "铵盐 + 强碱 → 新盐 + 氨气 + 水"
          });
        }
      }
    }

    /* --- 规则 5：酸 + 碳酸盐/亚硫酸盐（含表里漏掉的组合） --- */
    if (reactants.length === 2) {
      var acidB = null, carbonate = null;
      reactants.forEach(function (f) {
        if (f === "HCl" || f === "H2SO4" || f === "HNO3" || f === "CH3COOH") acidB = f;
        if (/CO3|HCO3/.test(f)) carbonate = f;
      });
      if (acidB && carbonate) {
        var ac = lookupSalt(acidB), ca = lookupSalt(carbonate);
        if (ac && ca) {
          var s2 = compose(ca.cation, ac.anion);
          if (s2) {
            push({
              p: [s2, "CO2", "H2O"],
              cond: "常温",
              why: "碳酸根与氢离子结合生成碳酸，碳酸不稳定立即分解",
              rule: "酸 + 碳酸盐 → 盐 + 二氧化碳 + 水"
            });
          }
        }
      }
    }

    /* --- 规则 6：金属 + 氧气 -> 金属氧化物 --- */
    if (reactants.length === 2) {
      var mm = null, oxy = false;
      reactants.forEach(function (f) { if (METALS[f]) mm = f; if (f === "O2") oxy = true; });
      var OXIDE = { Mg: "MgO", Al: "Al2O3", Zn: "ZnO", Fe: "Fe3O4", Cu: "CuO", Ca: "CaO", Na: "Na2O" };
      if (mm && oxy && OXIDE[mm]) {
        push({
          p: [OXIDE[mm]],
          cond: mm === "Fe" || mm === "Cu" ? "点燃/加热" : "常温",
          why: mm + " 与氧气化合生成氧化物",
          rule: "金属 + 氧气 → 金属氧化物（部分金属需加热）"
        });
      }
    }

    // 去重（同一组产物只留一条）
    var seen = {}, out = [];
    results.forEach(function (r) {
      var k = r.p.slice().sort().join("|");
      if (seen[k]) return;
      seen[k] = 1;
      out.push(r);
    });
    return out;
  }

  root.RxRules = {
    infer: infer,
    solubility: solubility,
    compose: compose,
    lookupSalt: lookupSalt,
    normalizeFormula: normalizeFormula
  };
})(typeof window !== "undefined" ? window : globalThis);
