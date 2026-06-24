// ===== CONSTANTS =====
let appData = null;

const DUTY_NAMES = ['ล้างจาน', 'เก็บโต๊ะ', 'ทิ้งขยะ', 'กวาดพื้น', 'เช็ดตะแกรง'];
const ZONE_NAMES = ['ห้องครัว', 'ห้องนั่งเล่น', 'ห้องน้ำ'];
const STATUS_OPTIONS = ['ยังไม่ทำ', 'ทำแล้ว', 'เลื่อน', 'มีปัญหา'];
const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const THAI_MONTHS_LONG = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const SCHEDULE_START = '2026-06-23';
const SCHEDULE_END = '2026-09-07';
const TZ = 'Asia/Bangkok';

// ===== DATE UTILITIES (Central Functions) =====

/** Returns today's date string YYYY-MM-DD in Asia/Bangkok timezone */
function getToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // gives YYYY-MM-DD
}

/** Returns a Date object (midnight local) from a YYYY-MM-DD string */
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Compares two YYYY-MM-DD strings: -1, 0, 1 */
function cmpDate(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Is the given YYYY-MM-DD string today? */
function isToday(dateStr) {
  return dateStr === getToday();
}

/** Is today within a week's range? */
function isCurrentWeek(weekStart, weekEnd) {
  const today = getToday();
  return today >= weekStart && today <= weekEnd;
}

/** Has the week already ended without completion? */
function isOverdue(weekEnd, status) {
  const today = getToday();
  return today > weekEnd && status !== 'ทำแล้ว';
}

/** Is today within the overall schedule range? */
function isInScheduleRange() {
  const today = getToday();
  return today >= SCHEDULE_START && today <= SCHEDULE_END;
}

/** Get the week object for today */
function getCurrentWeek() {
  if (!appData) return null;
  const today = getToday();
  return appData.weeklySchedule.find(w => today >= w.weekStart && today <= w.weekEnd) || null;
}

/** Human-readable Thai date: "วันจันทร์ที่ 23 มิถุนายน 2569" */
function thaiDateFull(dateStr) {
  const d = parseDate(dateStr);
  const dayName = THAI_DAYS[d.getDay()];
  return `วัน${dayName}ที่ ${d.getDate()} ${THAI_MONTHS_LONG[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** Short Thai: "23 มิ.ย." */
function thaiDateShort(dateStr) {
  const d = parseDate(dateStr);
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]}`;
}

/** Medium Thai: "23 มิ.ย. 2569" */
function thaiDateMed(dateStr) {
  const d = parseDate(dateStr);
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** Thai day-of-week short */
function thaiDayShort(dateStr) {
  return THAI_DAYS[parseDate(dateStr).getDay()];
}

// ===== BADGES & LABELS =====

function getDutyBadge(duty) {
  return `<span class="duty-badge duty-${duty}">${duty}</span>`;
}
function getZoneBadge(zone) {
  return `<span class="zone-badge zone-${zone}">${zone}</span>`;
}
function getStatusBadge(status) {
  return `<span class="status-badge status-${status}">${status}</span>`;
}
function getTodayPill() {
  return `<span class="pill pill-today">📍 วันนี้</span>`;
}
function getCurrentWeekPill() {
  return `<span class="pill pill-week">📅 สัปดาห์นี้</span>`;
}
function getOverduePill() {
  return `<span class="pill pill-overdue">⚠️ เลยกำหนด</span>`;
}
function getOutOfRangePill() {
  return `<span class="pill pill-out">🚫 นอกช่วงตาราง</span>`;
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  setupNav();
  setupButtons();
  fetchData();
  // Refresh every minute to keep "today" accurate
  setInterval(() => {
    if (appData) {
      renderDashboard();
      if (document.getElementById('page-daily').classList.contains('active')) renderDailyTable();
      if (document.getElementById('page-weekly').classList.contains('active')) renderWeeklyTable();
    }
  }, 60000);
});

function setupNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const page = btn.dataset.page;
      document.getElementById('page-' + page).classList.add('active');
      if (page === 'summary') renderSummary();
      if (page === 'daily') renderDailyTable();
      if (page === 'weekly') renderWeeklyTable();
    });
  });
}

