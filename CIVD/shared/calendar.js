let currentVisitId = null;
let currentVisit = null;
let currentLabId = null;
let calendar = null;
let map = null;

// === IndexedDB helpers ===
async function loadVisits() { return await getAllFromDB("visits"); }
async function saveVisit(visit) { await putToDB("visits", visit); }
async function loadLabCards() { return await getAllFromDB("labs"); }
async function saveLabCard(lab) { await putToDB("labs", lab); }

// === Допоміжні функції ===
function statusColor(status) {
  switch ((status || "").toLowerCase()) {
    case "в процесі": return "#ff9800";
    case "відмінено": return "#9e9e9e";
    case "перенесено": return "#2196f3";
    case "проведено": return "#4caf50";
    default: return "#2196f3";
  }
}
function filterByStatus(status) {
  const s = (status || "заплановано").toLowerCase();
  if (s === "заплановано") return document.getElementById("filterPlanned").checked;
  if (s === "в процесі") return document.getElementById("filterInProgress").checked;
  if (s === "відмінено") return document.getElementById("filterCancelled").checked;
  if (s === "перенесено") return document.getElementById("filterRescheduled").checked;
  if (s === "проведено") return document.getElementById("filterDone").checked;
  return true;
}
function eventsFromVisits(visits) {
  return visits
    .filter(v => filterByStatus(v.status))
    .map(v => ({
      id: v.id,
      title: `${v.labName} — ${v.status || "заплановано"}`,
      start: v.date + "T08:00",
      end: v.date + "T09:00", // тривалість 1 година
      backgroundColor: statusColor(v.status),
      borderColor: statusColor(v.status),
      extendedProps: { visit: v }
    }));
}

// === Меню візиту ===
async function showVisitMenu(visit) {
  currentVisitId = visit.id;
  currentVisit = visit;

  document.getElementById("visitMenuInfo").innerHTML = `
    <p><strong>${visit.labName}</strong></p>
    <p>Дата: ${visit.date}</p>
    <p>Статус: ${visit.status || "заплановано"}</p>
    ${visit.tasks ? `<p>Завдання:</p><ul>${visit.tasks.map(t => `<li>${t.action || t.title}</li>`).join("")}</ul>` : ""}
  `;

  document.querySelector("#visitMenu .btn-start").onclick = () => onStartVisit();
  document.querySelector("#visitMenu .btn-cancel").onclick = () => onCancelVisit();
  document.querySelector("#visitMenu .btn-reschedule").onclick = () => rescheduleVisit(currentVisitId);
  document.querySelector("#visitMenu .btn-edit").onclick = () => onEditLabCard();

  document.getElementById("visitMenu").classList.add("show");
}
function hideVisitMenu() { document.getElementById("visitMenu").classList.remove("show"); }
// === Дії з візитами ===

async function confirmStartVisit() {
  const visits = await loadVisits();
  const v = visits.find(x => x.id === currentVisitId);
  if (!v) return;
  v.status = "в процесі";
  await saveVisit(v);
  closeVisitModal();
  hideVisitMenu();
  await rerenderCalendar();
}
async function confirmReschedule(visitId) {
  const visits = await loadVisits();
  const v = visits.find(x => x.id === visitId);
  if (!v) return;
  const newDate = document.getElementById("newVisitDate").value;
  if (!newDate) return;
  v.date = newDate;
  v.status = "перенесено";
  await saveVisit(v);
  closeRescheduleModal();
  hideVisitMenu();
  await rerenderCalendar();
}

// === Календар ===
async function rerenderCalendar() { calendar.refetchEvents(); }

