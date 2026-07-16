// ============================================================================
// Směnářek 1.8.1 – KOMPLETNÍ FULL VERZE (Hanuman & Family Edition)
// ============================================================================

const MEAL_DEDUCT = 40;
const LUNCH_DEDUCT = 40;
const MEAL_INFO_VALUE = 110;

const MAP12 = { 
    D: 'D 05:45–18:01', 
    N: 'N 17:45–06:01', 
    V: 'Dovolená' 
};

const MAP8 = { 
    R: 'R 06:00–14:31', 
    V: 'Dovolená' 
};

const MAP775 = { 
    R: 'R 05:45–14:01', 
    O: 'O 13:45–22:01', 
    V: 'Dovolená' 
};

let state = JSON.parse(localStorage.getItem('smenarek_state_v181') || '{}');

if (!state.shifts) state.shifts = {};
if (!state.rates) state.rates = {};
if (!state.mode) state.mode = '12';
if (state.bonus_pct == null) state.bonus_pct = 10;
if (state.annual_bonus == null) state.annual_bonus = 0;
if (state.cafeteria_ok == null) state.cafeteria_ok = false;
if (state.lunches_775_ok == null) state.lunches_775_ok = true; 

if (!state.monthFunds) state.monthFunds = {};
if (!state.monthRates) state.monthRates = {};
if (!state.customHours) state.customHours = {};

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
    try {
        localStorage.setItem('smenarek_state_v181', JSON.stringify(state));
    } catch(e) {}
}

function rShiftNightH(dt) {
    if (!dt) return 0;
    return isW(dt) ? 1 : (35 / 60);
}

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
        if ($('todayNameday')) $('todayNameday').textContent = 'Svátek: —';
    }
}

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
    let url = 'bg_12h.jpg';
    if (state.mode === '8') url = 'bg_8h.jpg';
    if (state.mode === '7.75') url = 'bg_775h.jpg';
    layer.style.backgroundImage = `url("backgrounds/${url}")`;
}

function updateHeader() {
    const today = new Date();
    const t = state.shifts[ymd(today)] || '—';
    let label = '—';
    if (t !== '—') {
        if (t === 'R') {
            if (state.mode === '7.75') label = 'R 05:45–14:01 (7.75h)';
            else label = 'R 06:00–14:31 (8h)'; 
        } else if (t === 'F') {
            label = 'F 05:45–14:01 (Hluk)';
        } else {
            label = (state.mode === '7.75' ? MAP775[t] : (state.mode === '8' ? MAP8[t] : MAP12[t])) || t;
        }
    }
    if ($('todayShift')) $('todayShift').textContent = 'Dnes: ' + label;
    setTodayNameday();
}

function nextCode(cur) {
    let codes = ["", "R", "O", "D", "N", "F", "FO", "F16", "V"];
    if (state.mode === '7.75') codes = ["", "R", "O", "V"];
    let idx = codes.indexOf(cur);
    if (idx === -1) return codes[0];
    return codes[(idx + 1) % codes.length];
}

