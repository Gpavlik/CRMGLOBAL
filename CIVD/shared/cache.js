async function initCache() {
  window.labsCache = await getAllFromDB("labs");
  window.visitsCache = await getAllFromDB("visits");
}

async function loadLabs() {
  window.labsCache = await getAllFromDB("labs");
  return window.labsCache;
}
async function loadVisits() {
  window.visitsCache = await getAllFromDB("visits");
  return window.visitsCache;
}

async function saveLabs(labs) {
  for (const lab of labs) await putToDB("labs", lab);
  window.labsCache = await getAllFromDB("labs");
}
async function saveVisits(visits) {
  for (const v of visits) await putToDB("visits", v);
  window.visitsCache = await getAllFromDB("visits");
}
