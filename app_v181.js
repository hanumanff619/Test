// ============================================================================
// Směnářek 1.8.1 – KOMPLETNÍ FINÁLNÍ VERZE (Hanuman & Gemini)
// ============================================================================

const MEAL_DEDUCT = 40;
const LUNCH_DEDUCT = 40;
const MEAL_INFO_VALUE = 110;

const MAP12 = { D: 'D 05:45–18:00', N: 'N 17:45–06:00', V: 'Dovolená' };
const MAP8 = { R: 'R 8h', O: 'O 8h', V: 'Dovolená' };

let state = JSON.parse(localStorage.getItem('smenarek_state_v181') || '{}');
if (!state.shifts) state.shifts = {};
if (!state.rates) state.rates = {};
if (!state.mode) state.mode = '12';
if (state.bonus_pct == null) state.bonus_pct = 10;
if (state.cafeteria_ok == null) state.cafeteria_ok = false;
if (!state.avg) state.avg = { net1: null, h1: null, net2: null, h2: null, net3: null, h3: null, avg_manual: null };
if (!state.yearSummary) state.yearSummary = {};
if (!state.monthFunds) state.monthFunds = {};
if (!state.monthRates) state.monthRates = {};

let current = new Date();
let selectedDate = null;

const $ = id => document.getElementById(id);
const pad = n => n < 10 ? '0' + n : n;
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const ym = d => d.getFullYear() + '-' + pad(d.getMonth() + 1);
const md = d => pad(d.getMonth() + 1) + '-' + pad(d.getDate());

