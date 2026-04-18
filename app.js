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

let isDarkMode = JSON.parse(localStorage.getItem('calendarDarkMode')) || false;
if (isDarkMode) {
    document.body.classList.add('dark-mode');
}

function saveEvents() {
    localStorage.setItem('calendarEvents', JSON.stringify(eventsData));
}

function saveTemplates() {
    localStorage.setItem('calendarTemplates', JSON.stringify(templatesData));
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

    document.addEventListener('click', () => {
        const menu = document.getElementById('custom-context-menu');
        if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
            activeContextMenuCallbacks = null;
        }
    });

    document.getElementById('menu-edit').addEventListener('click', (e) => {
        if (activeContextMenuCallbacks && activeContextMenuCallbacks.edit) {
            activeContextMenuCallbacks.edit();
        }
    });

    document.getElementById('menu-add-template').addEventListener('click', (e) => {
        if (activeContextMenuCallbacks && activeContextMenuCallbacks.add) {
            activeContextMenuCallbacks.add();
        }
    });

    document.getElementById('btn-manage-templates').addEventListener('click', openTemplateModal);
    
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

function renderSingleCalendar(containerId, titleId, year, month) {
    const container = document.getElementById(containerId);
    const title = document.getElementById(titleId);
    container.innerHTML = '';
    title.textContent = `${year}年 ${month + 1}月`;

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
        
        if (eventsData[dateId]) {
            eventsData[dateId].forEach(evt => {
                const dot = document.createElement('div');
                dot.className = 'event-dot';
                if (evt.checked) dot.classList.add('checked');
                dot.style.backgroundColor = evt.color || '#667eea';
                dot.style.color = evt.textColor || '#ffffff';
                dot.textContent = evt.text || evt;
                indicatorContainer.appendChild(dot);
            });
        }
        dateCell.appendChild(indicatorContainer);

        dateCell.addEventListener('click', () => openModal(dateId, i, month, year));
        container.appendChild(dateCell);
    }
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

function renderEventList() {
    const list = document.getElementById('event-list');
    list.innerHTML = '';
    const events = eventsData[selectedDateId] || [];
    
    events.forEach((evt, index) => {
        const li = document.createElement('li');
        li.className = 'event-item';
        if (evt.checked) li.classList.add('checked');
        li.style.backgroundColor = evt.color || '#667eea';
        
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'event-checkbox';
        cb.checked = evt.checked;
        cb.addEventListener('change', () => {
            evt.checked = cb.checked;
            saveEvents();
            renderEventList();
            renderCalendars();
        });

        const text = document.createElement('span');
        text.className = 'event-text';
        text.style.color = evt.textColor || 'inherit';
        text.textContent = evt.text || evt;
        text.contentEditable = "false";
        text.spellcheck = false;
        
        const saveEdit = () => {
            const newText = text.textContent.trim();
            const originalText = evt.text || evt;
            if (newText && newText !== originalText) {
                if (typeof evt === 'object') {
                    evt.text = newText;
                } else {
                    eventsData[selectedDateId][index] = { text: newText, color: '#667eea', textColor: '#ffffff', checked: false };
                }
                saveEvents();
                renderCalendars();
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

                activeContextMenuCallbacks = {
                    edit: () => {
                        if (text.contentEditable !== "true") {
                            text.contentEditable = "true";
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
            saveEvents();
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
            saveEvents();
            renderCalendars();
        });
        
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-event-btn';
        delBtn.innerHTML = '&times;';
        delBtn.addEventListener('click', () => {
            eventsData[selectedDateId].splice(index, 1);
            if (eventsData[selectedDateId].length === 0) {
                delete eventsData[selectedDateId];
            }
            saveEvents();
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
