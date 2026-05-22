// Тягнемо дані з Google Sheets (Моріон)
async function fetchPartners() {
  const url = "https://docs.google.com/spreadsheets/d/1CUEcXgBAUIKvg0k2JePbhSH-_S01HcEi/gviz/tq?tqx=out:json&sheet=sheet1";
  const res = await fetch(url);
  const text = await res.text();
  const json = JSON.parse(text.substr(47).slice(0, -2));
  return json.table.rows.map(r => {
    let grossRaw = r.c[3]?.v;
    let grossRate = parseFloat(grossRaw);
    if (isNaN(grossRate)) grossRate = 0;
    grossRate = grossRate * 100;
    return {
      name: r.c[0]?.v || "",
      turnover: parseFloat(r.c[1]?.v) || 0,
      msTable: parseFloat(r.c[2]?.v) || 0,
      grossRate: grossRate,
      ei: parseFloat(r.c[4]?.v) || 0,
      tt: parseInt(r.c[5]?.v) || 0
    };
  }).filter(p => p.name && !p.name.includes("Rating"));
}

// Класифікація партнера
function classifyPartner(p, allPartners) {
  const avgHistory = allPartners.reduce((s,x)=>s+(x.history||0),0) / allPartners.length;
  const avgMsr = allPartners.reduce((s,x)=>s+(x.msr||0),0) / allPartners.length;

  const highHistory = p.history >= avgHistory;
  const highMsr = p.msr >= avgMsr;

  if (highHistory && highMsr) return {type:"Життєво важливий", cls:"vital"};
  if (!highHistory && highMsr) return {type:"Цінний", cls:"valuable"};
  if (highHistory && !highMsr) return {type:"Прийнятний", cls:"acceptable"};
  return {type:"Заважаючий", cls:"interfering"};
}

// Формула планів
function formatPlan(value, history) {
  const roundedValue = Math.ceil(value);
  const delta = history > 0 ? Math.ceil(((value - history) / history * 100)) : 0;
  const sign = delta >= 0 ? "+" : "";
  return `${roundedValue} / ${sign}${delta}%`;
}