function setupButtons() {
  document.getElementById('btn-regen-daily').addEventListener('click', async () => {
    if (!confirm('สร้างตารางเวรครัวใหม่? ข้อมูลเดิมจะหายไป')) return;
    const res = await api('/api/regenerate-daily', 'POST');
    appData.dailySchedule = res.dailySchedule;
    renderDailyTable();
    renderDashboard();
    toast('สร้างตารางเวรครัวใหม่แล้ว ✅');
  });
  document.getElementById('btn-regen-weekly').addEventListener('click', async () => {
    if (!confirm('สร้างตารางรายสัปดาห์ใหม่? ข้อมูลเดิมจะหายไป')) return;
    const res = await api('/api/regenerate-weekly', 'POST');
    appData.weeklySchedule = res.weeklySchedule;
    renderWeeklyTable();
    renderDashboard();
    toast('สร้างตารางรายสัปดาห์ใหม่แล้ว ✅');
  });
  document.getElementById('btn-reset-all').addEventListener('click', async () => {
    if (!confirm('รีเซ็ตทุกอย่างและสร้างตารางใหม่ทั้งหมด? ข้อมูลทั้งหมดจะหายไป')) return;
    const res = await api('/api/reset', 'POST');
    appData = res.data;
    renderAll();
    toast('รีเซ็ตและสร้างตารางใหม่เรียบร้อย ✅');
  });
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
  document.getElementById('month-filter').addEventListener('change', renderDailyTable);
}

// ===== API =====
async function api(url, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return res.json();
}

async function fetchData() {
  appData = await api('/api/data');
  renderAll();
}

function renderAll() {
  renderDashboard();
  renderDailyTable();
  renderWeeklyTable();
}

// ===== DASHBOARD =====
function renderDashboard() {
  if (!appData) return;

  const today = getToday();
  const inRange = isInScheduleRange();
  const currentWeek = getCurrentWeek();
  const todayData = appData.dailySchedule.find(d => d.date === today);

  // --- Status banner ---
  const banner = document.getElementById('dash-status-banner');
  if (!inRange) {
    banner.innerHTML = `<div class="status-banner banner-out">
      🚫 วันนี้ <b>${thaiDateFull(today)}</b> อยู่<b>นอกช่วงตาราง</b> (23 มิ.ย. – 7 ก.ย. 2569)
    </div>`;
  } else {
    banner.innerHTML = `<div class="status-banner banner-in">
      📅 วันนี้: <b>${thaiDateFull(today)}</b>
    </div>`;
  }

  // --- Today date card ---
  document.getElementById('dash-date-display').textContent = inRange
    ? thaiDateFull(today)
    : thaiDateFull(today) + ' (นอกช่วงตาราง)';

  // --- Today kitchen duty ---
  const todayEl = document.getElementById('dash-today');
  if (!inRange || !todayData) {
    todayEl.innerHTML = `<span class="text-muted">ไม่มีข้อมูลวันนี้</span>`;
  } else {
    todayEl.innerHTML = '<div class="duty-list">' +
      appData.people.map(p =>
        `<div class="duty-list-row"><span class="duty-person">${p}</span>${getDutyBadge(todayData.assignments[p])}</div>`
      ).join('') + '</div>';
  }

  // --- This week's zones ---
  const weekEl = document.getElementById('dash-week');
  if (!currentWeek) {
    weekEl.innerHTML = `<span class="text-muted">ไม่มีข้อมูลสัปดาห์นี้</span>`;
  } else {
    weekEl.innerHTML = '<div class="duty-list">' +
      appData.rooms.map(r =>
        `<div class="duty-list-row"><span class="duty-person">${r}</span>${getZoneBadge(currentWeek.assignments[r])}</div>`
      ).join('') + '</div>';
  }

  // --- Counters ---
  document.getElementById('dash-total-days').textContent = appData.dailySchedule.length + ' วัน';
  document.getElementById('dash-total-weeks').textContent = appData.weeklySchedule.length + ' สัปดาห์';

  // --- Pending & overdue alerts ---
  const pending = [];
  const overdue = [];
  appData.weeklySchedule.forEach(week => {
    appData.rooms.forEach(room => {
      if (isOverdue(week.weekEnd, week.status[room])) {
        overdue.push({ week, room });
      } else if (isCurrentWeek(week.weekStart, week.weekEnd) && week.status[room] !== 'ทำแล้ว') {
        pending.push({ week, room });
      }
    });
  });

  const alertEl = document.getElementById('dash-alerts');
  let alertHtml = '';
  if (overdue.length > 0) {
    alertHtml += `<div class="alert alert-danger">
      <b>⚠️ เลยกำหนด ${overdue.length} รายการ:</b>
      <ul>${overdue.map(x => `<li>${x.room} — ${x.week.assignments[x.room]} (สัปดาห์ที่ ${x.week.weekNum}: ${thaiDateShort(x.week.weekStart)}–${thaiDateShort(x.week.weekEnd)}) — ${getStatusBadge(x.week.status[x.room])}</li>`).join('')}</ul>
    </div>`;
  }
  if (pending.length > 0) {
    alertHtml += `<div class="alert alert-warning">
      <b>📋 งานสัปดาห์นี้ที่ยังไม่เสร็จ ${pending.length} รายการ:</b>
      <ul>${pending.map(x => `<li>${x.room} — ${getZoneBadge(x.week.assignments[x.room])} — ${getStatusBadge(x.week.status[x.room])}</li>`).join('')}</ul>
    </div>`;
  }
  if (!alertHtml) {
    alertHtml = `<div class="alert alert-success">✅ ไม่มีงานค้างหรือเลยกำหนด</div>`;
  }
  alertEl.innerHTML = alertHtml;

  // --- Mini daily table (this week) ---
  const weekStart = currentWeek ? currentWeek.weekStart : today;
  const weekEnd = currentWeek ? currentWeek.weekEnd : today;
  const thisWeekDays = appData.dailySchedule.filter(d => d.date >= weekStart && d.date <= weekEnd);

  const dailyWeekEl = document.getElementById('dash-daily-week');
  if (thisWeekDays.length > 0) {
    dailyWeekEl.innerHTML = buildDailyMiniTable(thisWeekDays);
  } else {
    dailyWeekEl.innerHTML = '<p class="loading-text">ไม่มีข้อมูลสัปดาห์นี้ในช่วงตาราง</p>';
  }

  // --- Mini weekly table ---
  const weeklyEl = document.getElementById('dash-weekly-current');
  if (currentWeek) {
    weeklyEl.innerHTML = buildWeeklyMiniTable(currentWeek);
  } else {
    // Show next upcoming week if before schedule
    const nextWeek = appData.weeklySchedule.find(w => w.weekStart > today);
    if (nextWeek) {
      weeklyEl.innerHTML = `<p class="loading-text" style="margin-bottom:8px">สัปดาห์ถัดไป (${thaiDateShort(nextWeek.weekStart)}–${thaiDateShort(nextWeek.weekEnd)})</p>` + buildWeeklyMiniTable(nextWeek);
    } else {
      weeklyEl.innerHTML = '<p class="loading-text">ไม่มีข้อมูล</p>';
    }
  }
}

