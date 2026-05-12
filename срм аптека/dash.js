
// ===== Допоміжні функції =====
function parseNum(v) {
  if (v === null || v === "" || v === undefined) return 0;
  const num = parseFloat(String(v).replace(/\s/g, ""));
  return isNaN(num) ? 0 : num;
}

function parsePercent(raw) {
  if (raw === null || raw === undefined || raw === "") return 0;
  let s = String(raw).trim();
  const hasPercentSign = s.includes("%");
  s = s.replace(/[\s\u00A0,]/g, "").replace("%", "");
  if (s === "") return 0;
  let v = parseFloat(s);
  if (isNaN(v)) return 0;
  if (!hasPercentSign && v > 0 && v < 0.01) v = v * 100;
  return v;
}

function parseIntClean(raw) {
  if (raw === null || raw === undefined || raw === "") return 0;
  const s = String(raw).replace(/[^\d-]/g, "");
  const v = parseInt(s, 10);
  return isNaN(v) ? 0 : v;
}

function formatNumber(num) {
  return Number(num || 0).toLocaleString("uk-UA");
}


// ===== Отримання URL історії =====
function getHistoryUrl(user) {
  if (user === "fedir") return "https://docs.google.com/spreadsheets/d/1OhWc6BKpVML_dnxDVTvLsr6GyRfM27BZ";
  if (user === "olena") return "https://docs.google.com/spreadsheets/d/1EeL08aCAa5PCwIYAtN49hQQibp5otMEm";
  if (user === "office") return "https://docs.google.com/spreadsheets/d/1ju1NDfqXREsb56FuYlVTv8kei4eL5rhW";
  if (user === "andriy") return "https://docs.google.com/spreadsheets/d/1AAAAAAAAAAAAAAAAAAAA";
  if (user === "maria") return "https://docs.google.com/spreadsheets/d/1BBBBBBBBBBBBBBBBBBBB";
  if (user === "serhiy") return "https://docs.google.com/spreadsheets/d/1CCCCCCCCCCCCCCCCCCCC";
  return null;
}

// ===== Отримання партнерів =====
async function fetchPartners(morionUrl) {
  const url = `${morionUrl}/gviz/tq?tqx=out:json&sheet=sheet1`;
  const res = await fetch(url);
  const text = await res.text();
  const json = JSON.parse(text.substr(47).slice(0, -2));

  return json.table.rows.map(r => {
    const corpRaw = r.c[0]?.v || "";
    const idMatch = corpRaw.match(/^(\d+)/);
    const id = idMatch ? parseInt(idMatch[1], 10) : 0;
    const name = corpRaw.replace(/^(\d+)\.\s*/, "");

    return {
      id,
      name,
      turnover: parseFloat(String(r.c[1]?.v || 0).replace(/\s|,/g, "")) || 0,
      msTable: parsePercent(r.c[2]?.v),
      grossRate: parsePercent(r.c[3]?.v),
      ei: parseFloat(String(r.c[4]?.v || 0).replace(/\s|,/g, "")) || 0,
      tt: r.c[5]?.v || "0"
    };
  }).filter(p => p.id && p.name && !p.name.includes("Rating"));
}

// ===== Історія по партнеру =====
async function fetchHistory(partnerId, historyUrl, partnerData) {
  const partnerName = partnerData.find(p => p.id === partnerId)?.name || `Партнер ${partnerId}`;
  const url = `${historyUrl}/gviz/tq?tqx=out:json&range='${partnerId}'!A1:Z1000`;
  const res2 = await fetch(url);
  const text2 = await res2.text();
  const json2 = JSON.parse(text2.substr(47).slice(0, -2));

  const cols = json2.table.cols.map(c => c.label);
  const rows = json2.table.rows.map(r => r.c.map(c => c?.v || ""));

  let products = [];
  let mode = "money";
  let firstProduct = null;
  let seenFirstAgain = false;

  rows.forEach(r => {
    const product = r[2];
    if (!product || product === "ТовардляПлана" || product === "Всього") return;

    if (!firstProduct) {
      firstProduct = product;
    } else if (product === firstProduct && !seenFirstAgain) {
      mode = "packs";
      seenFirstAgain = true;
    }

    let prod = products.find(p => p.product === product);
    if (!prod) {
      prod = { partnerId, partnerName, product, historyMoney: {}, historyPacks: {} };
      products.push(prod);
    }

    cols.forEach((col, idx) => {
      if (/^202[56]_\d$/.test(col)) {
        const val = Math.round(parseNum(r[idx]));
        if (mode === "money") prod.historyMoney[col] = val;
        else prod.historyPacks[col] = val;
      }
    });
  });

  return products;
}
// URL для кожного користувача
const planUrlOleksandr = "https://docs.google.com/spreadsheets/d/1TtDl9d1rxAl7mCwlW7N6plVhxZYAVEk8";
const planUrlTetiana   = "https://docs.google.com/spreadsheets/d/1IKqln_4KSXwcTiikO48E6j3XywHoebhI";
const planUrlOffice    = "https://docs.google.com/spreadsheets/d/1URsMjWRwYmyy7aHtQ5EqmvD6Yct-rNmf";
const planUrlAndriy    = "https://docs.google.com/spreadsheets/d/1AAAAAAAAAAAAAAAAAAAA"; // свій URL
const planUrlMaria     = "https://docs.google.com/spreadsheets/d/1BBBBBBBBBBBBBBBBBBBB"; // свій URL
const planUrlSerhiy    = "https://docs.google.com/spreadsheets/d/1CCCCCCCCCCCCCCCCCCCC"; // свій URL

