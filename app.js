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

// ===== DATE UTILITIES =====
function getToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function isToday(dateStr) { return dateStr === getToday(); }
function isCurrentWeek(weekStart, weekEnd) {
  const today = getToday();
  return today >= weekStart && today <= weekEnd;
}
function isOverdue(weekEnd, status) {
  return getToday() > weekEnd && status !== 'ทำแล้ว';
}
function isInScheduleRange() {
  const today = getToday();
  return today >= SCHEDULE_START && today <= SCHEDULE_END;
}
function getCurrentWeek() {
  if (!appData) return null;
  const today = getToday();
  return appData.weeklySchedule.find(w => today >= w.weekStart && today <= w.weekEnd) || null;
}
function thaiDateFull(dateStr) {
  const d = parseDate(dateStr);
  return `วัน${THAI_DAYS[d.getDay()]}ที่ ${d.getDate()} ${THAI_MONTHS_LONG[d.getMonth()]} ${d.getFullYear() + 543}`;
}
function thaiDateShort(dateStr) {
  const d = parseDate(dateStr);
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]}`;
}
function thaiDateMed(dateStr) {
  const d = parseDate(dateStr);
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
}
function thaiDayShort(dateStr) {
  return THAI_DAYS[parseDate(dateStr).getDay()];
}

// ===== BADGES =====
function getDutyBadge(duty) { return `<span class="duty-badge duty-${duty}">${duty}</span>`; }
function getZoneBadge(zone) { return `<span class="zone-badge zone-${zone}">${zone}</span>`; }
function getStatusBadge(status) { return `<span class="status-badge status-${status}">${status}</span>`; }
function getTodayPill() { return `<span class="pill pill-today">📍 วันนี้</span>`; }
function getCurrentWeekPill() { return `<span class="pill pill-week">📅 สัปดาห์นี้</span>`; }
function getOverduePill() { return `<span class="pill pill-overdue">⚠️ เลยกำหนด</span>`; }

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  setupNav();
  setupButtons();
  fetchData();
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
    renderDailyTable(); renderDashboard();
    toast('สร้างตารางเวรครัวใหม่แล้ว ✅');
  });
  document.getElementById('btn-regen-weekly').addEventListener('click', async () => {
    if (!confirm('สร้างตารางรายสัปดาห์ใหม่? ข้อมูลเดิมจะหายไป')) return;
    const res = await api('/api/regenerate-weekly', 'POST');
    appData.weeklySchedule = res.weeklySchedule;
    renderWeeklyTable(); renderDashboard();
    toast('สร้างตารางรายสัปดาห์ใหม่แล้ว ✅');
  });
  document.getElementById('btn-reset-all').addEventListener('click', async () => {
    if (!confirm('รีเซ็ตทุกอย่างและสร้างตารางใหม่ทั้งหมด?')) return;
    const res = await api('/api/reset', 'POST');
    appData = res.data; renderAll();
    toast('รีเซ็ตและสร้างตารางใหม่เรียบร้อย ✅');
  });
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
  document.getElementById('month-filter').addEventListener('change', renderDailyTable);
}

// ===== API =====
async function api(url, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return (await fetch(url, opts)).json();
}
async function fetchData() { appData = await api('/api/data'); renderAll(); }
function renderAll() { renderDashboard(); renderDailyTable(); renderWeeklyTable(); }

// ===== DASHBOARD =====
function renderDashboard() {
  if (!appData) return;
  const today = getToday();
  const inRange = isInScheduleRange();
  const currentWeek = getCurrentWeek();
  const todayData = appData.dailySchedule.find(d => d.date === today);

  document.getElementById('dash-status-banner').innerHTML = !inRange
    ? `<div class="status-banner banner-out">🚫 วันนี้ <b>${thaiDateFull(today)}</b> อยู่<b>นอกช่วงตาราง</b></div>`
    : `<div class="status-banner banner-in">📅 วันนี้: <b>${thaiDateFull(today)}</b></div>`;

  document.getElementById('dash-date-display').textContent = thaiDateFull(today);

  document.getElementById('dash-today').innerHTML = (!inRange || !todayData)
    ? `<span class="text-muted">ไม่มีข้อมูลวันนี้</span>`
    : '<div class="duty-list">' + appData.people.map(p =>
        `<div class="duty-list-row"><span class="duty-person">${p}</span>${getDutyBadge(todayData.assignments[p])}</div>`
      ).join('') + '</div>';

  document.getElementById('dash-week').innerHTML = !currentWeek
    ? `<span class="text-muted">ไม่มีข้อมูลสัปดาห์นี้</span>`
    : '<div class="duty-list">' + appData.rooms.map(r =>
        `<div class="duty-list-row"><span class="duty-person">${r}</span>${getZoneBadge(currentWeek.assignments[r])}</div>`
      ).join('') + '</div>';

  document.getElementById('dash-total-days').textContent = appData.dailySchedule.length + ' วัน';
  document.getElementById('dash-total-weeks').textContent = appData.weeklySchedule.length + ' สัปดาห์';

  const pending = [], overdue = [];
  appData.weeklySchedule.forEach(week => {
    appData.rooms.forEach(room => {
      if (isOverdue(week.weekEnd, week.status[room])) overdue.push({ week, room });
      else if (isCurrentWeek(week.weekStart, week.weekEnd) && week.status[room] !== 'ทำแล้ว') pending.push({ week, room });
    });
  });

  let alertHtml = '';
  if (overdue.length > 0) alertHtml += `<div class="alert alert-danger"><b>⚠️ เลยกำหนด ${overdue.length} รายการ:</b><ul>${overdue.map(x => `<li>${x.room} — ${x.week.assignments[x.room]} (สัปดาห์ที่ ${x.week.weekNum}) — ${getStatusBadge(x.week.status[x.room])}</li>`).join('')}</ul></div>`;
  if (pending.length > 0) alertHtml += `<div class="alert alert-warning"><b>📋 งานสัปดาห์นี้ที่ยังไม่เสร็จ ${pending.length} รายการ:</b><ul>${pending.map(x => `<li>${x.room} — ${getZoneBadge(x.week.assignments[x.room])} — ${getStatusBadge(x.week.status[x.room])}</li>`).join('')}</ul></div>`;
  if (!alertHtml) alertHtml = `<div class="alert alert-success">✅ ไม่มีงานค้างหรือเลยกำหนด</div>`;
  document.getElementById('dash-alerts').innerHTML = alertHtml;

  const wk = currentWeek || appData.weeklySchedule[0];
  const thisWeekDays = appData.dailySchedule.filter(d => d.date >= wk.weekStart && d.date <= wk.weekEnd);
  document.getElementById('dash-daily-week').innerHTML = thisWeekDays.length > 0
    ? buildDailyMiniTable(thisWeekDays)
    : '<p class="loading-text">ไม่มีข้อมูลสัปดาห์นี้</p>';

  document.getElementById('dash-weekly-current').innerHTML = currentWeek
    ? buildWeeklyMiniTable(currentWeek)
    : '<p class="loading-text">ไม่มีข้อมูล</p>';
}

function buildDailyMiniTable(days) {
  const people = appData.people;
  let html = '<table><thead><tr><th>วัน</th><th>วันที่</th>' + people.map(p => `<th>${p}</th>`).join('') + '</tr></thead><tbody>';
  for (const d of days) {
    const todayRow = isToday(d.date);
    html += `<tr${todayRow ? ' class="today-row"' : ''}>`;
    html += `<td class="date-day-name">${thaiDayShort(d.date)}</td>`;
    html += `<td class="date-label">${thaiDateShort(d.date)}${todayRow ? ' ' + getTodayPill() : ''}</td>`;
    people.forEach(p => { html += `<td>${getDutyBadge(d.assignments[p])}</td>`; });
    html += '</tr>';
  }
  return html + '</tbody></table>';
}

function buildWeeklyMiniTable(week) {
  let html = '<table><thead><tr><th>ห้อง</th><th>โซน</th><th>สถานะ</th></tr></thead><tbody>';
  appData.rooms.forEach(r => {
    const od = isOverdue(week.weekEnd, week.status[r]);
    html += `<tr${od ? ' class="overdue-row"' : ''}><td><b>${r}</b></td><td>${getZoneBadge(week.assignments[r])}</td><td>${getStatusBadge(week.status[r])}${od ? ' ' + getOverduePill() : ''}</td></tr>`;
  });
  return html + '</tbody></table>';
}

// ===== DAILY TABLE =====
function renderDailyTable() {
  if (!appData) return;
  const today = getToday();
  const filter = document.getElementById('month-filter').value;
  let days = appData.dailySchedule;
  if (filter) days = days.filter(d => d.date.startsWith(filter));
  const people = appData.people;
  let html = '<table><thead><tr><th>วัน</th><th>วันที่</th>' + people.map(p => `<th>${p}</th>`).join('') + '</tr></thead><tbody>';
  for (const d of days) {
    const todayRow = isToday(d.date);
    const isPast = d.date < today;
    html += `<tr class="${todayRow ? 'today-row' : isPast ? 'past-row' : ''}" id="daily-row-${d.date}">`;
    html += `<td class="date-day-name">${thaiDayShort(d.date)}</td>`;
    html += `<td class="date-label" style="white-space:nowrap">${thaiDateMed(d.date)}${todayRow ? ' ' + getTodayPill() : ''}</td>`;
    people.forEach(p => {
      html += `<td><select class="cell-select" data-date="${d.date}" data-person="${p}" onchange="updateDailyDuty(this)">
        ${DUTY_NAMES.map(duty => `<option value="${duty}"${d.assignments[p] === duty ? ' selected' : ''}>${duty}</option>`).join('')}
      </select></td>`;
    });
    html += '</tr>';
  }
  html += '</tbody></table>';
  document.getElementById('daily-table-wrap').innerHTML = html;
  if (!filter) setTimeout(() => {
    const el = document.getElementById(`daily-row-${today}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

