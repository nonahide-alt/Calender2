const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-indexed
let selectedDateId = null;

// Load events from local storage
let eventsData = JSON.parse(localStorage.getItem('calendarEvents')) || {};
// 過去の予定データのマイグレーション用
for (const dateId in eventsData) {
    eventsData[dateId] = eventsData[dateId].map(evt => {
        if (typeof evt === 'string') {
            return { text: evt, color: '#667eea', checked: false };
        }
        return evt;
    });
}
let templatesData = JSON.parse(localStorage.getItem('calendarTemplates')) || [];
let calendarMetas = {};
let activeContextMenuCallbacks = null;
let activeContextEvent = null;
let multiDayEventsData = JSON.parse(localStorage.getItem('calendarMultiEvents')) || [];

let isDarkMode = JSON.parse(localStorage.getItem('calendarDarkMode')) || false;
if (isDarkMode) {
    document.body.classList.add('dark-mode');
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function saveEvents() {
    localStorage.setItem('calendarEvents', JSON.stringify(eventsData));
}

function saveTemplates() {
    localStorage.setItem('calendarTemplates', JSON.stringify(templatesData));
}

function saveMultiEvents() {
    localStorage.setItem('calendarMultiEvents', JSON.stringify(multiDayEventsData));
}

function renderQuickTemplates() {
    const container = document.getElementById('quick-template-container');
    if (!container) return;
    container.innerHTML = '';
    
    templatesData.forEach((template, idx) => {
        const chip = document.createElement('button');
        chip.className = 'template-chip';
        chip.textContent = template.text;
        chip.style.backgroundColor = template.color || '#667eea';
        chip.style.color = template.textColor || '#ffffff';
        
        chip.addEventListener('click', () => {
            if (selectedDateId) {
                if (!eventsData[selectedDateId]) {
                    eventsData[selectedDateId] = [];
                }
                eventsData[selectedDateId].push({ 
                    text: template.text, 
                    color: template.color || '#667eea', 
                    textColor: template.textColor || '#ffffff', 
                    checked: false 
                });
                
                saveEvents();
                renderEventList();
                renderCalendars();
            }
        });
        
        container.appendChild(chip);
    });
}

async function loadCSV() {
    try {
        const response = await fetch('holidays_rokuyo.csv');
        const text = await response.text();
        const lines = text.split('\n');
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const [dateStr, holiday, rokuyo] = line.split(',');
            calendarMetas[dateStr] = { holiday, rokuyo };
        }
    } catch (e) {
        console.error('Failed to load CSV', e);
    }
}