document.addEventListener("DOMContentLoaded", async () => {
  initMap();

  const calendarEl = document.getElementById("calendar");
  calendar = new FullCalendar.Calendar(calendarEl, {
  initialView: "timeGridWeek",
  locale: "uk",
  headerToolbar: {
    left: "prev,next today",
    center: "title",
    right: "dayGridMonth,timeGridWeek,timeGridDay,listMonth,multiMonthYear"
  },
  weekends: false,
  businessHours: {
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: "08:00",
    endTime: "19:00"
  },
  slotDuration: "01:00",
  slotMinTime: "08:00",
  slotMaxTime: "19:00",
  slotLabelFormat: {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false // 🔑 вимикає 12-годинний формат
  },
  editable: true,
  events: async (fetchInfo, successCallback, failureCallback) => {
    try {
      const visits = await loadVisits();
      successCallback(eventsFromVisits(visits));
    } catch (err) {
      failureCallback(err);
    }
  },
  eventClick: info => showVisitMenu(info.event.extendedProps.visit),
  eventDrop: async info => {
    const v = info.event.extendedProps.visit;
    v.date = info.event.start.toISOString();
    v.status = "перенесено";
    await saveVisit(v);
    calendar.refetchEvents();
  },
  datesSet: () => updateMapFromCalendar()
});


  calendar.render();
  updateMapFromCalendar();

  document.getElementById("buildRouteBtn").addEventListener("click", async () => {
    await buildRouteForDay();
    document.getElementById("map").scrollIntoView({ behavior: "smooth" });
  });
});


async function onStartVisit() {
  const visits = await loadVisits();
  const v = visits.find(x => x.id === currentVisitId);
  if (!v) return;

  const labCards = await loadLabCards();
  const lab = labCards.find(l => l.id === v.labId || l.edrpou === v.labId);
  if (!lab) return;

  currentVisit = v;
  currentLabId = lab.id;

  // Формуємо модалку
  let headerHtml = `
    <h3>Візит: ${lab.partner}</h3>
    <p>Дата: ${v.date}</p>
  `;
  let buttonsHtml = "<div class='tab-buttons'>";
  let contentsHtml = "";

    if ((lab.devices || []).length > 0) {
    openTab(0);
    }

  (lab.devices || []).forEach((device, idx) => {
    const reagentsFromVisit = (v.tasks || [])
      .filter(t => t.device === device.device && t.taskType === "reagents");

    buttonsHtml += `<button onclick="openTab(${idx})" id="tabBtn_${idx}">${device.device}</button>`;
    contentsHtml += `
      <div class="tab-content" id="tab_${idx}">
        <label>Кількість аналізів на день:
          <input type="number" id="testsPerDay_${idx}" value="${device.testCount || 0}">
        </label>

        <h4>Реагенти</h4>
        <table>
          <tr><th>Завдання</th><th>Домовленість</th><th>Факт кількість</th><th>Факт дата</th></tr>
          ${reagentsFromVisit.map((t, j) => {
            const parsed = parseReagentAction(t.action);
            const info = device.reagentsInfo?.[parsed.name] || {};
            return `
              <tr>
                <td>${parsed.name} — ${v.date} (потреба: ${parsed.neededQuantity})</td>
                <td><input type="number" id="agreement_${idx}_${j}" value="${parsed.neededQuantity}"></td>
                <td><input type="number" id="factQty_${idx}_${j}" value="${info.lastOrderCount || 0}"></td>
                <td><input type="date" id="factDate_${idx}_${j}" value="${info.lastOrderDate || ""}"></td>
              </tr>
            `;
          }).join("")}
        </table>

        <h4>Сервіс</h4>
        <table>
          <tr><th></th><th>Вид сервісу</th><th>Дата</th></tr>
          <tr>
            <td>План</td>
            <td><input type="text" id="servicePlanType_${idx}" value="${device.workType || ''}"></td>
            <td><input type="date" id="servicePlanDate_${idx}" value="${(v.tasks.find(t => t.device === device.device && t.action === 'Сервіс')?.date) || ''}"></td>
          </tr>
          <tr>
            <td>Домовленість</td>
            <td><input type="text" id="serviceAgreementType_${idx}" value=""></td>
            <td><input type="date" id="serviceAgreementDate_${idx}" value=""></td>
          </tr>
          <tr>
            <td>Факт</td>
            <td><input type="text" id="serviceFactType_${idx}" value="${device.workType || ''}"></td>
            <td><input type="date" id="serviceFactDate_${idx}" value="${device.lastService || ''}"></td>
          </tr>
        </table>
      </div>
    `;
  });

  document.getElementById("visitModalTabs").innerHTML = headerHtml + buttonsHtml + contentsHtml;
  document.getElementById("visitModal").style.display = "block";
  openTab(0);
}

