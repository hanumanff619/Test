// ============================================================================
// Směnářek 1.8.1 – KOMPLETNÍ FULL VERZE BEZ KRÁCENÍ (Hanuman Edition)
// ============================================================================

const MEAL_DEDUCT = 40;
const LUNCH_DEDUCT = 40;
const MEAL_INFO_VALUE = 110;

const MAP12 = { 
    D: 'D 05:45–18:00', 
    N: 'N 17:45–06:00', 
    V: 'Dovolená' 
};

const MAP8 = { 
    R: 'R 8h (Po–Pá 05:25 / So–Ne 05:00)', 
    V: 'Dovolená' 
};

let state = JSON.parse(localStorage.getItem('smenarek_state_v181') || '{}');

if (!state.shifts) state.shifts = {};
if (!state.rates) state.rates = {};
if (!state.mode) state.mode = '12';
if (state.bonus_pct == null) state.bonus_pct = 10;
if (state.annual_bonus == null) state.annual_bonus = 0;
if (state.cafeteria_ok == null) state.cafeteria_ok = false;

if (!state.monthFunds) state.monthFunds = {};
if (!state.monthRates) state.monthRates = {};

if (!state.avg) {
    state.avg = {
        net1: null, 
        h1: null, 
        net2: null, 
        h2: null, 
        net3: null, 
        h3: null, 
        avg_manual: null
    };
}

if (!state.yearSummary) state.yearSummary = {};

let current = new Date();
let selectedDate = null;

// Pomocné funkce
const $ = id => document.getElementById(id);
const pad = n => n < 10 ? '0' + n : n;
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const ym = d => d.getFullYear() + '-' + pad(d.getMonth() + 1);
const md = d => pad(d.getMonth() + 1) + '-' + pad(d.getDate());

function daysIn(y, m) {
    return new Date(y, m + 1, 0).getDate();
}

function firstDay(y, m) {
    let n = new Date(y, m, 1).getDay();
    return n === 0 ? 7 : n;
}

const isW = d => [0, 6].includes(d.getDay());
const isSat = d => d.getDay() === 6;

const r2 = x => Math.round(x * 100) / 100;
const nval = v => (+v) || 0;

function money(x) {
    return (Math.round((x || 0) * 100) / 100).toLocaleString('cs-CZ', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + ' Kč';
}

function save() {
    localStorage.setItem('smenarek_state_v181', JSON.stringify(state));
}

function rShiftNightH(dt) {
    if (!dt) return 0;
    return isW(dt) ? 1 : (35 / 60);
}

// Namedays
async function setTodayNameday() {
    try {
        const d = new Date();
        const y = d.getFullYear();
        const m = ('0' + (d.getMonth() + 1)).slice(-2);
        const dd = ('0' + d.getDate()).slice(-2);
        const res = await fetch(`https://svatkyapi.cz/api/day?date=${y}-${m}-${dd}`);
        const data = await res.json();
        if ($('todayNameday')) {
            $('todayNameday').textContent = 'Svátek: ' + (data.name || '—');
        }
    } catch (e) {
        if ($('todayNameday')) {
            $('todayNameday').textContent = 'Svátek: —';
        }
    }
}

// Svátky
const HOLI_CACHE = {};
function easterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = 1 + ((h + l - 7 * m + 114) % 31);
    return new Date(year, month - 1, day);
}

function czechHolidays(year) {
    if (HOLI_CACHE[year]) return HOLI_CACHE[year];
    const fixed = ['01-01', '05-01', '05-08', '07-05', '07-06', '09-28', '10-28', '11-17', '12-24', '12-25', '12-26'];
    const set = new Set(fixed);
    const easter = easterSunday(year);
    const goodFriday = new Date(easter);
    goodFriday.setDate(easter.getDate() - 2);
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);
    set.add(pad(goodFriday.getMonth() + 1) + '-' + pad(goodFriday.getDate()));
    set.add(pad(easterMonday.getMonth() + 1) + '-' + pad(easterMonday.getDate()));
    HOLI_CACHE[year] = set;
    return set;
}

function isHoliday(dt) {
    return czechHolidays(dt.getFullYear()).has(md(dt));
}

function applyBackground() {
    const layer = $('bg-layer');
    if (!layer) return;
    const url = state.mode === '8' ? 'backgrounds/bg_8h.jpg' : 'backgrounds/bg_12h.jpg';
    layer.style.backgroundImage = `url("${url}")`;
}

