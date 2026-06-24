const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname)));

function dateRange(start, end) {
  const dates = [];
  let current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function generateDailySchedule(people, duties) {
  const dates = dateRange('2026-06-23', '2026-09-07');
  const schedule = [];
  let prevAssignment = {};
  let weekRotation = 0;

  for (let i = 0; i < dates.length; i++) {
    const dayOfWeek = i % 7;
    let assignments = {};

    if (dayOfWeek < 5) {
      people.forEach((person, personIdx) => {
        const dutyIdx = (personIdx + dayOfWeek + weekRotation) % duties.length;
        assignments[person] = duties[dutyIdx];
      });
    } else {
      let attempt = 0;
      let shuffled;
      do {
        shuffled = [...duties];
        for (let j = shuffled.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
        }
        attempt++;
      } while (attempt < 100 && people.some((p, idx) => prevAssignment[p] === shuffled[idx]));
      people.forEach((person, idx) => { assignments[person] = shuffled[idx]; });
    }

    if (dayOfWeek === 6) weekRotation++;
    schedule.push({ date: dates[i], assignments });
    prevAssignment = assignments;
  }
  return schedule;
}

function generateWeeklySchedule(rooms, zones) {
  const startDate = new Date('2026-06-23');
  const endDate = new Date('2026-09-07');
  const dayOfWeek = startDate.getDay();
  const monday = new Date(startDate);
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(monday.getDate() + daysToMonday);
  const weeks = [];
  let weekStart = new Date(monday);
  let weekNum = 0;
  const initialZones = { 'ห้อง 1': 'ห้องน้ำ', 'ห้อง 2': 'ห้องครัว', 'ห้อง 3': 'ห้องนั่งเล่น' };
  while (weekStart <= endDate) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekAssign = {};
    rooms.forEach(room => {
      const zoneIdx = (zones.indexOf(initialZones[room]) + weekNum) % zones.length;
      weekAssign[room] = zones[zoneIdx];
    });
    weeks.push({
      weekNum: weekNum + 1,
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      assignments: weekAssign,
      actualDates: { 'ห้อง 1': '', 'ห้อง 2': '', 'ห้อง 3': '' },
      status: { 'ห้อง 1': 'ยังไม่ทำ', 'ห้อง 2': 'ยังไม่ทำ', 'ห้อง 3': 'ยังไม่ทำ' },
      notes: { 'ห้อง 1': '', 'ห้อง 2': '', 'ห้อง 3': '' }
    });
    weekStart.setDate(weekStart.getDate() + 7);
    weekNum++;
  }
  return weeks;
}

function generateDefaultData() {
  const people = ['ปัน', 'แก้ม', 'เบส', 'ตะวัน', 'เกิด'];
  const duties = ['ล้างจาน', 'เก็บโต๊ะ', 'ทิ้งขยะ', 'กวาดพื้น', 'เช็ดตะแกรง'];
  const rooms = ['ห้อง 1', 'ห้อง 2', 'ห้อง 3'];
  const zones = ['ห้องครัว', 'ห้องนั่งเล่น', 'ห้องน้ำ'];
  return {
    people, duties, rooms, zones,
    dailySchedule: generateDailySchedule(people, duties),
    weeklySchedule: generateWeeklySchedule(rooms, zones)
  };
}

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
    catch (e) { return generateDefaultData(); }
  }
  const data = generateDefaultData();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  return data;
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/data', (req, res) => res.json(loadData()));

app.post('/api/regenerate-daily', (req, res) => {
  const data = loadData();
  data.dailySchedule = generateDailySchedule(data.people, data.duties);
  saveData(data);
  res.json({ success: true, dailySchedule: data.dailySchedule });
});

app.post('/api/regenerate-weekly', (req, res) => {
  const data = loadData();
  data.weeklySchedule = generateWeeklySchedule(data.rooms, data.zones);
  saveData(data);
  res.json({ success: true, weeklySchedule: data.weeklySchedule });
});

app.post('/api/update-daily', (req, res) => {
  const { date, person, duty } = req.body;
  const data = loadData();
  const day = data.dailySchedule.find(d => d.date === date);
  if (day) { day.assignments[person] = duty; saveData(data); res.json({ success: true }); }
  else res.status(404).json({ error: 'ไม่พบวันที่นี้' });
});

app.post('/api/update-weekly', (req, res) => {
  const { weekNum, room, field, value } = req.body;
  const data = loadData();
  const week = data.weeklySchedule.find(w => w.weekNum === weekNum);
  if (week) {
    if (field === 'actualDate') week.actualDates[room] = value;
    else if (field === 'status') week.status[room] = value;
    else if (field === 'notes') week.notes[room] = value;
    else if (field === 'zone') week.assignments[room] = value;
    saveData(data);
    res.json({ success: true });
  } else res.status(404).json({ error: 'ไม่พบสัปดาห์นี้' });
});

app.post('/api/reset', (req, res) => {
  const data = generateDefaultData();
  saveData(data);
  res.json({ success: true, data });
});

app.listen(PORT, '0.0.0.0', () => console.log(`✅ เซิร์ฟเวอร์ทำงานที่ http://localhost:${PORT}`));
