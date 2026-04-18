const fs = require('fs');
const holidays = require('japanese-holidays');
const lunisolar = require('lunisolar');

const ROKUYO = ['大安', '赤口', '先勝', '友引', '先負', '仏滅'];

const startDate = new Date('2025-01-01');
const endDate = new Date('2035-12-31');

let csvContent = 'Date,Holiday,Rokuyo\n';

let currDate = new Date(startDate);
while (currDate <= endDate) {
    const yyyy = currDate.getFullYear();
    const mm = String(currDate.getMonth() + 1).padStart(2, '0');
    const dd = String(currDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    // Japanese-holidays uses Date objects. Make sure we check exactly at noon to avoid timezone shift
    const checkDate = new Date(yyyy, currDate.getMonth(), currDate.getDate(), 12, 0, 0);
    const holidayName = holidays.isHoliday(checkDate) || '';
    
    const ls = lunisolar(checkDate);
    const m = ls.lunar.month;
    const d = ls.lunar.day;
    const rokuyoIndex = (m + d) % 6;
    const rokuyoName = ROKUYO[rokuyoIndex];
    
    csvContent += `${dateStr},${holidayName},${rokuyoName}\n`;
    
    currDate.setDate(currDate.getDate() + 1);
}

fs.writeFileSync('holidays_rokuyo.csv', csvContent, 'utf-8');
console.log('CSV created: holidays_rokuyo.csv');