function updateHeader() {
    const today = new Date();
    const t = state.shifts[ymd(today)] || '—';
    let label = '—';
    if (t !== '—') {
        if (t === 'R') {
            label = isW(today) ? 'R 05:00–13:15' : 'R 05:25–13:59';
        } else {
            label = MAP12[t] || MAP8[t] || t;
        }
    }
    if ($('todayShift')) {
        $('todayShift').textContent = 'Dnes: ' + label;
    }
    setTodayNameday();
}

function nextCode(cur) {
    const codes = ["", "R", "D", "N", "V"];
    let idx = codes.indexOf(cur);
    return codes[(idx + 1) % codes.length];
}

function setShift(dateStr, t, rerender = true) {
    const valid = ['R', 'D', 'N', 'V', ''];
    if (!valid.includes(t)) return;
    if (t === '') {
        delete state.shifts[dateStr];
    } else {
        state.shifts[dateStr] = t;
    }
    save();
    if (rerender) renderCalendar();
}

function bindInputsOnce() {
    if (window._inputsBound) return;
    window._inputsBound = true;

    ['rate_base', 'rate_odpo', 'rate_noc', 'rate_vikend', 'rate_nepretrzity'].forEach(id => {
        const el = $(id);
        if (!el) return;
        if (id === 'rate_noc' && !state.rates[id]) state.rates[id] = 25;
        if (id === 'rate_vikend' && !state.rates[id]) state.rates[id] = 35;
        el.value = state.rates[id] ?? '';
        el.oninput = () => {
            state.rates[id] = el.value === '' ? null : nval(el.value);
            save();
            calcPay();
        };
    });

    if ($('bonus_pct')) {
        $('bonus_pct').value = state.bonus_pct;
        $('bonus_pct').oninput = e => {
            state.bonus_pct = nval(e.target.value);
            save();
            calcPay();
        };
    }

    if ($('annual_bonus')) {
        $('annual_bonus').value = state.annual_bonus;
        $('annual_bonus').oninput = e => {
            state.annual_bonus = nval(e.target.value);
            save();
            calcPay();
        };
    }

    if ($('caf_check')) {
        $('caf_check').checked = !!state.cafeteria_ok;
        $('caf_check').onchange = e => {
            state.cafeteria_ok = e.target.checked;
            save();
            calcPay();
        };
    }

    const fbm = $('fund_bonus_month');
    if (fbm) {
        fbm.oninput = e => {
            const key = ym(current);
            state.monthFunds[key] = e.target.value === '' ? null : nval(e.target.value);
            save();
            calcPay();
        };
    }

    const rbm = $('rate_base_month');
    if (rbm) {
        rbm.oninput = e => {
            const key = ym(current);
            state.monthRates[key] = e.target.value === '' ? null : nval(e.target.value);
            save();
            calcPay();
        };
    }

    const fields = [
        ['avg_net1', 'net1'], ['avg_net2', 'net2'], ['avg_net3', 'net3'],
        ['avg_h1', 'h1'], ['avg_h2', 'h2'], ['avg_h3', 'h3'],
        ['avg_manual', 'avg_manual']
    ];
    fields.forEach(([id, key]) => {
        const el = $(id);
        if (!el) return;
        el.value = state.avg[key] ?? '';
        el.oninput = () => {
            state.avg[key] = el.value === '' ? null : nval(el.value);
            save();
            calcPay();
        };
    });

    if ($('prev')) {
        $('prev').onclick = () => {
            current.setMonth(current.getMonth() - 1);
            selectedDate = null;
            renderCalendar();
        };
    }
    if ($('next')) {
        $('next').onclick = () => {
            current.setMonth(current.getMonth() + 1);
            selectedDate = null;
            renderCalendar();
        };
    }
    if ($('setToday')) {
        $('setToday').onclick = () => {
            const k = ymd(new Date());
            setShift(k, nextCode(state.shifts[k] || ''));
        };
    }
    if ($('clearDay')) {
        $('clearDay').onclick = () => {
            if (selectedDate) setShift(selectedDate, '');
        };
    }
    if ($('mode12')) {
        $('mode12').onclick = () => {
            state.mode = '12';
            save();
            renderCalendar();
        };
    }
    if ($('mode8')) {
        $('mode8').onclick = () => {
            state.mode = '8';
            save();
            renderCalendar();
        };
    }
    if ($('toggleAudit')) {
        $('toggleAudit').onclick = () => {
            const box = $('audit');
            if (!box) return;
            box.style.display = (box.style.display === 'none' || !box.style.display) ? 'block' : 'none';
            if (box.style.display === 'block') renderAudit();
        };
    }
}

