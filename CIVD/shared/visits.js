// ==========================
// Робота з IndexedDB (labsDB)
// ==========================
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = e => {
      const db = e.target.result;
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

    request.onsuccess = e => resolve(e.target.result);
    request.onerror = e => reject(e.target.error);
  });
}

async function getAllFromDB(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = e => reject(e.target.error);
  });
}

async function putToDB(storeName, item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.put(item);
    tx.oncomplete = () => resolve(true);
    tx.onerror = e => reject(e.target.error);
  });
}

// ==========================
// CRUD для візитів
// ==========================
async function loadVisits() {
  return await getAllFromDB("visits");
}

async function saveVisit(visit) {
  if (!visit.id) {
    visit.id = `${visit.labId}_${visit.date}_${Date.now()}`;
  }
  await putToDB("visits", visit);
  return visit;
}

async function updateVisitStatus(visitId, status) {
  const visits = await loadVisits();
  const v = visits.find(x => x.id === visitId);
  if (!v) return;
  v.status = status;
  await saveVisit(v);
}

async function cancelVisit(visitId) {
  await updateVisitStatus(visitId, "відмінено");
}

async function completeVisit(visitId) {
  await updateVisitStatus(visitId, "проведено");
}

async function rescheduleVisit(visitId, newDate) {
  const visits = await loadVisits();
  const v = visits.find(x => x.id === visitId);
  if (!v) return;
  v.date = newDate;
  v.status = "перенесено";
  await saveVisit(v);
}

async function createManualVisit({ labId, labName, date, devices = [] }) {
  const newVisit = {
    id: `${labId}_${date}_${Date.now()}`,
    labId,
    labName,
    date,
    devices,
    notes: "",
    status: "заплановано"
  };
  await saveVisit(newVisit);
  return newVisit;
}

// ==========================
// Ініціалізація FullCalendar
// ==========================
document.addEventListener("DOMContentLoaded", async () => {
  const calendarEl = document.getElementById("calendar");

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listYear'
    },
    editable: true,
    events: async (fetchInfo, successCallback, failureCallback) => {
      try {
        const visits = await loadVisits();
        const events = visits.map(v => ({
          id: v.id,
          title: `${v.labName || v.labId} (${v.status})`,
          start: v.date,
          extendedProps: { ...v }
        }));
        successCallback(events);
      } catch (err) {
        failureCallback(err);
      }
    },
    eventClick: handleEventClick,
    eventDrop: handleEventDrop
  });

  calendar.render();

  // зберігаємо глобально для оновлення
  window.calendarInstance = calendar;
});

// ==========================
// Обробники подій
// ==========================
function handleEventClick(info) {
  currentVisitId = info.event.id;
  document.getElementById("visitMenuInfo").innerHTML = `
    <strong>${info.event.title}</strong><br>
    Дата: ${new Date(info.event.start).toLocaleDateString("uk-UA")}
  `;
  document.getElementById("visitMenu").classList.add("show");
}

async function handleEventDrop(info) {
  await rescheduleVisit(info.event.id, info.event.start.toISOString());
  window.calendarInstance.refetchEvents();
}

// ==========================
// Завершення візиту
// ==========================
async function processVisitReport(visitId, reportText) {
  const visits = await loadVisits();
  const v = visits.find(x => x.id === visitId);
  if (!v) return;
  v.status = "проведено";
  v.notes = reportText;
  await saveVisit(v);
  document.getElementById("visitMenu").classList.remove("show");
  window.calendarInstance.refetchEvents();
}