function setShift(dateStr, t, rerender = true) {
    const valid = ['R', 'O', 'D', 'N', 'F', 'FO', 'F16', 'V', ''];
    if (!valid.includes(t)) return;
    if (t === '') {
        delete state.shifts[dateStr];
        delete state.customHours[dateStr];
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

    const lcCheck = $('lunch_check');
    if (lcCheck) {
        lcCheck.onchange = e => {
            state.lunches_775_ok = e.target.checked;
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
        $('mode12').onclick = () => { state.mode = '12'; save(); renderCalendar(); };
    }
    if ($('mode8')) {
        $('mode8').onclick = () => { state.mode = '8'; save(); renderCalendar(); };
    }
    if ($('mode775')) {
        $('mode775').onclick = () => { state.mode = '7.75'; save(); renderCalendar(); };
    }
}

function refreshMonthScopedInputs() {
    const key = ym(current);
    if ($('fund_bonus_month')) $('fund_bonus_month').value = state.monthFunds[key] ?? '';
    if ($('rate_base_month')) $('rate_base_month').value = state.monthRates[key] ?? '';
    if ($('lunch_check')) $('lunch_check').checked = (state.lunches_775_ok === true);
}

function updateStats() {
    const y = current.getFullYear();
    const m = current.getMonth();
    const last = new Date(y, m + 1, 0);
    const DAILY_WORKED = 11.25;

    let dDay = 0, nDay = 0, vac = 0, hours = 0, nightH = 0, afterH = 0, weekendH = 0, rDays = 0, oDays = 0, fDays = 0, autoOT = 0;
    let holWorkedH = 0;
    let holPaidHomeDays = 0;
    let continuousH = 0; 

    for (let i = 1; i <= last.getDate(); i++) {
        const dt = new Date(y, m, i);
        const key = ymd(dt);
        const t = state.shifts[key];
        const isH = isHoliday(dt);
        const isWk = isW(dt);

        if (isH && !isWk && (!t || t === '')) {
            holPaidHomeDays++;
            continue;
        }

        if (!t) continue;
        if (t === 'V') { vac++; continue; }

        let baseShiftH = DAILY_WORKED;
        if (t === 'R' || t === 'O' || t === 'F' || t === 'FO' || t === 'F16') {
            if (state.mode === '7.75') {
                baseShiftH = 7.75; 
            } else {
                baseShiftH = (t === 'R') ? 8.0 : 7.75; 
            }
        }

        let curH = (state.customHours && state.customHours[key] !== undefined) ? nval(state.customHours[key]) : baseShiftH;

        if (isH || isWk) autoOT += curH;

        if (t === 'R' || t === 'O' || t === 'F' || t === 'FO' || t === 'F16') {
            if (t === 'F' || t === 'FO' || t === 'F16') {
                fDays += (t === 'F16' ? 2 : 1); 
                hours += curH; 
                if (t === 'FO' || t === 'F16') afterH += Math.min(curH, 7.75);
                if (isH) holWorkedH += curH;
                if (isWk) weekendH += curH;
            } else {
                if (t === 'O') oDays++; else rDays++;
                hours += curH;
                if (t === 'O') afterH += curH;
                nightH += rShiftNightH(dt);
                if (isWk) weekendH += curH;
                if (isH) holWorkedH += curH;
            }
        } else if (t === 'D') {
            dDay++; hours += curH; 
            continuousH += curH; 
            if (isWk) weekendH += curH; 
            if (isH) holWorkedH += curH;
        } else if (t === 'N') {
            nDay++; hours += curH; 
            continuousH += curH; 
            afterH += Math.min(4, Math.max(0, curH - 7.25)); 
            nightH += Math.min(7.25, curH);
            if (isWk) weekendH += curH; 
            if (isH) holWorkedH += curH;
            const nextDay = new Date(y, m, i + 1);
            if (isHoliday(nextDay)) holWorkedH += Math.min(6, curH);
        }
    }

    if ($('stats')) {
        $('stats').innerHTML = `R:${rDays} O:${oDays} F:${fDays} D:${dDay} N:${nDay} V:${vac}<br>Hodiny: <b>${r2(hours)}</b> | Svátek v práci: <b>${r2(holWorkedH)}h</b>`;
    }

    if ($('substats')) {
        $('substats').style.display = 'block';
        $('substats').innerHTML = [
            `<div class="payline"><span>Odpolední hodiny</span><span><b>${r2(afterH)}</b> h</span></div>`,
            `<div class="payline"><span>Noční hodiny (22–6)</span><span><b>${r2(nightH)}</b> h</span></div>`,
            `<div class="payline"><span>Víkendové hodiny</span><span><b>${r2(weekendH)}</b> h</span></div>`
        ].join('');
    }
    state._calc = { hours, afterH, nightH, weekendH, vac, holWorkedH, holPaidHomeDays, autoOT, fDays, continuousH };
    save();
}

function avgRate() {
    const man = nval(state.avg.avg_manual);
    if (man > 0) return man;
    const y = current.getFullYear();
    const m = current.getMonth();
    let sumNet = 0, sumHours = 0;
    for (let i = 1; i <= 3; i++) {
        let d = new Date(y, m - i, 1);
        let sy = d.getFullYear(), sm = d.getMonth();
        if (state.yearSummary[sy] && state.yearSummary[sy][sm]) {
            const h = state.yearSummary[sy][sm];
            sumNet += (h.net || 0);
            sumHours += (h.hours || 0);
        }
    }
    return (sumNet > 0 && sumHours > 0) ? (sumNet / sumHours) : 0;
}

function calcPay() {
    let avg = 0;
    try { avg = avgRate(); } catch(e) { avg = nval(state.avg.avg_manual); }

    const C = state._calc || { hours: 0, afterH: 0, nightH: 0, weekendH: 0, vac: 0, holWorkedH: 0, holPaidHomeDays: 0, autoOT: 0, fDays: 0, continuousH: 0 };
    const ymKey = ym(current);
    const effB = nval(state.monthRates[ymKey]) || nval(state.rates['rate_base']) || 148.50;

    const r = {
        b: effB, o: nval(state.rates['rate_odpo']) || 10, n: nval(state.rates['rate_noc']) || 25,
        v: nval(state.rates['rate_vikend']) || 35, nep: nval(state.rates['rate_nepretrzity'])
    };

    const basePay = r.b * C.hours;
    const odpoPay = r.o * C.afterH;
    const nightPay = r.n * C.nightH;
    const weekPay = r.v * C.weekendH;
    
    const holHomeH = C.holPaidHomeDays * ((state.mode === '7.75') ? 7.75 : 7.50);
    const holWorkedPay = (avg * 1.25) * (C.holWorkedH || 0);
    const holHomePay = avg * holHomeH;
    const holPay = holWorkedPay + holHomePay;

    // MATEMATIKA: 4 Kč za každou odpracovanou hodinu na D a N směnách
    const continuousPay = (C.continuousH || 0) * 4;

    const otExtraPay = (avg * 0.25) * (C.autoOT + r.nep);
    const primeP = basePay * (nval(state.bonus_pct) / 100);
    
    const vacH = C.vac * ((state.mode === '7.75') ? 7.75 : 7.50);
    const vacPay = vacH * avg;
    
    const hlukPay = C.fDays * (7.75 * 6);
    let annB = (current.getMonth() === 5 || current.getMonth() === 10) ? 8000 : nval(state.annual_bonus);
    const fund = nval(state.monthFunds[ymKey]);

    let mc = 0, lc = 0, satB = 0;
    for (let i = 1; i <= daysIn(current.getFullYear(), current.getMonth()); i++) {
        const dt = new Date(current.getFullYear(), current.getMonth(), i);
        const key = ymd(dt);
        const t = state.shifts[key];
        if (!t || t === '' || t === 'V') continue;
        const isH = isHoliday(dt);

        let baseH = 11.25;
        if (t === 'R' || t === 'O' || t === 'F' || t === 'FO' || t === 'F16') {
            baseH = (state.mode === '7.75') ? 7.75 : ((t === 'R') ? 8.0 : 7.75);
        }
        let actH = (state.customHours && state.customHours[key] !== undefined) ? nval(state.customHours[key]) : baseH;
        let dayStravenky = 0;

        if (t === 'N') dayStravenky = 2; 
        else if (t === 'D') { 
            if (isW(dt) || isH) dayStravenky = 2; else { dayStravenky = 1; lc += 1; } 
        } else if (t === 'R' || t === 'O' || t === 'F' || t === 'FO' || t === 'F16') { 
            if (t === 'R' && isSat(dt)) satB += 500;
            if (t === 'F16') { dayStravenky = 1; lc += 1; }
            else if (isW(dt) || isH) dayStravenky = 1; 
            else {
                if (t === 'FO' || t === 'O') dayStravenky = 1; 
                else if (t === 'F' || t === 'R') {
                    if (state.mode === '7.75') { if (state.lunches_775_ok === true) lc += 1; } else lc += 1;
                }
            }
        }
        if (!isW(dt) && !isH && (t === 'R' || t === 'F') && actH > 11.0) dayStravenky += 1;
        mc += dayStravenky;
    }

    const mealDeduct = mc * MEAL_DEDUCT;
    const lunchDeduct = lc * LUNCH_DEDUCT;
    const gross = basePay + odpoPay + nightPay + weekPay + holPay + continuousPay + otExtraPay + primeP + vacPay + annB + fund + satB + hlukPay;

    const soc = Math.round(gross * 0.065);
    const hlth = Math.round(gross * 0.045);
    const tax = Math.max(0, (Math.ceil(gross) - soc - hlth) * 0.15 - 2570);
    const net = gross - soc - hlth - tax - (mealDeduct + lunchDeduct);

    if ($('pay')) {
        $('pay').innerHTML = [
            ['Základ', money(basePay)], ['Odpolední příplatek', money(odpoPay)], ['Noční příplatek', money(nightPay)],
            ['Víkendový příplatek', money(weekPay)], ['Ztížené prostředí (Hluk)', money(hlukPay)], ['Soboty R (+500/ks)', money(satB)],
            // REVOLUCE: Tady kód dynamicky vygeneruje textový řádek přímo do tvého existujícího HTML!
            ['Nepřetržitý provoz (+4 Kč/h, celkem ' + r2(C.continuousH) + 'h)', money(continuousPay)],
            ['Odpracovaný svátek (125%)', money(holWorkedPay)], ['Náhrada za svátek doma', money(holHomePay)],
            ['Přesčasy', money(otExtraPay)], ['Prémie', money(primeP)], ['Náhrada za dovolenou', money(vacPay)],
            ['Motivační bonus', money(annB)], ['Fond vedoucího', money(fund)],
            ['Srážka Stravenky ('+mc+' ks)', '− ' + money(mealDeduct)], ['Srážka Obědy ('+lc+' ks)', '− ' + money(lunchDeduct)]
        ].map(([k, v]) => `<div class="payline"><span>${k}</span><span><b>${v}</b></span></div>`).join('');
    }

    if ($('gross')) $('gross').textContent = '💼 Hrubá mzda: ' + money(gross);
    if ($('net')) $('net').textContent = '💵 Čistá mzda (odhad): ' + money(net);
    if ($('meal')) $('meal').textContent = '🍽️ Stravenky: ' + mc + ' ks — ' + money(mc * 110);
    if ($('cafInfo')) $('cafInfo').innerHTML = `🎁 Cafeterie: <b>${state.cafeteria_ok ? '1 000,00 Kč' : '0,00 Kč'}</b>`;

    state.yearSummary[current.getFullYear()] = state.yearSummary[current.getFullYear()] || {};
    state.yearSummary[current.getFullYear()][current.getMonth()] = { gross, net, hours: C.hours, mealCount: mc, mealValue: mc * 110, ts: Date.now() };
    save();
    try { renderYearSummary(); } catch(e) {}
}

function renderYearSummary() {
    const box = $('yearSummary'); if (!box) return;
    const y = current.getFullYear(); const rows = state.yearSummary[y] || {};
    const months = Object.keys(rows).map(k => +k).sort((a, b) => a - b);
    let sG = 0, sN = 0, sMC = 0, sMV = 0;
    months.forEach(m => { sG += (rows[m].gross || 0); sN += (rows[m].net || 0); sMC += (rows[m].mealCount || 0); sMV += (rows[m].mealValue || 0); });
    box.innerHTML = `<hr><div class="payline"><span>Hrubá (rok ${y})</span><span><b>${money(sG)}</b></span></div><div class="payline"><span>Čistá (rok ${y})</span><span><b>${money(sN)}</b></span></div><div class="payline"><span>Stravenky (rok ${y})</span><span><b>${sMC} ks — ${money(sMV)}</b></span></div>`;
}

function renderCalendar() {
    document.body.className = state.mode === '8' ? 'mode8' : (state.mode === '7.75' ? 'mode775' : '');
    applyBackground();
    const y = current.getFullYear(); const m = current.getMonth();
    const total = daysIn(y, m); const start = firstDay(y, m) - 1; const todayKey = ymd(new Date());

    $('monthLabel').textContent = new Date(y, m).toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });
    let html = `<thead><tr>${["Po", "Út", "St", "Čt", "Pá", "So", "Ne"].map(d => `<th>${d}</th>`).join("")}</tr></thead><tbody>`;
    let day = 1;
    for (let r = 0; r < 6; r++) {
        html += "<tr>";
        for (let c = 0; c < 7; c++) {
            if ((r === 0 && c < start) || day > total) { html += "<td></td>"; continue; }
            const dt = new Date(y, m, day); const key = ymd(dt); const t = state.shifts[key] || "";
            const hasCustom = (state.customHours && state.customHours[key] !== undefined) ? ' ⏱️' : '';
            html += `<td data-date="${key}" class="${t} ${selectedDate === key ? 'selected' : ''} ${key === todayKey ? 'today' : ''}">
                 <div class="daynum">${day}${isHoliday(dt) ? ' 🎌' : ''}${hasCustom}</div>
                 ${t ? `<span class="badge">${t}</span>` : ''}
               </td>`;
            day++;
        }
        html += "</tr>"; if (day > total) break;
    }
    $('cal').innerHTML = html + "</tbody>";
    
    $('cal').querySelectorAll('td[data-date]').forEach(td => {
        td.onclick = (e) => {
            const dateKey = td.dataset.date;
            if (selectedDate === dateKey && state.shifts[dateKey] && state.shifts[dateKey] !== "") {
                let currentH = state.customHours[dateKey];
                if (currentH === undefined) {
                    let code = state.shifts[dateKey];
                    if (code === 'V') currentH = (state.mode === '7.75') ? 7.75 : 7.50;
                    else if (code === 'R' || code === 'O' || code === 'F' || code === 'FO' || code === 'F16') {
                        currentH = (state.mode === '7.75') ? 7.75 : ((code === 'R') ? 8.0 : 7.75);
                    } else currentH = (code === 'F16' ? 16.25 : 11.25);
                }
                let val = prompt(`Upravit odpracované hodiny pro den ${dateKey} (aktuálně: ${currentH} h):`, currentH);
                if (val !== null) {
                    let parsed = parseFloat(val);
                    if (!isNaN(parsed) && parsed > 0) state.customHours[dateKey] = parsed; else delete state.customHours[dateKey];
                    save(); renderCalendar(); return;
                }
            }
            selectedDate = dateKey; setShift(dateKey, nextCode(state.shifts[dateKey] || ''));
        };
    });
    updateStats(); updateHeader(); bindInputsOnce(); refreshMonthScopedInputs(); calcPay();
}

renderCalendar();
