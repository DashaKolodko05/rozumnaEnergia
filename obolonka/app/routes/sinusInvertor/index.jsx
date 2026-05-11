import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────────
// Залишено лише SinePure 3500 — менші моделі не витримують повне навантаження
// (макс. ~3130 Вт при всіх увімкнених пристроях)
const INVERTERS = {
  inv3500: { id:"inv3500", label:"SinePure 3500", max_w:3500, thd_base:0.018, desc:"Чиста синусоїда · 3500 Вт" },
};

// Дефолтний тип батареї (використовується до ініціалізації стану)
const BAT_DEFAULT_ID = "varta_b8";
const INVERTER_EFF_NOMINAL = 0.92;
const BAT_SAFE_FLOOR = 0.05;
const PEUKERT_EXP = 1.08;
const PEUKERT_REF_HOURS = 20;

// Бібліотека акумуляторів
const BAT_LIBRARY = {
  varta_b8:    { id:"varta_b8",    label:"ВАРТА В8",       cap:80,  minV:10.8, maxV:12.85, type:"AGM",    desc:"12В · 80 Аг · AGM"   },
  varta_b9:    { id:"varta_b9",    label:"ВАРТА В9",       cap:100, minV:10.8, maxV:12.85, type:"AGM",    desc:"12В · 100 Аг · AGM"  },
  bosch_s5:    { id:"bosch_s5",    label:"Bosch S5 110",   cap:110, minV:10.8, maxV:12.90, type:"AGM",    desc:"12В · 110 Аг · AGM"  },
  exide_gel80: { id:"exide_gel80", label:"Exide Gel G80",  cap:80,  minV:10.5, maxV:12.80, type:"GEL",    desc:"12В · 80 Аг · GEL"   },
  lifepo4_100: { id:"lifepo4_100", label:"LiFePO4 100 Аг", cap:100, minV:11.0, maxV:14.60, type:"LiFePO4",desc:"12В · 100 Аг · LFP"  },
};

// Конфігурації акумуляторної підсистеми (резервування для функціональної стійкості)
const BAT_CONFIGS = {
  parallel: {
    id:"parallel", label:"Паралельне",
    desc:"Батареї працюють одночасно",
    detail:"Всі батареї увімкнені паралельно. Ємність множиться на кількість батарей, струм розряду ділиться — менший просад напруги, нижча THD при пікових навантаженнях.",
    capMul:1, parallel:true, hotSwap:false,
  },
  hotSwap: {
    id:"hotSwap", label:"Резервне (АВР)",
    desc:"Почергове підключення з ATS",
    detail:"Батареї підключаються по черзі. Активна батарея працює до 15% заряду, потім ATS перемикає на наступну. Максимально використовується вся доступна енергія всіх акумуляторів.",
    capMul:1, parallel:false, hotSwap:true, hotSwapThreshold:0.15,
  },
};

const FAN_MODES = [
  { id:0, label:"Вимк",  w:0  },
  { id:1, label:"Мін",   w:15,  surge:3.2, surgeT:0.5 },
  { id:2, label:"Сер",   w:33,  surge:3.8, surgeT:0.6 },
  { id:3, label:"Макс",  w:55,  surge:4.5, surgeT:0.7 },
  { id:4, label:"Турбо", w:80,  surge:5.8, surgeT:0.9 },
];

// Пристрої — baseW: робоча потужність, cycleOn/cycleOff: тривалість фаз (с)
const DEVICES = {
  fan:    { name:"Вентилятор", type:"inductive",  baseW:0,    icon:"fan",    cycleOn:null },
  kettle: { name:"Чайник",     type:"resistive",  baseW:1500, icon:"kettle", cycleOn:300, cycleOff:120 },
  hob:    { name:"Конфорка",   type:"resistive",  baseW:1000, icon:"hob",    cycleOn:480, cycleOff:180 },
  drill:  { name:"Дриль",      type:"nonlinear",  baseW:550,  icon:"drill",  cycleOn:null },
};
// Сумарно макс: 1500 + 1000 + 550 + 80 = 3130 Вт → вміщається в SinePure 3500

const ZONES = {
  stable:   { label:"Стабільно",    col:"#16a34a", bg:"#f0fdf4", border:"#86efac" },
  warning:  { label:"Попередження", col:"#b45309", bg:"#fffbeb", border:"#fcd34d" },
  critical: { label:"Критично",     col:"#dc2626", bg:"#fef2f2", border:"#fca5a5" },
  shutdown: { label:"Вимкнено",     col:"#6b7280", bg:"#f9fafb", border:"#d1d5db" },
};

// ─── BATTERY VOLTAGE CURVE ─────────────────────────────────────────────────────
// Реальна крива розряду AGM 12В: швидке падіння на початку, плато, різкий обвал у кінці
function batV(charge, bat) {
  const b = bat ?? BAT_LIBRARY[BAT_DEFAULT_ID];
  const x = Math.max(0, Math.min(1, charge));
  return b.minV + (b.maxV - b.minV) * (0.78 * x + 0.22 * x * x);
}

function inverterEfficiency(loadW, inv) {
  if (loadW <= 0) return INVERTER_EFF_NOMINAL;
  const loadRatio = Math.max(0.02, Math.min(1.25, loadW / inv.max_w));
  if (loadRatio < 0.12) return 0.86 + loadRatio * 0.35;
  if (loadRatio > 0.85) return 0.92 - (loadRatio - 0.85) * 0.08;
  return INVERTER_EFF_NOMINAL;
}

function peukertCapacityFactor(currentA, bat) {
  const b = bat ?? BAT_LIBRARY[BAT_DEFAULT_ID];
  if (currentA <= 0.01) return 1;
  const refA = b.cap / PEUKERT_REF_HOURS;
  const factor = Math.pow(refA / currentA, PEUKERT_EXP - 1);
  return Math.max(0.82, Math.min(1.05, factor));
}

function dischargeDeltaCharge(currentA, dt, bat) {
  const b = bat ?? BAT_LIBRARY[BAT_DEFAULT_ID];
  const capFactor = peukertCapacityFactor(currentA, b);
  return (currentA * dt) / (b.cap * capFactor * 3600);
}

function remainingBatteryWh(charge, currentA, bat, floor = BAT_SAFE_FLOOR) {
  const b = bat ?? BAT_LIBRARY[BAT_DEFAULT_ID];
  const usableCharge = Math.max(0, charge - floor);
  return usableCharge * b.cap * peukertCapacityFactor(currentA, b) * batV(charge, b);
}

// ─── DEVICE POWER ───────────────────────────────────────────────────────────────
function devPower(key, dev, t) {
  if (!dev.on) return 0;
  const cfg = DEVICES[key];

  if (key === "fan") {
    const fm = FAN_MODES[dev.fanMode ?? 0];
    if (!fm || fm.w === 0) return 0;
    const dt = t - dev.startT;
    const surge = (fm.surgeT && dt < fm.surgeT)
      ? 1 + (fm.surge - 1) * Math.exp(-5 * dt / fm.surgeT)
      : 1.0;
    return fm.w * surge;
  }

  // Циклічні пристрої: чайник (терморегулятор), конфорка
  if (cfg.cycleOn !== null) {
    const period = cfg.cycleOn + cfg.cycleOff;
    const phase = dev.cycleT % period;
    if (phase >= cfg.cycleOn) return 0; // фаза паузи
  }

  if (key === "drill") {
    const dt = t - dev.startT;
    // Реальний пусковий струм щіткового двигуна: 2.6× протягом ~0.5с
    const surge = dt < 0.5 ? 1 + 1.6 * Math.exp(-8 * dt / 0.5) : 1.0;
    // Модуляція навантаження (натиск на свердло)
    const load = 0.80 + 0.20 * (1 + Math.sin(2 * Math.PI * 0.65 * t)) / 2;
    return cfg.baseW * surge * load;
  }

  return cfg.baseW;
}

// ─── HARMONIC DISTORTION ───────────────────────────────────────────────────────
// Реалістичні коефіцієнти на основі вимірювань реальних побутових приладів
// (IEC 61000-3-2, дослідження Schneider Electric, Fluke Power Quality)
function distortion(type, w) {
  if (type === "inductive")  return { thd: 0.045 * (w / 80),    sag: 0.005 * (w / 80) };
  if (type === "nonlinear")  return { thd: 0.18  * (w / 550),   sag: 0.012 * (w / 550) };
  // Резистивні — практично без спотворень, зростає трохи лише при перевантаженні
  return                            { thd: 0.008 * (w / 1500), sag: 0.002 * (w / 1500) };
}

// ─── ZONE CALCULATION ──────────────────────────────────────────────────────────
// Гістерезис: не дозволяємо перескакувати зону частіше ніж за HYSTERESIS_SEC секунд.
// Це стандартна практика в SCADA-системах і промислових ДБЖ — без неї індикатор
// "блимає" при коливаннях навантаження (наприклад, дриль з модуляцією).
const ZONE_HYSTERESIS_SEC = 5;

function calcZoneRaw(margin, charge) {
  if (charge <= 0.05) return "shutdown";
  if (margin > 60)    return "stable";
  if (margin > 8)     return "warning";   // 8–60 хв
  if (margin > 3)     return "critical";  // 3–8 хв
  return "critical";                      // <3 хв: критично, але не вимикаємо до фактичного розряду
}

// Враховує час перебування в попередній зоні — повертає або нову, або стару
function calcZoneStable(margin, charge, prevZone, zoneEnteredAt, t) {
  const raw = calcZoneRaw(margin, charge);
  if (raw === prevZone) return raw;
  // Перехід до більш критичної зони — мить (без гістерезису, для безпеки)
  const sevOrder = { stable:0, warning:1, critical:2, shutdown:3 };
  if (sevOrder[raw] > sevOrder[prevZone]) return raw;
  // Перехід до менш критичної — тільки якщо в попередній пробули >= HYSTERESIS_SEC
  if (zoneEnteredAt == null) return raw;
  if (t - zoneEnteredAt >= ZONE_HYSTERESIS_SEC) return raw;
  return prevZone; // ще зарано — лишаємо стару
}

// ─── TIME FORMATTING ───────────────────────────────────────────────────────────
function fmt(s) {
  if (s < 60)   return `${Math.round(s)}с`;
  if (s < 3600) return `${Math.floor(s/60)}хв`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return m > 0 ? `${h}год ${m}хв` : `${h}год`;
}

// Час доби з урахуванням стартової години + симульованого часу
function fmtClock(startHourMin, simSec) {
  const totalMin = startHourMin + simSec / 60;
  const totalSec = (totalMin * 60) % (24 * 3600);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  return { h, m, s, str: `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` };
}

function useViewportWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

// ─── INITIAL STATE ─────────────────────────────────────────────────────────────
function mkState(invId, charge0, batConfigId, startHour, batTypeId, batCount) {
  const bc = BAT_CONFIGS[batConfigId];
  const bat = BAT_LIBRARY[batTypeId ?? BAT_DEFAULT_ID];
  const n = Math.max(1, batCount ?? 2);
  // Черга батарей: масив зарядів. Для паралелі — всі активні; для АВР — по черзі.
  const batQueue = Array.from({ length: n }, () => charge0);
  return {
    t:0, charge:charge0,
    batVolt: batV(charge0, bat),
    devices:{
      fan:    { on:false, fanMode:0, startT:0, cycleT:0 },
      kettle: { on:false, startT:0, cycleT:0 },
      hob:    { on:false, startT:0, cycleT:0 },
      drill:  { on:false, startT:0, cycleT:0 },
    },
    totalW:0, thd:0, sagFactor:1, avgPowerW: 0,
    margin:999, zone:"stable",
    zoneEnteredAt: 0,
    trend:[], events:[],
    invId, lastShedT:-60,
    criticalSince: null,
    // Конфігурація живлення
    batConfigId,
    batTypeId: batTypeId ?? BAT_DEFAULT_ID,
    batCount: n,
    // Черга батарей (масив зарядів 0..1)
    batQueue,           // [bat1, bat2, ..., batN]
    activeBatIdx: 0,    // для АВР: індекс поточної активної батареї
    hotSwapDone: false,
    // Для сумісності з BatPanel (відображення 2 батарей)
    bat2Charge: n >= 2 ? charge0 : null,
    bat2Active: bc.parallel,
    activeBatN: bc.parallel ? n : 1,
    // Час
    startHour: startHour ?? 12,
  };
}