async function init() {
    await loadCSV();
    renderQuickTemplates();

    document.addEventListener('click', (e) => {
        const menu = document.getElementById('custom-context-menu');
        if (menu && !menu.classList.contains('hidden')) {
            // コンテキストメニューの内部がクリックされた場合は閉じない
            if (!menu.contains(e.target)) {
                menu.classList.add('hidden');
                activeContextMenuCallbacks = null;
            }
        }
    });

    document.getElementById('menu-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        if (activeContextMenuCallbacks && activeContextMenuCallbacks.edit) {
            activeContextMenuCallbacks.edit();
        }
        document.getElementById('custom-context-menu').classList.add('hidden');
        activeContextMenuCallbacks = null;
    });

    document.getElementById('menu-add-template').addEventListener('click', (e) => {
        e.stopPropagation();
        if (activeContextMenuCallbacks && activeContextMenuCallbacks.add) {
            activeContextMenuCallbacks.add();
        }
        document.getElementById('custom-context-menu').classList.add('hidden');
        activeContextMenuCallbacks = null;
    });

    document.getElementById('btn-manage-templates').addEventListener('click', openTemplateModal);
    
    document.getElementById('menu-set-period').addEventListener('click', (e) => {
        e.stopPropagation();
        if (activeContextMenuCallbacks && activeContextMenuCallbacks.setPeriod) {
            activeContextMenuCallbacks.setPeriod();
        }
        document.getElementById('custom-context-menu').classList.add('hidden');
        activeContextMenuCallbacks = null;
    });

    document.getElementById('btn-close-period-modal').addEventListener('click', () => {
        document.getElementById('period-modal').classList.add('hidden');
    });

    document.getElementById('btn-apply-period').addEventListener('click', () => {
        const startStr = document.getElementById('period-start-date').value;
        const endStr = document.getElementById('period-end-date').value;
        if (!startStr || !endStr) {
            alert('開始日と終了日を入力してください。');
            return;
        }
        if (new Date(startStr) > new Date(endStr)) {
            alert('開始日は終了日以前である必要があります。');
            return;
        }

        if (activeContextEvent) {
            const evt = activeContextEvent.event;

            if (activeContextEvent.isExistingMulti) {
                // Editing an existing multi-day event's period
                const realEvt = multiDayEventsData.find(e => e.id === evt.id);
                if (realEvt) {
                    realEvt.startDate = startStr;
                    realEvt.endDate = endStr;
                }
                saveMultiEvents();
            } else {
                // Converting a single-day event to multi-day
                const originIndex = activeContextEvent.index;
                const originDateId = activeContextEvent.dateId;

                if (eventsData[originDateId]) {
                    eventsData[originDateId].splice(originIndex, 1);
                    if (eventsData[originDateId].length === 0) delete eventsData[originDateId];
                }

                const multiEvt = {
                    id: generateId(),
                    text: evt.text,
                    color: evt.color || '#667eea',
                    textColor: evt.textColor || '#ffffff',
                    checked: evt.checked || false,
                    startDate: startStr,
                    endDate: endStr
                };
                multiDayEventsData.push(multiEvt);
                saveEvents();
                saveMultiEvents();
            }
            
            renderCalendars();
            renderEventList();
        }
        
        document.getElementById('period-modal').classList.add('hidden');
        document.getElementById('custom-context-menu').classList.add('hidden');
        activeContextMenuCallbacks = null;
    });
    
    document.getElementById('btn-close-template-modal').addEventListener('click', closeTemplateModal);
    document.getElementById('template-modal').addEventListener('click', (e) => {
        if (e.target.id === 'template-modal') closeTemplateModal();
    });

    document.getElementById('btn-prev').addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendars();
    });

    document.getElementById('btn-next').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendars();
    });

    document.getElementById('btn-today').addEventListener('click', () => {
        const today = new Date();
        currentYear = today.getFullYear();
        currentMonth = today.getMonth();
        renderCalendars();
    });

    document.getElementById('btn-close-modal').addEventListener('click', closeModal);
    document.getElementById('event-modal').addEventListener('click', (e) => {
        if (e.target.id === 'event-modal') closeModal();
    });

    document.getElementById('btn-add-event').addEventListener('click', addEvent);
    document.getElementById('new-event-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addEvent();
    });

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        if (isDarkMode) themeToggle.checked = true;
        themeToggle.addEventListener('change', (e) => {
            isDarkMode = e.target.checked;
            if (isDarkMode) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
            localStorage.setItem('calendarDarkMode', JSON.stringify(isDarkMode));
        });
    }

    renderCalendars();
}

function renderCalendars() {
    const leftDate = new Date(currentYear, currentMonth, 1);
    const rightDate = new Date(currentYear, currentMonth + 1, 1);

    renderSingleCalendar('calendar-left', 'left-month-title', leftDate.getFullYear(), leftDate.getMonth());
    renderSingleCalendar('calendar-right', 'right-month-title', rightDate.getFullYear(), rightDate.getMonth());
}