function refreshMonthScopedInputs() {
    const key = ym(current);
    if ($('fund_bonus_month')) $('fund_bonus_month').value = state.monthFunds[key] ?? '';
    if ($('rate_base_month')) $('rate_base_month').value = state.monthRates[key] ?? '';
}

function updateStats() {
    const y = current.getFullYear();
    const m = current.getMonth();
    const last = new Date(y, m + 1, 0);
    const DAILY_WORKED = 11.25;
    const VAC12 = 11.25;
    const H8 = 8.0;

    let dDay = 0, nDay = 0, vac = 0, hours = 0, nightH = 0, afterH = 0, weekendH = 0, holWorkedH = 0, rDays = 0;

    for (let i = 1; i <= last.getDate(); i++) {
        const dt = new Date(y, m, i);
        const key = ymd(dt);
        const t = state.shifts[key];
        if (!t) continue;
        if (t === 'V') { vac++; continue; }
        if (t === 'R') {
            rDays++;
            hours += H8;
            nightH += rShiftNightH(dt);
            if (isW(dt)) weekendH += H8;
            if (isHoliday(dt)) holWorkedH += H8;
        } else if (t === 'D') {
            dDay++;
            hours += DAILY_WORKED;
            afterH += 3.75;
            if (isW(dt)) weekendH += DAILY_WORKED;
            if (isHoliday(dt)) holWorkedH += VAC12;
        } else if (t === 'N') {
            nDay++;
            hours += DAILY_WORKED;
            afterH += 4;
            nightH += 7.25;
            if (isW(dt)) weekendH += DAILY_WORKED;
            if (isHoliday(dt)) holWorkedH += VAC12;
            const nextDay = new Date(y, m, i + 1);
            if (isHoliday(nextDay)) holWorkedH += 6;
        }
    }

    if ($('stats')) {
        const head = state.mode === '8' ? `Ranní: <b>${rDays}</b> • Dovolené: <b>${vac}</b>` : `Denní: <b>${dDay}</b> • Noční: <b>${nDay}</b> • Dovolené: <b>${vac}</b>`;
        $('stats').innerHTML = head + `<br>Hodiny: <b>${r2(hours)}</b><br>Svátek odpracovaný: <b>${r2(holWorkedH)} h</b>`;
    }

    if ($('substats')) {
        $('substats').style.display = 'block';
        $('substats').innerHTML = [
            `<div class="payline"><span>Odpolední hodiny</span><span><b>${r2(afterH)}</b> h</span></div>`,
            `<div class="payline"><span>Noční hodiny (22–6)</span><span><b>${r2(nightH)}</b> h</span></div>`,
            `<div class="payline"><span>Víkendové hodiny</span><span><b>${r2(weekendH)}</b> h</span></div>`
        ].join('');
    }
    state._calc = { hours, afterH, nightH, weekendH, vac, holWorkedH, DAILY_WORKED, H8, VAC12 };
    save();
}

function autoAvgFromHistory() {
    const y = current.getFullYear();
    const m = current.getMonth();
    const months = [];
    for (let k = 1; k <= 12; k++) {
        const mm = (m - k + 12) % 12;
        const yy = m - k < 0 ? y - 1 : y;
        if (state.yearSummary?.[yy]?.[mm]) {
            months.push(state.yearSummary[yy][mm]);
            if (months.length >= 3) break;
        }
    }
    if (!months.length) return 0;
    const sumNet = months.reduce((a, b) => a + (b.net || 0), 0);
    const sumH = months.reduce((a, b) => a + (b.hours || 0), 0);
    return sumH > 0 ? (sumNet / sumH) : 0;
}

function avgRate() {
    const man = nval(state.avg.avg_manual);
    if (man > 0) return man;
    const sNet = nval(state.avg.net1) + nval(state.avg.net2) + nval(state.avg.net3);
    const sH = nval(state.avg.h1) + nval(state.avg.h2) + nval(state.avg.h3);
    if (sNet > 0 && sH > 0) return sNet / sH;
    return autoAvgFromHistory() || 253.24;
}

function updateAvgInfo() {
    const v = avgRate();
    if ($('avg_info')) $('avg_info').textContent = 'Průměrná náhrada: ' + money(v);
}