// ─── TICK ──────────────────────────────────────────────────────────────────────
function tick(prev, realDt, inv, toggle) {
  const s = { ...prev, devices:{}, batQueue: [...prev.batQueue] };
  for (const k of Object.keys(prev.devices)) s.devices[k] = { ...prev.devices[k] };
  const bc = BAT_CONFIGS[s.batConfigId];
  const bat = BAT_LIBRARY[s.batTypeId ?? BAT_DEFAULT_ID];

  s.t += realDt;

  // Команда користувача
  if (toggle) {
    if (toggle.key === "fanMode") {
      const m = toggle.val;
      s.devices.fan = { ...s.devices.fan, fanMode:m, on:m>0 };
      if (m > 0) s.devices.fan.startT = s.t;
    } else {
      const wasOn = s.devices[toggle.key].on;
      s.devices[toggle.key] = { ...s.devices[toggle.key], on:toggle.val };
      if (toggle.val && !wasOn) {
        s.devices[toggle.key].startT = s.t;
        s.devices[toggle.key].cycleT = 0;
      }
    }
  }

  // Цикли терморегулятора + автовимкнення чайника
  for (const k of ["kettle","hob"]) {
    if (s.devices[k].on) {
      s.devices[k].cycleT += realDt;
      if (k === "kettle") {
        const cfg = DEVICES[k];
        if (s.devices[k].cycleT >= cfg.cycleOn) {
          s.devices[k] = { ...s.devices[k], on:false, cycleT:0 };
          s.events = [...s.events.slice(-14), { t:s.t, msg:"Чайник закипів — автоматично вимкнено", sev:"info" }];
        }
      }
    }
  }

  // Сумарна потужність + спотворення
  let totalW = 0, thdAcc = inv.thd_base, sagAcc = 0;
  for (const k of Object.keys(DEVICES)) {
    const p = devPower(k, s.devices[k], s.t);
    if (p > 0) {
      const d = distortion(DEVICES[k].type, p);
      thdAcc += d.thd; sagAcc += d.sag;
    }
    totalW += p;
  }

  const overload = totalW > inv.max_w;
  if (overload) { thdAcc += 0.05; sagAcc += 0.10; }

  // ─── РОЗРЯД АКУМУЛЯТОРА (з урахуванням конфігурації резервування) ───────────
  const effectiveW = overload ? inv.max_w : totalW;
  const bv = batV(s.charge, bat);
  const effNow = inverterEfficiency(effectiveW, inv);
  const iDC = effectiveW / Math.max(bv * effNow, 1);

  if (bc.parallel) {
    // Паралель: струм ділиться порівну між усіма батареями
    const perBat = iDC / s.batQueue.length;
    const dCharge = dischargeDeltaCharge(perBat, realDt, bat);
    s.batQueue = s.batQueue.map(ch => Math.max(0, ch - dCharge));
    sagAcc *= 0.6;
    thdAcc -= 0.005;
  } else if (bc.hotSwap) {
    // АВР: черга батарей — розряджаємо активну до 4%, потім переходимо на наступну.
    // Якщо всі батареї <= 4% — система зупиняється (більше не перемикаємо).
    const DEAD_FLOOR = 0.04;
    let idx = s.activeBatIdx;
    const dCharge = dischargeDeltaCharge(iDC, realDt, bat);
    s.batQueue[idx] = Math.max(0, s.batQueue[idx] - dCharge);

    // Перемикання тільки якщо активна досягла порогу І є жива наступна
    if (s.batQueue[idx] <= DEAD_FLOOR) {
      // Шукаємо першу батарею з зарядом > DEAD_FLOOR (крім поточної)
      let next = -1;
      for (let i = 1; i < s.batQueue.length; i++) {
        const ni = (idx + i) % s.batQueue.length;
        if (s.batQueue[ni] > DEAD_FLOOR) { next = ni; break; }
      }
      if (next !== -1) {
        // Є жива батарея — перемикаємось
        const prevPct = Math.round(s.batQueue[idx] * 100);
        s.activeBatIdx = next;
        s.hotSwapDone = true;
        s.events = [...s.events.slice(-14), {
          t: s.t,
          msg: `АВР: батарея №${idx + 1} розряджена (${prevPct}%) — активна №${next + 1}`,
          sev: "info",
        }];
      }
      // Якщо next === -1 — всі мертві, залишаємось на поточній (вона на 0-4%), zoneCharge це відловить
    }
  } else {
    s.batQueue[0] = Math.max(0, s.batQueue[0] - dischargeDeltaCharge(iDC, realDt, bat));
  }

  // Синхронізуємо s.charge / s.bat2Charge з batQueue для відображення
  s.charge = s.batQueue[0];
  s.bat2Charge = s.batQueue.length >= 2 ? s.batQueue[1] : null;
  s.activeBatN = bc.parallel ? s.batQueue.length : (s.activeBatIdx + 1);

  // Поточний заряд для розрахунків (середній або активний)
  const effectiveCharge = bc.parallel
    ? s.batQueue.reduce((a, b) => a + b, 0) / s.batQueue.length
    : s.batQueue[s.activeBatIdx];

  s.batVolt    = batV(effectiveCharge, bat);
  s.totalW     = totalW;
  s.overload   = overload;
  s.thd        = Math.max(0, Math.min(thdAcc, 0.28));
  s.sagFactor  = Math.max(0.75, 1 - sagAcc - (overload ? 0.10 : 0));
  // sinePhase тепер анімується локально в SineCanvas (через requestAnimationFrame),
  // незалежно від realDt — щоб плавно і не "трясло" на високих швидкостях симуляції

  // Час автономної роботи (T_auto)
  // Використовуємо ЗГЛАДЖЕНЕ навантаження (EMA), бо миттєві піки (дриль) не повинні
  // різко змінювати оцінку T_auto. Це стандартна практика — APC, Eaton, Victron всі
  // використовують sliding window або EMA з τ ≈ 30c для оцінки runtime.
  // Формула EMA: avg_new = avg_old + α·(P_now - avg_old), α = dt/τ
  const tauSec = 30;
  const alpha = Math.min(1, realDt / tauSec);
  const prevAvgW = prev.avgPowerW ?? effectiveW;
  s.avgPowerW = prevAvgW + alpha * (effectiveW - prevAvgW);

  const effAvg = inverterEfficiency(s.avgPowerW, inv);
  const avgIDC = s.avgPowerW / Math.max(s.batVolt * effAvg, 1);
  let totalRemainingWh;
  if (bc.parallel) {
    const perBatA = avgIDC / s.batQueue.length;
    totalRemainingWh = s.batQueue.reduce((sum, ch) => sum + remainingBatteryWh(ch, perBatA, bat), 0);
  } else if (bc.hotSwap) {
    totalRemainingWh = s.batQueue.reduce((sum, ch) => sum + remainingBatteryWh(ch, avgIDC, bat), 0);
  } else {
    totalRemainingWh = remainingBatteryWh(s.batQueue[0], avgIDC, bat);
  }
  const usableAcWh = totalRemainingWh * effAvg;
  const STABILITY_MAX_MIN = 100;
  s.margin = s.avgPowerW > 5 ? Math.min((usableAcWh / s.avgPowerW) * 60, STABILITY_MAX_MIN) : STABILITY_MAX_MIN;

  // Зона
  const prevZone = s.zone;
  // Для обох режимів: shutdown тільки якщо ВСІ батареї мертві
  const allDeadParallel = s.batQueue.every(ch => ch <= 0.05);
  const allDeadHotSwap  = s.batQueue.every(ch => ch <= 0.04);
  const allDead = bc.parallel ? allDeadParallel : (bc.hotSwap ? allDeadHotSwap : s.batQueue[0] <= 0.05);

  // zoneCharge: для паралелі — середній (не мінімум!), для АВР — активна або 0 якщо всі мертві
  const zoneCharge = bc.parallel
    ? (allDeadParallel ? 0 : s.batQueue.reduce((a, b) => a + b, 0) / s.batQueue.length)
    : (allDeadHotSwap  ? 0 : Math.max(s.batQueue[s.activeBatIdx ?? 0], 0.051));

  s.zone = calcZoneStable(s.margin, zoneCharge, prevZone, s.zoneEnteredAt, s.t);
  if (s.zone !== prevZone) s.zoneEnteredAt = s.t;

  // Час у критичній зоні
  if (s.zone === "critical" && prevZone !== "critical") {
    s.criticalSince = s.t;
  } else if (s.zone !== "critical") {
    s.criticalSince = null;
  }

  // Load Shedding
  const SHED_ORDER = ["drill","hob","fan"];
  const inCriticalLong = s.criticalSince !== null && (s.t - s.criticalSince) > 20;
  const justToggled = toggle?.val === true ? toggle.key : null;
  if (s.zone === "critical" && inCriticalLong && s.t - s.lastShedT > 20) {
    for (const k of SHED_ORDER) {
      if (s.devices[k].on && k !== justToggled) {
        s.devices[k] = { ...s.devices[k], on:false };
        s.events = [...s.events.slice(-14), { t:s.t, msg:`Авт. відключення: ${DEVICES[k].name}`, sev:"warn" }];
        s.lastShedT = s.t;
        s.criticalSince = s.t;
        break;
      }
    }
  }

  if (s.zone === "shutdown" && prevZone !== "shutdown") {
    for (const k of Object.keys(s.devices)) s.devices[k] = { ...s.devices[k], on:false };
    s.events = [...s.events.slice(-14), { t:s.t, msg:"Акумулятори розряджено — система заблокована", sev:"crit" }];
  }

  // Вимикаємо пристрої при реальному розряді всіх батарей
  if (allDead) {
    for (const k of Object.keys(s.devices)) {
      if (s.devices[k].on) s.devices[k] = { ...s.devices[k], on:false };
    }
  }

  // Точка тренду (раз на ~3с симульованого часу)
  const last = s.trend[s.trend.length - 1];
  if (!last || s.t - last.t >= 3) {
    s.trend = [...s.trend.slice(-120), {
      t: s.t,
      tLabel: fmt(s.t),
      chargePct: parseFloat((s.batQueue[0] * 100).toFixed(1)),
      bat2Pct: s.batQueue.length >= 2 ? parseFloat((s.batQueue[1] * 100).toFixed(1)) : null,
      batV: parseFloat(s.batVolt.toFixed(2)),
      marginMin: parseFloat(s.margin.toFixed(1)),
      powerW: Math.round(totalW),
      thdPct: parseFloat(Math.min(s.thd * 100, 30).toFixed(1)),
    }];
  }

  return s;
}

