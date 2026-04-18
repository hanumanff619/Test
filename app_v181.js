// ============================================================================
// Směnářek 1.8.1 – KOMPLETNÍ FULL VERZE (Hanuman & Family Edition)
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

const MAP775 = { 
    R: 'R 5:45–14:01', 
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
            if (state.mode === '7.75') label = 'R 05:45–14:01';
            else label = isW(today) ? 'R 05:00–13:15' : 'R 05:25–13:59';
        } else {
            label = (state.mode === '7.75' ? MAP775[t] : (state.mode === '8' ? MAP8[t] : MAP12[t])) || t;
        }
    }
    if ($('todayShift')) {
        $('todayShift').textContent = 'Dnes: ' + label;
    }
    setTodayNameday();
}

function nextCode(cur) {
    const codes = ["", "R", "O", "D", "N", "V"];
    let idx = codes.indexOf(cur);
    return codes[(idx + 1) % codes.length];
}

function setShift(dateStr, t, rerender = true) {
    const valid = ['R', 'O', 'D', 'N', 'V', ''];
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
            state.monthFunds[key] = e.target.value === '' ? null : nval(state.monthFunds[key]);
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
    if ($('mode775')) {
        $('mode775').onclick = () => {
            state.mode = '7.75';
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
    let shiftH = 8.0;
    if (state.mode === '7.75') shiftH = 7.75;

    let dDay = 0, nDay = 0, vac = 0, hours = 0, nightH = 0, afterH = 0, weekendH = 0, holWorkedH = 0, rDays = 0, oDays = 0, autoOT = 0;

    for (let i = 1; i <= last.getDate(); i++) {
        const dt = new Date(y, m, i);
        const key = ymd(dt);
        const t = state.shifts[key];
        const isH = isHoliday(dt);
        const isWk = isW(dt);

        // 1. NEODPRACOVANÝ SVÁTEK (Všední den, prázdné políčko)
        // Platí se jen v režimu 8h a 7.75h jako náhrada (z průměru)
        if (isH && !isWk && !t) {
            if (state.mode === '8' || state.mode === '7.75') {
                holWorkedH += shiftH; 
            }
            continue;
        }

        if (!t) continue;
        if (t === 'V') { vac++; continue; }

        let curH = (t === 'R' || t === 'O') ? shiftH : DAILY_WORKED;

        // 2. AUTOMATICKÝ PŘESČAS (Příplatek 25% průměru v calcPay)
        // Počítá se vždy, když se o víkendu nebo svátku reálně pracuje
        if (isH || isWk) autoOT += curH;

        // 3. ODPRACCOVANÉ SMĚNY
        if (t === 'R' || t === 'O') {
            if (t === 'O') oDays++; else rDays++;
            hours += shiftH; // Základní mzda (hodiny)
            if (t === 'O') afterH += 7.75;
            nightH += rShiftNightH(dt);
            if (isWk) weekendH += shiftH;
            if (isH) holWorkedH += shiftH; // Náhrada 100% průměru
        } else if (t === 'D') {
            dDay++; hours += DAILY_WORKED; afterH += 3.75;
            if (isWk) weekendH += DAILY_WORKED; 
            if (isH) holWorkedH += DAILY_WORKED; // Náhrada 100% průměru
        } else if (t === 'N') {
            nDay++; hours += DAILY_WORKED; afterH += 4; nightH += 7.25;
            if (isWk) weekendH += DAILY_WORKED; 
            if (isH) holWorkedH += DAILY_WORKED; // Náhrada 100% průměru
            
            // Přesah noční do svátku (příplatek za hodiny v dalším dni)
            const nextDay = new Date(y, m, i + 1);
            if (isHoliday(nextDay)) holWorkedH += 6;
        }
    }

    if ($('stats')) {
        $('stats').innerHTML = `R:${rDays} O:${oDays} D:${dDay} N:${nDay} V:${vac}<br>Hodiny: <b>${r2(hours)}</b> | Svátek: <b>${r2(holWorkedH)}h</b>`;
    }

    if ($('substats')) {
        $('substats').style.display = 'block';
        $('substats').innerHTML = [
            `<div class="payline"><span>Odpolední hodiny</span><span><b>${r2(afterH)}</b> h</span></div>`,
            `<div class="payline"><span>Noční hodiny (22–6)</span><span><b>${r2(nightH)}</b> h</span></div>`,
            `<div class="payline"><span>Víkendové hodiny</span><span><b>${r2(weekendH)}</b> h</span></div>`
        ].join('');
    }
    state._calc = { hours, afterH, nightH, weekendH, vac, holWorkedH, DAILY_WORKED, H8: shiftH, VAC12, autoOT };
    save();
}


function avgRate() {
    // 1. Priorita: Ruční zadání z pásky (třeba těch tvých 253.24)
    const man = nval(state.avg.avg_manual);
    if (man > 0) {
        // Pokud máš něco v políčku, apka nic nepočítá a bere tohle
        if ($('avg_info')) $('avg_info').innerHTML = `Průměr z pásky (ručně): <b>${money(man)}</b>`;
        return man;
    }

    // 2. Priorita: Automatika z historie (když políčko smažeš)
    const y = current.getFullYear();
    const m = current.getMonth();
    let sumNet = 0;
    let sumHours = 0;

    for (let i = 1; i <= 3; i++) {
        let d = new Date(y, m - i, 1);
        let sy = d.getFullYear(), sm = d.getMonth();
        if (state.yearSummary[sy] && state.yearSummary[sy][sm]) {
            const h = state.yearSummary[sy][sm];
            sumNet += (h.net || 0);
            sumHours += (h.hours || 0);
        }
    }

    if (sumNet > 0 && sumHours > 0) {
        const calculatedAvg = sumNet / sumHours;
        if ($('avg_info')) $('avg_info').innerHTML = `Auto průměr z historie: <b>${calculatedAvg.toFixed(2)} Kč/h</b>`;
        return calculatedAvg;
    }

    // 3. Nouzovka: Jen když je apka prázdná a nic jsi nezadal
    if ($('avg_info')) $('avg_info').innerHTML = `Zadejte průměr z pásky!`;
    return 0; 
}


function updateAvgInfo() {
    const v = avgRate();
    if ($('avg_info')) $('avg_info').textContent = 'Průměrná náhrada: ' + money(v);
}

function calcPay() {
    const avg = avgRate();
    updateAvgInfo();
    const C = state._calc || { hours: 0, afterH: 0, nightH: 0, weekendH: 0, vac: 0, holWorkedH: 0, autoOT: 0 };

    const ymKey = ym(current);
    const effB = nval(state.monthRates[ymKey]) || nval(state.rates['rate_base']) || 148.50;

    const r = {
        b: effB,
        o: nval(state.rates['rate_odpo']) || 10,
        n: nval(state.rates['rate_noc']) || 25,
        v: nval(state.rates['rate_vikend']) || 35,
        nep: nval(state.rates['rate_nepretrzity'])
    };

    const basePay = r.b * C.hours;
    const odpoPay = r.o * C.afterH;
    const nightPay = r.n * C.nightH;
    const weekPay = r.v * C.weekendH;
    const holPay = avg * C.holWorkedH;
    const totalOT = C.autoOT + r.nep;
    const otExtraPay = (avg * 0.25) * totalOT;
    const primeP = basePay * (nval(state.bonus_pct) / 100);
    const vH = state.mode === '12' ? 11.25 : (state.mode === '7.75' ? 7.75 : 8);
    const vacPay = vH * avg * C.vac;

    const annB = (current.getMonth() === 5 || current.getMonth() === 10 ? nval(state.annual_bonus) : 0);
    const fund = nval(state.monthFunds[ymKey]);

        let mc = 0, lc = 0, satB = 0;
    for (let i = 1; i <= daysIn(current.getFullYear(), current.getMonth()); i++) {
        const dt = new Date(current.getFullYear(), current.getMonth(), i);
        const t = state.shifts[ymd(dt)];
        if (!t || t === 'V') continue;
        const noL = isSat(dt) || isHoliday(dt);

        if (t === 'N') {
            mc += 2; // Noční - ty zůstávají (2 stravenky)
        }
        else if (t === 'D') { 
            if (isW(dt)) mc += 2; 
            else { mc += 1; if(!noL) lc++; else mc++; } 
        }
        else if (t === 'R' || t === 'O') { 
            if (t === 'R' && isSat(dt)) satB += 500;
            
            // LOGIKA PRO MLADOU (7.75h)
            if (state.mode === '7.75') {
                // Ranní: Vaří si doma = 0 obědů, 0 stravenek
                // Odpolední: Jen 1 stravenka
                if (t === 'O') mc += 1; 
            } 
            // LOGIKA PRO TEBE (12h / 8h)
            else {
                if (isSat(dt)) mc += 1; 
                else if (!isW(dt)) {
                    if(!noL) lc++; else mc++; 
                }
            }
        }
    }


    const mealDeduct = mc * MEAL_DEDUCT;
    const lunchDeduct = lc * LUNCH_DEDUCT;
    const gross = basePay + odpoPay + nightPay + weekPay + holPay + otExtraPay + primeP + vacPay + annB + fund + satB;

    const soc = Math.round(gross * 0.065);
    const hlth = Math.round(gross * 0.045);
    const tax = Math.max(0, (Math.ceil(gross) - soc - hlth) * 0.15 - 2570);
    const net = gross - soc - hlth - tax - (mealDeduct + lunchDeduct);

    const cafVal = state.cafeteria_ok ? '1 000,00 Kč' : '0,00 Kč';
    if ($('cafInfo')) {
        $('cafInfo').innerHTML = `🎁 Cafeterie (mimo čistou): <b>${cafVal}</b>`;
    }

    if ($('pay')) {
        $('pay').innerHTML = [
            ['Základ', money(basePay)],
            ['Odpolední příplatek', money(odpoPay)],
            ['Noční příplatek', money(nightPay)],
            ['Víkendový příplatek', money(weekPay)],
            ['Soboty R (+500/ks)', money(satB)],
            ['Svátek (100% průměru)', money(holPay)],
            ['Přesčasy (Auto+Man: ' + r2(totalOT) + 'h)', money(otExtraPay)],
            ['Prémie (' + (state.bonus_pct || 0) + '%)', money(primeP)],
            ['Náhrada za dovolenou', money(vacPay)],
            ['Fond vedoucího (měsíc)', money(fund)],
            ['Srážka Stravenky ('+mc+' ks)', '− ' + money(mealDeduct)],
            ['Srážka Obědy ('+lc+' ks)', '− ' + money(lunchDeduct)]
        ].map(([k, v]) => `<div class="payline"><span>${k}</span><span><b>${v}</b></span></div>`).join('');
    }

    $('gross').textContent = '💼 Hrubá mzda: ' + money(gross);
    $('net').textContent = '💵 Čistá mzda (odhad): ' + money(net);
    $('meal').textContent = '🍽️ Stravenky: ' + mc + ' ks — ' + money(mc * 110);

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
    box.innerHTML = `<hr><div class="payline"><span>Hrubá (rok ${y})</span><span><b>${money(sG)}</b></span></div><div class="payline"><span>Čistá (rok ${y})</span><span><b>${money(sN)}</b></span></div><div class="payline"><span>Stravenky (rok ${y})</span><span><b>${sMC} ks — ${money(sMV)}</b></span></div>`;
}

function renderCalendar() {
    document.body.className = state.mode === '8' ? 'mode8' : (state.mode === '7.75' ? 'mode775' : '');
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
        if (day > total) break;
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
                        