// ===== Плани =====
function getPlanUrl(userKey) {
  switch (userKey) {
    case "fedir":
      return planUrlOleksandr;
    case "olena":
      return planUrlTetiana;
    case "office":
      return planUrlOffice;
    case "andriy":
      return planUrlAndriy;
    case "maria":
      return planUrlMaria;
    case "serhiy":
      return planUrlSerhiy;
    default:
      console.warn("Невідомий користувач, використовую загальний план");
      return planUrlOffice; // fallback
  }
}

// ===== Кешування планів =====
function savePlanCache(data, lastRow) {
  localStorage.setItem("planCache", JSON.stringify(data));
  localStorage.setItem("planLastRow", lastRow);
  localStorage.setItem("planLastUpdate", new Date().toISOString());
}

function loadPlanCache() {
  const raw = localStorage.getItem("planCache");
  return raw ? JSON.parse(raw) : [];
}

function loadPlanLastRow() {
  return Number(localStorage.getItem("planLastRow")) || 1;
}

// ===== Інкрементальний фетч планів =====
async function fetchPlanIncremental(planUrl) {
  const lastRow = loadPlanLastRow();
  const url = `${planUrl}/gviz/tq?tqx=out:json&range=A${lastRow}:I1000`;

  try {
    const res = await fetch(url);
    const text = await res.text();
    const json = JSON.parse(text.substr(47).slice(0, -2));
    const rows = json.table.rows.map(r => r.c.map(c => c?.v || ""));

    if (rows.length > 0) {
      let cache = loadPlanCache();

      // додаємо нові рядки
      cache = cache.concat(rows.map(r => {
        const product = r[0];
        if (!product) return null;
        return {
          product,
          planMoney: {
            "2026_1": parseFloat(r[1]) || 0,
            "2026_2": parseFloat(r[2]) || 0,
            "2026_3": parseFloat(r[3]) || 0,
            "2026_4": parseFloat(r[4]) || 0
          },
          planPacks: {
            "2026_1": parseFloat(r[5]) || 0,
            "2026_2": parseFloat(r[6]) || 0,
            "2026_3": parseFloat(r[7]) || 0,
            "2026_4": parseFloat(r[8]) || 0
          }
        };
      }).filter(Boolean));

      const newLastRow = lastRow + rows.length;
      savePlanCache(cache, newLastRow);
      return cache;
    } else {
      return loadPlanCache();
    }
  } catch (err) {
    console.error("❌ Помилка інкрементального запиту планів:", err);
    return loadPlanCache();
  }
}
function distributePlanForPartners(plans, partners, quarter) {
  const keyPrev = `2025_${quarter.replace("Q","")}`;
  const keyCurr = `2026_${quarter.replace("Q","")}`;

  plans.forEach(plan => {
    const totalMoney = plan.planMoney[keyCurr] || 0;
    const totalPacks = plan.planPacks[keyCurr] || 0;

    // 1. базові дольові плани по MSр
    let shares = partners.map(p => {
      const prod = p.products.find(pr => pr.product === plan.product);
      const historyPacks = prod ? (prod.historyPacks?.[keyPrev] || 0) : 0;
      const baseShare = totalPacks * (p.msr / 100);

      let share;
      const allHistoryZero = partners.every(x => {
        const h = x.products.find(pr => pr.product === plan.product)?.historyPacks?.[keyPrev] || 0;
        return h === 0;
      });

      if (allHistoryZero) {
        share = baseShare;
      } else if (historyPacks > baseShare) {
        share = historyPacks;
      } else {
        share = (historyPacks * p.ei) / 100;
      }

      return { partner: p, share, historyPacks };
    });

    // 2. перевірка суми
    let sumShares = shares.reduce((s, x) => s + x.share, 0);

    if (sumShares > totalPacks * 1.1) {
      shares.forEach(x => {
        x.share = x.share * (totalPacks / sumShares);
      });
    } else if (sumShares < totalPacks) {
      shares.forEach(x => {
        x.share = x.share * (totalPacks / sumShares);
      });
    }

    // 2a. балансування приростів
    shares.forEach(x => {
      if (x.historyPacks > 0) {
        const growth = (x.share - x.historyPacks) / x.historyPacks;
        const maxDeviation = 0.25; // дозволений поріг ±25%
        if (growth > maxDeviation) {
          x.share = x.historyPacks * (1 + maxDeviation);
        } else if (growth < -maxDeviation) {
          x.share = x.historyPacks * (1 - maxDeviation);
        }
      }
    });

    // після балансування знову масштабуємо, щоб сума збігалася
    sumShares = shares.reduce((s, x) => s + x.share, 0);
    if (sumShares > 0) {
      shares.forEach(x => {
        x.share = x.share * (totalPacks / sumShares);
      });
    }

    // 3. округлення і запис у продукти
    shares.forEach(x => {
      const planPacks = Math.round(x.share);
      const prod = x.partner.products.find(pr => pr.product === plan.product);
      if (prod) {
        const execPacks = prod.historyPacks?.[keyCurr] || 0;
        const toSellPacks = Math.max(planPacks - execPacks, 0);

        prod.planPacks   = planPacks;
        prod.execPacks   = execPacks;
        prod.toSellPacks = toSellPacks;

        // додаткові поля для таблиці
        prod.basePacks    = planPacks;                        // Дольовий
        prod.superPacks   = Math.round(planPacks * 1.20);     // Супер
        prod.optimalPacks = Math.round(planPacks * 1.15);     // Подобається
        prod.satisfyPacks = Math.round(planPacks * 1.07);     // Задовільнить
        prod.thinkPacks   = planPacks;                        // Замислитися
        prod.goPacks      = planPacks;                        // Піти

        const historyMoney = prod.historyMoney?.[keyPrev] || 0;
        const execMoney    = prod.historyMoney?.[keyCurr] || 0;

        const pricePerPack = totalPacks > 0 ? (totalMoney / totalPacks) : 0;
        let planMoney = planPacks * pricePerPack;

        const toSellMoney = Math.max(planMoney - execMoney, 0);

        prod.planMoney   = Math.round(planMoney);
        prod.execMoney   = execMoney;
        prod.toSellMoney = Math.round(toSellMoney);

        prod.baseMoney    = planMoney;
        prod.superMoney   = Math.round(planMoney * 1.20);
        prod.optimalMoney = Math.round(planMoney * 1.15);
        prod.satisfyMoney = Math.round(planMoney * 1.07);
        prod.thinkMoney   = planMoney;
        prod.goMoney      = planMoney;

        prod.percentExecPacks = planPacks > 0 ? ((execPacks / planPacks) * 100).toFixed(2) + "%" : "0.00%";
        prod.percentExecMoney = planMoney > 0 ? ((execMoney / planMoney) * 100).toFixed(2) + "%" : "0.00%";
      }
    });

    // 4. контрольний рядок із сумою
    const sumPlanPacks = shares.reduce((s, x) => s + Math.round(x.share), 0);
    const sumPlanMoney = shares.reduce((s, x) => {
      const pricePerPack = totalPacks > 0 ? (totalMoney / totalPacks) : 0;
      return s + Math.round(x.share) * pricePerPack;
    }, 0);

    console.log(`▶ Контроль по продукту ${plan.product}:`);
    console.log(`   План з таблиці: ${totalPacks.toLocaleString("uk-UA")} упак. / ${totalMoney.toLocaleString("uk-UA")} грн`);
    console.log(`   Сума розподілу: ${sumPlanPacks.toLocaleString("uk-UA")} упак. / ${sumPlanMoney.toLocaleString("uk-UA")} грн`);
  });

  return partners;
}