function buildDailyMiniTable(days) {
  const people = appData.people;
  const today = getToday();
  let html = '<table><thead><tr><th>วัน</th><th>วันที่</th>' +
    people.map(p => `<th>${p}</th>`).join('') + '</tr></thead><tbody>';
  for (const d of days) {
    const todayRow = isToday(d.date);
    const rowClass = todayRow ? 'today-row' : '';
    html += `<tr class="${rowClass}">`;
    html += `<td class="date-day-name">${thaiDayShort(d.date)}</td>`;
    html += `<td class="date-label">${thaiDateShort(d.date)}${todayRow ? ' ' + getTodayPill() : ''}</td>`;
    people.forEach(p => {
      html += `<td>${getDutyBadge(d.assignments[p])}</td>`;
    });
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function buildWeeklyMiniTable(week) {
  const rooms = appData.rooms;
  const today = getToday();
  let html = '<table><thead><tr><th>ห้อง</th><th>โซน</th><th>สถานะ</th></tr></thead><tbody>';
  rooms.forEach(r => {
    const overdue = isOverdue(week.weekEnd, week.status[r]);
    html += `<tr${overdue ? ' class="overdue-row"' : ''}>
      <td><b>${r}</b></td>
      <td>${getZoneBadge(week.assignments[r])}</td>
      <td>${getStatusBadge(week.status[r])}${overdue ? ' ' + getOverduePill() : ''}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  return html;
}

// ===== DAILY TABLE =====
function renderDailyTable() {
  if (!appData) return;
  const today = getToday();
  const filter = document.getElementById('month-filter').value;
  let days = appData.dailySchedule;
  if (filter) days = days.filter(d => d.date.startsWith(filter));

  const people = appData.people;
  let html = '<table><thead><tr>' +
    '<th>วัน</th><th>วันที่</th>' +
    people.map(p => `<th>${p}</th>`).join('') +
    '</tr></thead><tbody>';

  for (const d of days) {
    const todayRow = isToday(d.date);
    const isPast = d.date < today;
    const rowClass = todayRow ? 'today-row' : (isPast ? 'past-row' : '');
    html += `<tr class="${rowClass}" id="daily-row-${d.date}">`;
    html += `<td class="date-day-name">${thaiDayShort(d.date)}</td>`;
    html += `<td class="date-label" style="white-space:nowrap">
      ${thaiDateMed(d.date)}
      ${todayRow ? getTodayPill() : ''}
    </td>`;
    people.forEach(p => {
      html += `<td>
        <select class="cell-select" data-date="${d.date}" data-person="${p}" onchange="updateDailyDuty(this)">
          ${DUTY_NAMES.map(duty =>
            `<option value="${duty}"${d.assignments[p] === duty ? ' selected' : ''}>${duty}</option>`
          ).join('')}
        </select>
      </td>`;
    });
    html += '</tr>';
  }
  html += '</tbody></table>';
  document.getElementById('daily-table-wrap').innerHTML = html;

  // Auto-scroll to today
  if (!filter || filter === '') {
    setTimeout(() => {
      const todayEl = document.getElementById(`daily-row-${today}`);
      if (todayEl) todayEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }
}

async function updateDailyDuty(sel) {
  const date = sel.dataset.date;
  const person = sel.dataset.person;
  const duty = sel.value;
  const day = appData.dailySchedule.find(d => d.date === date);
  if (day) day.assignments[person] = duty;
  await api('/api/update-daily', 'POST', { date, person, duty });
  toast('บันทึกแล้ว ✅');
}

// ===== WEEKLY TABLE =====
function renderWeeklyTable() {
  if (!appData) return;
  const rooms = appData.rooms;
  const today = getToday();
  let html = '';

  for (const week of appData.weeklySchedule) {
    const isCurrent = isCurrentWeek(week.weekStart, week.weekEnd);
    const isPast = today > week.weekEnd;
    const hasOverdue = rooms.some(r => isOverdue(week.weekEnd, week.status[r]));

    let headerBg = '';
    let weekBadge = '';
    if (isCurrent) { headerBg = 'background:var(--success)'; weekBadge = getCurrentWeekPill(); }
    else if (hasOverdue) { headerBg = 'background:var(--danger)'; weekBadge = getOverduePill(); }
    else if (isPast) { headerBg = 'background:var(--text-muted)'; }

    const cardClass = isCurrent ? 'week-card current-week-card' : hasOverdue ? 'week-card overdue-week-card' : 'week-card';

    html += `<div class="${cardClass}" id="week-card-${week.weekNum}">
      <div class="week-card-header" style="${headerBg}">
        <span class="week-title">สัปดาห์ที่ ${week.weekNum} ${weekBadge}</span>
        <span class="week-dates">${thaiDateMed(week.weekStart)} – ${thaiDateMed(week.weekEnd)}</span>
      </div>
      <div class="week-card-body">
        <table>
          <thead>
            <tr>
              <th>ห้อง</th>
              <th>โซนที่รับผิดชอบ</th>
              <th>วันที่ทำจริง</th>
              <th>สถานะ</th>
              <th>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>`;

    rooms.forEach(room => {
      const overdue = isOverdue(week.weekEnd, week.status[room]);
      const rowClass = overdue ? 'overdue-row' : (isCurrent && week.status[room] !== 'ทำแล้ว' ? 'pending-row' : '');
      html += `<tr class="${rowClass}">
        <td><b>${room}</b>${overdue ? ' ' + getOverduePill() : ''}</td>
        <td>
          <select class="cell-select" data-week="${week.weekNum}" data-room="${room}" data-field="zone" onchange="updateWeekly(this)">
            ${ZONE_NAMES.map(z => `<option value="${z}"${week.assignments[room] === z ? ' selected' : ''}>${z}</option>`).join('')}
          </select>
        </td>
        <td>
          <input type="date" class="cell-input" style="min-width:130px"
            value="${week.actualDates[room] || ''}"
            data-week="${week.weekNum}" data-room="${room}" data-field="actualDate"
            onchange="updateWeekly(this)" />
        </td>
        <td>
          <select class="cell-select" data-week="${week.weekNum}" data-room="${room}" data-field="status" onchange="updateWeekly(this)">
            ${STATUS_OPTIONS.map(s => `<option value="${s}"${week.status[room] === s ? ' selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
        <td>
          <input type="text" class="cell-input" style="min-width:140px"
            placeholder="หมายเหตุ..."
            value="${week.notes[room] || ''}"
            data-week="${week.weekNum}" data-room="${room}" data-field="notes"
            onblur="updateWeekly(this)" />
        </td>
      </tr>`;
    });

    html += `</tbody></table></div></div>`;
  }

  document.getElementById('weekly-table-wrap').innerHTML = html;

  // Auto-scroll to current week
  setTimeout(() => {
    const currentWeek = getCurrentWeek();
    if (currentWeek) {
      const el = document.getElementById(`week-card-${currentWeek.weekNum}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);
}

async function updateWeekly(el) {
  const weekNum = parseInt(el.dataset.week);
  const room = el.dataset.room;
  const field = el.dataset.field;
  const value = el.value;
  const week = appData.weeklySchedule.find(w => w.weekNum === weekNum);
  if (week) {
    if (field === 'actualDate') week.actualDates[room] = value;
    else if (field === 'status') week.status[room] = value;
    else if (field === 'notes') week.notes[room] = value;
    else if (field === 'zone') week.assignments[room] = value;
  }
  await api('/api/update-weekly', 'POST', { weekNum, room, field, value });
  // Re-render weekly to update overdue states
  renderWeeklyTable();
  renderDashboard();
  toast('บันทึกแล้ว ✅');
}

// ===== SUMMARY =====
function renderSummary() {
  if (!appData) return;
  const today = getToday();
  const people = appData.people;
  const duties = appData.duties;
  const rooms = appData.rooms;
  const zones = appData.zones;

  // Daily counts
  const countDaily = {};
  people.forEach(p => { countDaily[p] = {}; duties.forEach(d => { countDaily[p][d] = 0; }); });
  appData.dailySchedule.forEach(day => {
    people.forEach(p => {
      const duty = day.assignments[p];
      if (duty && countDaily[p][duty] !== undefined) countDaily[p][duty]++;
    });
  });

  let html = '<table><thead><tr><th>ชื่อ</th>' +
    duties.map(d => `<th>${d}</th>`).join('') + '<th>รวม</th></tr></thead><tbody>';
  people.forEach(p => {
    const total = duties.reduce((s, d) => s + countDaily[p][d], 0);
    html += `<tr><td><b>${p}</b></td>` +
      duties.map(d => `<td><span class="stat-num">${countDaily[p][d]}</span></td>`).join('') +
      `<td><span class="stat-num accent">${total}</span></td></tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('summary-daily').innerHTML = html;

  // Weekly counts
  const countWeekly = {};
  rooms.forEach(r => { countWeekly[r] = {}; zones.forEach(z => { countWeekly[r][z] = 0; }); });
  appData.weeklySchedule.forEach(week => {
    rooms.forEach(r => {
      const zone = week.assignments[r];
      if (zone && countWeekly[r][zone] !== undefined) countWeekly[r][zone]++;
    });
  });

  let html2 = '<table><thead><tr><th>ห้อง</th>' +
    zones.map(z => `<th>${z}</th>`).join('') + '<th>รวม</th></tr></thead><tbody>';
  rooms.forEach(r => {
    const total = zones.reduce((s, z) => s + countWeekly[r][z], 0);
    html2 += `<tr><td><b>${r}</b></td>` +
      zones.map(z => `<td><span class="stat-num">${countWeekly[r][z]}</span></td>`).join('') +
      `<td><span class="stat-num accent">${total}</span></td></tr>`;
  });
  html2 += '</tbody></table>';
  document.getElementById('summary-weekly').innerHTML = html2;

  // Status breakdown with overdue detection
  const statusCounts = {};
  STATUS_OPTIONS.forEach(s => { statusCounts[s] = 0; });
  let overdueCount = 0;
  appData.weeklySchedule.forEach(week => {
    rooms.forEach(r => {
      statusCounts[week.status[r]]++;
      if (isOverdue(week.weekEnd, week.status[r])) overdueCount++;
    });
  });

  let html3 = '<table><thead><tr><th>สถานะ</th><th>จำนวน (ห้อง×สัปดาห์)</th></tr></thead><tbody>';
  STATUS_OPTIONS.forEach(s => {
    html3 += `<tr><td>${getStatusBadge(s)}</td><td><span class="stat-num">${statusCounts[s]}</span></td></tr>`;
  });
  html3 += `<tr style="font-weight:700"><td>${getOverduePill()}</td><td><span class="stat-num" style="background:#FEE2E2;color:#991B1B">${overdueCount}</span></td></tr>`;
  html3 += '</tbody></table>';
  document.getElementById('summary-status').innerHTML = html3;
}

// ===== EXPORT CSV =====
function exportCSV() {
  if (!appData) return;
  const people = appData.people;
  const rows = [['วันที่', 'วัน', ...people]];
  appData.dailySchedule.forEach(d => {
    rows.push([d.date, thaiDayShort(d.date), ...people.map(p => d.assignments[p])]);
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'เวรครัวรายวัน.csv'; a.click();
  URL.revokeObjectURL(url);
  toast('Export CSV สำเร็จ ✅');
}

// ===== TOAST =====
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); el.classList.add('hidden'); }, 2500);
}