function allocateSlots(year, month) {
    const slots = {};
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const formatDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        slots[dateStr] = [];
    }
    
    const visibleMultiEvents = multiDayEventsData.filter(e => {
        return (new Date(e.startDate) <= new Date(year, month, daysInMonth)) && 
               (new Date(e.endDate) >= new Date(year, month, 1));
    });
    
    visibleMultiEvents.sort((a, b) => {
        const lenA = new Date(a.endDate) - new Date(a.startDate);
        const lenB = new Date(b.endDate) - new Date(b.startDate);
        if (lenA !== lenB) return lenB - lenA; 
        return new Date(a.startDate) - new Date(b.startDate);
    });

    visibleMultiEvents.forEach(evt => {
        let slotIndex = 0;
        let slotFound = false;
        while (!slotFound) {
            let conflict = false;
            let d = new Date(evt.startDate);
            const endD = new Date(evt.endDate);
            endD.setHours(0,0,0,0);
            while (d <= endD) {
                const dateStr = formatDateStr(d);
                if (slots[dateStr] && slots[dateStr][slotIndex] !== undefined && slots[dateStr][slotIndex] !== null) {
                    conflict = true;
                    break;
                }
                d.setDate(d.getDate() + 1);
            }
            if (!conflict) slotFound = true;
            else slotIndex++;
        }
        let d = new Date(evt.startDate);
        const endD = new Date(evt.endDate);
        endD.setHours(0,0,0,0);
        while (d <= endD) {
            const dateStr = formatDateStr(d);
            if (slots[dateStr]) {
                slots[dateStr][slotIndex] = Object.assign({}, evt, { isMulti: true });
            }
            d.setDate(d.getDate() + 1);
        }
    });

    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const singleEvts = eventsData[dateStr] || [];
        singleEvts.forEach((evt, idx) => {
             let slotIndex = 0;
             while (slots[dateStr][slotIndex] !== undefined && slots[dateStr][slotIndex] !== null) {
                 slotIndex++;
             }
             slots[dateStr][slotIndex] = Object.assign({}, evt, { isMulti: false, originalIndex: idx });
        });
        
        const maxLen = slots[dateStr].length;
        for (let s = 0; s < maxLen; s++) {
            if (slots[dateStr][s] === undefined) slots[dateStr][s] = null;
        }
    }
    return slots;
}

function renderSingleCalendar(containerId, titleId, year, month) {
    const container = document.getElementById(containerId);
    const title = document.getElementById(titleId);
    container.innerHTML = '';
    title.textContent = `${year}年 ${month + 1}月`;

    const monthSlots = allocateSlots(year, month);

    // Render Headers
    dayNames.forEach((day, index) => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.textContent = day;
        if (index === 0) dayHeader.classList.add('sun');
        if (index === 6) dayHeader.classList.add('sat');
        container.appendChild(dayHeader);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Empty spaces
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'date-cell empty';
        container.appendChild(emptyCell);
    }

    // Date cells
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const dateCell = document.createElement('div');
        dateCell.className = 'date-cell';
        
        const currentDayOfWeek = new Date(year, month, i).getDay();
        if (currentDayOfWeek === 0) dateCell.classList.add('sun');
        if (currentDayOfWeek === 6) dateCell.classList.add('sat');

        if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {
            dateCell.classList.add('today');
        }

        const dateId = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        dateCell.setAttribute('data-date', dateId);
        
        const topRow = document.createElement('div');
        topRow.className = 'date-top-row';

        const numSpan = document.createElement('span');
        numSpan.className = 'date-num';
        numSpan.textContent = i;
        topRow.appendChild(numSpan);

        const meta = calendarMetas[dateId];
        if (meta) {
            if (meta.holiday) {
                dateCell.classList.add('holiday');
                numSpan.title = meta.holiday;
            }
            if (meta.rokuyo) {
                const rokuyoSpan = document.createElement('span');
                rokuyoSpan.className = `rokuyo ${meta.rokuyo}`;
                rokuyoSpan.textContent = meta.rokuyo;
                topRow.appendChild(rokuyoSpan);
            }
        }
        dateCell.appendChild(topRow);

        const indicatorContainer = document.createElement('div');
        indicatorContainer.className = 'event-indicator';
        
        const daySlots = monthSlots[dateId] || [];
        daySlots.forEach(evt => {
            if (evt === null || (evt && evt.isMulti)) {
                // 複数日イベントとnullスロットはプレースホルダー（スペーサー）にする
                const placeholder = document.createElement('div');
                placeholder.className = 'event-bar placeholder';
                indicatorContainer.appendChild(placeholder);
            } else {
                const bar = document.createElement('div');
                bar.className = 'event-bar single';
                bar.style.backgroundColor = evt.color || '#667eea';
                bar.style.color = evt.textColor || '#ffffff';
                bar.textContent = evt.text || evt;
                if (evt.checked) bar.classList.add('checked');
                indicatorContainer.appendChild(bar);
            }
        });

        dateCell.appendChild(indicatorContainer);

        dateCell.addEventListener('click', () => openModal(dateId, i, month, year));
        container.appendChild(dateCell);
    }

    // 複数日イベントのオーバーレイバーを描画
    requestAnimationFrame(() => {
        renderMultiDayOverlays(container, year, month, monthSlots, daysInMonth);
    });
}