// ===== Підсумки для користувача =====
function calculateUserTotals(planRows, partners, quarter, userKey) {
  const ids = userMap[userKey] || [];
  const historyKey = `2025_${quarter.replace("Q","")}`;
  const execKey1   = `2026_${quarter.replace("Q","")}`;
  const execKey2   = `2026_Q${quarter.replace("Q","")}`;
  const planKey1   = `2026_${quarter.replace("Q","")}`;
  const planKey2   = `2026_Q${quarter.replace("Q","")}`;

  let totalHistory = 0;
  let totalExec = 0;

  partners.forEach(p => {
    if (!ids.includes(p.id)) return;
    if (!Array.isArray(p.products)) return;

    p.products.forEach(prod => {
      totalHistory += prod.historyMoney?.[historyKey] || 0;
      totalExec    += prod.historyMoney?.[execKey1] || prod.historyMoney?.[execKey2] || 0;
    });
  });

  let totalPlan = 0;
  planRows.forEach(row => {
    totalPlan += row.planMoney?.[planKey1] || row.planMoney?.[planKey2] || 0;
  });

  const percentExec = totalPlan > 0 ? ((totalExec / totalPlan) * 100) : 0;
  const percentExecStr = percentExec.toFixed(2) + "%";

  return {
    totalHistory: Math.round(totalHistory).toLocaleString("uk-UA"),
    totalPlan: Math.round(totalPlan).toLocaleString("uk-UA"),
    totalExec: Math.round(totalExec).toLocaleString("uk-UA"),
    percentExec: percentExecStr
  };
}


// ===== Логіка для семисегментних дисплеїв =====
function updateSevenSegDashboard(planRows, partners, quarter, userKey, prefix="moneyGreen") {
  const totals = calculateUserTotals(planRows, partners, quarter, userKey);

  document.getElementById(prefix).textContent    = totals.totalPlan;     // План
  document.getElementById(prefix+"1").textContent = totals.totalExec;    // Факт
  document.getElementById(prefix+"2").textContent = totals.percentExec;  // %
}