function daysIn(y, m) { return new Date(y, m + 1, 0).getDate(); }
function firstDay(y, m) { let n = new Date(y, m, 1).getDay(); return n === 0 ? 7 : n; }
const isW = d => [0, 6].includes(d.getDay());
const isSat = d => d.getDay() === 6;
const r2 = x => Math.round(x * 100) / 100;
const nval = v => (+v) || 0;
function money(x) { return (Math.round((x || 0) * 100) / 100).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kč'; }
function save() { localStorage.setItem('smenarek_state_v181', JSON.stringify(state)); }
function rShiftNightH(dt) { if (!dt) return 0; return isW(dt) ? 1 : (35 / 60); }

async function setTodayNameday() {
    try {
        const d = new Date();
        const res = await fetch(`https://svatkyapi.cz/api/day?date=${ymd(d)}`);
        const data = await res.json();
        if ($('todayNameday')) $('todayNameday').textContent = 'Svátek: ' + (data.name || '—');
    } catch (e) { if ($('todayNameday')) $('todayNameday').textContent = 'Svátek: —'; }
}

const HOLI_CACHE = {};
function easterSunday(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4,
          f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
          i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
          month = Math.floor((h + l - 7 * m + 114) / 31), day = 1 + ((h + l - 7 * m + 114) % 31);
    return new Date(year, month - 1, day);
}
function czechHolidays(year) {
    if (HOLI_CACHE[year]) return HOLI_CACHE[year];
    const fixed = ['01-01', '05-01', '05-08', '07-05', '07-06', '09-28', '10-28', '11-17', '12-24', '12-25', '12-26'];
    const set = new Set(fixed);
    const easter = easterSunday(year), gf = new Date(easter), em = new Date(easter);
    gf.setDate(easter.getDate() - 2); em.setDate(easter.getDate() + 1);
    set.add(pad(gf.getMonth() + 1) + '-' + pad(gf.getDate()));
    set.add(pad(em.getMonth() + 1) + '-' + pad(em.getDate()));
    HOLI_CACHE[year] = set; return set;
}
const isHoliday = dt => czechHolidays(dt.getFullYear()).has(md(dt));

function applyBackground() {
    const layer = $('bg-layer'); if (!layer) return;
    const url = state.mode === '8' ? 'backgrounds/bg_8h.jpg' : 'backgrounds/bg_12h.jpg';
    layer.style.backgroundImage = `url("${url}")`;
}

function updateHeader() {
    const today = new Date(); const t = state.shifts[ymd(today)] || '—';
    let label = '—';
    if (t !== '—') {
        if (t === 'R') label = isW(today) ? 'R 05:00–13:15' : 'R 05:25–13:59';
        else if (t === 'O') label = 'O 13:59–22:00';
        else label = MAP12[t] || MAP8[t] || t;
    }
    if ($('todayShift')) $('todayShift').textContent = 'Dnes: ' + label;
    setTodayNameday();
}

function nextCode(cur) {
    const codes = ["", "R", "O", "D", "N", "V"];
    let idx = codes.indexOf(cur);
    return codes[(idx + 1) % codes.length];
}

function setShift(dateStr, t, rerender = true) {
    if (!['R', 'O', 'D', 'N', 'V', ''].includes(t)) return;
    if (t === '') delete state.shifts[dateStr]; else state.shifts[dateStr] = t;
    save(); if (rerender) renderCalendar();
}

function bindInputsOnce() {
    if (window._inputsBound) return; window._inputsBound = true;
    ['rate_base', 'rate_odpo', 'rate_noc', 'rate_vikend', 'rate_nepretrzity'].forEach(id => {
        const el = $(id); if (!el) return;
        el.value = state.rates[id] ?? '';
        el.oninput = () => { state.rates[id] = el.value === '' ? null : nval(el.value); save(); calcPay(); };
    });
    if ($('bonus_pct')) { $('bonus_pct').value = state.bonus_pct; $('bonus_pct').oninput = e => { state.bonus_pct = nval(e.target.value); save(); calcPay(); }; }
    if ($('caf_check')) { $('caf_check').checked = !!state.cafeteria_ok; $('caf_check').onchange = e => { state.cafeteria_ok = e.target.checked; save(); calcPay(); }; }
    const fbm = $('fund_bonus_month'); if (fbm) { fbm.oninput = e => { const key = ym(current); state.monthFunds[key] = e.target.value === '' ? null : nval(e.target.value); save(); calcPay(); }; }
    
    [['avg_net1', 'net1'], ['avg_net2', 'net2'], ['avg_net3', 'net3'], ['avg_h1', 'h1'], ['avg_h2', 'h2'], ['avg_h3', 'h3'], ['avg_manual', 'avg_manual']].forEach(([id, key]) => {
        const el = $(id); if (!el) return; el.value = state.avg[key] ?? '';
        el.oninput = () => { state.avg[key] = el.value === '' ? null : nval(el.value); save(); calcPay(); };
    });

    if ($('prev')) $('prev').onclick = () => { current.setMonth(current.getMonth() - 1); selectedDate = null; renderCalendar(); };
    if ($('next')) $('next').onclick = () => { current.setMonth(current.getMonth() + 1); selectedDate = null; renderCalendar(); };
    if ($('setToday')) $('setToday').onclick = () => { const k = ymd(new Date()); setShift(k, nextCode(state.shifts[k] || '')); };
    if ($('clearDay')) $('clearDay').onclick = () => { if (selectedDate) setShift(selectedDate, ''); };
    if ($('mode12')) $('mode12').onclick = () => { state.mode = '12'; save(); renderCalendar(); };
    if ($('mode8')) $('mode8').onclick = () => { state.mode = '8'; save(); renderCalendar(); };
    if ($('toggleAudit')) $('toggleAudit').onclick = () => { const box = $('audit'); if (!box) return; box.style.display = (box.style.display === 'none' || !box.style.display) ? 'block' : 'none'; if (box.style.display === 'block') renderAudit(); };
}

function updateStats() {
    const y = current.getFullYear(), m = current.getMonth(), last = new Date(y, m + 1, 0);
    const DAILY_WORKED = 11.25, VAC_VAL = state.mode === '8' ? 8.0 : 11.25;
    let dDay = 0, nDay = 0, rDays = 0, oDays = 0, vac = 0, hours = 0, nightH = 0, afterH = 0, weekendH = 0, holWorkedH = 0;
    for (let i = 1; i <= last.getDate(); i++) {
        const dt = new Date(y, m, i), key = ymd(dt), t = state.shifts[key];
        if (!t) continue; if (t === 'V') { vac++; continue; }
        if (t === 'R' || t === 'O') {
            if (t === 'O') oDays++; else rDays++; hours += 8.0; if (t === 'O') afterH += 6.0;
            nightH += rShiftNightH(dt); if (isW(dt)) weekendH += 8.0; if (isHoliday(dt)) holWorkedH += 8.0;
        } else if (t === 'D') { dDay++; hours += DAILY_WORKED; afterH += 3.75; if (isW(dt)) weekendH += DAILY_WORKED; if (isHoliday(dt)) holWorkedH += 11.25; }
        else if (t === 'N') { nDay++; hours += DAILY_WORKED; afterH += 4.0; nightH += 7.25; if (isW(dt)) weekendH += DAILY_WORKED; if (isHoliday(dt)) holWorkedH += 11.25; const nextDay = new Date(y, m, i + 1); if (isHoliday(nextDay)) holWorkedH += 6; }
    }
    if ($('stats')) $('stats').innerHTML = `R:${rDays} O:${oDays} D:${dDay} N:${nDay} V:${vac}<br>Hodiny: <b>${r2(hours)}</b> | Svátek: <b>${r2(holWorkedH)}h</b>`;
    if ($('substats')) {
        $('substats').style.display = 'block';
        $('substats').innerHTML = [`<div class="payline"><span>Odpolední hodiny</span><span><b>${r2(afterH)}</b> h</span></div>`, `<div class="payline"><span>Noční hodiny</span><span><b>${r2(nightH)}</b> h</span></div>`, `<div class="payline"><span>Víkendové hodiny</span><span><b>${r2(weekendH)}</b> h</span></div>`].join('');
    }
    state._calc = { hours, afterH, nightH, weekendH, vac, holWorkedH, DAILY_WORKED, VAC_VAL }; save();
}

function avgRate() {
    const man = nval(state.avg.avg_manual); if (man > 0) return man;
    const sNet = nval(state.avg.net1) + nval(state.avg.net2) + nval(state.avg.net3);
    const sH = nval(state.avg.h1) + nval(state.avg.h2) + nval(state.avg.h3);
    return (sNet > 0 && sH > 0) ? sNet / sH : 253.24;
}

function calcPay() {
    const avg = avgRate(); const C = state._calc || { hours: 0, afterH: 0, nightH: 0, weekendH: 0, vac: 0, holWorkedH: 0 };
    const ymKey = ym(current), effB = nval(state.rates['rate_base']) || 148.50;
    const r = { b: effB, o: nval(state.rates['rate_odpo']) || 6.45, n: nval(state.rates['rate_noc']) || 25, v: nval(state.rates['rate_vikend']) || 35, nep: nval(state.rates['rate_nepretrzity']) };
    const basePay = r.b * C.hours, odpoPay = r.o * C.afterH, nightPay = r.n * C.nightH, weekPay = r.v * C.weekendH, holPay = avg * C.holWorkedH, otExtraPay = (avg * 0.25) * r.nep;
    const primeP = basePay * (nval(state.bonus_pct) / 100), vacPay = (C.VAC_VAL || 11.25) * avg * C.vac, fund = nval(state.monthFunds[ymKey]);
    let satB = 0, mc = 0, lc = 0;
    for (let i = 1; i <= daysIn(current.getFullYear(), current.getMonth()); i++) {
        const dt = new Date(current.getFullYear(), current.getMonth(), i), t = state.shifts[ymd(dt)]; if (!t || t === 'V') continue;
        if (t === 'R' && isSat(dt)) satB += 500;
        if (t === 'N') mc += 2; else if (t === 'D') { if (isW(dt)) mc += 2; else { mc += 1; lc++; } } else if (t === 'R' || t === 'O') { if (isSat(dt)) mc += 1; else if (!isW(dt)) lc++; }
    }
    const gross = basePay + odpoPay + nightPay + weekPay + holPay + otExtraPay + primeP + vacPay + fund + satB;
    const soc = Math.round(gross * 0.065), hlth = Math.round(gross * 0.045), tax = Math.max(0, (Math.ceil(gross) - soc - hlth) * 0.15 - 2570), net = gross - soc - hlth - tax - (mc*40 + lc*40);
    
    // ✅ FIX CAFETERIE
    const cafVal = state.cafeteria_ok ? '1 000,00 Kč' : '0,00 Kč';
    if ($('cafInfo')) $('cafInfo').innerHTML = `🎁 Cafeterie (mimo čistou): <b>${cafVal}</b>`;

    if ($('gross')) $('gross').textContent = '💼 Hrubá mzda: ' + money(gross);
    if ($('net')) $('net').textContent = '💵 Čistá mzda (odhad): ' + money(net);
    if ($('meal')) $('meal').textContent = '🍽️ Stravenky: ' + mc + ' ks — ' + money(mc * 110);
    
    state.yearSummary[current.getFullYear()] = state.yearSummary[current.getFullYear()] || {};
    state.yearSummary[current.getFullYear()][current.getMonth()] = { gross, net, hours: C.hours, mealCount: mc, mealValue: mc * 110 };
    save(); renderYearSummary();
}

function renderYearSummary() {
    const box = $('yearSummary'); if (!box) return; const y = current.getFullYear(), rows = state.yearSummary[y] || {}, months = Object.keys(rows).map(k => +k).sort((a, b) => a - b);
    let sG = 0, sN = 0, sMC = 0, sMV = 0;
    months.forEach(m => { sG += rows[m].gross; sN += rows[m].net; sMC += rows[m].mealCount || 0; sMV += rows[m].mealValue || 0; });
    box.innerHTML = `<hr><div class="payline"><span>Hrubá (rok ${y})</span><span><b>${money(sG)}</b></span></div><div class="payline"><span>Čistá (rok ${y})</span><span><b>${money(sN)}</b></span></div>`;
}

function renderCalendar() {
    document.body.classList.toggle('mode8', state.mode === '8'); applyBackground();
    const y = current.getFullYear(), m = current.getMonth(), total = daysIn(y, m), start = firstDay(y, m) - 1, todayKey = ymd(new Date());
    if ($('monthLabel')) $('monthLabel').textContent = new Date(y, m).toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });
    let html = `<thead><tr>${["Po", "Út", "St", "Čt", "Pá", "So", "Ne"].map(d => `<th>${d}</th>`).join("")}</tr></thead><tbody>`;
    let day = 1;
    for (let r = 0; r < 6; r++) {
        html += "<tr>";
        for (let c = 0; c < 7; c++) {
            if ((r === 0 && c < start) || day > total) { html += "<td></td>"; continue; }
            const dt = new Date(y, m, day), key = ymd(dt), t = state.shifts[key] || "";
            html += `<td data-date="${key}" class="${t} ${selectedDate === key ? 'selected' : ''} ${key === todayKey ? 'today' : ''}">
                 <div class="daynum">${day}${isHoliday(dt) ? ' 🎌' : ''}</div>
                 ${t ? `<span class="badge">${t}</span>` : ''}
               </td>`;
            day++;
        }
        html += "</tr>"; if (day > total) break;
    }
    if ($('cal')) {
        $('cal').innerHTML = html + "</tbody>";
        $('cal').querySelectorAll('td[data-date]').forEach(td => { td.onclick = () => { selectedDate = td.dataset.date; setShift(td.dataset.date, nextCode(state.shifts[td.dataset.date] || '')); }; });
    }
    updateStats(); updateHeader(); bindInputsOnce(); calcPay();
}

renderCalendar();
