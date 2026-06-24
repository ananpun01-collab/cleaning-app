function generateDailySchedule(people, duties) {
  const dates = dateRange('2026-06-23', '2026-09-07');
  const schedule = [];
  let prevAssignment = {};
  let weekRotation = 0;

  for (let i = 0; i < dates.length; i++) {
    const dayOfWeek = i % 7;
    let assignments = {};

    if (dayOfWeek < 5) {
      // วันจันทร์–ศุกร์: หมุนเวียน Latin Square ทุกคนได้ครบทุกหน้าที่
      people.forEach((person, personIdx) => {
        const dutyIdx = (personIdx + dayOfWeek + weekRotation) % duties.length;
        assignments[person] = duties[dutyIdx];
      });
    } else {
      // วันเสาร์–อาทิตย์: สุ่มใหม่ ไม่ซ้ำวันก่อน
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

      people.forEach((person, idx) => {
        assignments[person] = shuffled[idx];
      });
    }

    // เริ่มสัปดาห์ใหม่ให้เลื่อน rotation
    if (dayOfWeek === 6) weekRotation++;

    schedule.push({ date: dates[i], assignments });
    prevAssignment = assignments;
  }

  return schedule;
}