async function submitVisitData() {
  const labCards = await loadLabCards();
  const lab = labCards.find(l => l.id === currentLabId);
  if (!lab) return;

  (lab.devices || []).forEach((device, idx) => {
    // кількість аналізів на день
    device.testCount = parseInt(document.getElementById(`testsPerDay_${idx}`).value) || 0;

    // реагенти з поточного візиту
    const reagentsFromVisit = (currentVisit.tasks || [])
      .filter(t => t.device === device.device && t.taskType === "reagents");

    reagentsFromVisit.forEach((task, j) => {
      const agreementQty = parseInt(document.getElementById(`agreement_${idx}_${j}`).value) || 0;
      const factQty = parseInt(document.getElementById(`factQty_${idx}_${j}`).value) || 0;
      const factDate = document.getElementById(`factDate_${idx}_${j}`).value || "";

      // оновлюємо інформацію по реагенту у картці
      if (!device.reagentsInfo) device.reagentsInfo = {};
      device.reagentsInfo[task.reagentName || task.action] = {
        lastOrderCount: factQty,
        lastOrderDate: factDate
      };

      // оновлюємо саму задачу у візиті
      task.agreement = { quantity: agreementQty };
      task.fact = { quantity: factQty, date: factDate };
    });

    // сервіс
    device.service = {
      plan: {
        type: document.getElementById(`servicePlanType_${idx}`).value || "",
        date: document.getElementById(`servicePlanDate_${idx}`).value || ""
      },
      agreement: {
        type: document.getElementById(`serviceAgreementType_${idx}`).value || "",
        date: document.getElementById(`serviceAgreementDate_${idx}`).value || ""
      },
      fact: {
        type: document.getElementById(`serviceFactType_${idx}`).value || "",
        date: document.getElementById(`serviceFactDate_${idx}`).value || ""
      }
    };
    device.lastService = device.service.fact.date;
  });

  // оновлюємо статус візиту
  currentVisit.status = "проведено";

  // зберігаємо лабораторію та візит у IndexedDB
  await saveLabCard(lab);
  await saveVisit(currentVisit);

  // перерахунок майбутніх візитів
  await recalculateSchedule(lab.id);

  closeVisitModal();
  hideVisitMenu();
  await rerenderCalendar();
}
async function recalculateSchedule(labId) {
  const labCards = await loadLabCards();
  const lab = labCards.find(l => l.id === labId);
  if (!lab) return;

  (lab.devices || []).forEach(device => {
    // реагенти: кожні 3 місяці
    Object.keys(device.reagentsInfo || {}).forEach(name => {
      const info = device.reagentsInfo[name];
      if (info.lastOrderDate) {
        const nextDate = addMonths(info.lastOrderDate, 3);
        const newVisit = {
          id: `${lab.id}_${nextDate}_${Date.now()}`,
          labId: lab.id,
          labName: lab.partner,
          date: nextDate,
          tasks: [{ device: device.device, action: `Замов реагент — ${name}`, taskType: "reagents" }],
          status: "заплановано"
        };
        putToDB("visits", newVisit);
      }
    });

    // сервіс: кожні 6 місяців
    if (device.lastService) {
      const nextServiceDate = addMonths(device.lastService, 6);
      const newVisit = {
        id: `${lab.id}_${nextServiceDate}_${Date.now()}`,
        labId: lab.id,
        labName: lab.partner,
        date: nextServiceDate,
        tasks: [{ device: device.device, action: "Сервіс", taskType: "service" }],
        status: "заплановано"
      };
      putToDB("visits", newVisit);
    }
  });
}
function closeVisitModal() { 
  document.getElementById("visitModal").style.display = "none"; 
}