function openModal(dateId, day, month, year) {
    selectedDateId = dateId;
    document.getElementById('modal-date-title').textContent = `${year}年 ${month + 1}月 ${day}日の予定`;
    document.getElementById('event-modal').classList.remove('hidden');
    renderEventList();
    setTimeout(() => document.getElementById('new-event-input').focus(), 100);
}

function closeModal() {
    document.getElementById('event-modal').classList.add('hidden');
    selectedDateId = null;
    document.getElementById('new-event-input').value = '';
}

function renderMultiDayOverlays(container, year, month, monthSlots, daysInMonth) {
    // 既存のオーバーレイを削除
    container.querySelectorAll('.multi-bar-overlay').forEach(el => el.remove());
    
    // calendar-wrapperを取得（containerの親）してposition:relativeを設定
    const wrapper = container.closest('.calendar-wrapper');
    if (!wrapper) return;
    wrapper.style.position = 'relative';
    // 既存のオーバーレイを削除
    wrapper.querySelectorAll('.multi-bar-overlay').forEach(el => el.remove());
    
    // セルのマップを構築
    const cellMap = {};
    container.querySelectorAll('.date-cell[data-date]').forEach(cell => {
        cellMap[cell.dataset.date] = cell;
    });
    
    // 処理済みイベント(同一行のセグメント)を記録
    const processed = new Set();
    
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const daySlots = monthSlots[dateStr] || [];
        const d = new Date(year, month, i);
        
        daySlots.forEach((evt, slotIdx) => {
            if (!evt || !evt.isMulti) return;
            
            const segKey = evt.id + '_row_' + Math.floor((firstDayOffset(year, month) + i - 1) / 7);
            if (processed.has(segKey)) return;
            
            // この日が行セグメントの開始地点かどうかチェック
            const actualStart = new Date(evt.startDate);
            actualStart.setHours(0,0,0,0);
            const isRowStart = d.getTime() === actualStart.getTime() || d.getDay() === 0 || i === 1;
            if (!isRowStart) return;
            
            // この行セグメントの終了日を見つける
            const actualEnd = new Date(evt.endDate);
            actualEnd.setHours(0,0,0,0);
            let segEnd = i;
            for (let j = i; j <= daysInMonth; j++) {
                const jd = new Date(year, month, j);
                if (jd > actualEnd) break;
                segEnd = j;
                if (jd.getDay() === 6) break; // 土曜で行が終わる
            }
            
            const startDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const endDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(segEnd).padStart(2, '0')}`;
            
            const startCell = cellMap[startDateStr];
            const endCell = cellMap[endDateStr];
            if (!startCell || !endCell) return;
            
            // プレースホルダーの位置からtopを算出
            const placeholders = startCell.querySelectorAll('.event-bar.placeholder');
            let topOffset = 0;
            if (placeholders[slotIdx]) {
                topOffset = placeholders[slotIdx].offsetTop + startCell.offsetTop;
            } else {
                topOffset = startCell.offsetTop + 22 + slotIdx * 20;
            }
            
            const left = startCell.offsetLeft;
            const right = endCell.offsetLeft + endCell.offsetWidth;
            
            const isActualStart = d.getTime() === actualStart.getTime();
            const isActualEnd = (new Date(year, month, segEnd)).getTime() === actualEnd.getTime();
            
            const bar = document.createElement('div');
            bar.className = 'multi-bar-overlay';
            bar.style.position = 'absolute';
            bar.style.left = (left + 4) + 'px';
            bar.style.width = (right - left - 8) + 'px';
            bar.style.top = topOffset + 'px';
            bar.style.height = '18px';
            bar.style.backgroundColor = evt.color || '#667eea';
            bar.style.color = evt.textColor || '#ffffff';
            bar.style.fontSize = '0.65rem';
            bar.style.lineHeight = '18px';
            bar.style.padding = '0 4px';
            bar.style.overflow = 'hidden';
            bar.style.textOverflow = 'ellipsis';
            bar.style.whiteSpace = 'nowrap';
            bar.style.zIndex = '20';
            bar.style.boxSizing = 'border-box';
            bar.style.pointerEvents = 'none';
            
            // 角丸の設定
            const rStart = isActualStart ? '3px' : '0';
            const rEnd = isActualEnd ? '3px' : '0';
            bar.style.borderRadius = `${rStart} ${rEnd} ${rEnd} ${rStart}`;
            
            if (evt.checked) bar.style.opacity = '0.6';
            bar.textContent = isActualStart ? evt.text : '';
            
            wrapper.appendChild(bar);
            processed.add(segKey);
        });
    }
}

function firstDayOffset(year, month) {
    return new Date(year, month, 1).getDay();
}

function renderEventList() {
    const list = document.getElementById('event-list');
    list.innerHTML = '';
    
    const singleEvents = (eventsData[selectedDateId] || []).map((e, idx) => Object.assign({}, e, { _isMulti: false, _index: idx }));
    const multiEvents = multiDayEventsData.filter(e => {
        const d = new Date(selectedDateId);
        const sd = new Date(e.startDate);
        const ed = new Date(e.endDate);
        sd.setHours(0,0,0,0);
        ed.setHours(0,0,0,0);
        return d >= sd && d <= ed;
    }).map((e, idx) => Object.assign({}, e, { _isMulti: true, _index: idx }));
    
    const events = [...singleEvents, ...multiEvents];
    
    events.forEach((evt) => {
        const li = document.createElement('li');
        li.className = 'event-item';
        if (evt.checked) li.classList.add('checked');
        li.style.backgroundColor = evt.color || '#667eea';
        
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'event-checkbox';
        cb.checked = evt.checked || false;
        cb.addEventListener('change', () => {
            evt.checked = cb.checked;
            if (evt._isMulti) {
                const realEvt = multiDayEventsData.find(e => e.id === evt.id);
                if (realEvt) realEvt.checked = evt.checked;
                saveMultiEvents();
            } else {
                eventsData[selectedDateId][evt._index].checked = evt.checked;
                saveEvents();
            }
            renderEventList();
            renderCalendars();
        });

        // 複数日予定の場合はアイコンを先頭に追加
        if (evt._isMulti) {
            const icon = document.createElement('span');
            icon.className = 'multi-period-icon';
            icon.textContent = '📅';
            icon.title = `${evt.startDate} ～ ${evt.endDate}`;
            li.appendChild(icon);
        }

        const text = document.createElement('span');
        text.className = 'event-text';
        text.style.color = evt.textColor || 'inherit';
        text.textContent = evt.text || evt;
        text.contentEditable = "false";
        text.spellcheck = false;
        
        const saveEdit = () => {
            let newText = text.textContent.trim();
            
            const originalText = evt.text || evt;
            if (newText && newText !== originalText) {
                if (evt._isMulti) {
                    const realEvt = multiDayEventsData.find(e => e.id === evt.id);
                    if (realEvt) realEvt.text = newText;
                    saveMultiEvents();
                } else {
                    eventsData[selectedDateId][evt._index].text = newText;
                    saveEvents();
                }
                renderCalendars();
                renderEventList();
            } else {
                text.textContent = originalText;
            }
            text.contentEditable = "false";
            text.blur();
        };

        text.addEventListener('blur', () => {
            if (text.contentEditable === "true") {
                saveEdit();
            }
        });

        text.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            }
        });
        
        li.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const menu = document.getElementById('custom-context-menu');
            if (menu) {
                menu.style.left = `${e.pageX}px`;
                menu.style.top = `${e.pageY}px`;
                menu.classList.remove('hidden');

                if (evt._isMulti) {
                    document.getElementById('menu-set-period').textContent = '期間編集';
                } else {
                    document.getElementById('menu-set-period').textContent = '期間指定';
                }
                document.getElementById('menu-set-period').style.display = 'block';

                activeContextMenuCallbacks = {
                    edit: () => {
                        if (text.contentEditable !== "true") {
                            text.contentEditable = "true";
                            if (evt._isMulti) text.textContent = evt.text;
                            text.focus();
                            const range = document.createRange();
                            const sel = window.getSelection();
                            range.selectNodeContents(text);
                            range.collapse(false);
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }
                    },
                    add: () => {
                        templatesData.push({ text: evt.text, color: evt.color || '#667eea', textColor: evt.textColor || '#ffffff' });
                        saveTemplates();
                        renderQuickTemplates();
                    },
                    setPeriod: () => {
                        if (evt._isMulti) {
                            activeContextEvent = { event: evt, isExistingMulti: true };
                            document.getElementById('period-start-date').value = evt.startDate;
                            document.getElementById('period-end-date').value = evt.endDate;
                        } else {
                            activeContextEvent = { event: evt, index: evt._index, dateId: selectedDateId, isExistingMulti: false };
                            document.getElementById('period-start-date').value = selectedDateId;
                            document.getElementById('period-end-date').value = selectedDateId;
                        }
                        document.getElementById('period-modal').classList.remove('hidden');
                    }
                };
            }
        });
        
        const bgColorPicker = document.createElement('input');
        bgColorPicker.type = 'color';
        bgColorPicker.className = 'inline-color-picker';
        bgColorPicker.value = evt.color || '#667eea';
        bgColorPicker.title = "背景色を変更";
        bgColorPicker.addEventListener('input', (e) => {
            evt.color = e.target.value;
            li.style.backgroundColor = evt.color;
            if (evt._isMulti) {
                const realEvt = multiDayEventsData.find(m => m.id === evt.id);
                if (realEvt) realEvt.color = evt.color;
                saveMultiEvents();
            } else {
                eventsData[selectedDateId][evt._index].color = evt.color;
                saveEvents();
            }
            renderCalendars();
        });

        const textColorPicker = document.createElement('input');
        textColorPicker.type = 'color';
        textColorPicker.className = 'inline-color-picker';
        textColorPicker.value = evt.textColor || '#ffffff';
        textColorPicker.title = "文字色を変更";
        textColorPicker.addEventListener('input', (e) => {
            evt.textColor = e.target.value;
            text.style.color = evt.textColor;
            if (evt._isMulti) {
                const realEvt = multiDayEventsData.find(m => m.id === evt.id);
                if (realEvt) realEvt.textColor = evt.textColor;
                saveMultiEvents();
            } else {
                eventsData[selectedDateId][evt._index].textColor = evt.textColor;
                saveEvents();
            }
            renderCalendars();
        });
        
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-event-btn';
        delBtn.innerHTML = '&times;';
        delBtn.addEventListener('click', () => {
            if (evt._isMulti) {
                multiDayEventsData = multiDayEventsData.filter(m => m.id !== evt.id);
                saveMultiEvents();
            } else {
                eventsData[selectedDateId].splice(evt._index, 1);
                if (eventsData[selectedDateId].length === 0) {
                    delete eventsData[selectedDateId];
                }
                saveEvents();
            }
            renderEventList();
            renderCalendars();
        });

        li.appendChild(cb);
        li.appendChild(text);
        li.appendChild(bgColorPicker);
        li.appendChild(textColorPicker);
        li.appendChild(delBtn);
        list.appendChild(li);
    });
}

function addEvent() {
    const input = document.getElementById('new-event-input');
    const text = input.value.trim();
    const colorInput = document.getElementById('new-event-color');
    const color = colorInput.value;
    const textColorInput = document.getElementById('new-event-text-color');
    const textColor = textColorInput ? textColorInput.value : '#ffffff';
    
    if (text && selectedDateId) {
        if (!eventsData[selectedDateId]) {
            eventsData[selectedDateId] = [];
        }
        eventsData[selectedDateId].push({ text, color, textColor, checked: false });
        
        saveEvents();
        input.value = '';
        renderEventList();
        renderCalendars();
    }
}

function openTemplateModal() {
    document.getElementById('template-modal').classList.remove('hidden');
    renderTemplateList();
}

function closeTemplateModal() {
    document.getElementById('template-modal').classList.add('hidden');
}

function renderTemplateList() {
    const list = document.getElementById('template-list');
    list.innerHTML = '';
    
    templatesData.forEach((template, index) => {
        const li = document.createElement('li');
        li.className = 'event-item';
        li.style.backgroundColor = template.color || '#667eea';
        
        const text = document.createElement('span');
        text.className = 'event-text';
        text.style.color = template.textColor || 'inherit';
        text.textContent = template.text;
        text.contentEditable = "false";
        text.spellcheck = false;
        
        const saveEdit = () => {
            const newText = text.textContent.trim();
            if (newText) {
                template.text = newText;
                saveTemplates();
                renderQuickTemplates();
            } else {
                text.textContent = template.text;
            }
            text.contentEditable = "false";
            editBtn.textContent = '編集';
            text.blur();
        };

        text.addEventListener('blur', () => {
            if (text.contentEditable === "true") saveEdit();
        });

        text.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            }
        });

        const bgColorPicker = document.createElement('input');
        bgColorPicker.type = 'color';
        bgColorPicker.className = 'inline-color-picker';
        bgColorPicker.value = template.color || '#667eea';
        bgColorPicker.title = "背景色を変更";
        bgColorPicker.addEventListener('input', (e) => {
            template.color = e.target.value;
            li.style.backgroundColor = template.color;
            saveTemplates();
            renderQuickTemplates();
        });

        const textColorPicker = document.createElement('input');
        textColorPicker.type = 'color';
        textColorPicker.className = 'inline-color-picker';
        textColorPicker.value = template.textColor || '#ffffff';
        textColorPicker.title = "文字色を変更";
        textColorPicker.addEventListener('input', (e) => {
            template.textColor = e.target.value;
            text.style.color = template.textColor;
            saveTemplates();
            renderQuickTemplates();
        });
        
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-event-btn';
        editBtn.textContent = '編集';
        editBtn.addEventListener('click', () => {
            if (text.contentEditable === "true") {
                saveEdit();
            } else {
                text.contentEditable = "true";
                text.focus();
                
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(text);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
                
                editBtn.textContent = '完了';
            }
        });
        
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-event-btn';
        delBtn.innerHTML = '&times;';
        delBtn.addEventListener('click', () => {
            if (confirm(`テンプレート「${template.text}」を削除しますか？`)) {
                templatesData.splice(index, 1);
                saveTemplates();
                renderQuickTemplates();
                renderTemplateList();
            }
        });

        li.appendChild(text);
        li.appendChild(bgColorPicker);
        li.appendChild(textColorPicker);
        li.appendChild(editBtn);
        li.appendChild(delBtn);
        list.appendChild(li);
    });
}

document.addEventListener('DOMContentLoaded', init);