async function updateDailyDuty(sel) {
  const { date, person } = sel.dataset;
  const duty = sel.value;
  const day = appData.dailySchedule.find(d => d.date === date);
  if (day) day.assignments[person] = duty;
  await api('/api/update-daily', 'POST', { date, person, duty });
  toast('บันทึกแล้ว ✅');
}

// ===== WEEKLY TABLE =====
function renderWeeklyTable() {
  if (!appData) return;
  const today = getToday();
  const rooms = appData.rooms;
  let html = '';

  for (const week of appData.weeklySchedule) {
    const isCurrent = isCurrentWeek(week.weekStart, week.weekEnd);
    const isPast = today > week.weekEnd;
    const hasOverdue = rooms.some(r => isOverdue(week.weekEnd, week.status[r]));
    const allDone = rooms.every(r => week.status[r] === 'ทำแล้ว');

    let headerBg = isCurrent ? 'background:var(--success)' : hasOverdue ? 'background:var(--danger)' : isPast ? 'background:var(--text-muted)' : '';
    let weekBadge = isCurrent ? getCurrentWeekPill() : hasOverdue ? getOverduePill() : '';
    const cardClass = isCurrent ? 'week-card current-week-card' : hasOverdue ? 'week-card overdue-week-card' : 'week-card';

    html += `<div class="${cardClass}" id="week-card-${week.weekNum}">
      <div class="week-card-header" style="${headerBg}">
        <span class="week-title">สัปดาห์ที่ ${week.weekNum} ${weekBadge}</span>
        <span class="week-dates">${thaiDateMed(week.weekStart)} – ${thaiDateMed(week.weekEnd)}</span>
      </div>
      <div class="week-card-body">
        <table>
          <thead><tr><th>ห้อง</th><th>โซน</th><th>วันที่ทำจริง</th><th>หมายเหตุ</th></tr></thead>
          <tbody>`;

    rooms.forEach(room => {
      const od = isOverdue(week.weekEnd, week.status[room]);
      const isDone = week.status[room] === 'ทำแล้ว';
      const rowClass = od ? 'overdue-row' : isDone ? '' : (isCurrent ? 'pending-row' : '');
      html += `<tr class="${rowClass}">
        <td><b>${room}</b>${od ? ' ' + getOverduePill() : ''}</td>
        <td>${getZoneBadge(week.assignments[room])}</td>
        <td><input type="date" class="cell-input" style="min-width:130px"
          value="${week.actualDates[room] || ''}"
          data-week="${week.weekNum}" data-room="${room}" data-field="actualDate"
          onchange="updateWeekly(this)" /></td>
        <td><input type="text" class="cell-input" style="min-width:120px"
          placeholder="หมายเหตุ..."
          value="${week.notes[room] || ''}"
          data-week="${week.weekNum}" data-room="${room}" data-field="notes"
          onblur="updateWeekly(this)" /></td>
      </tr>`;
    });

    html += `</tbody></table>

        <!-- ปุ่มแยกห้อง -->
        <div style="padding:12px 16px;display:flex;flex-direction:column;gap:10px;">`;

    rooms.forEach(room => {
      const isDone = week.status[room] === 'ทำแล้ว';
      if (isDone) {
        html += `<div style="display:flex;gap:8px;align-items:center;">
          <div style="flex:1;background:#D1FAE5;color:#065F46;border-radius:10px;padding:12px 16px;text-align:center;font-size:15px;font-weight:700;">
            ✅ ${room} — ทำเสร็จแล้ว!
          </div>
          <button onclick="markRoomUndone(${week.weekNum}, '${room}')"
            style="padding:12px 14px;font-size:13px;font-weight:600;background:#FEE2E2;color:#991B1B;border:none;border-radius:10px;cursor:pointer;white-space:nowrap;">
            ↩ ยกเลิก
          </button>
        </div>`;
      } else {
        html += `<button onclick="markRoomDone(${week.weekNum}, '${room}')"
          style="width:100%;padding:14px;font-size:16px;font-weight:700;background:#10B981;color:#fff;border:none;border-radius:10px;cursor:pointer;">
          ✅ ${room} — ทำเสร็จแล้ว!
        </button>`;
      }
    });

    if (allDone) {
      html += `<div style="background:#059669;color:#fff;border-radius:10px;padding:12px;text-align:center;font-size:15px;font-weight:700;margin-top:4px;">
        🎉 ทุกห้องเสร็จหมดแล้ว!
      </div>`;
    }

    html += `</div>
      </div>
    </div>`;
  }

  document.getElementById('weekly-table-wrap').innerHTML = html;
  setTimeout(() => {
    const cw = getCurrentWeek();
    if (cw) {
      const el = document.getElementById(`week-card-${cw.weekNum}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);
}

async function markRoomDone(weekNum, room) {
  const week = appData.weeklySchedule.find(w => w.weekNum === weekNum);
  if (!week) return;
  week.status[room] = 'ทำแล้ว';
  await api('/api/update-weekly', 'POST', { weekNum, room, field: 'status', value: 'ทำแล้ว' });
  renderWeeklyTable();
  renderDashboard();
  toast(`${room} ทำเสร็จแล้ว ✅`);
}

async function markRoomUndone(weekNum, room) {
  const week = appData.weeklySchedule.find(w => w.weekNum === weekNum);
  if (!week) return;
  week.status[room] = 'ยังไม่ทำ';
  await api('/api/update-weekly', 'POST', { weekNum, room, field: 'status', value: 'ยังไม่ทำ' });
  renderWeeklyTable();
  renderDashboard();
  toast(`${room} ยกเลิกเสร็จแล้ว ↩`);
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
  renderWeeklyTable();
  renderDashboard();
  toast('บันทึกแล้ว ✅');
}

// ===== SUMMARY =====
function renderSummary() {
  if (!appData) return;
  const { people, duties, rooms, zones } = appData;
  const countD = {};
  people.forEach(p => { countD[p] = {}; duties.forEach(d => { countD[p][d] = 0; }); });
  appData.dailySchedule.forEach(day => { people.forEach(p => { if (countD[p][day.assignments[p]] !== undefined) countD[p][day.assignments[p]]++; }); });
  let h1 = '<table><thead><tr><th>ชื่อ</th>' + duties.map(d => `<th>${d}</th>`).join('') + '<th>รวม</th></tr></thead><tbody>';
  people.forEach(p => {
    const total = duties.reduce((s, d) => s + countD[p][d], 0);
    h1 += `<tr><td><b>${p}</b></td>` + duties.map(d => `<td><span class="stat-num">${countD[p][d]}</span></td>`).join('') + `<td><span class="stat-num accent">${total}</span></td></tr>`;
  });
  document.getElementById('summary-daily').innerHTML = h1 + '</tbody></table>';

  const countW = {};
  rooms.forEach(r => { countW[r] = {}; zones.forEach(z => { countW[r][z] = 0; }); });
  appData.weeklySchedule.forEach(w => { rooms.forEach(r => { if (countW[r][w.assignments[r]] !== undefined) countW[r][w.assignments[r]]++; }); });
  let h2 = '<table><thead><tr><th>ห้อง</th>' + zones.map(z => `<th>${z}</th>`).join('') + '<th>รวม</th></tr></thead><tbody>';
  rooms.forEach(r => {
    const total = zones.reduce((s, z) => s + countW[r][z], 0);
    h2 += `<tr><td><b>${r}</b></td>` + zones.map(z => `<td><span class="stat-num">${countW[r][z]}</span></td>`).join('') + `<td><span class="stat-num accent">${total}</span></td></tr>`;
  });
  document.getElementById('summary-weekly').innerHTML = h2 + '</tbody></table>';

  const sc = {}; STATUS_OPTIONS.forEach(s => { sc[s] = 0; });
  let od = 0;
  appData.weeklySchedule.forEach(w => { rooms.forEach(r => { sc[w.status[r]]++; if (isOverdue(w.weekEnd, w.status[r])) od++; }); });
  let h3 = '<table><thead><tr><th>สถานะ</th><th>จำนวน</th></tr></thead><tbody>';
  STATUS_OPTIONS.forEach(s => { h3 += `<tr><td>${getStatusBadge(s)}</td><td><span class="stat-num">${sc[s]}</span></td></tr>`; });
  h3 += `<tr><td>${getOverduePill()}</td><td><span class="stat-num" style="background:#FEE2E2;color:#991B1B">${od}</span></td></tr>`;
  document.getElementById('summary-status').innerHTML = h3 + '</tbody></table>';
}

// ===== EXPORT CSV =====
function exportCSV() {
  if (!appData) return;
  const people = appData.people;
  const rows = [['วันที่', 'วัน', ...people]];
  appData.dailySchedule.forEach(d => { rows.push([d.date, thaiDayShort(d.date), ...people.map(p => d.assignments[p])]); });
  const blob = new Blob(['\ufeff' + rows.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'เวรครัวรายวัน.csv' });
  a.click(); URL.revokeObjectURL(a.href);
  toast('Export CSV สำเร็จ ✅');
}

// ===== TOAST =====
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.remove('hidden'); el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); el.classList.add('hidden'); }, 2500);
}
