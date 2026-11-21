/* ============================================================
   化境 ChemLab · 操作图解插画库（全部为本站自绘 SVG 线稿）
   用法：<script src="assets/art.js"></script> 之后可调用
     window.CHEMLAB_ART.figure("distill", "蒸馏")  → HTML 字符串
   数据条目可用 art 字段指定；未指定时按 id / 分类自动匹配。
   ============================================================ */
(function () {
  "use strict";

  var S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var AC = 'fill="var(--accent)" opacity=".18"';
  var AC2 = 'fill="var(--accent)" opacity=".35"';

  function svg(inner, label) {
    return '<svg class="art-svg" viewBox="0 0 160 110" role="img" aria-label="' + label + '">' + inner + "</svg>";
  }

  /* 每幅图都画成“操作现场”：器皿 + 关键动作 + 现象 */
  var ART = {
    "heat-tube": {
      label: "加热试管",
      cap: "试管口略向下倾斜，先均匀预热再集中加热，管口不要对着人。",
      svg: svg(
        '<path d="M52 18 L86 46" ' + S + '/>' +
        '<path d="M54 16 L88 44" ' + S + '/>' +
        '<path d="M86 46 q10 8 6 20" ' + S + '/>' +
        '<path d="M92 66 q-2 14 -14 16" ' + S + '/>' +
        '<path d="M78 82 q-16 2 -20 -12" ' + S + '/>' +
        '<path d="M58 70 q-4 -12 6 -20" ' + S + '/>' +
        '<rect x="70" y="0" width="8" height="16" rx="3" ' + S + '/>' +
        '<path d="M64 86 h44" ' + S + '/>' +
        '<path d="M74 92 q6 -12 12 0 q6 12 12 0" stroke="var(--warn)" stroke-width="2" fill="none"/>' +
        '<path d="M80 96 q4 -8 8 0" stroke="var(--amber)" stroke-width="2" fill="none"/>' +
        '<circle cx="66" cy="34" r="3" ' + AC2 + '/>' +
        '<circle cx="74" cy="24" r="2" ' + AC2 + '/>' +
        '<path d="M40 40 h12 M40 48 h8" ' + S + '/>',
        "加热试管"
      )
    },
    "filter": {
      label: "过滤",
      cap: "一贴二低三靠：滤纸紧贴漏斗，液面低于滤纸边缘，玻璃棒引流。",
      svg: svg(
        '<path d="M30 14v84 M18 98h24" ' + S + '/>' +
        '<path d="M30 44h16" ' + S + '/>' +
        '<path d="M46 50h48L74 74h-8z" ' + S + '/>' +
        '<path d="M52 54h36l-13 16h-10z" ' + AC + '/>' +
        '<path d="M54 58h32" stroke-dasharray="4 4" ' + S + '/>' +
        '<path d="M71 74v10" ' + S + '/>' +
        '<circle cx="71" cy="87" r="1.6" fill="var(--accent)" opacity=".7"/>' +
        '<path d="M54 92h34 M56 92v13a3 3 0 0 0 3 3h24a3 3 0 0 0 3-3V92" ' + S + '/>' +
        '<path d="M58 100h26v8H58z" ' + AC + '/>' +
        '<path d="M38 38l22 18" ' + S + '/>',
        "过滤操作"
      )
    },
    "crystallize": {
      label: "蒸发结晶",
      cap: "蒸发皿放在泥三角上小火加热，出现较多晶体时停止加热，余热蒸干。",
      svg: svg(
        '<path d="M40 46 q40 26 80 0" ' + S + '/>' +
        '<path d="M40 46 q0 -8 8 -8 h64 q8 0 8 8" ' + S + '/>' +
        '<path d="M52 52 q28 16 56 0" ' + AC + '/>' +
        '<path d="M48 60 l8 12 M70 64 l6 12 M92 62 l8 10 M112 56 l6 12" ' + S + '/>' +
        '<path d="M70 60 l4 -4 4 4 -4 5 z" ' + AC2 + '/>' +
        '<path d="M96 58 l4 -4 4 4 -4 5 z" ' + AC2 + '/>' +
        '<path d="M60 84 h40" ' + S + '/>' +
        '<path d="M68 90 q6 -10 12 0 q6 10 12 0" stroke="var(--warn)" stroke-width="2" fill="none"/>' +
        '<path d="M60 104 h40" ' + S + '/>',
        "蒸发结晶"
      )
    },
    "distill": {
      label: "蒸馏",
      cap: "温度计水银球位于支管口，冷凝水从下口进、上口出，弃去开始馏出的液体。",
      svg: svg(
        '<circle cx="36" cy="76" r="14" ' + S + '/>' +
        '<path d="M31 62V46h10v16" ' + S + '/>' +
        '<path d="M23 80h26a14 14 0 0 1-26 0z" ' + AC + '/>' +
        '<path d="M36 34v12" ' + S + '/>' +
        '<circle cx="36" cy="49" r="2.6" ' + AC2 + '/>' +
        '<path d="M41 50h22" ' + S + '/>' +
        '<rect x="-23" y="-7" width="46" height="14" rx="7" transform="translate(84,58) rotate(26)" ' + S + '/>' +
        '<path d="M64 49l40 19" ' + S + '/>' +
        '<circle cx="105" cy="74" r="1.6" fill="var(--accent)" opacity=".7"/>' +
        '<circle cx="105" cy="79" r="1.3" fill="var(--accent)" opacity=".5"/>' +
        '<path d="M100 84h12v6l12 14H88l12-14z" ' + S + '/>' +
        '<path d="M91 99h26l2 5H89z" ' + AC + '/>' +
        '<path d="M26 96q4-8 8 0q4 8 8 0" stroke="var(--warn)" stroke-width="2" fill="none"/>' +
        '<path d="M22 104h30" ' + S + '/>',
        "蒸馏装置"
      )
    },
    "reflux": {
      label: "回流",
      cap: "冷凝管夹在铁架台上，通水后加热，蒸气在冷凝管中液化回流，可减少溶剂损失。",
      svg: svg(
        '<path d="M54 92 a18 18 0 0 1 18 -18 h8 a18 18 0 0 1 18 18 z" ' + S + '/>' +
        '<path d="M60 74 h28" ' + AC + '/>' +
        '<path d="M80 74 v-42" ' + S + '/>' +
        '<path d="M72 32 v40 M88 32 v40" ' + S + '/>' +
        '<path d="M70 24 h20 l-4 8 h-12 z" ' + S + '/>' +
        '<path d="M96 40 l10 10 M96 52 l10 10 M96 64 l10 10" ' + AC2 + '/>' +
        '<path d="M40 96 q6 -12 12 0 q6 12 12 0" stroke="var(--warn)" stroke-width="2" fill="none"/>' +
        '<path d="M64 100 h40" ' + S + '/>' +
        '<circle cx="80" cy="52" r="2" ' + AC2 + '/>',
        "回流装置"
      )
    },
    "water-bath": {
      label: "水浴加热",
      cap: "把容器浸在 60–80℃ 的水浴中，受热均匀，适合低沸点、易燃液体的加热。",
      svg: svg(
        '<rect x="36" y="30" width="88" height="48" rx="6" ' + S + '/>' +
        '<path d="M44 62 q40 -6 72 0" ' + AC + '/>' +
        '<rect x="62" y="24" width="36" height="34" rx="4" ' + S + '/>' +
        '<path d="M70 34 h20 M70 42 h20" ' + AC2 + '/>' +
        '<path d="M112 34 v-10 M112 24 h4" ' + S + '/>' +
        '<circle cx="114" cy="20" r="3" ' + S + '/>' +
        '<path d="M56 88 q6 -12 12 0 q6 12 12 0" stroke="var(--warn)" stroke-width="2" fill="none"/>' +
        '<path d="M72 102 h32" ' + S + '/>' +
        '<path d="M44 40 q4 6 8 0 M52 52 q4 6 8 0" ' + AC2 + '/>',
        "水浴加热"
      )
    },
    "gas-jar": {
      label: "气体收集",
      cap: "根据气体密度选择向上或向下排空气，排水法收集时导管插入瓶口，集满后先移导管再停止加热。",
      svg: svg(
        '<circle cx="40" cy="74" r="15" ' + S + '/>' +
        '<path d="M35 60V50h10v10" ' + S + '/>' +
        '<path d="M33 46h14" ' + S + '/>' +
        '<path d="M26 78h28a15 15 0 0 1-28 0z" ' + AC + '/>' +
        '<path d="M45 52h14v-16h30" ' + S + '/>' +
        '<path d="M90 68V26h34v42" ' + S + '/>' +
        '<circle cx="100" cy="38" r="1.7" ' + AC2 + '/>' +
        '<circle cx="111" cy="34" r="1.5" ' + AC2 + '/>' +
        '<circle cx="105" cy="48" r="1.4" ' + AC2 + '/>' +
        '<circle cx="116" cy="46" r="1.3" ' + AC2 + '/>' +
        '<path d="M84 68h46v10H84z" ' + S + '/>' +
        '<path d="M86 71h42v6H86z" ' + AC + '/>' +
        '<path d="M14 100h58" ' + S + '/>',
        "气体收集"
      )
    },
    "precipitate": {
      label: "沉淀反应",
      cap: "滴管垂直悬空滴加，边加边振荡试管；沉淀下沉后观察颜色与状态。",
      svg: svg(
        '<path d="M46 26 h20 v50 a10 10 0 0 1 -20 0 z" ' + S + '/>' +
        '<path d="M50 70 h12" ' + AC + '/>' +
        '<circle cx="52" cy="80" r="2" ' + AC2 + '/>' +
        '<circle cx="58" cy="84" r="2" ' + AC2 + '/>' +
        '<path d="M100 26 h20 v42 a10 10 0 0 1 -20 0 z" ' + S + '/>' +
        '<path d="M104 58 q6 8 12 0" ' + AC2 + '/>' +
        '<path d="M78 18 l10 10 M84 20 l4 4" ' + S + '/>' +
        '<path d="M80 30 v8" ' + AC2 + '/>' +
        '<circle cx="80" cy="44" r="2" ' + AC2 + '/>' +
        '<path d="M78 14 h10" ' + S + '/>' +
        '<path d="M40 100 h80" ' + S + '/>' +
        '<path d="M110 76 l6 -6 6 6 -6 6 z" ' + AC2 + '/>',
        "沉淀反应"
      )
    },
    "color-tubes": {
      label: "显色与比色",
      cap: "同规格试管、等量试液、同时加入相同滴数试剂，在白纸前比较颜色深浅。",
      svg: svg(
        '<path d="M28 96 h104" ' + S + '/>' +
        '<path d="M34 96 v-46 q0 -6 6 -6 t6 6 v46" ' + S + '/>' +
        '<path d="M36 78 h12 v14 h-12 z" ' + AC2 + '/>' +
        '<path d="M56 96 v-52 q0 -6 6 -6 t6 6 v52" ' + S + '/>' +
        '<path d="M58 74 h12 v18 h-12 z" ' + AC + '/>' +
        '<path d="M78 96 v-44 q0 -6 6 -6 t6 6 v44" ' + S + '/>' +
        '<path d="M80 80 h12 v12 h-12 z" fill="var(--amber)" opacity=".35"/>' +
        '<path d="M100 96 v-56 q0 -6 6 -6 t6 6 v56" ' + S + '/>' +
        '<path d="M102 70 h12 v22 h-12 z" fill="var(--accent)" opacity=".28"/>' +
        '<path d="M124 96 v-48" ' + S + '/>' +
        '<path d="M120 52 h24" ' + S + '/>' +
        '<path d="M34 40 h96" stroke-dasharray="3 5" ' + S + '/>',
        "显色与比色"
      )
    },
    "titrate": {
      label: "滴定",
      cap: "滴定管排气泡后调零，左手控制活塞，右手摇瓶，眼睛注视锥形瓶内颜色变化。",
      svg: svg(
        '<path d="M42 28h30 M42 28v12" ' + S + '/>' +
        '<rect x="72" y="10" width="14" height="46" rx="3" ' + S + '/>' +
        '<path d="M77 19h9 M77 28h9 M77 37h9" ' + S + '/>' +
        '<path d="M79 56v4" ' + S + '/>' +
        '<circle cx="79" cy="64" r="4" ' + S + '/>' +
        '<path d="M79 68v6" ' + S + '/>' +
        '<circle cx="79" cy="79" r="1.7" fill="var(--accent)" opacity=".8"/>' +
        '<circle cx="79" cy="84" r="1.4" fill="var(--accent)" opacity=".55"/>' +
        '<path d="M73 88h12v6l13 12H60l13-12z" ' + S + '/>' +
        '<path d="M66 102h26l3 4H63z" ' + AC + '/>',
        "酸碱滴定"
      )
    },
    "electrolysis": {
      label: "电解",
      cap: "石墨电极插入电解液，接通直流电源，正极析出氧气、负极析出氢气，注意气密与通风。",
      svg: svg(
        '<rect x="70" y="10" width="20" height="12" rx="2" ' + S + '/>' +
        '<path d="M75 16h3 M82 16h3" ' + AC2 + '/>' +
        '<path d="M64 26v42 M96 26v42" ' + S + '/>' +
        '<path d="M64 26h-8v-8h14 M96 26h8v-8h-14" ' + S + '/>' +
        '<path d="M44 38h72v56a6 6 0 0 1-6 6H50a6 6 0 0 1-6-6z" ' + S + '/>' +
        '<path d="M46 64h68v26a4 4 0 0 1-4 4H50a4 4 0 0 1-4-4z" ' + AC + '/>' +
        '<circle cx="60" cy="56" r="1.8" ' + AC2 + '/>' +
        '<circle cx="57" cy="47" r="1.3" ' + AC2 + '/>' +
        '<circle cx="100" cy="54" r="1.8" ' + AC2 + '/>' +
        '<circle cx="103" cy="45" r="1.3" ' + AC2 + '/>',
        "电解装置"
      )
    },
    "separate-funnel": {
      label: "分液",
      cap: "分液漏斗静置分层，下层从下口放出，上层从上口倒出，放气时倒置漏斗打开活塞。",
      svg: svg(
        '<path d="M26 12v88 M14 100h24" ' + S + '/>' +
        '<path d="M26 40h20" ' + S + '/>' +
        '<path d="M56 30c4 14-10 16-10 30a26 26 0 0 0 52 0c0-14-14-16-10-30z" ' + S + '/>' +
        '<path d="M50 66h44v7H50z" ' + AC + '/>' +
        '<path d="M51 74h42v6H51z" ' + AC2 + '/>' +
        '<path d="M72 86v4" ' + S + '/>' +
        '<circle cx="72" cy="94" r="4" ' + S + '/>' +
        '<path d="M72 98v6" ' + S + '/>' +
        '<path d="M54 105h36 M56 105v5h32v-5" ' + S + '/>' +
        '<path d="M58 107h28v2H58z" ' + AC + '/>',
        "分液操作"
      )
    },
    "chromatography": {
      label: "纸层析",
      cap: "滤纸点样端浸入展开剂，斑点随溶剂上行，不同组分因吸附与溶解能力差异而分开。",
      svg: svg(
        '<path d="M50 28h60v66a6 6 0 0 1-6 6H56a6 6 0 0 1-6-6z" ' + S + '/>' +
        '<path d="M52 84h56v10a4 4 0 0 1-4 4H56a4 4 0 0 1-4-4z" ' + AC + '/>' +
        '<path d="M74 18h12v70H74z" ' + S + '/>' +
        '<path d="M74 48h12" stroke-dasharray="3 3" ' + AC2 + '/>' +
        '<circle cx="80" cy="74" r="2.4" fill="var(--warn)" opacity=".75"/>' +
        '<circle cx="80" cy="64" r="2.4" fill="var(--accent)" opacity=".8"/>' +
        '<circle cx="80" cy="54" r="2.2" fill="var(--amber)" opacity=".85"/>',
        "纸层析"
      )
    },
    "flame": {
      label: "焰色试验",
      cap: "铂丝蘸取样品在无色火焰外焰灼烧，观察火焰颜色；每次试验前用稀盐酸洗净铂丝。",
      svg: svg(
        '<path d="M44 92h52" ' + S + '/>' +
        '<path d="M30 64h30l14-8" ' + S + '/>' +
        '<circle cx="80" cy="52" r="4" ' + S + '/>' +
        '<circle cx="80" cy="47" r="2" fill="var(--warn)" opacity=".75"/>' +
        '<path d="M88 92c0-18 5-26 11-40 6 14 11 22 11 40a11 11 0 0 1-22 0z" ' + S + '/>' +
        '<path d="M93 92c0-11 3-16 6-25 3 9 6 14 6 25a6 6 0 0 1-12 0z" ' + AC2 + '/>' +
        '<path d="M114 34l6-6 M120 46l8-2 M116 58l6 4" stroke="var(--amber)" stroke-width="2" fill="none"/>',
        "焰色试验"
      )
    },
    "polymer": {
      label: "高分子",
      cap: "单体在引发剂作用下连接成长链，链与链缠结形成材料；固化过程常伴随放热与体积变化。",
      svg: svg(
        '<path d="M24 56 l12 -10 12 10 -12 10 z" ' + S + '/>' +
        '<path d="M48 56 l12 -10 12 10 -12 10 z" ' + S + '/>' +
        '<path d="M72 56 l12 -10 12 10 -12 10 z" ' + S + '/>' +
        '<path d="M96 56 l12 -10 12 10 -12 10 z" ' + S + '/>' +
        '<path d="M60 46 q0 -18 16 -18 t16 18" ' + AC2 + '/>' +
        '<path d="M40 66 q0 18 16 18 t16 -18" ' + AC2 + '/>' +
        '<circle cx="36" cy="56" r="2" ' + AC2 + '/>' +
        '<circle cx="108" cy="56" r="2" ' + AC2 + '/>' +
        '<path d="M20 84 h120" ' + S + '/>',
        "高分子链"
      )
    },
    "electroplate": {
      label: "电镀",
      cap: "待镀件接负极、镀层金属接正极，电镀液含镀层金属离子，通电后金属在工件表面析出。",
      svg: svg(
        '<rect x="34" y="40" width="92" height="48" rx="6" ' + S + '/>' +
        '<path d="M40 72 q40 -10 80 0" ' + AC + '/>' +
        '<path d="M64 40 v-12 h-8" ' + S + '/>' +
        '<path d="M96 40 v-12 h8" ' + S + '/>' +
        '<path d="M56 24 h16 M88 24 h16" ' + S + '/>' +
        '<rect x="72" y="10" width="16" height="12" rx="3" ' + S + '/>' +
        '<path d="M64 44 v40" stroke="var(--accent)" stroke-width="4"/>' +
        '<path d="M96 44 v40" ' + S + '/>' +
        '<path d="M92 52 h8 v10 h-8 z" fill="var(--accent)" opacity=".5"/>' +
        '<circle cx="96" cy="72" r="2" ' + AC2 + '/>' +
        '<path d="M28 96 h104" ' + S + '/>',
        "电镀装置"
      )
    }
  };

  /* 按 id 关键字匹配实验/制法，未命中时按分类兜底 */
  var RULES = [
    [/titrat/, "titrate"],
    [/flame|焰色|burn|combust/, "flame"],
    [/electrolys|electroplate|electro|电解|电镀|cell|corrosion|rust|anode/, "electrolysis"],
    [/chromatograph|层析/, "chromatography"],
    [/distill|蒸馏|fraction/, "distill"],
    [/extract|分液|separat/, "separate-funnel"],
    [/recrystall|crystal|结晶|purif/, "crystallize"],
    [/filter|filtration|过滤|purif/, "filter"],
    [/precip|沉淀|hydroxide|chloride|sulfate|carbonate|insoluble/, "precipitate"],
    [/reflux|回流|esterif|hydrolysis|saponif/, "reflux"],
    [/water-bath|水浴|fehling|biuret|denatur|enzyme|ferment/, "water-bath"],
    [/gas|oxygen|hydrogen|chlorine|ammonia|carbon-dioxide|combust|burn|prepar/, "gas-jar"],
    [/polymer|resin|nylon|bakelite|plastic|slime/, "polymer"],
    [/color|indicat|iodine|starch|ph|buffer|spectro|colorimetr/, "color-tubes"],
    [/heat|加热|thermit|magnesium|sodium/, "heat-tube"]
  ];

  var CAT_FALLBACK = {
    "气体": "gas-jar",
    "单质": "heat-tube",
    "氧化物": "heat-tube",
    "酸与碱": "color-tubes",
    "盐": "crystallize",
    "有机物": "reflux",
    "试剂与溶液": "color-tubes",
    "生活材料": "filter",
    "基础操作": "filter",
    "物质性质": "color-tubes",
    "电化学": "electrolysis",
    "趣味演示": "flame",
    "分离提纯": "filter",
    "定量测量": "titrate",
    "气体与燃烧": "gas-jar",
    "沉淀溶解平衡": "precipitate",
    "配位化学": "color-tubes",
    "生活化学": "color-tubes",
    "环境检测": "titrate"
  };

  function artId(item, type) {
    if (!item) return "heat-tube";
    if (item.art && ART[item.art]) return item.art;
    var key = (item.id || "") + " " + (item.name || "");
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i][0].test(key)) {
        /* 过滤优先于结晶：id 含 filter 时走过滤 */
        return RULES[i][1];
      }
    }
    return CAT_FALLBACK[item.category] || (type === "p" ? "crystallize" : "heat-tube");
  }

  function figure(item, type, captionOverride) {
    var id = artId(item, type);
    var art = ART[id] || ART["heat-tube"];
    var caption = captionOverride || art.cap;
    return (
      '<figure class="art-figure">' +
        '<div class="art-frame">' + art.svg + "</div>" +
        '<figcaption class="art-cap"><b>' + art.label + "</b>" + (caption ? " · " + caption : "") + "</figcaption>" +
      "</figure>"
    );
  }

  function icon(item, type) {
    var id = artId(item, type);
    var art = ART[id] || ART["heat-tube"];
    return art.svg;
  }

  function list() {
    return Object.keys(ART).map(function (k) {
      return { id: k, label: ART[k].label, svg: ART[k].svg };
    });
  }

  window.CHEMLAB_ART = {
    figure: figure,
    icon: icon,
    artId: artId,
    list: list,
    art: ART
  };
})();