function computeDailyBreakdown() {
    const y = current.getFullYear();
    const m = current.getMonth();
    const last = daysIn(y, m);
    const rows = [];
    for (let i = 1; i <= last; i++) {
        const dt = new Date(y, m, i);
        const key = ymd(dt);
        const t = state.shifts[key] || '';
        let w = 0, a = 0, n = 0, wk = 0, h = 0;
        if (t === 'R') {
            w = 8; n = rShiftNightH(dt);
            if (isW(dt)) wk = 8;
            if (isHoliday(dt)) h = 8;
        } else if (t === 'D') {
            w = 11.25; a = 3.75;
            if (isW(dt)) wk = 11.25;
            if (isHoliday(dt)) h = 11.25;
        } else if (t === 'N') {
            w = 11.25; a = 4; n = 7.25;
            if (isW(dt)) wk = 11.25;
            if (isHoliday(dt)) h = 11.25;
            if (isHoliday(new Date(y, m, i + 1))) h += 6;
        }
        rows.push({ l: i, t, w, a, n, wk, h });
    }
    return rows;
}

function renderAudit() {
    const box = $('audit');
    if (!box) return;
    const rows = computeDailyBreakdown();
    const s = (k) => rows.reduce((acc, r) => acc + (r[k] || 0), 0);
    box.innerHTML = `<div class="payline" style="font-weight:700"><span>Den</span><span>Směna</span><span>Odprac.</span><span>Odpol.</span><span>Noční</span><span>Víkend</span><span>Svátek h</span></div>` +
        rows.map(r => `<div class="payline"><span>${r.l}.</span><span>${r.t || '—'}</span><span>${r2(r.w)}</span><span>${r2(r.a)}</span><span>${r2(r.n)}</span><span>${r2(r.wk)}</span><span>${r2(r.h)}</span></div>`).join('') +
        `<div class="payline" style="font-weight:700"><span>Součet</span><span></span><span>${r2(s('w'))}</span><span>${r2(s('a'))}</span><span>${r2(s('n'))}</span><span>${r2(s('wk'))}</span><span>${r2(s('h'))}</span></div>`;
}

function calcPay() {
    const avg = avgRate();
    updateAvgInfo();
    const C = state._calc || { hours: 0, afterH: 0, nightH: 0, weekendH: 0, vac: 0, holWorkedH: 0 };

    const ymKey = ym(current);
    const baseM = nval(state.monthRates[ymKey]);
    const baseG = nval(state.rates['rate_base']);
    const effB = baseM > 0 ? baseM : (baseG || 148.50);

    const r = {
        b: effB,
        o: nval(state.rates['rate_odpo']),
        n: nval(state.rates['rate_noc']) || 25,
        v: nval(state.rates['rate_vikend']) || 35,
        nep: nval(state.rates['rate_nepretrzity'])
    };

    const basePay = r.b * C.hours;
    const nightPay = r.n * C.nightH;
    const weekPay = r.v * C.weekendH;
    const holPay = avg * C.holWorkedH;
    const otExtraPay = (avg * 0.25) * r.nep;
    const primeP = basePay * (nval(state.bonus_pct) / 100);
    const vH = (state.mode === '8' ? 8 : 11.25);
    const vacPay = vH * avg * C.vac;

    const annB = (current.getMonth() === 5 || current.getMonth() === 10 ? nval(state.annual_bonus) : 0);
    const fund = nval(state.monthFunds[ymKey]);

    let satB = 0;
    for (let i = 1; i <= daysIn(current.getFullYear(), current.getMonth()); i++) {
        const dt = new Date(current.getFullYear(), current.getMonth(), i);
        if (state.shifts[ymd(dt)] === 'R' && isSat(dt)) satB += 500;
    }

    let mc = 0, lc = 0;
    for (let i = 1; i <= daysIn(current.getFullYear(), current.getMonth()); i++) {
        const dt = new Date(current.getFullYear(), current.getMonth(), i);
        const t = state.shifts[ymd(dt)];
        if (!t || t === 'V') continue;
        if (t === 'N') mc += 2;
        else if (t === 'D') { if (isW(dt)) mc += 2; else { mc += 1; lc++; } }
        else if (t === 'R') { if (isSat(dt)) mc += 1; else if (!isW(dt)) lc++; }
    }

    const mD = mc * MEAL_DEDUCT;
    const lD = lc * LUNCH_DEDUCT;
    const gross = basePay + nightPay + weekPay + holPay + otExtraPay + primeP + vacPay + annB + fund + satB;

    const soc = Math.round(gross * 0.065);
    const hlth = Math.round(gross * 0.045);
    const tax = Math.max(0, (Math.ceil(gross) - soc - hlth) * 0.15 - 2570);
    const net = gross - soc - hlth - tax - (mD + lD);

    $('pay').innerHTML = [
        ['Základ', money(basePay) + ` (${r.b} Kč/h)`],
        ['Noční příplatek', money(nightPay)],
        ['Víkendový příplatek', money(weekPay)],
        ['Soboty R (+500/ks)', money(satB)],
        ['Svátek (100% průměru)', money(holPay)],
        ['Příplatek přesčas (25% z průměru)', money(otExtraPay)],
        ['Prémie (' + (state.bonus_pct || 0) + '%)', money(primeP)],
        ['Náhrada za dovolenou', money(vacPay)],
        ['Fond vedoucího (měsíc)', money(fund)],
        ['Roční motivační', money(annB)],
        ['Srážka stravenky', '− ' + money(mD)],
        ['Srážka obědy', '− ' + money(lD)]
    ].map(([k, v]) => `<div class="payline"><span>${k}</span><span><b>${v}</b></span></div>`).join('');

    $('gross').textContent = '💼 Hrubá mzda: ' + money(gross);
    $('net').textContent = '💵 Čistá mzda (odhad): ' + money(net);
    $('meal').textContent = '🍽️ Stravenky: ' + mc + ' ks — ' + money(mc * 110);
    $('cafInfo').textContent = '🎁 Cafeterie (mimo čistou): ' + (state.cafeteria_ok ? '1 000,00 Kč' : '0 Kč');

    state.yearSummary[current.getFullYear()] = state.yearSummary[current.getFullYear()] || {};
    state.yearSummary[current.getFullYear()][current.getMonth()] = { gross, net, hours: C.hours, mealCount: mc, mealValue: mc * 110, ts: Date.now() };
    save();
    renderYearSummary();
}

