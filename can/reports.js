/**
 * report.js — Модуль генерації ручних та автоматичних звітів
 */

// Головна функція, яка запускається при кліку на картку
function initProcessReport(processId) {
  // Припускаємо, що всі процеси доступні у глобальній змінній (наприклад, ALL_PROCESSES або через пошук)
  // Якщо у тебе дані завантажені в processData, адаптуй цей рядок:
  const currentProcess = typeof processData !== 'undefined' && processData.id === processId 
    ? processData 
    : (typeof allProcesses !== 'undefined' ? allProcesses.find(p => p.id === processId) : null);

  if (!currentProcess) {
    alert("Дані процесу не знайдені.");
    return;
  }

  const reportHTML = generateProcessReportHTML(currentProcess);
  showReportModal(reportHTML, currentProcess);
}

// 1. ГЕНЕРАЦІЯ HTML-ВМІСТУ ЗВІТУ
function generateProcessReportHTML(proc) {
  const tasks = proc.tasks || [];
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'done').length;
  const inProgressTasks = tasks.filter(t => t.status === 'inprogress').length;
  
  // Рахуємо загальний прогрес процесу
  const processPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  
  // Збираємо унікальних учасників та їхні ролі
  const members = {};
  tasks.forEach(t => {
    if (t.username) {
      members[t.username] = t.role || "Виконавець";
    }
  });

  // Формуємо таблицю задач для звіту
  let tasksRows = "";
  tasks.forEach(t => {
    let statusText = t.status === 'done' ? "Виконано" : t.status === 'inprogress' ? "В процесі" : "В черзі";
    let statusColor = t.status === 'done' ? "#10b981" : t.status === 'inprogress' ? "#f59e0b" : "#64748b";
    
    tasksRows += `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">${t.title || '—'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">${t.username || '—'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align:center;">${t.start || '—'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align:center;">${t.deadline || '—'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align:center; color: white; background-color: ${statusColor}; font-weight: bold; font-size: 11px; border-radius: 4px;">${statusText}</td>
      </tr>
    `;
  });

  // Базовий шаблон звіту
  return `
    <div id="print-report-area" style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 10px;">
      <h2 style="color: #0f172a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-bottom: 12px;">
        📊 Звіт по процесу: ${proc.title || 'Без назви'}
      </h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 13px;">
        <tr>
          <td style="padding: 4px 0; font-weight: bold; width: 150px;">Старт процесу:</td>
          <td style="padding: 4px 0;">${proc.start || '—'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-weight: bold;">Фінальний дедлайн:</td>
          <td style="padding: 4px 0;">${proc.deadline || '—'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-weight: bold;">Загальний прогрес:</td>
          <td style="padding: 4px 0; font-weight: bold; color: #3b82f6;">${processPercent}%</td>
        </tr>
      </table>

      <h4 style="margin: 10px 0 5px 0; color: #1e293b;">👥 Залучена команда:</h4>
      <ul style="margin-top: 0; padding-left: 20px; font-size: 13px;">
        ${Object.keys(members).length > 0 
          ? Object.entries(members).map(([name, role]) => `<li><strong>${name}</strong> — ${role}</li>`).join('')
          : '<li>Учасники не вказані</li>'}
      </ul>

      <h4 style="margin: 15px 0 5px 0; color: #1e293b;">📋 Стан виконання задач:</h4>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px;">
        <thead>
          <tr style="background-color: #f1f5f9; text-align: left;">
            <th style="border: 1px solid #cbd5e1; padding: 6px;">Задача</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px;">Відповідальний</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align:center;">Початок</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align:center;">Дедлайн</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align:center;">Статус</th>
          </tr>
        </thead>
        <tbody>
          ${tasksRows || '<tr><td colspan="5" style="text-align:center; padding: 10px;">Задачі відсутні</td></tr>'}
        </tbody>
      </table>
      
      <p style="font-size: 11px; color: #64748b; text-align: right; margin-top: 20px;">
        Звіт згенеровано автоматично: ${new Date().toLocaleDateString('uk-UA')} о ${new Date().toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit'})}
      </p>
    </div>
  `;
}

// 2. ПОКАЗ МОДАЛЬНОГО ВІКНА ПОВЕРХ СТОРІНКИ
function showReportModal(htmlContent, proc) {
  // Видаляємо старе вікно, якщо воно залишилось
  const oldModal = document.getElementById("reportModal");
  if (oldModal) oldModal.remove();

  const modal = document.createElement("div");
  modal.id = "reportModal";
  modal.className = "report-modal-overlay";

  modal.innerHTML = `
    <div class="report-modal-window">
      <div class="report-modal-header">
        <h3>Прев'ю звіту</h3>
        <button class="report-modal-close" onclick="document.getElementById('reportModal').remove()">&times;</button>
      </div>
      <div class="report-modal-actions">
        <button onclick="copyReportToClipboard()">📋 Копіювати текст</button>
        <button onclick="exportReportToWord('${proc.title || 'Проект'}')">📝 Завантажити Word</button>
        <button onclick="sendReportByEmail('${proc.title || 'Проект'}')">✉️ Надіслати поштою</button>
      </div>
      <div class="report-modal-body">
        ${htmlContent}
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

// 3. ДІЯ: КОПІЮВАННЯ В БУФЕР ОБМІНУ
function copyReportToClipboard() {
  const area = document.getElementById("print-report-area");
  if (!area) return;
  
  // Копіюємо як чистий текст (можна адаптувати для копіювання з HTML форматуванням)
  navigator.clipboard.writeText(area.innerText)
    .then(() => alert("Текст звіту успішно скопійовано!"))
    .catch(err => alert("Помилка копіювання: " + err));
}

// 4. ДІЯ: ЕКСПОРТ У WORD (Геніальний трюк з інлайн XML-HTML)
function exportReportToWord(filename) {
  const area = document.getElementById("print-report-area");
  if (!area) return;

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><title>Report</title></head>
    <body>${area.innerHTML}</body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Звіт_${filename.replace(/[/\\?%*:|"<>\s]/g, '_')}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 5. ДІЯ: ВИКЛИК ПОШТОВОГО АГЕНТА (mailto:) АБО ПІДГОТОВКА ДО СЕРВЕРА
function sendReportByEmail(filename) {
  const area = document.getElementById("print-report-area");
  if (!area) return;

  const subject = encodeURIComponent(`Звіт по процесу: ${filename}`);
  // Для поштових клієнтів (типу Outlook/Thunderbird) через mailto краще передавати чистий текст, бо HTML в посиланнях обрізається
  const body = encodeURIComponent(area.innerText);

  // Відкриває встановлений поштовий клієнт за замовчуванням
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}