async function onCancelVisit() { 
  const visits = await loadVisits();
  const v = visits.find(x => x.id === currentVisitId);
  if (!v) return;
  v.status = "відмінено";
  await saveVisit(v);
  hideVisitMenu();
  await rerenderCalendar();
}

function onRescheduleVisit() {
  rescheduleVisit(currentVisitId);
}

async function onEditLabCard() {
  const visits = await loadVisits();
  const v = visits.find(x => x.id === currentVisitId);
  if (!v) return;
  // зберігаємо ID лабораторії у sessionStorage (щоб уникнути LocalStorage)
  sessionStorage.setItem("editLabCard", JSON.stringify({ labId: v.labId }));
  window.location.href = "../labcards/labcard.html";
}

async function rerenderCalendar() {
  calendar.refetchEvents();
}

function renderVisit(v) {
  return `
    ${v.date} 🕑 ${v.time || ""} — Лабораторія: ${v.institution || v.labId} (${v.status})
  `;
}
function updateMap(visits) {
  visits.forEach(v => {
    if (v.lat && v.lng) {
      L.marker([v.lat, v.lng]).addTo(map)
        .bindPopup(`${v.institution || "Лабораторія"}<br>${v.date}`);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const visits = await loadVisits();
  const calendarEl = document.getElementById("calendar");
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "uk",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay,listMonth"
    },
    events: eventsFromVisits(visits),
    eventClick: info => showVisitMenu(info.event.extendedProps.visit)
  });
  calendar.render();

  // Експортуємо в window
  window.hideVisitMenu = hideVisitMenu;
  window.onStartVisit = onStartVisit;
  window.onCancelVisit = onCancelVisit;
  window.onRescheduleVisit = onRescheduleVisit;
  window.onEditLabCard = onEditLabCard;
  window.rerenderCalendar = rerenderCalendar;
});