// ─── TREND CHART ───────────────────────────────────────────────────────────────
function TrendChart({ trend, lines, yMin, yMax, yLabel, xLabel, title, zoneLines, tooltipData }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);

  const PL = 86, PR = 18, PT = 20, PB = 48;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const DPR = window.devicePixelRatio || 1;
    const W = c.clientWidth || 300;
    const H = c.clientHeight || 180;
    c.width = W * DPR; c.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const textC = "#334155";
    const textCStrong = "#0f172a";
    const gridC = "rgba(15,23,42,0.12)";
    const axisC = "#0f172a";
    const cw = W - PL - PR, ch = H - PT - PB;
    const hasData = trend.length >= 2;

    ctx.clearRect(0, 0, W, H);

    let lo = yMin ?? Infinity, hi = yMax ?? -Infinity;
    if (!hasData) {
      lo = yMin ?? 0;
      hi = yMax ?? 1;
    } else if (yMin === undefined || yMax === undefined) {
      for (const p of trend) for (const l of lines) {
        const v = p[l.key];
        if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      }
      const r = hi - lo || 1;
      lo = Math.max(lo - r * 0.1, 0);
      hi = hi + r * 0.12;
    }
    const rng = hi - lo || 1;
    const toX = i => PL + (i / Math.max(trend.length - 1, 1)) * cw;
    const toY = v => PT + ch - ((v - lo) / rng) * ch;
    const fmtTick = (v) => {
      const abs = Math.abs(v);
      if (abs >= 1000) return `${Math.round(v / 100) / 10}к`;
      if (abs < 10 && Math.abs(v - Math.round(v)) > 0.05) return v.toFixed(1);
      return Math.round(v).toString();
    };

    // Сітка
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, PT, PL, ch);
    ctx.strokeStyle = gridC; ctx.lineWidth = 1;
    for (let g = 0; g <= 5; g++) {
      const y = PT + (g / 5) * ch;
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + cw, y); ctx.stroke();
    }
    for (let g = 1; g <= 5; g++) {
      const x = PL + (g / 5) * cw;
      ctx.beginPath(); ctx.moveTo(x, PT); ctx.lineTo(x, PT + ch); ctx.stroke();
    }

    // Осі: Y зроблена явною, але без надмірної товщини.
    ctx.strokeStyle = axisC; ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(PL, PT);
    ctx.lineTo(PL, PT + ch);
    ctx.lineTo(PL + cw, PT + ch);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(PL, PT);
    ctx.lineTo(PL - 4, PT + 8);
    ctx.moveTo(PL, PT);
    ctx.lineTo(PL + 4, PT + 8);
    ctx.stroke();
    ctx.fillStyle = textCStrong; ctx.font = "600 11px sans-serif"; ctx.textAlign = "right";
    ctx.fillText("Y", PL - 10, PT + 8);

    ctx.fillStyle = textCStrong; ctx.font = "600 11px sans-serif"; ctx.textAlign = "right";
    for (let g = 0; g <= 5; g++) {
      const y = PT + (g / 5) * ch;
      ctx.strokeStyle = axisC;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PL - 8, y); ctx.lineTo(PL, y); ctx.stroke();
      const val = hi - (g / 5) * rng;
      ctx.fillText(fmtTick(val), PL - 12, y + 4);
    }

    if (yLabel) {
      ctx.save();
      ctx.translate(18, PT + ch / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = textCStrong; ctx.font = "600 11px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(yLabel, 0, 0);
      ctx.restore();
    }

    if (zoneLines) {
      for (const zl of zoneLines) {
        if (zl.val < lo || zl.val > hi) continue;
        const y = toY(zl.val);
        ctx.save();
        ctx.strokeStyle = zl.col; ctx.lineWidth = 1; ctx.setLineDash([4,3]);
        ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + cw, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = zl.col; ctx.font = "9px sans-serif"; ctx.textAlign = "left";
        ctx.fillText(zl.label, PL + 4, y - 3);
        ctx.restore();
      }
    }

    ctx.strokeStyle = axisC;
    ctx.lineWidth = 1;
    ctx.fillStyle = textC; ctx.font = "11px sans-serif"; ctx.textAlign = "center";
    const N_TICKS = 5;
    for (let g = 0; g <= N_TICKS; g++) {
      const idxFrac = g / N_TICKS;
      const x = PL + idxFrac * cw;
      ctx.beginPath(); ctx.moveTo(x, PT + ch); ctx.lineTo(x, PT + ch + 4); ctx.stroke();
      const idx = Math.round(idxFrac * (trend.length - 1));
      const pt = trend[idx];
      if (pt) ctx.fillText(pt.tLabel, x, PT + ch + 16);
    }

    if (xLabel) {
      ctx.fillStyle = textCStrong; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(xLabel, PL + cw / 2, H - 4);
    }

    if (!hasData) {
      ctx.fillStyle = textC; ctx.font = "12px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("Очікування даних...", PL + cw / 2, PT + ch / 2);
      return;
    }

    for (const line of lines) {
      ctx.beginPath(); ctx.strokeStyle = line.col; ctx.lineWidth = 2; ctx.lineJoin = "round";
      if (line.dashed) ctx.setLineDash([5,4]);
      let first = true;
      for (let i = 0; i < trend.length; i++) {
        const v = trend[i][line.key]; if (v == null) continue;
        first ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)); first = false;
      }
      ctx.stroke();
      ctx.setLineDash([]);
      const last2 = trend[trend.length - 1];
      if (last2?.[line.key] != null) {
        ctx.beginPath(); ctx.arc(toX(trend.length - 1), toY(last2[line.key]), 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = line.col; ctx.fill();
      }
    }

    if (hover) {
      const hx = PL + (hover.idx / Math.max(trend.length - 1, 1)) * cw;
      ctx.strokeStyle = "rgba(15,23,42,0.28)";
      ctx.lineWidth = 1; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.moveTo(hx, PT); ctx.lineTo(hx, PT + ch); ctx.stroke();
      ctx.setLineDash([]);
      for (const line of lines) {
        const v = hover.pt[line.key]; if (v == null) continue;
        ctx.beginPath(); ctx.arc(hx, toY(v), 4, 0, 2 * Math.PI);
        ctx.fillStyle = line.col; ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
  }, [trend, lines, yMin, yMax, yLabel, xLabel, zoneLines, hover, PL, PR, PT, PB]);

  const handleMouseMove = useCallback((e) => {
    const c = ref.current; if (!c || trend.length < 2) return;
    const rect = c.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const cw = c.clientWidth - PL - PR;
    const frac = Math.max(0, Math.min(1, (mx - PL) / cw));
    const idx = Math.round(frac * (trend.length - 1));
    setHover({ idx, pt: trend[idx], x: mx, y: e.clientY - rect.top });
  }, [trend, PL, PR]);

  const handleMouseLeave = useCallback(() => setHover(null), []);

  return (
    <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"10px 12px", position:"relative" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <span style={{ fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>{title}</span>
        <div style={{ display:"flex", gap:10 }}>
          {lines.map(l => (
            <span key={l.key} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"var(--color-text-secondary)" }}>
              <span style={{
                width:14, height:l.dashed ? 0 : 2.5,
                borderTop: l.dashed ? `2px dashed ${l.col}` : "none",
                background: l.dashed ? "transparent" : l.col,
                display:"inline-block", borderRadius:1
              }} />
              {l.name}
            </span>
          ))}
        </div>
      </div>

      <div style={{ position:"relative" }}>
        <canvas
          ref={ref}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ width:"100%", height:190, display:"block", cursor:"crosshair" }}
        />

        {hover && tooltipData && (() => {
          const pt = hover.pt;
          const tipW = 170;
          const canvasW = ref.current?.clientWidth || 300;
          const tipLeft = hover.x + tipW + 12 > canvasW ? hover.x - tipW - 8 : hover.x + 8;
          return (
            <div style={{
              position:"absolute", top: Math.max(4, hover.y - 10),
              left: tipLeft, width: tipW, pointerEvents:"none", zIndex:10,
              background:"var(--color-background-primary)",
              border:"0.5px solid var(--color-border-secondary)",
              borderRadius:"var(--border-radius-md)",
              padding:"8px 10px", fontSize:11,
              boxShadow:"0 2px 8px rgba(0,0,0,0.12)",
            }}>
              <div style={{ color:"var(--color-text-secondary)", marginBottom:5, fontWeight:500 }}>{pt.tLabel}</div>
              {tooltipData.map(td => (
                <div key={td.key} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                  <span style={{ display:"flex", alignItems:"center", gap:5, color:"var(--color-text-secondary)" }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background:td.col, display:"inline-block", flexShrink:0 }} />
                    {td.label}
                  </span>
                  <span style={{ fontWeight:500, color:td.col }}>
                    {pt[td.key] != null ? `${pt[td.key]}${td.unit}` : "—"}
                  </span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── SINE CANVAS ───────────────────────────────────────────────────────────────
function SineCanvas({ sagFactor, thd, speedId, paused }) {
  const ref = useRef(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;

    let raf = 0;
    let lastTs = performance.now();

    const draw = (ts) => {
      const ctx = c.getContext("2d");
      const DPR = window.devicePixelRatio || 1;
      const W = c.clientWidth || 300;
      const H = c.clientHeight || 120;
      if (c.width !== W * DPR || c.height !== H * DPR) {
        c.width = W * DPR;
        c.height = H * DPR;
      }
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      const dt = Math.min((ts - lastTs) / 1000, 0.08);
      lastTs = ts;
      const speedMul = speedId === "real" ? 1 : 1.35;
      if (!paused) phaseRef.current += dt * speedMul * Math.PI * 1.6;

      const bg = "#ffffff";
      const grid = "rgba(37,99,235,0.10)";
      const axis = "rgba(15,23,42,0.22)";
      const text = "rgba(15,23,42,0.66)";
      const line = thd > 0.08 ? "#dc2626" : thd > 0.05 ? "#d97706" : "#2563eb";

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const pad = 18;
      const mid = H / 2;
      const amp = Math.max(18, (H - pad * 2) * 0.42 * sagFactor);

      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        const x = (W / 5) * i;
        ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H - pad); ctx.stroke();
      }
      for (let i = -1; i <= 1; i++) {
        const y = mid + i * amp * 0.65;
        ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
      }

      ctx.strokeStyle = axis;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad, mid); ctx.lineTo(W - pad, mid); ctx.stroke();

      ctx.strokeStyle = line;
      ctx.lineWidth = 2.25;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let x = pad; x <= W - pad; x++) {
        const t = ((x - pad) / (W - pad * 2)) * Math.PI * 4 + phaseRef.current;
        const harmonic = thd * 1.35 * Math.sin(t * 3 + phaseRef.current * 0.45);
        const y = mid - amp * (Math.sin(t) + harmonic);
        if (x === pad) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = text;
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Синусоїда · THD ${(thd * 100).toFixed(1)}%`, pad, 15);
      ctx.textAlign = "right";
      ctx.fillText(`просад ${Math.round((1 - sagFactor) * 100)}%`, W - pad, 15);

      if (!paused) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [sagFactor, thd, speedId, paused]);

  return (
    <div style={{
      background:"var(--color-background-primary)",
      border:"0.5px solid var(--color-border-tertiary)",
      borderRadius:"var(--border-radius-lg)",
      padding:"10px 12px",
    }}>
      <canvas ref={ref} style={{ width:"100%", height:120, display:"block", borderRadius:8 }} />
    </div>
  );
}
// ─── ANALOG CLOCK ──────────────────────────────────────────────────────────────
function AnalogClock({ hour, minute, second, size = 120, showSeconds = true }) {
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 2;

  // Кути в радіанах (12 годин = -π/2, рух за годинниковою)
  const hAng = ((hour % 12) + minute / 60) * (Math.PI / 6) - Math.PI / 2;
  const mAng = (minute + second / 60) * (Math.PI / 30) - Math.PI / 2;
  const sAng = second * (Math.PI / 30) - Math.PI / 2;

  // Apple-style пропорції стрілок:
  //   годинна — коротка (53%), товста
  //   хвилинна — довга (78%), середньої товщини
  //   секундна — найдовша (85%), тонка
  const hLen = r * 0.53;
  const mLen = r * 0.78;
  const sLen = r * 0.85;

  // Хвостики (коротка частина за центром) — лише декоративні, ~12% довжини
  const tail = r * 0.10;
  const hTailX = cx - Math.cos(hAng) * tail, hTailY = cy - Math.sin(hAng) * tail;
  const mTailX = cx - Math.cos(mAng) * tail, mTailY = cy - Math.sin(mAng) * tail;

  const hx = cx + Math.cos(hAng) * hLen, hy = cy + Math.sin(hAng) * hLen;
  const mx = cx + Math.cos(mAng) * mLen, my = cy + Math.sin(mAng) * mLen;
  const sx = cx + Math.cos(sAng) * sLen, sy = cy + Math.sin(sAng) * sLen;
  const sTailX = cx - Math.cos(sAng) * (r * 0.18);
  const sTailY = cy - Math.sin(sAng) * (r * 0.18);

  // Товщина адаптивна до розміру (для невеликих годинників не виглядає громіздко)
  const hW = Math.max(2.5, size * 0.038);
  const mW = Math.max(1.8, size * 0.024);
  const sW = Math.max(1, size * 0.012);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display:"block" }}>
      {/* Циферблат — білий чітко (не темна тема) */}
      <circle cx={cx} cy={cy} r={r} fill="#ffffff" stroke="#d1d5db" strokeWidth="1" />

      {/* Всі 12 поділок — однакові тонкі штришки, як в Apple Watch */}
      {[...Array(12)].map((_,i) => {
        const a = i * Math.PI / 6 - Math.PI / 2;
        const isHour = i % 3 === 0; // 12, 3, 6, 9 — трохи товстіші
        const inner = r - (isHour ? size * 0.085 : size * 0.055);
        const outer = r - size * 0.025;
        const x1 = cx + Math.cos(a) * inner, y1 = cy + Math.sin(a) * inner;
        const x2 = cx + Math.cos(a) * outer, y2 = cy + Math.sin(a) * outer;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="#1f2937"
          strokeWidth={isHour ? Math.max(1.4, size * 0.018) : Math.max(0.8, size * 0.010)}
          strokeLinecap="round" />;
      })}

      {/* Годинна стрілка (з хвостиком) */}
      <line x1={hTailX} y1={hTailY} x2={hx} y2={hy}
        stroke="#1f2937" strokeWidth={hW} strokeLinecap="round" />

      {/* Хвилинна стрілка (з хвостиком) */}
      <line x1={mTailX} y1={mTailY} x2={mx} y2={my}
        stroke="#1f2937" strokeWidth={mW} strokeLinecap="round" />

      {/* Секундна стрілка — тонка червона з хвостиком */}
      {showSeconds && (
        <line x1={sTailX} y1={sTailY} x2={sx} y2={sy}
          stroke="#dc2626" strokeWidth={sW} strokeLinecap="round" />
      )}

      {/* Центральна крапка */}
      <circle cx={cx} cy={cy} r={Math.max(2, size * 0.022)} fill="#1f2937" />
      {showSeconds && <circle cx={cx} cy={cy} r={Math.max(0.8, size * 0.010)} fill="#dc2626" />}
    </svg>
  );
}

// Компактний інформаційний блок «Час»
function ClockBlock({ startHour, simT, isRealtime }) {
  const clk = fmtClock(startHour * 60, simT); // startHour у годинах → переводимо в хвилини
  return (
    <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)",
      borderRadius:"var(--border-radius-lg)", padding:"12px 14px",
      display:"flex", alignItems:"center", gap:14 }}>
      <AnalogClock hour={clk.h} minute={clk.m} second={clk.s} size={84} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:10, color:"var(--color-text-secondary)", letterSpacing:"0.06em", fontWeight:500, marginBottom:3 }}>
          ПОТОЧНИЙ ЧАС
        </div>
        <div style={{ fontSize:22, fontWeight:600, fontVariantNumeric:"tabular-nums", lineHeight:1.1, color:"var(--color-text-primary)" }}>
          {clk.str}
        </div>
        <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:6 }}>
          Минуло: <span style={{ fontWeight:500, color:"var(--color-text-primary)" }}>{fmt(simT)}</span>
        </div>
        {isRealtime && (
          <div style={{ marginTop:5, display:"inline-flex", alignItems:"center", gap:4,
            padding:"2px 7px", borderRadius:4, background:"#eff6ff", border:"0.5px solid #bfdbfe" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#2563eb",
              animation:"pulse 1.5s ease-in-out infinite" }} />
            <span style={{ fontSize:10, color:"#1d4ed8", fontWeight:500 }}>Натуральний темп</span>
          </div>
        )}
      </div>
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  );
}

// ─── STABILITY GAUGE ───────────────────────────────────────────────────────────
// Великий горизонтальний індикатор T_auto з кольоровими зонами — головний
// візуальний показник функціональної стійкості системи.
function StabilityGauge({ marginMin, zone }) {
  const SCALE_MAX = 100;
  const v = Math.max(0, Math.min(SCALE_MAX, marginMin));
  const pct = (v / SCALE_MAX) * 100;

  const critEnd    = (3  / SCALE_MAX) * 100;
  const warnEnd    = (8  / SCALE_MAX) * 100;
  const stableEnd  = (60 / SCALE_MAX) * 100;

  const z = ZONES[zone];

  const displayVal = marginMin >= 100 ? "100+" : marginMin.toFixed(1);

  // Текстова інтерпретація стану
  let interp;
  if (zone === "stable")   interp = "Система стабільна — навантаження безпечне";
  else if (zone === "warning") interp = "Запас стійкості зменшується — стежте за зарядом";
  else if (zone === "critical") interp = "Критичний рівень — відключіть зайві пристрої";
  else interp = "Система зупинена";

  return (
    <div style={{ background:"var(--color-background-primary)", border:`1px solid ${z.border}`,
      borderRadius:"var(--border-radius-lg)", padding:"12px 14px", transition:"border-color 0.4s" }}>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", letterSpacing:"0.06em" }}>
            ЗАПАС СТАБІЛЬНОСТІ
          </div>
          <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginTop:2 }}>
            Запас стабільної роботи при поточному навантаженні
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
          <span style={{ fontSize:32, fontWeight:700, color:z.col, fontVariantNumeric:"tabular-nums", lineHeight:1 }}>
            {displayVal}
          </span>
          <span style={{ fontSize:13, color:"var(--color-text-secondary)" }}>хв</span>
        </div>
      </div>

      {/* Горизонтальна шкала з кольоровими зонами */}
      <div style={{ position:"relative", height:22, borderRadius:11,
        background:"#f3f4f6", border:"0.5px solid #e5e7eb", overflow:"hidden", marginTop:6 }}>
        {/* Зона критично (червона, 0-3 хв) */}
        <div style={{ position:"absolute", left:0, top:0, height:"100%",
          width:`${critEnd}%`, background:"#fee2e2" }} />
        {/* Зона попередження (жовта, 3-8 хв) */}
        <div style={{ position:"absolute", left:`${critEnd}%`, top:0, height:"100%",
          width:`${warnEnd - critEnd}%`, background:"#fef3c7" }} />
        {/* Зона стабільно (зелена, 8-60 хв) */}
        <div style={{ position:"absolute", left:`${warnEnd}%`, top:0, height:"100%",
          width:`${stableEnd - warnEnd}%`, background:"#dcfce7" }} />
        {/* Зона відмінно (синювата, 60-120 хв) */}
        <div style={{ position:"absolute", left:`${stableEnd}%`, top:0, height:"100%",
          width:`${100 - stableEnd}%`, background:"#dbeafe" }} />

        {/* Вертикальні розділювачі зон */}
        <div style={{ position:"absolute", left:`${critEnd}%`, top:0, height:"100%",
          width:1, background:"#dc2626", opacity:0.6 }} />
        <div style={{ position:"absolute", left:`${warnEnd}%`, top:0, height:"100%",
          width:1, background:"#b45309", opacity:0.6 }} />

        {/* Маркер поточного значення */}
        <div style={{
          position:"absolute", top:-3, height:28,
          left:`calc(${pct}% - 2px)`, width:4,
          background:z.col, borderRadius:2,
          boxShadow:"0 0 0 1.5px #fff, 0 1px 4px rgba(0,0,0,0.25)",
          transition:"left 0.5s ease, background 0.4s",
        }} />
      </div>

      {/* Підписи зон під шкалою */}
      <div style={{ position:"relative", height:14, marginTop:3 }}>
        <span style={{ position:"absolute", left:0, fontSize:9, color:"#dc2626", fontWeight:500 }}>0</span>
        <span style={{ position:"absolute", left:`${critEnd}%`, transform:"translateX(-50%)",
          fontSize:9, color:"#dc2626", fontWeight:500 }}>3 хв</span>
        <span style={{ position:"absolute", left:`${warnEnd}%`, transform:"translateX(-50%)",
          fontSize:9, color:"#b45309", fontWeight:500 }}>8 хв</span>
        <span style={{ position:"absolute", right:0, fontSize:9, color:"#16a34a", fontWeight:500 }}>≥60 хв</span>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:1, fontSize:9, color:"var(--color-text-secondary)" }}>
        <span style={{ width:`${critEnd}%`, textAlign:"center" }}>критично</span>
        <span style={{ width:`${warnEnd - critEnd}%`, textAlign:"center" }}>ризик</span>
        <span style={{ width:`${stableEnd - warnEnd}%`, textAlign:"center" }}>попередження → стабільно</span>
        <span style={{ width:`${100 - stableEnd}%`, textAlign:"center", color:"#2563eb" }}>відмінно</span>
      </div>

      {/* Текстова інтерпретація */}
      <div style={{ marginTop:8, padding:"6px 10px", borderRadius:6,
        background:z.bg, border:`0.5px solid ${z.border}`,
        fontSize:11, color:z.col, fontWeight:500 }}>
        {interp}
      </div>
    </div>
  );
}

// ─── DEVICE CARD ───────────────────────────────────────────────────────────────
const ICONS = {
  fan: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="2.5"/><path d="M12 9.5C13 7 15 4 18 4s2 5-6 5.5"/><path d="M14.5 12C17 11 20 9 20 6s-5-2-5.5 6"/><path d="M12 14.5C11 17 9 20 6 20s-2-5 6-5.5"/><path d="M9.5 12C7 13 4 15 4 18s5 2 5.5-6"/></svg>,
  kettle: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 8h12l-1.5 9H7.5L6 8z"/><path d="M18 10h2a1.5 1.5 0 010 3h-2"/><path d="M9 8V6.5a1.5 1.5 0 013 0V8"/></svg>,
  hob: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="2"/><circle cx="15.5" cy="10" r="2"/><circle cx="8.5" cy="16" r="1.5"/><circle cx="15.5" cy="16" r="1.5"/></svg>,
  drill: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="9" width="10" height="6" rx="1.5"/><path d="M12 11h3l3-3h2v8h-2l-3-3h-3"/><path d="M5 9V7m0 10v-2"/></svg>,
};

function Toggle({ on, onToggle }) {
  return (
    <div onClick={onToggle} style={{ width:40, height:22, borderRadius:11, background: on ? "#16a34a" : "var(--color-border-secondary)", position:"relative", cursor:"pointer", transition:"background 0.25s", flexShrink:0 }}>
      <div style={{ position:"absolute", top:3, left: on ? 21 : 3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.25)" }} />
    </div>
  );
}

function DevCard({ devKey, dev, zone, onToggle, onFanMode }) {
  const cfg = DEVICES[devKey];
  const isOn = dev.on;
  const z = ZONES[zone];

  let stCol = "var(--color-text-secondary)";
  let bCol  = "var(--color-border-tertiary)";
  let stTxt = "Вимкнено";

  if (isOn) {
    stCol = z.col; bCol = z.border;
    if (zone === "stable")   stTxt = "Активно";
    if (zone === "warning")  stTxt = "Попередження";
    if (zone === "critical") stTxt = "Ризик відкл.";
    if (cfg.cycleOn !== null) {
      const period = cfg.cycleOn + cfg.cycleOff;
      const phase  = dev.cycleT % period;
      stTxt = phase < cfg.cycleOn ? "Нагрів" : "Пауза";
    }
  }

  return (
    <div style={{ background:"var(--color-background-primary)", border:`1px solid ${bCol}`, borderRadius:"var(--border-radius-lg)", padding:"10px 12px", transition:"border-color 0.3s" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: devKey==="fan" ? 8 : 0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ color: isOn ? stCol : "var(--color-text-secondary)", transition:"color 0.3s" }}>{ICONS[cfg.icon]}</span>
          <div>
            <div style={{ fontSize:13, fontWeight:500 }}>{cfg.name}</div>
            <div style={{ fontSize:11, color:stCol, transition:"color 0.3s" }}>{stTxt}</div>
          </div>
        </div>
        {devKey !== "fan" && <Toggle on={isOn} onToggle={() => onToggle(devKey, !isOn)} />}
      </div>

      {devKey === "fan" && (
        <div style={{ display:"flex", gap:3 }}>
          {FAN_MODES.map(m => {
            const active = dev.fanMode === m.id;
            return (
              <button key={m.id} onClick={() => onFanMode(m.id)} style={{
                flex:1, padding:"4px 0", fontSize:10, fontWeight: active ? 500 : 400,
                borderRadius:6, cursor:"pointer",
                border:`1px solid ${active ? stCol : "var(--color-border-tertiary)"}`,
                background: active ? (isOn && m.id > 0 ? stCol : "var(--color-background-secondary)") : "transparent",
                color: active && isOn && m.id > 0 ? "#fff" : active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                transition:"all 0.2s",
              }}>{m.label}</button>
            );
          })}
        </div>
      )}

      {cfg.cycleOn !== null && isOn && (() => {
        const isKettle = devKey === "kettle";
        const period = isKettle ? cfg.cycleOn : (cfg.cycleOn + cfg.cycleOff);
        const phase  = dev.cycleT % period;
        // Чайник: 0..100% протягом cycleOn → потім вимикається
        // Конфорка: 0..heatPct (нагрів) → heatPct..100% (пауза) → знову 0
        const pct = (phase / period) * 100;

        // Залишок часу: для чайника — до закипання; для конфорки — до кінця поточної фази
        let rem, phaseLabel;
        if (isKettle) {
          rem = Math.round(cfg.cycleOn - phase);
          phaseLabel = "Нагрів до закипання";
        } else {
          const inHeat = phase < cfg.cycleOn;
          rem = inHeat ? Math.round(cfg.cycleOn - phase) : Math.round(cfg.cycleOff - (phase - cfg.cycleOn));
          phaseLabel = inHeat ? "Нагрів" : "Пауза";
        }

        // Колір лінії: під час нагріву — статусний (помаранчевий під час роботи), пауза — сіруватий
        const inHeat = isKettle ? true : (phase < cfg.cycleOn);
        const fillCol = inHeat ? stCol : "var(--color-text-secondary)";

        return (
          <div style={{ marginTop:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
              <span style={{ fontSize:10, fontWeight:500, color: fillCol }}>
                {phaseLabel}
              </span>
              <span style={{ fontSize:10, color:"var(--color-text-secondary)" }}>
                залишилось <strong style={{ color:"var(--color-text-primary)" }}>{rem}с</strong>
              </span>
            </div>
            <div style={{ position:"relative", height:8, borderRadius:4, background:"var(--color-border-tertiary)", overflow:"hidden" }}>
              <div style={{
                position:"absolute", left:0, top:0, height:"100%",
                background: fillCol, borderRadius:4,
                width:`${pct}%`,
                transition:"width 0.6s linear, background 0.3s",
              }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
              <span style={{ fontSize:9, color:"var(--color-text-secondary)" }}>0%</span>
              <span style={{ fontSize:9, fontWeight:500, color:"var(--color-text-primary)" }}>{Math.round(pct)}%</span>
              <span style={{ fontSize:9, color:"var(--color-text-secondary)" }}>
                {isKettle ? `${Math.round(cfg.cycleOn / 60)} хв` : `повний цикл ${Math.round(period / 60)} хв`}
              </span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── BATTERY STATUS PANEL ──────────────────────────────────────────────────────
function BatPanel({ sim, onAddBattery }) {
  const bc = BAT_CONFIGS[sim.batConfigId] ?? BAT_CONFIGS.parallel;
  const bat = BAT_LIBRARY[sim.batTypeId ?? BAT_DEFAULT_ID];
  const batQ = sim.batQueue ?? [sim.charge ?? 1];
  const colorFor = (pct) => pct < 15 ? "#dc2626" : pct < 35 ? "#b45309" : "#16a34a";

  const totalCap = bat.cap * batQ.length;
  const totalLabel = `${batQ.length}× ${bat.label} · ${totalCap} Аг`;

  return (
    <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)",
      borderRadius:"var(--border-radius-lg)", padding:"10px 12px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <span style={{ fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>
          {bc.label}
        </span>
        <span style={{ fontSize:10, color:"var(--color-text-secondary)" }}>{totalLabel}</span>
      </div>

      {batQ.map((ch, i) => {
        const pct = Math.round(ch * 100);
        const isActive = bc.parallel ? true : (i === (sim.activeBatIdx ?? 0));
        const isDead = ch <= 0.05;
        let note = "";
        if (bc.parallel) note = "паралель";
        else if (isDead) note = "розряджена";
        else if (isActive) note = i === 0 ? "активна" : "активна · АВР";
        else note = "очікує · АВР";

        return (
          <div key={i} style={{ marginBottom: i < batQ.length - 1 ? 6 : 0 }}>
            <BatRow
              label={`Батарея №${i + 1}`}
              pct={pct}
              active={isActive}
              color={colorFor(pct)}
              note={note}
            />
          </div>
        );
      })}

      {sim.zone !== "shutdown" && (
        <button
          onClick={onAddBattery}
          style={{
            marginTop:10, width:"100%", padding:"6px", fontSize:11, fontWeight:500,
            borderRadius:8, border:"1px dashed #2563eb", background:"#eff6ff",
            color:"#2563eb", cursor:"pointer", transition:"opacity 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.opacity="0.75"}
          onMouseLeave={e => e.currentTarget.style.opacity="1"}
        >
          + Додати батарею ({BAT_LIBRARY[sim.batTypeId ?? BAT_DEFAULT_ID].label})
        </button>
      )}
    </div>
  );
}

function BatRow({ label, pct, active, color, note }) {
  return (
    <div style={{ opacity: active ? 1 : 0.45, transition:"opacity 0.3s" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
        <span style={{ fontSize:11, fontWeight:500, display:"flex", alignItems:"center", gap:6 }}>
          {active && <span style={{ width:6, height:6, borderRadius:"50%", background:color, display:"inline-block" }} />}
          {label}
          {note && <span style={{ fontSize:9, color:"var(--color-text-secondary)", fontWeight:400 }}>· {note}</span>}
        </span>
        <span style={{ fontSize:11, fontWeight:600, color }}>{pct}%</span>
      </div>
      <div style={{ height:6, background:"var(--color-border-tertiary)", borderRadius:3, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:3, transition:"width 0.3s" }} />
      </div>
    </div>
  );
}

// ─── ADVISOR ───────────────────────────────────────────────────────────────────
// Кожен топік: title, sections[] = { heading?, body, formula? }
const ADVISOR_TOPICS = [
  {
    t: "Синусоїда виходу",
    sections: [
      {
        body: "Графік показує форму напруги, яку інвертор подає на підключені пристрої. Ідеальна синусоїда — це рівна хвиля 230 В, 50 Гц. Реальний вихід відрізняється від ідеалу через характер навантаження: чайник або конфорка майже не спотворюють форму, тоді як дриль або вентилятор вносять помітні відхилення.",
      },
      {
        heading: "Що таке THD",
        body: "THD (Total Harmonic Distortion) — коефіцієнт гармонічних спотворень. Він показує, наскільки реальна форма напруги відрізняється від ідеальної синусоїди. Чим вище THD, тим більше ризик перегріву або некоректної роботи чутливої електроніки.",
        formula: "THD = √(U₂² + U₃² + … + Uₙ²) / U₁ × 100%",
      },
      {
        heading: "Норми",
        body: "До 5% — норма за стандартом IEC 61000-2-2. Від 5% до 8% — знижена якість живлення. Понад 8% — критичне спотворення, чутливі прилади можуть працювати некоректно.",
      },
    ],
  },
  {
    t: "Заряд акумулятора",
    sections: [
      {
        body: "Графік відображає, як заряд акумулятора (у відсотках) спадає з часом під навантаженням. При паралельному підключенні видно дві лінії, що спадають одночасно — струм ділиться між батареями. При резервному (АВР) режимі лінія активної батареї спадає, а резервна стоїть на місці до моменту перемикання — на графіку видно характерний «сходинковий» перехід.",
      },
      {
        heading: "Як рахується заряд",
        body: "Розряд враховує закон Пейкерта: при великому струмі батарея віддає менше енергії, ніж при малому. Коефіцієнт Пейкерта для AGM-акумуляторів становить близько 1.08.",
        formula: "ΔQ = I · Δt / (C · k_P · 3600)",
      },
      {
        body: "де I — струм розряду (А), C — ємність батареї (Аг), k_P — коефіцієнт Пейкерта, Δt — крок часу (с).",
      },
      {
        heading: "Пороги",
        body: "35% — попередження (жовта лінія на графіку). 20% — критичний рівень (червона лінія). Нижче 5% — система автоматично вимикається.",
      },
    ],
  },
  {
    t: "Напруга акумулятора",
    sections: [
      {
        body: "Напруга AGM-акумулятора монотонно спадає в міру розряду — це нормальна електрохімічна властивість, а не збій. Крива побудована на основі реальних даних виробників (Varta, Exide, OPTIMA).",
        formula: "U(Q) = U_min + (U_max − U_min) · (0.78·Q + 0.22·Q²)",
      },
      {
        body: "де Q — рівень заряду від 0 до 1, U_min = 10.8 В (поріг відключення), U_max = 12.85 В (повний заряд).",
      },
      {
        heading: "Орієнтовні значення",
        body: "12.85 В — повністю заряджений. 12.0 В — приблизно 50% заряду. 11.3 В — близько 20%. 10.8 В — мінімум, нижче якого відбувається необоротна сульфатація пластин. Коли напруга опускається нижче 11.5 В, інвертор починає гірше утримувати форму синусоїди — THD зростає, амплітуда просідає.",
      },
    ],
  },
  {
    t: "Запас стабільності",
    sections: [
      {
        body: "Ключовий показник роботи системи — скільки хвилин система зможе продовжувати роботу при поточному навантаженні, якщо нічого не змінювати. Розраховується на основі залишку енергії в батареях та поточного споживання.",
        formula: "T = ( W_залишок · η ) / P_середнє × 60",
      },
      {
        body: "де W_залишок — залишкова ємність батарей (Вт·год), η — ККД інвертора (0.86–0.92), P_середнє — згладжена потужність навантаження (Вт), T — час у хвилинах.",
      },
      {
        heading: "Згладження навантаження",
        body: "Щоб короткочасні піки (наприклад, пусковий струм дриля) не спотворювали показник, потужність згладжується через експоненційне ковзне середнє (EMA) з постійною часу τ = 30 с.",
        formula: "P_avg(t) = P_avg(t−1) + α · ( P(t) − P_avg(t−1) ),   α = Δt / τ",
      },
      {
        heading: "Зони",
        body: "Понад 60 хв — стабільно (зелена зона). Від 8 до 60 хв — попередження, варто зменшити навантаження. Менше 8 хв — критично, система готується до автоматичного відключення пристроїв. Позначка 100+ означає, що при поточному навантаженні батарей вистачить більш ніж на 1 год 40 хв.",
      },
    ],
  },
  {
    t: "Резервування акумуляторів",
    sections: [
      {
        heading: "Паралельне підключення",
        body: "Всі батареї працюють одночасно. Загальна ємність системи дорівнює сумі ємностей всіх батарей. Струм розряду ділиться порівну, тому кожна батарея розряджається повільніше. Це також зменшує просад напруги під навантаженням та THD.",
        formula: "C_заг = C₁ + C₂ + … + Cₙ,   I_батарея = I_заг / n",
      },
      {
        heading: "Резервне підключення (АВР)",
        body: "Батареї підключаються по черзі. Активна батарея розряджається до 4%, після чого автоматичний перемикач (ATS) вмикає наступну. Це дозволяє максимально використати енергію кожної батареї та подовжити загальний час роботи системи. Перемикання відбувається за мілісекунди — підключені пристрої цього не помічають.",
      },
      {
        heading: "Додавання батарей під час роботи",
        body: "Кнопка «+ Додати батарею» підключає нову повністю заряджену батарею до системи без зупинки симуляції. У паралельному режимі вона одразу починає розряджатись разом з іншими. У резервному — стає в чергу і чекає.",
      },
    ],
  },
  {
    t: "Типи навантаження",
    sections: [
      {
        heading: "Резистивне — чайник (1500 Вт), конфорка (1000 Вт)",
        body: "Найпростіший тип навантаження. Струм і напруга синфазні, спотворення мінімальні. Чайник і конфорка вмикаються циклічно через термостат: нагрів 5 хв, пауза 2 хв. Чайник вимикається автоматично після закипання.",
        formula: "THD_резист ≈ 0.8% · (P / 1500)",
      },
      {
        heading: "Індуктивне — вентилятор (0–80 Вт)",
        body: "Асинхронний мотор споживає реактивний струм, який зміщений за фазою відносно напруги. При запуску виникає пусковий струм у 3–6 разів вище робочого тривалістю 0.5–0.9 с — це видно на графіку THD як короткий стрибок.",
        formula: "THD_індукт ≈ 4.5% · (P / 80)",
      },
      {
        heading: "Нелінійне — дриль (550 Вт)",
        body: "Щітковий двигун із регулятором обертів — найбільший джерело спотворень у системі. Регулятор «нарізає» синусоїду, створюючи вищі гармоніки. Навантаження на дриль додатково модулюється, що дає змінне споживання.",
        formula: "THD_нелін ≈ 18% · (P / 550)",
      },
    ],
  },
  {
    t: "Як працює програма",
    sections: [
      {
        heading: "Симуляція",
        body: "Кожні 50 мс реального часу програма виконує один крок розрахунку. На кожному кроці визначається поточне споживання всіх увімкнених пристроїв, розраховується розряд батарей, оновлюється напруга, THD, просад синусоїди та запас стабільності. Швидкість симуляції можна збільшити до 600× для перегляду тривалих сценаріїв.",
      },
      {
        heading: "Автоматичне відключення пристроїв",
        body: "Якщо система перебуває у критичній зоні (запас менше 8 хв) понад 20 секунд, програма починає почергово вимикати пристрої у порядку від найменш важливого: спочатку дриль, потім конфорка, потім вентилятор. Між відключеннями витримується пауза 20 с. Чайник не відключається автоматично — він сам вимикається після закипання.",
      },
      {
        heading: "Зони стабільності",
        body: "Зелена — система працює в штатному режимі, запасу енергії достатньо. Жовта — заряд або час автономії зменшуються, рекомендується вимкнути зайві пристрої. Червона — критичний стан, програма починає автоматичне відключення. Сіра — всі батареї розряджені, система заблокована.",
      },
      {
        heading: "ККД інвертора",
        body: "ККД залежить від рівня завантаження. При малому навантаженні (менше 12% від максимуму) ККД нижчий через відносно великі власні втрати. При номінальному навантаженні досягає 92%. При перевантаженні ККД знижується, а THD і просад синусоїди зростають.",
        formula: "η = 0.92,   при P < 12%: η = 0.86 + 0.35 · (P/P_max),   при P > 85%: η = 0.92 − 0.08 · (P/P_max − 0.85)",
      },
    ],
  },
];

function AdvisorScreen({ onClose }) {
  const [open, setOpen] = useState(null);

  return (
    <div style={{ maxWidth:640, margin:"0 auto", padding:"1.5rem 1rem", boxSizing:"border-box" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
        <div>
          <div style={{ fontSize:18, fontWeight:600, color:"var(--color-text-primary)", marginBottom:2 }}>Радник</div>
          <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>Пояснення показників та графіків симулятора</div>
        </div>
        <button onClick={onClose} style={{ padding:"6px 16px", fontSize:13, fontWeight:500, borderRadius:"var(--border-radius-md)", border:"0.5px solid var(--color-border-secondary)", background:"transparent", cursor:"pointer", color:"var(--color-text-secondary)" }}>
          ← Назад
        </button>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {ADVISOR_TOPICS.map((tp, ti) => {
          const isOpen = open === ti;
          return (
            <div key={ti} style={{ background:"var(--color-background-primary)", border:`0.5px solid ${isOpen ? "#93c5fd" : "var(--color-border-tertiary)"}`, borderRadius:"var(--border-radius-lg)", overflow:"hidden", transition:"border-color 0.2s" }}>
              {/* Header */}
              <button
                onClick={() => setOpen(isOpen ? null : ti)}
                style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 15px", background:"transparent", border:"none", cursor:"pointer", textAlign:"left" }}
              >
                <span style={{ fontSize:14, fontWeight:600, color:"var(--color-text-primary)" }}>{tp.t}</span>
                <span style={{ fontSize:18, color:"var(--color-text-secondary)", lineHeight:1, transform: isOpen ? "rotate(45deg)" : "none", transition:"transform 0.2s" }}>+</span>
              </button>

              {/* Body */}
              {isOpen && (
                <div style={{ padding:"0 15px 15px", display:"flex", flexDirection:"column", gap:14 }}>
                  <div style={{ height:1, background:"var(--color-border-tertiary)", marginBottom:2 }} />
                  {tp.sections.map((sec, si) => (
                    <div key={si}>
                      {sec.heading && (
                        <div style={{ fontSize:12, fontWeight:700, color:"#1d4ed8", letterSpacing:"0.04em", textTransform:"uppercase", marginBottom:5 }}>
                          {sec.heading}
                        </div>
                      )}
                      <p style={{ margin:0, fontSize:13, color:"var(--color-text-secondary)", lineHeight:1.75 }}>{sec.body}</p>
                      {sec.formula && (
                        <div style={{ marginTop:8, padding:"8px 12px", borderRadius:8, background:"#f0f9ff", border:"1px solid #bae6fd", fontFamily:"'Courier New', monospace", fontSize:12.5, color:"#0c4a6e", letterSpacing:"0.02em" }}>
                          {sec.formula}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SETUP SCREEN ──────────────────────────────────────────────────────────────
function Setup({ onStart }) {
  const [charge, setCharge] = useState(90);
  const [batConfigId, setBatConfigId] = useState("parallel");
  const [batTypeId, setBatTypeId] = useState("varta_b8");
  const [batCount, setBatCount] = useState(2);
  const [startHour, setStartHour] = useState(12);
  const [startMin, setStartMin]   = useState(0);
  const [showAdvisor, setShowAdvisor] = useState(false);

  if (showAdvisor) return <AdvisorScreen onClose={() => setShowAdvisor(false)} />;

  const inv = INVERTERS.inv3500;
  const chargeColor = charge >= 70 ? "#16a34a" : charge >= 35 ? "#b45309" : "#dc2626";
  const startHourFloat = startHour + startMin / 60;
  const selBat = BAT_LIBRARY[batTypeId];
  const totalCap = selBat.cap * batCount;

  return (
    <div style={{ minHeight:"100vh", background:"var(--color-background-secondary)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem", boxSizing:"border-box" }}>
      <div style={{ width:"100%", maxWidth:520 }}>

        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:"1.5rem" }}>
          <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:52, height:52, borderRadius:16, background:"#eff6ff", border:"1px solid #bfdbfe", marginBottom:14 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <h1 style={{ fontSize:22, fontWeight:600, margin:"0 0 6px", color:"var(--color-text-primary)" }}>
            Симулятор інвертора
          </h1>
          <p style={{ fontSize:13, color:"var(--color-text-secondary)", margin:0, lineHeight:1.5 }}>
            Програмне забезпечення для функціональної стійкості<br/>інвертора з чистою синусоїдою
          </p>
        </div>

        {/* Card */}
        <div style={{ background:"var(--color-background-primary)", borderRadius:20, border:"0.5px solid var(--color-border-tertiary)", overflow:"hidden", boxShadow:"0 4px 24px rgba(0,0,0,0.06)" }}>

          {/* Inverter info — fixed (тільки одна модель) */}
          <div style={{ background:"linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)", padding:"16px 22px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.6)", fontWeight:500, letterSpacing:"0.08em", marginBottom:5 }}>ІНВЕРТОР</div>
              <div style={{ fontSize:18, fontWeight:600, color:"#fff" }}>{inv.label}</div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.65)", marginTop:2 }}>{inv.desc}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", marginBottom:4 }}>Базовий THD</div>
              <div style={{ fontSize:20, fontWeight:600, color:"#fff" }}>{(inv.thd_base*100).toFixed(1)}%</div>
            </div>
          </div>

          <div style={{ padding:"18px 22px", display:"flex", flexDirection:"column", gap:18 }}>

            {/* Battery type */}
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", letterSpacing:"0.07em", marginBottom:10 }}>ТИП АКУМУЛЯТОРА</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {Object.values(BAT_LIBRARY).map(b => {
                  const active = batTypeId === b.id;
                  const typeColor = b.type === "LiFePO4" ? "#7c3aed" : b.type === "GEL" ? "#0891b2" : "#2563eb";
                  return (
                    <button key={b.id} onClick={() => setBatTypeId(b.id)} style={{
                      display:"flex", alignItems:"center", justifyContent:"space-between",
                      padding:"9px 13px", borderRadius:10, cursor:"pointer",
                      border:`1.5px solid ${active ? typeColor : "var(--color-border-tertiary)"}`,
                      background: active ? (b.type === "LiFePO4" ? "#f5f3ff" : b.type === "GEL" ? "#ecfeff" : "#eff6ff") : "transparent",
                      transition:"all 0.18s",
                    }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background: active ? typeColor : "var(--color-border-secondary)" }} />
                        <div style={{ textAlign:"left" }}>
                          <div style={{ fontSize:13, fontWeight:500, color: active ? typeColor : "var(--color-text-primary)" }}>{b.label}</div>
                          <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginTop:1 }}>{b.desc}</div>
                        </div>
                      </div>
                      <div style={{ fontSize:11, color:"var(--color-text-secondary)", fontWeight:500 }}>{b.cap} Аг</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Battery connection mode */}
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", letterSpacing:"0.07em", marginBottom:10 }}>КОНФІГУРАЦІЯ ЖИВЛЕННЯ</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {Object.values(BAT_CONFIGS).map(bc => {
                  const active = batConfigId === bc.id;
                  return (
                    <button key={bc.id} onClick={() => setBatConfigId(bc.id)} style={{
                      display:"block", width:"100%", textAlign:"left",
                      padding:"11px 13px", borderRadius:12, cursor:"pointer",
                      border:`1.5px solid ${active ? "#2563eb" : "var(--color-border-tertiary)"}`,
                      background: active ? "#eff6ff" : "transparent",
                      transition:"all 0.18s",
                    }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background: active ? "#2563eb" : "var(--color-border-secondary)" }} />
                        <div>
                          <div style={{ fontSize:13, fontWeight:500, color: active ? "#1d4ed8" : "var(--color-text-primary)" }}>{bc.label}</div>
                          <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:1 }}>{bc.desc}</div>
                        </div>
                      </div>
                      {active && bc.detail && (
                        <div style={{ marginTop:7, paddingLeft:18, fontSize:11, color:"var(--color-text-secondary)", lineHeight:1.5 }}>
                          {bc.detail}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Battery count */}
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", letterSpacing:"0.07em", marginBottom:10 }}>
                КІЛЬКІСТЬ АКУМУЛЯТОРІВ
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                <input type="range" min="2" max="6" step="1" value={batCount}
                  onChange={e => setBatCount(+e.target.value)}
                  style={{ flex:1, accentColor:"#2563eb" }}
                />
                <div style={{ minWidth:80, textAlign:"right" }}>
                  <span style={{ fontSize:22, fontWeight:700, color:"#2563eb" }}>{batCount}</span>
                  <span style={{ fontSize:11, color:"var(--color-text-secondary)", marginLeft:4 }}>шт</span>
                </div>
              </div>
              <div style={{ marginTop:6, fontSize:11, color:"var(--color-text-secondary)" }}>
                Загальна ємність: <span style={{ fontWeight:600, color:"var(--color-text-primary)" }}>{totalCap} Аг</span>
                <span style={{ marginLeft:8 }}>· {selBat.type}</span>
              </div>
            </div>

            {/* Start time */}
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", letterSpacing:"0.07em", marginBottom:10 }}>ЧАС ПОЧАТКУ СИМУЛЯЦІЇ</div>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <AnalogClock hour={startHour} minute={startMin} second={0} size={70} showSeconds={false} />
                <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginBottom:3 }}>Година</div>
                      <input type="range" min="0" max="23" step="1" value={startHour}
                        onChange={e => setStartHour(+e.target.value)}
                        style={{ width:"100%", accentColor:"#2563eb" }}
                      />
                    </div>
                    <span style={{ fontSize:18, fontWeight:600, fontVariantNumeric:"tabular-nums", minWidth:28, textAlign:"center" }}>
                      {String(startHour).padStart(2,"0")}
                    </span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginBottom:3 }}>Хвилина</div>
                      <input type="range" min="0" max="55" step="5" value={startMin}
                        onChange={e => setStartMin(+e.target.value)}
                        style={{ width:"100%", accentColor:"#2563eb" }}
                      />
                    </div>
                    <span style={{ fontSize:18, fontWeight:600, fontVariantNumeric:"tabular-nums", minWidth:28, textAlign:"center" }}>
                      {String(startMin).padStart(2,"0")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Charge slider */}
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", letterSpacing:"0.07em", marginBottom:12 }}>
                ПОЧАТКОВИЙ ЗАРЯД АКУМУЛЯТОРА
              </div>
              <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", marginBottom:10 }}>
                <span style={{ fontSize:22, fontWeight:700, color:chargeColor }}>{charge}<span style={{ fontSize:13, fontWeight:400, marginLeft:1 }}>%</span></span>
              </div>
              <input type="range" min="10" max="100" step="5" value={charge}
                onChange={e => setCharge(+e.target.value)}
                style={{ width:"100%", accentColor: chargeColor }}
              />
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--color-text-secondary)", marginTop:5 }}>
                <span>10% · розряджений</span>
                <span>100% · повний</span>
              </div>
            </div>

            {/* Start button */}
            <button onClick={() => onStart("inv3500", charge / 100, batConfigId, startHourFloat, batTypeId, batCount)} style={{
              padding:"14px", borderRadius:12, fontSize:15, fontWeight:600,
              border:"none", background:"linear-gradient(135deg, #2563eb, #1d4ed8)",
              color:"#fff", cursor:"pointer", letterSpacing:"0.01em",
              boxShadow:"0 2px 12px rgba(37,99,235,0.35)",
              transition:"opacity 0.15s",
            }}
              onMouseEnter={e => e.target.style.opacity="0.9"}
              onMouseLeave={e => e.target.style.opacity="1"}
            >
              Запустити симуляцію
            </button>

          </div>
        </div>

        {/* Device summary */}
        <div style={{ marginTop:14, display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {[
            { name:"Вентилятор", w:"0–80", col:"#2563eb" },
            { name:"Чайник",     w:"1500", col:"#16a34a" },
            { name:"Конфорка",   w:"1000", col:"#d97706" },
            { name:"Дриль",      w:"550",  col:"#7c3aed" },
          ].map(d => (
            <div key={d.name} style={{ background:"var(--color-background-primary)", borderRadius:10, border:"0.5px solid var(--color-border-tertiary)", padding:"10px 8px", textAlign:"center" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:d.col, margin:"0 auto 6px" }} />
              <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-primary)" }}>{d.name}</div>
              <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginTop:2 }}>{d.w} Вт</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
// Швидкості:
//   "real"  — 1:1 з реальним часом (натуральний темп)
//   1, 10, 60 — прискорений симульований час (1×=10× від реального для зручності спостереження)
const SPEED_OPTIONS = [
  { id:"real", label:"Натуральний темп", short:"1:1", dtPerTick:0.05 }, // 50мс симул./50мс реал.
  { id:1,      label:"Прискорено 10×",   short:"10×", dtPerTick:0.5 },
  { id:10,     label:"Прискорено 100×",  short:"100×", dtPerTick:5 },
  { id:60,     label:"Прискорено 600×",  short:"600×", dtPerTick:30 },
];

export default function App() {
  const [screen, setScreen] = useState("setup");
  const [sim,    setSim]    = useState(null);
  const [speedId, setSpeedId] = useState("real"); // за замовчуванням — реальний час
  const [paused, setPaused] = useState(false);
  const [invCfg, setInvCfg] = useState(null);
  const toggleQ = useRef(null);
  const simRef  = useRef(null);
  const viewportW = useViewportWidth();
  const isCompact = viewportW < 820;

  const handleStart = (invId, charge, batConfigId, startHour, batTypeId, batCount) => {
    const inv = INVERTERS[invId];
    setInvCfg(inv);
    const s = mkState(invId, charge, batConfigId, startHour, batTypeId, batCount);
    simRef.current = s;
    setSim(s);
    setPaused(false);
    setScreen("sim");
  };

  // Додати одну батарею того ж типу під час роботи симулятора
  const handleAddBattery = useCallback(() => {
    const cur = simRef.current;
    if (!cur) return;
    const newQueue = [...cur.batQueue, 1]; // нова батарея — завжди повна (100%)
    const next = { ...cur, batQueue: newQueue, batCount: newQueue.length,
      bat2Charge: newQueue.length >= 2 ? newQueue[1] : null };
    simRef.current = next;
    setSim({ ...next });
  }, []);

  useEffect(() => {
    if (screen !== "sim" || paused) return;
    const speedCfg = SPEED_OPTIONS.find(o => o.id === speedId) ?? SPEED_OPTIONS[0];
    const id = setInterval(() => {
      const pending = toggleQ.current; toggleQ.current = null;
      const next = tick(simRef.current, speedCfg.dtPerTick, invCfg, pending);
      simRef.current = next;
      setSim({ ...next });
    }, 50);
    return () => clearInterval(id);
  }, [screen, speedId, invCfg, paused]);

  if (screen === "setup") return <Setup onStart={handleStart} />;
  if (screen === "advisor") return <AdvisorScreen onClose={() => setScreen("sim")} />;
  if (!sim) return null;

  const z = ZONES[sim.zone] || ZONES.stable;
  const powerPct = invCfg ? Math.min(Math.round(sim.totalW / invCfg.max_w * 100), 100) : 0;
  const bcFor = BAT_CONFIGS[sim.batConfigId] ?? BAT_CONFIGS.parallel;
  const batQ = sim.batQueue ?? [sim.charge ?? 1];
  const activeCharge = bcFor.parallel
    ? batQ.reduce((a, b) => a + b, 0) / batQ.length
    : batQ[sim.activeBatIdx ?? 0] ?? batQ[0] ?? 0;
  const chargePct = Math.round(activeCharge * 100);
  const chargeLabel = bcFor.parallel
    ? "Заряд (середній)"
    : (sim.activeBatIdx > 0 ? `Заряд (батарея №${sim.activeBatIdx + 1})` : "Заряд (батарея №1)");
  const isRealtime = speedId === "real";

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:600 }}>

      {/* Status bar */}
      <div style={{ background:z.bg, borderBottom:`1px solid ${z.border}`, padding:"8px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:6, transition:"background 0.4s, border-color 0.4s" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 12px", borderRadius:20, border:`1px solid ${z.border}`, background:"transparent" }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:z.col }} />
            <span style={{ fontSize:13, fontWeight:500, color:z.col }}>{z.label}</span>
          </div>
          <span style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
            {invCfg?.label} · {BAT_CONFIGS[sim.batConfigId].label} · {fmt(sim.t)}
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
          <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>Темп:</span>
          {SPEED_OPTIONS.map(sp => (
            <button key={sp.id} onClick={() => setSpeedId(sp.id)}
              title={sp.label}
              style={{
                padding:"3px 9px", fontSize:11, borderRadius:6, cursor:"pointer",
                border:`0.5px solid ${speedId===sp.id ? z.col : "var(--color-border-tertiary)"}`,
                background: speedId===sp.id ? z.bg : "transparent",
                color: speedId===sp.id ? z.col : "var(--color-text-secondary)",
                fontWeight: speedId===sp.id ? 500 : 400,
                display:"flex", alignItems:"center", gap:4,
              }}>
              {sp.id === "real" && <span style={{ fontSize:9 }}>●</span>}
              {sp.short}
            </button>
          ))}
          <button onClick={() => setPaused(p => !p)} style={{
            padding:"3px 10px", fontSize:11, borderRadius:6, cursor:"pointer",
            border:`0.5px solid ${paused ? "#b45309" : "var(--color-border-tertiary)"}`,
            background: paused ? "#fffbeb" : "transparent",
            color: paused ? "#b45309" : "var(--color-text-secondary)",
            fontWeight: paused ? 600 : 400,
          }}>
            {paused ? "Продовжити" : "Зупинити"}
          </button>
          <button onClick={() => setScreen("advisor")} style={{ padding:"3px 10px", fontSize:11, borderRadius:6, border:"0.5px solid var(--color-border-tertiary)", background:"transparent", color:"var(--color-text-secondary)", cursor:"pointer" }}>
            Радник
          </button>
          <button onClick={() => { simRef.current=null; setPaused(false); setScreen("setup"); }} style={{ padding:"3px 10px", fontSize:11, borderRadius:6, border:"0.5px solid var(--color-border-tertiary)", background:"transparent", color:"var(--color-text-secondary)", cursor:"pointer" }}>
            Скинути
          </button>
        </div>
      </div>

      <div style={{
        display:"grid",
        gridTemplateColumns: isCompact ? "1fr" : "205px minmax(0,1fr)",
        flex:1,
        minHeight:0,
      }}>
        {/* Devices panel */}
        <div style={{
          borderRight: isCompact ? "none" : "0.5px solid var(--color-border-tertiary)",
          borderBottom: isCompact ? "0.5px solid var(--color-border-tertiary)" : "none",
          padding:"10px",
          display:"flex",
          flexDirection:"column",
          gap:7,
          overflowY:"auto",
        }}>
          <div style={{ fontSize:10, fontWeight:500, color:"var(--color-text-secondary)", letterSpacing:"0.07em", marginBottom:2 }}>ПРИСТРОЇ</div>
          {Object.keys(DEVICES).map(k => (
            <DevCard key={k} devKey={k} dev={sim.devices[k]} zone={sim.zone}
              onToggle={(key, val) => { toggleQ.current = { key, val }; }}
              onFanMode={mode => { toggleQ.current = { key:"fanMode", val:mode }; }}
            />
          ))}

          {sim.events.length > 0 && (
            <div style={{ marginTop:4 }}>
              <div style={{ fontSize:10, fontWeight:500, color:"var(--color-text-secondary)", letterSpacing:"0.07em", marginBottom:5 }}>ПОДІЇ</div>
              {[...sim.events].reverse().slice(0,6).map((ev,i) => (
                <div key={i} style={{ fontSize:10, padding:"5px 8px", borderRadius:6, marginBottom:4,
                  background: ev.sev==="crit" ? "#fef2f2" : ev.sev==="info" ? "#eff6ff" : "#fffbeb",
                  color: ev.sev==="crit" ? "#991b1b" : ev.sev==="info" ? "#1d4ed8" : "#92400e",
                  border:`0.5px solid ${ev.sev==="crit" ? "#fca5a5" : ev.sev==="info" ? "#bfdbfe" : "#fcd34d"}` }}>
                  <span style={{ opacity:0.55 }}>{fmt(ev.t)} </span>{ev.msg}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main panel */}
        <div style={{ padding:"10px 14px", display:"flex", flexDirection:"column", gap:10, overflowY:"auto" }}>

          {/* StabilityGauge — ГОЛОВНИЙ показник стійкості */}
          <StabilityGauge marginMin={sim.margin} zone={sim.zone} />

          {/* Top row: Clock + Battery panel */}
          <div style={{ display:"grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr", gap:10 }}>
            <ClockBlock startHour={sim.startHour} simT={sim.t} isRealtime={isRealtime} />
            <BatPanel sim={sim} onAddBattery={handleAddBattery} />
          </div>

          {/* Metrics row */}
          <div style={{ display:"grid", gridTemplateColumns: isCompact ? "repeat(2, minmax(0,1fr))" : "repeat(4, minmax(0,1fr))", gap:8 }}>
            {[
              { lbl:"Напруга акум.", val:sim.batVolt.toFixed(2), u:"В",  col: sim.batVolt < 11.3 ? "#dc2626" : "var(--color-text-primary)" },
              { lbl:chargeLabel,     val:chargePct,              u:"%",  col: activeCharge<0.15?"#dc2626":activeCharge<0.35?"#b45309":"var(--color-text-primary)" },
              { lbl:"Навантаження",  val:Math.round(sim.totalW), u:"Вт", col: powerPct>90?"#dc2626":"var(--color-text-primary)" },
              { lbl:"THD",           val:(sim.thd*100).toFixed(1),u:"%", col: sim.thd>0.08?"#dc2626":sim.thd>0.05?"#b45309":"#16a34a" },
            ].map(m => (
              <div key={m.lbl} style={{ background:"var(--color-background-secondary)", borderRadius:"var(--border-radius-md)", padding:"9px 11px" }}>
                <div style={{ fontSize:10, color:"var(--color-text-secondary)" }}>{m.lbl}</div>
                <div style={{ fontSize:20, fontWeight:500, color:m.col, marginTop:2 }}>
                  {m.val}<span style={{ fontSize:11, color:"var(--color-text-secondary)", marginLeft:2 }}>{m.u}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Load bar */}
          <div style={{ background:"var(--color-background-secondary)", borderRadius:"var(--border-radius-md)", padding:"9px 12px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"var(--color-text-secondary)", marginBottom:5 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span>Завантаження інвертора</span>
                {sim.overload && (
                  <span style={{ fontSize:10, fontWeight:500, padding:"2px 7px", borderRadius:4, background:"#fef2f2", color:"#dc2626", border:"0.5px solid #fca5a5" }}>
                    ПЕРЕВАНТАЖЕННЯ — погіршення синусоїди
                  </span>
                )}
              </div>
              <span style={{ fontWeight:500, color:powerPct>100?"#dc2626":powerPct>90?"#dc2626":powerPct>75?"#b45309":"#16a34a" }}>
                {Math.round(sim.totalW)} / {invCfg?.max_w} Вт
              </span>
            </div>
            <div style={{ height:7, background:"var(--color-border-tertiary)", borderRadius:4, overflow:"hidden" }}>
              <div style={{ height:"100%", borderRadius:4, width:`${Math.min(powerPct,100)}%`, transition:"width 0.3s",
                background:powerPct>100?"#dc2626":powerPct>90?"#dc2626":powerPct>75?"#b45309":"#16a34a" }} />
            </div>
          </div>

          {/* ─── СТАБІЛЬНІСТЬ ІНВЕРТОРА ─── */}
          {(() => {
            const sineQuality = Math.round(sim.sagFactor * 100);
            const thdPct = parseFloat((sim.thd * 100).toFixed(1));
            const thdOk = thdPct <= 5;
            const thdWarn = thdPct > 5 && thdPct <= 8;
            const thdCol = thdOk ? "#16a34a" : thdWarn ? "#b45309" : "#dc2626";
            const thdLabel = thdOk ? "Норма" : thdWarn ? "Знижена якість" : "Критично";
            const sineCol = sineQuality >= 95 ? "#16a34a" : sineQuality >= 88 ? "#b45309" : "#dc2626";
            const invMode = sim.overload ? "Перевантаження" : sim.thd > 0.08 ? "Знижена якість" : "Нормальний";
            const invModeCol = sim.overload || sim.thd > 0.08 ? "#dc2626" : "#16a34a";
            return (
              <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"11px 13px" }}>
                <div style={{ fontSize:10, fontWeight:600, color:"var(--color-text-secondary)", letterSpacing:"0.07em", marginBottom:10 }}>
                  СТАБІЛЬНІСТЬ ІНВЕРТОРА
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                  <div>
                    <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginBottom:3 }}>Якість синусоїди</div>
                    <div style={{ fontSize:18, fontWeight:600, color:sineCol }}>{sineQuality}<span style={{ fontSize:10, marginLeft:1, color:"var(--color-text-secondary)" }}>%</span></div>
                    <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginTop:2 }}>sagFactor · просад амплітуди</div>
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginBottom:3 }}>Гарм. спотворення</div>
                    <div style={{ fontSize:18, fontWeight:600, color:thdCol }}>{thdPct}<span style={{ fontSize:10, marginLeft:1, color:"var(--color-text-secondary)" }}>%</span></div>
                    <div style={{ fontSize:10, color:thdCol, marginTop:2 }}>{thdLabel} · IEC 61000-2-2</div>
                  </div>
                  <div>
                    <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginBottom:3 }}>Режим інвертора</div>
                    <div style={{ fontSize:13, fontWeight:600, color:invModeCol, marginTop:4 }}>{invMode}</div>
                    <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginTop:2 }}>SinePure 3500</div>
                  </div>
                </div>
                <div style={{ marginTop:10, height:4, borderRadius:2, background:"#f3f4f6", overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${thdPct / 30 * 100}%`, background: thdCol, borderRadius:2, transition:"width 0.4s" }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"var(--color-text-secondary)", marginTop:3 }}>
                  <span>0%</span><span style={{ color:"#16a34a" }}>норма 5%</span><span style={{ color:"#dc2626" }}>ризик 8%</span><span>15%</span>
                </div>
              </div>
            );
          })()}

          {/* ─── АНАЛІЗ СТАНУ ЗАБЕЗПЕЧЕННЯ ─── */}
          {(() => {
            const bc = BAT_CONFIGS[sim.batConfigId];
            const bat = BAT_LIBRARY[sim.batTypeId ?? BAT_DEFAULT_ID];
            const totalCap = bat.cap * sim.batQueue.length;
            const aliveCount = sim.batQueue.filter(ch => ch > 0.05).length;
            const totalRemWh = sim.batQueue.reduce((sum, ch) => sum + Math.max(0, ch - BAT_SAFE_FLOOR) * bat.cap * batV(ch, bat), 0);
            const estHours = sim.avgPowerW > 5 ? (totalRemWh * inverterEfficiency(sim.avgPowerW, invCfg) / sim.avgPowerW).toFixed(1) : "—";
            const supplyStatus = sim.zone === "stable" ? "Стабільне" : sim.zone === "warning" ? "Обмежене" : sim.zone === "critical" ? "Критичне" : "Відсутнє";
            const supplyCol = sim.zone === "stable" ? "#16a34a" : sim.zone === "warning" ? "#b45309" : "#dc2626";
            return (
              <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:"var(--border-radius-lg)", padding:"11px 13px" }}>
                <div style={{ fontSize:10, fontWeight:600, color:"var(--color-text-secondary)", letterSpacing:"0.07em", marginBottom:10 }}>
                  АНАЛІЗ СТАНУ ЗАБЕЗПЕЧЕННЯ
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
                  {[
                    { lbl:"Стан живлення",     val:supplyStatus, col:supplyCol, sub:"поточний статус" },
                    { lbl:"Активних батарей",   val:`${aliveCount} / ${sim.batQueue.length}`, col:"var(--color-text-primary)", sub:`${bc.label}` },
                    { lbl:"Залишок енергії",    val:`${totalRemWh.toFixed(0)} Вт·год`, col:"var(--color-text-primary)", sub:`з ${totalCap} Аг · ${bat.type}` },
                    { lbl:"Розрахунк. ресурс", val:estHours === "—" ? "—" : `${estHours} год`, col:"var(--color-text-primary)", sub:"при поточному навантаженні" },
                  ].map(item => (
                    <div key={item.lbl} style={{ background:"var(--color-background-secondary)", borderRadius:"var(--border-radius-md)", padding:"8px 10px" }}>
                      <div style={{ fontSize:10, color:"var(--color-text-secondary)" }}>{item.lbl}</div>
                      <div style={{ fontSize:15, fontWeight:600, color:item.col, marginTop:2 }}>{item.val}</div>
                      <div style={{ fontSize:9, color:"var(--color-text-secondary)", marginTop:1 }}>{item.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Sine */}
          <SineCanvas sagFactor={sim.sagFactor} thd={sim.thd} speedId={speedId} paused={paused} />

          {/* Charts: 4 окремих графіки замість поєднаного Вт/% */}
          {(() => {
            const ttip = [
              { key:"chargePct", label:"Заряд №1",   unit:"%",  col:"#16a34a" },
              ...(sim.batQueue.length >= 2 ? [{ key:"bat2Pct", label:"Заряд №2", unit:"%", col:"#0891b2" }] : []),
              { key:"batV",      label:"Напруга",    unit:"В",  col:"#2563eb" },
              { key:"marginMin", label:"Запас стаб.", unit:"хв", col:z.col     },
              { key:"powerW",    label:"Потужність", unit:"Вт", col:"#7c3aed" },
              { key:"thdPct",    label:"THD",        unit:"%",  col:"#d97706" },
            ];
            const chargeLines = [{ key:"chargePct", col:"#16a34a", name:"Батарея №1 %" }];
            if (sim.batQueue.length >= 2) {
              chargeLines.push({ key:"bat2Pct", col:"#0891b2", name:"Батарея №2 %", dashed:true });
            }
            return (
              <>
                {/* T_auto першим — головна метрика стійкості */}
                <div style={{ display:"grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr", gap:10 }}>
                  <TrendChart
                    trend={sim.trend}
                    title="Стабільність"
                    yLabel="Хвилини" xLabel="t, с"
                    lines={[{ key:"marginMin", col:z.col, name:"запас стаб." }]}
                    yMin={0} yMax={100}
                    zoneLines={[
                      { val:3,  col:"#dc2626", label:"Критично < 3 хв" },
                      { val:8,  col:"#b45309", label:"Попередження < 8 хв" },
                      { val:60, col:"#16a34a", label:"Стабільно > 60 хв" },
                      { val:100, col:"#2563eb", label:"100+ хв" },
                    ]}
                    tooltipData={ttip}
                  />
                  <TrendChart
                    trend={sim.trend}
                    title="Заряд акумулятора"
                    yLabel="Заряд, %" xLabel="t, с"
                    lines={chargeLines}
                    yMin={0} yMax={100}
                    zoneLines={[
                      { val:20, col:"#dc2626", label:"Критичний рівень 20%" },
                      { val:50, col:"#b45309", label:"Рівень попередження 50%" },
                    ]}
                    tooltipData={ttip}
                  />
                </div>
                <div style={{ display:"grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 1fr", gap:10 }}>
                  <TrendChart
                    trend={sim.trend}
                    title="Напруга акумулятора"
                    yLabel="Напруга, В" xLabel="t, с"
                    lines={[{ key:"batV", col:"#2563eb", name:"В" }]}
                    yMin={BAT_LIBRARY[sim.batTypeId ?? BAT_DEFAULT_ID].minV - 0.2} yMax={BAT_LIBRARY[sim.batTypeId ?? BAT_DEFAULT_ID].maxV + 0.1}
                    tooltipData={ttip}
                  />
                  <TrendChart
                    trend={sim.trend}
                    title="Навантаження"
                    yLabel="Потужність, Вт" xLabel="t, с"
                    lines={[{ key:"powerW", col:"#7c3aed", name:"Вт" }]}
                    yMin={0} yMax={3500}
                    tooltipData={ttip}
                  />
                </div>
                <TrendChart
                  trend={sim.trend}
                  title="Гармонічні спотворення (THD)"
                  yLabel="THD, %" xLabel="t, с"
                  lines={[{ key:"thdPct", col:"#d97706", name:"THD %" }]}
                  yMin={0} yMax={30}
                  zoneLines={[
                    { val:5,  col:"#16a34a", label:"Норма ≤ 5%" },
                    { val:8,  col:"#b45309", label:"Попередження > 8%" },
                    { val:28, col:"#dc2626", label:"Критично > 28%" },
                  ]}
                  tooltipData={ttip}
                />
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