function renderYearSummary() {
    const box = $('yearSummary');
    if (!box) return;
    const y = current.getFullYear();
    const rows = state.yearSummary[y] || {};
    const months = Object.keys(rows).map(k => +k).sort((a, b) => a - b);
    let sG = 0, sN = 0, sMC = 0, sMV = 0;
    months.forEach(m => {
        sG += rows[m].gross;
        sN += rows[m].net;
        sMC += rows[m].mealCount || 0;
        sMV += rows[m].mealValue || 0;
    });
    box.innerHTML = `<hr><div class="payline"><span>Hrubá (rok ${y})</span><span><b>${money(sG)}</b></span></div><div class="payline"><span>Čistá (rok ${y})</span><span><b>${money(sN)}</b></span></div><div class="payline"><span>Stravenky (rok ${y})</span><span><b>${sMC} ks — ${money(sMV)}</b></span></div><div class="subtle">Započítáno měsíců: ${months.length}</div>`;
}

function renderCalendar() {
    document.body.classList.toggle('mode8', state.mode === '8');
    applyBackground();
    const y = current.getFullYear();
    const m = current.getMonth();
    const total = daysIn(y, m);
    const start = firstDay(y, m) - 1;
    const todayKey = ymd(new Date());

    $('monthLabel').textContent = new Date(y, m).toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });
    let html = `<thead><tr>${["Po", "Út", "St", "Čt", "Pá", "So", "Ne"].map(d => `<th>${d}</th>`).join("")}</tr></thead><tbody>`;
    let day = 1;
    for (let r = 0; r < 6; r++) {
        html += "<tr>";
        for (let c = 0; c < 7; c++) {
            if ((r === 0 && c < start) || day > total) {
                html += "<td></td>";
                continue;
            }
            const dt = new Date(y, m, day);
            const key = ymd(dt);
            const t = state.shifts[key] || "";
            html += `<td data-date="${key}" class="${t} ${selectedDate === key ? 'selected' : ''} ${key === todayKey ? 'today' : ''}">
                 <div class="daynum">${day}${isHoliday(dt) ? ' 🎌' : ''}</div>
                 ${t ? `<span class="badge">${t}</span>` : ''}
               </td>`;
            day++;
        }
        html += "</tr>";
    }
    $('cal').innerHTML = html + "</tbody>";
    $('cal').querySelectorAll('td[data-date]').forEach(td => {
        td.onclick = () => {
            selectedDate = td.dataset.date;
            setShift(td.dataset.date, nextCode(state.shifts[td.dataset.date] || ''));
        };
    });
    updateStats();
    updateHeader();
    bindInputsOnce();
    refreshMonthScopedInputs();
    calcPay();
}

renderCalendar();