async function rescheduleVisit(visitId) {
  const existing = document.getElementById("rescheduleModal");
  if (existing) existing.remove();

  const visits = await loadVisits();
  const v = visits.find(x => x.id === visitId);
  if (!v) return;

  const modalHtml = `
    <div id="rescheduleModal" class="modal">
      <div class="modal-content">
        <span class="close" onclick="closeRescheduleModal()">&times;</span>
        <h3>Перенесення візиту</h3>
        <label>Оберіть нову дату:
          <input type="date" id="newVisitDate" value="${v.date}">
        </label>
        <div class="modal-actions" style="margin-top:12px;text-align:right;">
          <button onclick="confirmReschedule('${visitId}')">✅ Зберегти</button>
          <button onclick="closeRescheduleModal()">❌ Скасувати</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
  document.getElementById("rescheduleModal").style.display = "block";
}

async function confirmReschedule(visitId) {
  const visits = await loadVisits();
  const v = visits.find(x => x.id === visitId);
  if (!v) return;

  const newDate = document.getElementById("newVisitDate").value;
  if (!newDate) return;

  v.date = newDate;
  v.status = "перенесено";
  await saveVisit(v);

  closeRescheduleModal();
  hideVisitMenu();
  await rerenderCalendar();
}

function closeRescheduleModal() {
  const modal = document.getElementById("rescheduleModal");
  if (modal) modal.remove();
}
async function updateMapFromCalendar() {
  const visits = await loadVisits();
  const labs = await loadLabCards();

  // Поточний діапазон календаря
  const view = calendar.view;
  const start = view.activeStart;
  const end = view.activeEnd;

  // Візити у діапазоні
  const visibleVisits = visits.filter(v => {
    const d = new Date(v.date);
    return d >= start && d < end;
  });

  const labIds = [...new Set(visibleVisits.map(v => v.labId))];
  const labsWithVisits = labs.filter(l => labIds.includes(l.id));

  // Очистити карту від маркерів і маршрутів
  map.eachLayer(layer => {
    if (!(layer instanceof L.TileLayer)) {
      map.removeLayer(layer);
    }
  });

  // Додати маркери лабораторій
  labsWithVisits.forEach(lab => {
    if (lab.lat && lab.lng) {
      // знайти найближчий візит для цієї лабораторії
      const labVisits = visibleVisits.filter(v => v.labId === lab.id);
      let nearestVisit = null;
      if (labVisits.length > 0) {
        nearestVisit = labVisits.reduce((a, b) =>
          new Date(a.date) < new Date(b.date) ? a : b
        );
      }

      let popupHtml = `<strong>${lab.partner}</strong><br>ID: ${lab.id}`;
      if (nearestVisit) {
        popupHtml += `<br>📅 ${nearestVisit.date}<br>Статус: ${nearestVisit.status}`;
      }

      L.marker([lab.lat, lab.lng])
        .addTo(map)
        .bindPopup(popupHtml);
    }
  });

  // Кнопка маршруту тільки у режимі "день"
  const routeBtn = document.getElementById("buildRouteBtn");
  routeBtn.style.display = (view.type === "timeGridDay") ? "block" : "none";
}

function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0,10);
}

// Ініціалізація карти
function initMap() {
  map = L.map("map").setView([50.45, 30.52], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);
}

// Оновлення карти відповідно до календаря
async function updateMapFromCalendar() {
  const visits = await loadVisits();
  const labs = await loadLabCards();

  const view = calendar.view;
  const start = view.activeStart;
  const end = view.activeEnd;

  // Візити у поточному діапазоні
  const visibleVisits = visits.filter(v => {
    const d = new Date(v.date);
    return d >= start && d < end;
  });

  const labIds = [...new Set(visibleVisits.map(v => v.labId))];
  const labsWithVisits = labs.filter(l => labIds.includes(l.id));

  // Очистити карту від маркерів і маршрутів
  map.eachLayer(layer => {
    if (!(layer instanceof L.TileLayer)) {
      map.removeLayer(layer);
    }
  });

  // Додати маркери лабораторій
  labsWithVisits.forEach(lab => {
    if (lab.lat && lab.lng) {
      const labVisits = visibleVisits.filter(v => v.labId === lab.id);
      let nearestVisit = null;
      if (labVisits.length > 0) {
        nearestVisit = labVisits.reduce((a, b) =>
          new Date(a.date) < new Date(b.date) ? a : b
        );
      }

      let popupHtml = `<strong>${lab.partner}</strong><br>ID: ${lab.id}`;
      if (nearestVisit) {
        popupHtml += `<br>📅 ${nearestVisit.date}<br>Статус: ${nearestVisit.status}`;
      }

      L.marker([lab.lat, lab.lng])
        .addTo(map)
        .bindPopup(popupHtml);
    }
  });

  // Кнопка маршруту тільки у режимі "день"
  const routeBtn = document.getElementById("buildRouteBtn");
  routeBtn.style.display = (view.type === "timeGridDay") ? "block" : "none";
}
 // Ініціалізація карти
function initMap() {
  map = L.map("map").setView([50.45, 30.52], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);
}

// Оновлення карти відповідно до календаря
async function updateMapFromCalendar() {
  const visits = await loadVisits();
  const labs = await loadLabCards();

  const view = calendar.view;
  const start = view.activeStart;
  const end = view.activeEnd;

  // Візити у поточному діапазоні
  const visibleVisits = visits.filter(v => {
    const d = new Date(v.date);
    return d >= start && d < end;
  });

  const labIds = [...new Set(visibleVisits.map(v => v.labId))];
  const labsWithVisits = labs.filter(l => labIds.includes(l.id));

  // Очистити карту від маркерів і маршрутів
  map.eachLayer(layer => {
    if (!(layer instanceof L.TileLayer)) {
      map.removeLayer(layer);
    }
  });

  // Додати маркери лабораторій
  labsWithVisits.forEach(lab => {
    if (lab.lat && lab.lng) {
      const labVisits = visibleVisits.filter(v => v.labId === lab.id);
      let nearestVisit = null;
      if (labVisits.length > 0) {
        nearestVisit = labVisits.reduce((a, b) =>
          new Date(a.date) < new Date(b.date) ? a : b
        );
      }

      let popupHtml = `<strong>${lab.partner}</strong><br>ID: ${lab.id}`;
      if (nearestVisit) {
        popupHtml += `<br>📅 ${nearestVisit.date}<br>Статус: ${nearestVisit.status}`;
      }

      L.marker([lab.lat, lab.lng])
        .addTo(map)
        .bindPopup(popupHtml);
    }
  });

  // Кнопка маршруту тільки у режимі "день"
  const routeBtn = document.getElementById("buildRouteBtn");
  routeBtn.style.display = (view.type === "timeGridDay") ? "block" : "none";
}

document.addEventListener("DOMContentLoaded", async () => {
  const visits = await loadVisits();
  const calendarEl = document.getElementById("calendar");
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "uk",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay,listMonth"
    },
    events: eventsFromVisits(visits),
    eventClick: info => showVisitMenu(info.event.extendedProps.visit),
    datesSet: () => updateMapFromCalendar() // 🔑 оновлюємо карту при зміні вигляду
  });
  calendar.render();

  // перший рендер карти
  updateMapFromCalendar();
});


  // Побудова маршруту
  async function buildRouteForDay() {
    if (calendar.view.type !== "timeGridDay") return;

    navigator.geolocation.getCurrentPosition(async pos => {
      const startCoords = [pos.coords.latitude, pos.coords.longitude];

      const visits = await loadVisits();
      const today = calendar.view.activeStart;
      const tomorrow = calendar.view.activeEnd;

      const dayVisits = visits.filter(v => {
        const d = new Date(v.date);
        return d >= today && d < tomorrow;
      });

      const labs = await loadLabCards();
      const labIds = [...new Set(dayVisits.map(v => v.labId))];
      const labsForRoute = labs.filter(l => labIds.includes(l.id));

      const waypoints = labsForRoute
        .filter(l => l.lat && l.lng)
        .map(l => [l.lat, l.lng]);

      const routePoints = [startCoords, ...waypoints, startCoords];
      const coordsStr = routePoints.map(p => p[1] + "," + p[0]).join(";");

      const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0].geometry;
        const geo = L.geoJSON(route, { color: "blue" }).addTo(map);
        map.fitBounds(geo.getBounds());
      }
    }, err => {
      alert("Не вдалося отримати координати пристрою");
    });
  }

  // Прив’язати кнопку
  document.getElementById("buildRouteBtn").addEventListener("click", buildRouteForDay);

  // Викликати initMap при завантаженні
  document.addEventListener("DOMContentLoaded", initMap);
  // Оновлювати карту при зміні вигляду календаря
document.getElementById("buildRouteBtn").addEventListener("click", async () => {
  await buildRouteForDay();
  document.getElementById("map").scrollIntoView({behavior:"smooth"});
});
function eventsFromVisits(visits) {
  return visits.map((v, idx) => {
    let startTime = "08:00";
    if (idx === 1) startTime = "10:00";
    if (idx === 2) startTime = "12:00";
    return {
      title: v.labName,
      start: v.date + "T" + startTime,
      extendedProps: { visit: v }
    };
  });
}
function renderRemindersForVisit(visit) {
  let reminders = [];
  (visit.tasks || []).forEach(t => {
    if (t.taskType === "reagents") reminders.push("💡 Не забудь прайс");
    if (t.taskType === "tender") reminders.push("📑 Візьми потрібні КП");
    if (t.taskType === "service") reminders.push("🛠️ Візьми форму виклику сервісного інженера");
  });
  return reminders.join("<br>");
}
