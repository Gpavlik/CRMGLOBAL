// ==========================
// labcard.js — Повна виправлена версія
// ==========================

// 🔧 Глобальні змінні
let labsCache = [];          // кеш лабораторій
let visitsCache = [];        // кеш візитів
let tasksCache = [];         // кеш задач
let calculators = {};        // кеш конфігів приладів
let kpListByDevice = {};     // КП по приладах
window.labsData = [];        // початкові дані лабораторій (вбудовані)
let deviceCount = 0;         // лічильник приладів

// ==========================
// === db-utils.js ===
// ==========================
const DB_NAME = "labsDB";
const DB_VERSION = 3;

function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      // ВАЖЛИВО: Виправлено keyPath на правильні (edrpou та id)
      if (!db.objectStoreNames.contains("labs")) {
        db.createObjectStore("labs", { keyPath: "edrpou" });
      }
      if (!db.objectStoreNames.contains("visits")) {
        db.createObjectStore("visits", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("tasks")) {
        db.createObjectStore("tasks", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllFromDB(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Універсальна функція для збереження одного запису
async function putToDB(storeName, item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.put(item);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// Універсальна функція для масового збереження (швидка транзакція)
async function saveToDB(storeName, dataArray) {
  if (!Array.isArray(dataArray) || dataArray.length === 0) return true;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    
    dataArray.forEach(item => {
      if (item) store.put(item);
    });

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteFromDB(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function clearDB(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// ==========================
// Категорії приладів (глобально)
// ==========================
const deviceCategories = {
  "Гематологія": ["df-50", "dh-360", "Sysmex XN-1000"],
  "Біохімія": ["Cobas 311", "Cobas 6000"],
  "Імунологія": ["Architect i1000SR", "Architect i2000SR"],
  "Загальні аналізатори": ["LS-1100", "LS-2000"]
};

// ==========================
// Допоміжні утиліти
// ==========================
function formatDate(dateObj) {
  if (!(dateObj instanceof Date) || isNaN(dateObj)) return "";
  return dateObj.toISOString().split("T")[0];
}

function formatDateForInput(dateStr) {
  if (!dateStr) return "";
  return dateStr.split("T")[0]; // залишає тільки yyyy-MM-dd
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  
  if (el.tagName === "SELECT") {
    [...el.options].forEach(opt => opt.selected = (opt.value === String(value)));
  } else if (el.type === "checkbox" || el.type === "radio") {
    el.checked = Boolean(value);
  } else {
    el.value = value || "";
  }
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

// allOrders – масив об'єктів закупівель
function getLatestReagentsInfo(allOrders) {
  const latestInfo = {};
  for (const order of allOrders) {
    const { reagentName, lastOrderDate, lastOrderCount } = order;
    if (
      !latestInfo[reagentName] ||
      new Date(lastOrderDate) > new Date(latestInfo[reagentName].lastOrderDate)
    ) {
      latestInfo[reagentName] = { lastOrderDate, lastOrderCount };
    }
  }
  return latestInfo;
}

// ==========================
// Завантаження кешу з IndexedDB
// ==========================
async function loadCaches() {
  labsCache = await getAllFromDB("labs");
  visitsCache = await getAllFromDB("visits");
  tasksCache = await getAllFromDB("tasks");
  window.labsCache = labsCache;
  console.log(`✅ Кеш завантажено: ${labsCache.length} лаб, ${visitsCache.length} візитів, ${tasksCache.length} задач.`);
}

// ==========================
// Каскадні підказки
// ==========================
function fillRegionOptions() {
  const regions = [...new Set((labsCache || []).map(l => l.region).filter(Boolean))];
  const list = document.getElementById("regionList");
  if (list) list.innerHTML = regions.map(r => `<option value="${r}">`).join("");
}

function fillCityOptions() {
  const region = document.getElementById("region")?.value;
  const cities = [...new Set((labsCache || [])
    .filter(l => l.region === region)
    .map(l => l.city)
    .filter(Boolean))];
  const list = document.getElementById("cityList");
  if (list) list.innerHTML = cities.map(c => `<option value="${c}">`).join("");
}

function fillLpzOptions() {
  const region = document.getElementById("region")?.value;
  const city = document.getElementById("city")?.value;
  const lpzs = (labsCache || []).filter(l => l.region === region && l.city === city);
  const list = document.getElementById("lpzList");
  if (list) list.innerHTML = lpzs.map(l => `<option value="${l.institution} [ЄДРПОУ:${l.edrpou}]">`).join("");
}

function prefillLabData() {
  const lpzValue = document.getElementById("lpz")?.value;
  if (!lpzValue) return;
  const edrpouMatch = lpzValue.match(/ЄДРПОУ:(\d+)/);
  if (!edrpouMatch) return;
  
  const edrpou = edrpouMatch[1];
  const lab = labsCache.find(l => String(l.edrpou) === edrpou);
  if (!lab) return;

  setValue("partnerName", lab.partner);
  setValue("labAddress", lab.address);
  setValue("contractor", lab.contractor);
  setValue("phone", lab.phone);
  setValue("labEdrpou", lab.edrpou);
  setValue("labManager", lab.manager);

  const container = document.getElementById("devicesContainer");
  if (container) {
    container.innerHTML = "";
    deviceCount = 0;
    if (lab.devices && lab.devices.length > 0) {
      document.getElementById("devicesSection").style.display = "block";
      lab.devices.forEach((d, idx) => addDevice(idx, d));
    }
  }
}

// ==========================
// Ініціалізація сторінки
// ==========================
document.addEventListener("DOMContentLoaded", async () => {
  await loadCaches();
  fillRegionOptions();
  fillCityOptions();
  fillLpzOptions();
  
  const edrpou = getQueryParam("id");
  if (edrpou) {
    await initLabCard(edrpou);
  } else {
    initEmptyLabCard();
  }
});

// ==========================
// Ініціалізація картки лабораторії
// ==========================
async function initLabCard(edrpou) {
  console.log("▶ initLabCard викликана для ЄДРПОУ:", edrpou);

  const lab = labsCache.find(l => String(l.edrpou).trim() === String(edrpou).trim());
  if (!lab) {
    console.error("❌ Лабораторія не знайдена у кеші за ЄДРПОУ:", edrpou);
    return;
  }

  // Заповнюємо форму
  setValue("partnerName", lab.partner);
  setValue("region", lab.region);
  setValue("city", lab.city);
  setValue("lpz", lab.institution);
  setValue("labAddress", lab.address);
  setValue("contractor", lab.contractor);
  setValue("phone", lab.phone);
  setValue("labEdrpou", lab.edrpou);
  setValue("labManager", lab.manager);

  // Показуємо блок приладів
  document.getElementById("devicesSection").style.display = "block";

  // Відображаємо прилади
  const container = document.getElementById("devicesContainer");
  container.innerHTML = "";
  deviceCount = 0;

  (lab.devices || []).forEach((d, idx) => {
    const deviceName = d.device || d.name || d.category || "";
    const allOrders = d.reagentsOrders || [];
    const latestReagents = getLatestReagentsInfo(allOrders);

    addDevice(idx, {
      category: d.category || "",
      device: deviceName,
      soldDate: d.soldDate || d.date || "",
      lastService: d.lastService || "",
      workType: d.workType || "",
      replacedParts: d.replacedParts || "",
      kp: d.kp || "",
      testCount: d.testCount || "",
      reagentsInfo: Object.keys(latestReagents).length > 0 ? latestReagents : (d.reagentsInfo || {}),
      analyses: d.analyses || {}
    });
  });

  console.log("✅ Картка лабораторії ініціалізована");
}

function initEmptyLabCard() {
  document.getElementById("devicesSection").style.display = "block";
  
  setValue("partnerName", "");
  setValue("region", "");
  setValue("city", "");
  setValue("lpz", "");
  setValue("labAddress", "");
  setValue("contractor", "");
  setValue("phone", "");
  setValue("labEdrpou", "");
  setValue("labManager", "");

  const container = document.getElementById("devicesContainer");
  container.innerHTML = "";
  deviceCount = 0;

  // Видалено addDevice(0) — блок приладів залишається порожнім, 
  // поки користувач сам не натисне кнопку "Додати прилад".
  console.log("✅ Ініціалізація нової лабораторії завершена");
}

// ==========================
// Додавання приладу
// ==========================
function addDevice(index = null, prefill = {}) {
  const container = document.getElementById("devicesContainer");
  if (!container) return;

  const idx = index !== null ? index : deviceCount;

  const block = document.createElement("div");
  block.className = "device-block";
  block.id = `deviceBlock_${idx}`;

  block.innerHTML = `
    <label for="category_${idx}">Категорія:</label>
    <input id="category_${idx}" value="${prefill.category || ""}" placeholder="Оберіть категорію">

    <label for="device_${idx}">Прилад:</label>
    <input id="device_${idx}" value="${prefill.device || ""}" placeholder="Введіть назву приладу" onblur="loadCalculator(${idx})">

    <label for="soldDate_${idx}">Дата продажу:</label>
    <input type="date" id="soldDate_${idx}" value="${formatDateForInput(prefill.soldDate)}">

    <label for="lastService_${idx}">Останній сервіс:</label>
    <input type="date" id="lastService_${idx}" value="${formatDateForInput(prefill.lastService)}">

    <label for="workType_${idx}">Виконані роботи:</label>
    <select id="workType_${idx}">
      <option value="">Оберіть тип</option>
      <option value="технічне обслуговування">Технічне обслуговування</option>
      <option value="ремонт">Ремонт</option>
      <option value="калібрування">Калібрування</option>
    </select>

    <label for="replacedParts_${idx}">Замінені деталі:</label>
    <input id="replacedParts_${idx}" value="${prefill.replacedParts || ""}" placeholder="Перелік деталей">

    <label for="kpSelect_${idx}">КП:</label>
    <select id="kpSelect_${idx}">
      <option value="">Оберіть КП</option>
    </select>

    <div id="reagentsFields_${idx}"></div>
    <div id="analysisFields_${idx}"></div>
    <button type="button" style="margin-top:10px; background:#cc0000;" onclick="document.getElementById('deviceBlock_${idx}').remove()">🗑️ Видалити прилад</button>
  `;

  container.appendChild(block);
  
  if (index === null) deviceCount++; 
  else deviceCount = Math.max(deviceCount, index + 1);

  if (prefill.workType) {
    const workTypeEl = document.getElementById(`workType_${idx}`);
    if (workTypeEl) workTypeEl.value = prefill.workType;
  }

  // === Префіл реагентів без калькулятора ===
  if (prefill.reagentsInfo && Object.keys(prefill.reagentsInfo).length > 0) {
    const reagentsContainer = document.getElementById(`reagentsFields_${idx}`);
    Object.entries(prefill.reagentsInfo).forEach(([name, info]) => {
      const safeId = name.replace(/[^a-zA-Z0-9]/g, "_");
      const reagentBlock = document.createElement("div");
      reagentBlock.className = "reagent-block";
      reagentBlock.dataset.name = name;
      reagentBlock.innerHTML = `
        <label>${name}</label>
        <input id="reagentCount_${idx}_${safeId}" value="${info.lastOrderCount || ""}" placeholder="Кількість">
        <input type="date" id="reagentDate_${idx}_${safeId}" value="${formatDateForInput(info.lastOrderDate)}">
      `;
      reagentsContainer.appendChild(reagentBlock);
    });
  }

  // === Префіл аналізів ===
  if (prefill.analyses && Object.keys(prefill.analyses).length > 0) {
    const analysesContainer = document.getElementById(`analysisFields_${idx}`);
    Object.entries(prefill.analyses).forEach(([testName, data]) => {
      const safeId = testName.replace(/[^a-zA-Z0-9]/g, "_");
      const analysisBlock = document.createElement("div");
      analysisBlock.className = "analysis-block";
      analysisBlock.dataset.name = testName;
      analysisBlock.innerHTML = `
        <label>${testName}</label>
        <input id="analysisCount_${idx}_${safeId}" value="${data.count || ""}" placeholder="Кількість">
        <input id="analysisPackages_${idx}_${safeId}" value="${data.packages || ""}" placeholder="Пакети">
        <input type="date" id="analysisDate_${idx}_${safeId}" value="${formatDateForInput(data.date)}">
      `;
      analysesContainer.appendChild(analysisBlock);
    });
  }

  // Запускаємо калькулятор
  if (prefill.device) {
    loadCalculator(idx, prefill);
  }
}

// ==========================
// Завантаження калькулятора
// ==========================
async function loadCalculator(index, prefill = null) {
  const deviceInput = document.getElementById(`device_${index}`);
  if (deviceInput && !deviceInput.value && prefill?.device) {
    deviceInput.value = prefill.device;
  }

  const deviceName = deviceInput?.value?.trim();
  if (!deviceName) return;

  if ((prefill?.category || deviceName).toUpperCase().includes("YHLO")) {
    console.log(`ℹ️ Прилад ${deviceName} працює без реагентів — калькулятор не потрібен`);
    return;
  }

  const key = deviceName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  const applyPrefill = (config) => {
    const analysisContainer = document.getElementById(`analysisFields_${index}`);
    if (analysisContainer) analysisContainer.innerHTML = "";

    const testCountEl = document.getElementById(`testCount_${index}`);
    if (testCountEl) testCountEl.remove();

    const reagentBlocks = document.querySelectorAll(`#deviceBlock_${index} .reagent-block`);
    reagentBlocks.forEach(rb => rb.remove());

    renderTestCountField(index, config, deviceName);

    if (config.reagents) {
      renderReagentFields(index, config, prefill);
      renderAnalysisFields(index, config, prefill); // для розрахунку тестів
    }
    if (config.analyses) {
      renderAnalysisFieldsFromAnalyses(index, config, prefill);
    }

    // КП
    const kpOptions = kpListByDevice[deviceName] || [];
    const kpSelect = document.getElementById(`kpSelect_${index}`);
    if (kpSelect) {
      kpSelect.innerHTML = `<option value="">Оберіть КП</option>` +
        kpOptions.map(kp => `<option value="${kp}">${kp}</option>`).join("");
      if (prefill?.kp) kpSelect.value = prefill.kp;
    }

    if (prefill?.testCount) {
      const testCountInput = document.getElementById(`testCount_${index}`);
      if (testCountInput) testCountInput.value = prefill.testCount;
    }
  };

  if (calculators[key]) {
    applyPrefill(calculators[key]);
    return;
  }

  try {
    const res = await fetch(`../calculators/${deviceName}.json`);
    if (!res.ok) throw new Error(`Не вдалося знайти калькулятор: ${deviceName}`);
    const config = await res.json();
    calculators[key] = config;
    applyPrefill(config);
  } catch (err) {
    console.error(`❌ Помилка завантаження калькулятора ${deviceName}:`, err);
  }
}

function renderTestCountField(index, config, deviceName) {
  const block = document.getElementById(`deviceBlock_${index}`);
  if (!block) return;
  const wrapper = document.createElement("div");
  wrapper.className = "test-count-block";
  wrapper.innerHTML = `
    <label for="testCount_${index}">Кількість тестів на день (${deviceName}):</label>
    <input type="number" id="testCount_${index}" value="${config.testsPerDay || ""}">
    <p>💰 Ціна тесту: ${config.testPrice || "—"} грн</p>
  `;
  block.appendChild(wrapper);
}

function renderReagentFields(index, config, prefill = null) {
  const block = document.getElementById(`reagentsFields_${index}`);
  if (!block || !config.reagents) return;
  block.innerHTML = "<h4>🧪 Реагенти</h4>";

  config.reagents.forEach(r => {
    const safeId = r.name.replace(/[^a-zA-Z0-9]/g, "_");
    const wrapper = document.createElement("div");
    wrapper.className = "reagent-block";
    wrapper.dataset.name = r.name;

    wrapper.innerHTML = `
      <label><b>${r.name}</b> (📦 ${r.packageSize}мл, 💰 ${r.price}грн)</label>
      <input type="number" id="reagentCount_${index}_${safeId}" placeholder="Кількість упаковок" value="0">
      <input type="date" id="reagentDate_${index}_${safeId}">
      <div id="reagentCalc_${index}_${safeId}" class="reagent-calc"></div>
    `;
    block.appendChild(wrapper);

    if (prefill?.reagentsInfo?.[r.name]) {
      const info = prefill.reagentsInfo[r.name];
      document.getElementById(`reagentCount_${index}_${safeId}`).value = info.lastOrderCount || 0;
      document.getElementById(`reagentDate_${index}_${safeId}`).value = info.lastOrderDate || "";
    }
  });
}

function renderAnalysisFields(index, config, prefill = null) {
  const container = document.getElementById(`analysisFields_${index}`);
  if (!container) return;
  
  const testsInput = document.getElementById(`testCount_${index}`);
  if (!testsInput) return;

  config.reagents.forEach(r => {
    const safeId = r.name.replace(/[^a-zA-Z0-9]/g, "_");
    const packagesEl = document.getElementById(`reagentCount_${index}_${safeId}`);
    const calcEl = document.getElementById(`reagentCalc_${index}_${safeId}`);
    if(!packagesEl || !calcEl) return;

    function recalc() {
      const testsPerDay = parseInt(testsInput.value || "0", 10);
      const packages = parseInt(packagesEl.value || "0", 10);
      const dailyUsage = r.startup + r.shutdown + (r.perTest * testsPerDay);
      const totalVolume = r.packageSize * packages;
      let daysAvailable = "∞";
      if (dailyUsage > 0) daysAvailable = Math.floor(totalVolume / dailyUsage);
      calcEl.innerHTML = `⏳ Вистачить приблизно на <strong>${daysAvailable}</strong> днів`;
    }

    testsInput.addEventListener("input", recalc);
    packagesEl.addEventListener("input", recalc);
    recalc();
  });
}

function renderAnalysisFieldsFromAnalyses(index, config, prefill = null) {
  const container = document.getElementById(`analysisFields_${index}`);
  if (!container) return;
  container.innerHTML = "<h4>🧪 Тести</h4>";

  Object.keys(config.analyses).forEach(testName => {
    const safeId = testName.replace(/[^a-zA-Z0-9]/g, "_");
    const block = document.createElement("div");
    block.className = "analysis-block";
    block.dataset.name = testName;
    block.innerHTML = `
      <label><b>${testName}</b></label>
      <input type="number" id="analysisCount_${index}_${safeId}" placeholder="Кількість" value="${prefill?.analyses?.[testName]?.count || 0}">
      <input type="number" id="analysisPackages_${index}_${safeId}" placeholder="Пакети" value="${prefill?.analyses?.[testName]?.packages || 0}">
      <input type="date" id="analysisDate_${index}_${safeId}" value="${prefill?.analyses?.[testName]?.date || ""}">
    `;
    container.appendChild(block);
  });
}

// ==========================
// Збір даних з форми
// ==========================
function collectLabCardData() {
  const devices = [];
  const deviceBlocks = document.querySelectorAll(".device-block");

  deviceBlocks.forEach((block) => {
    const idxMatch = block.id.match(/deviceBlock_(\d+)/);
    if (!idxMatch) return;
    const i = idxMatch[1];

    const category = document.getElementById(`category_${i}`)?.value.trim() || "";
    const device = document.getElementById(`device_${i}`)?.value.trim() || "";
    
    if (!category && !device) return;

    const soldDate = document.getElementById(`soldDate_${i}`)?.value || "";
    const lastService = document.getElementById(`lastService_${i}`)?.value || "";
    const workType = document.getElementById(`workType_${i}`)?.value || "";
    const replacedParts = document.getElementById(`replacedParts_${i}`)?.value.trim() || "";
    const kp = document.getElementById(`kpSelect_${i}`)?.value || "";
    const testCount = document.getElementById(`testCount_${i}`)?.value || "";

    const reagentsInfo = {};
    const reagentBlocks = block.querySelectorAll(`.reagent-block`);
    reagentBlocks.forEach(rb => {
      const name = rb.dataset.name;
      const safeId = name?.replace(/[^a-zA-Z0-9]/g, "_");
      const countEl = document.getElementById(`reagentCount_${i}_${safeId}`);
      const dateEl = document.getElementById(`reagentDate_${i}_${safeId}`);
      if (name) {
        reagentsInfo[name] = {
          lastOrderCount: countEl?.value || "",
          lastOrderDate: dateEl?.value || ""
        };
      }
    });

    const analyses = {};
    const analysisBlocks = block.querySelectorAll(`.analysis-block`);
    analysisBlocks.forEach(ab => {
      const testName = ab.dataset.name;
      const safeId = testName?.replace(/[^a-zA-Z0-9]/g, "_");
      const countEl = document.getElementById(`analysisCount_${i}_${safeId}`);
      const packagesEl = document.getElementById(`analysisPackages_${i}_${safeId}`);
      const dateEl = document.getElementById(`analysisDate_${i}_${safeId}`);
      if (testName) {
        analyses[testName] = {
          count: countEl?.value || "",
          packages: packagesEl?.value || "",
          date: dateEl?.value || ""
        };
      }
    });

    devices.push({
      category, device, soldDate, lastService, workType, replacedParts, kp, testCount, reagentsInfo, analyses
    });
  });

  return {
    partner: document.getElementById("partnerName")?.value.trim(),
    region: document.getElementById("region")?.value.trim(),
    city: document.getElementById("city")?.value.trim(),
    institution: document.getElementById("lpz")?.value.trim(),
    address: document.getElementById("labAddress")?.value.trim(),
    contractor: document.getElementById("contractor")?.value.trim(),
    phone: document.getElementById("phone")?.value.trim(),
    edrpou: document.getElementById("labEdrpou")?.value.trim(),
    manager: document.getElementById("labManager")?.value.trim(),
    devices,
    updatedAt: Date.now() // Важливо для дельта-синхронізації
  };
}

// ==========================
// Збереження лабораторії
// ==========================
async function saveOrUpdateLabCard() {
  try {
    const labCard = collectLabCardData();

    if (!labCard.partner || !labCard.region || !labCard.city || !labCard.institution || !labCard.edrpou) {
      alert("⚠️ Заповніть обов'язкові поля: Контрагент, Область, Місто, ЛПЗ та ЄДРПОУ.");
      return;
    }

    await showTaskPreviewBeforeSave(labCard, async () => {
      await putToDB("labs", labCard);
      labsCache = await getAllFromDB("labs");
      alert("✅ Лабораторію успішно збережено в базі!");
      window.location.href = "./labs.html"; // Повернення до списку
    });

  } catch (err) {
    console.error("❌ Помилка при збереженні лабораторії:", err);
    alert("⚠️ Сталася помилка при збереженні.");
  }
}

function deleteLab(edrpou) {
  if (!confirm("❌ Ви впевнені, що хочете видалити цю лабораторію?")) return;
  
  deleteFromDB("labs", edrpou).then(() => {
    alert("✅ Лабораторію видалено!");
    window.location.href = "./labs.html";
  }).catch(err => {
    console.error(err);
    alert("Помилка видалення");
  });
}

// ==========================
// Генерація задач для приладів
// ==========================
async function generateDeviceTasksWithDueDates(lab) {
  try {
    const tasks = [];
    let minDaysAvailable = Infinity;

    for (const device of lab.devices || []) {
      const isYHLO = (device.category || device.device || "").toUpperCase().includes("YHLO");

      // ТО (сервіс)
      let lastServiceDate = device.lastService ? new Date(device.lastService) : null;
      if (!lastServiceDate && device.soldDate) lastServiceDate = new Date(device.soldDate);

      if (lastServiceDate && !isNaN(lastServiceDate)) {
        const diffDays = Math.floor((Date.now() - lastServiceDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 180) {
          tasks.push({
            id: `${lab.edrpou}_${device.device}_service_${Date.now()}`,
            labId: lab.edrpou,
            labName: lab.partner,
            device: device.device,
            title: `Плановий сервіс приладу ${device.device}`,
            date: new Date().toISOString().split("T")[0],
            taskType: "service",
            priority: "🔧"
          });
        }
      }

      // Реагенти
      if (!isYHLO && device.reagentsInfo) {
        for (const [reagentName, info] of Object.entries(device.reagentsInfo)) {
          const reagentConfig = (device.calculator?.reagents || []).find(r => r.name === reagentName);
          if (!reagentConfig) continue;

          const testsPerDay = parseInt(device.testCount || 0, 10);
          const dailyUsage = reagentConfig.startup + reagentConfig.shutdown + (reagentConfig.perTest * testsPerDay);
          const totalVolume = reagentConfig.packageSize * (info.lastOrderCount || 0);

          let daysAvailable = Infinity;
          if (dailyUsage > 0) daysAvailable = Math.floor(totalVolume / dailyUsage);
          if (daysAvailable < minDaysAvailable) minDaysAvailable = daysAvailable;

          const neededPackages = Math.ceil((dailyUsage * 66) / reagentConfig.packageSize);

          if (daysAvailable < 30) {
            tasks.push({
              id: `${lab.edrpou}_${device.device}_reagent_${Date.now()}_${Math.random()}`,
              labId: lab.edrpou,
              labName: lab.partner,
              device: device.device,
              title: `Закупівля реагенту ${reagentName}`,
              date: new Date().toISOString().split("T")[0],
              taskType: "reagents",
              reagentName,
              neededQuantity: neededPackages,
              priority: "🧪"
            });
          }
        }
      }
    }

    if (minDaysAvailable !== Infinity && minDaysAvailable < 60) {
      const nextVisitDate = new Date();
      nextVisitDate.setDate(nextVisitDate.getDate() + Math.max(minDaysAvailable - 15, 1));
      
      tasks.push({
        id: `${lab.edrpou}_visit_${Date.now()}`,
        labId: lab.edrpou,
        labName: lab.partner,
        title: `Наступний візит до лабораторії ${lab.partner}`,
        date: nextVisitDate.toISOString().split("T")[0],
        taskType: "visit",
        priority: "📅"
      });
    }

    if (tasks.length > 0) {
      await saveToDB("tasks", tasks);
      tasksCache = await getAllFromDB("tasks");
    }

    return tasks;
  } catch (err) {
    console.error("❌ Помилка при генерації задач:", err);
    return [];
  }
}

async function showTaskPreviewBeforeSave(labCard, onConfirm) {
  const tasks = await generateDeviceTasksWithDueDates(labCard);
  if (!tasks || tasks.length === 0) {
    return onConfirm();
  }

  let previewHtml = "<h3>📋 Згенеровані задачі:</h3><ul>";
  tasks.forEach(t => { previewHtml += `<li>${t.date} — ${t.title}</li>`; });
  previewHtml += "</ul>";

  const previewContainer = document.getElementById("taskPreview");
  if (previewContainer) previewContainer.innerHTML = previewHtml;

  if (confirm("✅ Перегляньте задачі. Зберегти лабораторію?")) {
    onConfirm();
  }
}

// ==========================
// Масова генерація візитів та оновлення
// ==========================
async function generateMonthlyLabVisits(tasks) {
  // Збережена ваша логіка
  if (!Array.isArray(tasks) || tasks.length === 0) return [];
  const visitsByMonth = {};
  
  tasks.forEach(task => {
    const date = new Date(task.date);
    if (isNaN(date)) return;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!visitsByMonth[monthKey]) visitsByMonth[monthKey] = [];
    visitsByMonth[monthKey].push(task);
  });

  const visitsPayload = [];
  for (const [monthKey, monthTasks] of Object.entries(visitsByMonth)) {
    visitsPayload.push({
      id: `${monthTasks[0].labId}_${monthKey}_${Date.now()}`,
      labId: monthTasks[0].labId,
      labName: monthTasks[0].labName || "—",
      date: monthTasks[0].date,
      tasks: monthTasks,
      status: "заплановано"
    });
  }

  if (visitsPayload.length > 0) {
    await saveToDB("visits", visitsPayload);
    visitsCache = await getAllFromDB("visits");
  }
  return visitsPayload;
}

async function applyFieldUpdatesFromVisits() {
  const visits = await getAllFromDB("visits");
  const labs = await getAllFromDB("labs");
  
  for (const lab of labs) {
    const labVisits = visits.filter(v => v.labId === lab.edrpou && v.status === "виконано");
    for (const visit of labVisits) {
      for (const task of visit.tasks || []) {
        if (task.taskType === "service") {
          const device = lab.devices.find(d => d.device === task.device);
          if (device) device.lastService = task.date;
        }
        if (task.taskType === "reagents") {
          const device = lab.devices.find(d => d.device === task.device);
          if (device) {
            if (!device.reagentsInfo) device.reagentsInfo = {};
            device.reagentsInfo[task.reagentName] = {
              lastOrderDate: task.date,
              lastOrderCount: task.neededQuantity
            };
          }
        }
      }
    }
  }
  await saveToDB("labs", labs);
}

// ==========================
// Глобальні прив’язки до window
// ==========================
window.initLabCard = initLabCard;
window.addDevice = addDevice;
window.loadCalculator = loadCalculator;
window.saveOrUpdateLabCard = saveOrUpdateLabCard;
window.deleteLab = deleteLab;
window.fillRegionOptions = fillRegionOptions;
window.fillCityOptions = fillCityOptions;
window.fillLpzOptions = fillLpzOptions;
window.prefillLabData = prefillLabData;
window.suggestVisitDate = () => alert("Логістика підключена з logistics.js");