/* Směnářek v1.8.2 = v1.8.1 + 2 doplňky:
   - Přesčas / Fond vedoucího (Kč) => do hrubé
   - Roční motivační (Kč) => počítá se pouze v měsících 6 a 11
   Ostatní logika i UI zachovány.
*/
const $ = (s, p=document)=>p.querySelector(s);
const $$= (s, p=document)=>[...p.querySelectorAll(s)];
const pad = n => String(n).padStart(2,'0');
const LSKEY = 'SMENAREK_V181'; // necháváme zpětně kompatibilní klíč

// --- STATE ---
const STATE = load() || defaults();
let CUR = new Date(STATE.viewYear, STATE.viewMonth, 1);

// --- ELEMENTY ---
const el = {
  cal: $('#cal'),
  todayShift: $('#todayShift'),
  todayName: $('#todayName'),
  summary: $('#summary'),
  results: $('#results'),
  bg: $('#bg-layer'),

  // inputs (vstupy)
  wage: $('#st_wage'),
  bonusPct: $('#st_bonusPct'),
  bEvening: $('#st_b_evening'),
  bNight: $('#st_b_night'),
  bWeekend: $('#st_b_weekend'),
  bCont: $('#st_b_cont'),
  yearly: $('#st_yearly'),          // NOVÉ: roční motivační
  overtime: $('#st_overtime'),      // NOVÉ: přesčas / fond
  vacHours: $('#st_vac_hours'),
  mealVal: $('#st_meal_val'),
  mode: $('#st_mode'),
  ccy: $('#st_ccy'),
  annualHint: $('#annual_hint'),

  // průměrná náhrada (poslední 3 měsíce)
  avg: {
    net1: $('#avg_net1'), hrs1: $('#avg_hrs1'),
    net2: $('#avg_net2'), hrs2: $('#avg_hrs2'),
    net3: $('#avg_net3'), hrs3: $('#avg_hrs3'),
    manual: $('#avg_manual')
  },

  // ovladače
  btnToday: $('#btnToday'),
  btnClear: $('#btnClear'),
  prev: $('#prevMonth'),
  next: $('#nextMonth')
};

// --- DEFAULTY ---
function defaults(){
  const d=new Date();
  return {
    viewYear: d.getFullYear(),
    viewMonth: d.getMonth(),
    mode: "12",              // "12" = D/N/V, "8" = R/O/N/V
    wage: 185,
    bonusPct: 10,
    bEvening: 10,
    bNight: 25,
    bWeekend: 35,
    bCont: 4,
    yearly: 0,               // NOVÉ
    overtime: 0,             // NOVÉ
    vacHours: 11.25,
    mealVal: 110,
    ccy: "Kč",
    avg: { net1:0,hrs1:0, net2:0,hrs2:0, net3:0,hrs3:0, manual:0 },
    days:{}                  // "YYYY-MM-DD": "D|N|V|R|O"
  };
}
function save(){ localStorage.setItem(LSKEY, JSON.stringify(STATE)); }
function load(){ try{ return JSON.parse(localStorage.getItem(LSKEY)); }catch(e){ return null; } }

// --- JMENINY ---
let namedays = null;
fetch('namedays_cs.json').then(r=>r.ok?r.json():null).then(d=>{namedays=d; renderHeaderToday();}).catch(()=>{});

// --- SVÁTKY (včetně Velikonočního pondělí) ---
function easterMonday(y){ // výpočet pondělí podle algoritmu (Meeus/Jones/Butcher)
  const a=y%19, b=Math.floor(y/100), c=y%100, d=Math.floor(b/4), e=b%4;
  const f=Math.floor((b+8)/25), g=Math.floor((b-f+1)/3), h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4), k=c%4, l=(32+2*e+2*i-h-k)%7, m=Math.floor((a+11*h+22*l)/451);
  const month=Math.floor((h+l-7*m+114)/31);    // 3=March, 4=April
  const day=((h+l-7*m+114)%31)+1;
  const easter = new Date(y, month-1, day);    // Easter Sunday
  const monday = new Date(easter); monday.setDate(easter.getDate()+1);
  return monday;
}
function holidaySet(y){
  const S = new Set([
    `${y}-01-01`, // Nový rok
    `${y}-05-01`, // Svátek práce
    `${y}-05-08`, // Den vítězství
    `${y}-07-05`, // Cyril a Metoděj
    `${y}-07-06`, // Hus
    `${y}-09-28`, // Sv. Václav
    `${y}-10-28`, // Vznik ČSR
    `${y}-11-17`, // Den studentů
    `${y}-12-24`,`${
      y}-12-25`,`${y}-12-26`
  ]);
  const em = easterMonday(y);
  S.add(`${y}-${pad(em.getMonth()+1)}-${pad(em.getDate())}`);
  return S;
}

// --- UI / KALENDÁŘ ---
function key(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

function renderBg(){
  el.bg.style.backgroundImage = `url(backgrounds/bg_${STATE.mode==='12'?'12h':'8h'}.jpg)`;
}

function renderCalendar(){
  renderBg();

  const y=CUR.getFullYear(), m=CUR.getMonth();
  STATE.viewYear=y; STATE.viewMonth=m; save();

  const first = new Date(y,m,1);
  const startDay = (first.getDay()+6)%7; // Po=0
  const daysIn = new Date(y,m+1,0).getDate();
  const holi = holidaySet(y);

  let html = `<thead><tr>${['Po','Út','St','Čt','Pá','So','Ne'].map(d=>`<th>${d}</th>`).join('')}</tr></thead><tbody>`;
  let d=1, rows = Math.ceil((startDay+daysIn)/7);
  const todayStr = key(new Date());

  for(let r=0;r<rows;r++){
    html+='<tr>';
    for(let c=0;c<7;c++){
      const idx = r*7+c;
      if(idx<startDay || d>daysIn){ html+='<td></td>'; }
      else{
        const date = new Date(y,m,d);
        const k = key(date);
        const mark = STATE.days[k]||'';
        const classes = [];
        if(k===todayStr) classes.push('today');
        if(mark) classes.push('selected');
        const isHoliday = holi.has(k);
        html+=`<td data-k="${k}" class="${classes.join(' ')}">
                 <div class="mark">${mark||''}</div>
                 <div style="position:absolute;left:.35rem;bottom:.35rem;font-size:.75rem;opacity:.85">${d}${isHoliday?' 🎌':''}</div>
               </td>`;
        d++;
      }
    }
    html+='</tr>';
  }
  html+='</tbody>';
  el.cal.innerHTML = html;

  // kliky
  $$('#cal td[data-k]').forEach(td=>{
    td.onclick = ()=>{
      const k = td.getAttribute('data-k');
      const order = STATE.mode==='12' ? ['','D','N','V'] : ['','R','O','N','V'];
      const cur = STATE.days[k]||'';
      const next = order[(order.indexOf(cur)+1)%order.length];
      if(next) STATE.days[k]=next; else delete STATE.days[k];
      save(); renderCalendar(); calcPay();
    };
  });

  renderHeaderToday();
  refreshAnnualUI();
}

function renderHeaderToday(){
  const today = new Date();
  const tk = key(today);
  const shift = STATE.days[tk] || '—';
  el.todayShift.textContent = `Dnes: ${shift}`;
  if(namedays){
    const mmdd = `${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
    el.todayName.textContent = namedays[mmdd] || '—';
  }
}

function monthDelta(delta){ CUR = new Date(CUR.getFullYear(), CUR.getMonth()+delta, 1); renderCalendar(); calcPay(); }

// --- LOGIKA HODIN ---
function hoursPerShift(code){
  if(STATE.mode==='12'){
    if(code==='D' || code==='N' || code==='V') return 11.25;
    return 0;
  } else {
    if(code==='R' || code==='O' || code==='N' || code==='V') return 8;
    return 0;
  }
}

// --- VÝPOČET ---
function n(v){ const x=Number((v||'').toString().replace(',','.')); return Number.isFinite(x)?x:0; }
function money(v,ccy=STATE.ccy){ return (v||0).toLocaleString('cs-CZ',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+ccy; }

function calcPay(){
  const y=CUR.getFullYear(), m=CUR.getMonth()+1;
  const daysIn = new Date(y,m,0).getDate();

  let den=0, noc=0, rani=0, odpo=0, dov=0;
  let hours=0, wendHours=0, nightHours=0, eveHours=0, holHours=0;

  const holi = holidaySet(y);

  for(let d=1; d<=daysIn; d++){
    const k = `${y}-${pad(m)}-${pad(d)}`;
    const code = STATE.days[k];
    if(!code) continue;

    const date = new Date(y,m-1,d);
    const dow = (date.getDay()+6)%7; // 0..6 (Po..Ne)
    const hrs = hoursPerShift(code);
    hours += hrs;

    // počty směn
    if(code==='D') { den++; eveHours += 4; }         // odpolední část 4h
    if(code==='N') { noc++; nightHours += 8; }       // noční část 8h (22–06)
    if(code==='R') { rani++; }                       // 8h
    if(code==='O') { odpo++; eveHours += 4; }        // 8h + odpolední 4h
    if(code==='V') { dov++; }                        // volno (počítáme jen hodiny přes hoursPerShift)

    // víkendové hodiny (So/Ne)
    if(dow>=5) wendHours += hrs;

    // státní svátek → hodiny svátku zapsat pro náhradu (Kč/h = průměrná)
    if(holi.has(k)) holHours += hrs;
  }

  // VSTUPY
  const W = n(el.wage.value)     || STATE.wage;
  const Pct = (n(el.bonusPct.value)||STATE.bonusPct)/100;
  const B_e = n(el.bEvening.value)||STATE.bEvening;
  const B_n = n(el.bNight.value)  ||STATE.bNight;
  const B_w = n(el.bWeekend.value)||STATE.bWeekend;
  const B_c = n(el.bCont.value)   ||STATE.bCont;
  const VacH = n(el.vacHours.value)||STATE.vacHours;
  const mealVal = n(el.mealVal.value)||STATE.mealVal;

  // NOVÉ: přesčas/fond + roční motivační (jen 6/11)
  const monthIdx = CUR.getMonth();          // 0..11
  const Yearly   = (monthIdx===5 || monthIdx===10) ? n(el.yearly.value||STATE.yearly) : 0;
  const Overtime = n(el.overtime.value||STATE.overtime);

  // průměrná náhrada (Kč/h): ručně, jinak z M-1..M-3 (čistá/hod)
  let avg = n(el.avg.manual.value)||0;
  if(!avg){
    const n1=n(el.avg.net1.value), h1=n(el.avg.hrs1.value);
    const n2=n(el.avg.net2.value), h2=n(el.avg.hrs2.value);
    const n3=n(el.avg.net3.value), h3=n(el.avg.hrs3.value);
    const num = n1+n2+n3, den = h1+h2+h3;
    avg = den>0 ? num/den : 0;
  }

  // ZÁKLAD + PŘÍPLATKY
  const basePay = hours * W;
  const prime   = basePay * Pct;
  const evePay  = eveHours  * B_e;
  const nightPay= nightHours* B_n;
  const wkPay   = wendHours * B_w;
  const contPay = hours     * B_c;
  const holPay  = holHours  * avg;                 // svátek z průměru
  const vacPay  = dov       * VacH * avg;          // dovolená z průměru

  const gross = basePay + prime + evePay + nightPay + wkPay + contPay + holPay + vacPay
              + Overtime + Yearly;

  // Čistá (orientačně) – stejně jako dřív (můžeš upravit koef.)
  const net = gross * 0.78;

  // přehled
  el.summary.innerHTML =
    `Směny – D:${den} N:${noc} R:${rani} O:${odpo} (V:${dov})<br>`+
    `Hodiny celkem: ${hours.toFixed(2)}<br>`+
    `Přímé prémie (${(Pct*100).toFixed(0)}%): ${money(prime)}<br>`+
    `Příplatky – Odpo: ${money(evePay)}, Noc: ${money(nightPay)}, Víkend: ${money(wkPay)}, Nepřetržitý: ${money(contPay)}<br>`+
    `Svátek (průměr × ${holHours.toFixed(2)} h): ${money(holPay)}<br>`+
    `Dovolená (průměr × ${VacH} h × ${dov} dny): ${money(vacPay)}<br>`+
    `Přesčas / Fond: ${money(Overtime)}, Roční (6/11): ${money(Yearly)}`;

  // výsledky
  const rows = [
    ['Hrubá mzda', gross],
    ['Čistá mzda (odhad)', net],
    ['Stravenky (informativně)', (0).toFixed ? undefined : undefined] // necháváme prázdné – už to máš řešené jinde, případně doplníme
  ].filter(x=>x[1]!==undefined);

  el.results.innerHTML = rows.map(([k,v]) =>
    `<div class="row"><div>${k}</div><div>${money(v)}</div></div>`
  ).join('');
}

// --- HELP & BIND ---
function refreshAnnualUI(){
  const m = CUR.getMonth();
  const on = (m===5 || m===10);
  if(el.annualHint) el.annualHint.textContent = on ? '(počítá se tento měsíc)' : '(mimo 6/11 se nepočítá)';
}

function bind(){
  el.prev.onclick = ()=> monthDelta(-1);
  el.next.onclick = ()=> monthDelta(1);
  el.btnToday.onclick = ()=>{ CUR=new Date(); CUR.setDate(1); renderCalendar(); calcPay(); };
  el.btnClear.onclick = ()=>{
    const k = `${new Date().getFullYear()}-${pad(new Date().getMonth()+1)}-${pad(new Date().getDate())}`;
    delete STATE.days[k]; save(); renderCalendar(); calcPay();
  };

  // načíst STATE do UI
  el.wage.value = STATE.wage;
  el.bonusPct.value = STATE.bonusPct;
  el.bEvening.value = STATE.bEvening;
  el.bNight.value = STATE.bNight;
  el.bWeekend.value = STATE.bWeekend;
  el.bCont.value = STATE.bCont;
  el.yearly.value = STATE.yearly;         // NOVÉ
  el.overtime.value = STATE.overtime;     // NOVÉ
  el.vacHours.value = STATE.vacHours;
  el.mealVal.value = STATE.mealVal;
  el.mode.value = STATE.mode;
  el.ccy.value = STATE.ccy;

  el.avg.net1.value = STATE.avg.net1; el.avg.hrs1.value = STATE.avg.hrs1;
  el.avg.net2.value = STATE.avg.net2; el.avg.hrs2.value = STATE.avg.hrs2;
  el.avg.net3.value = STATE.avg.net3; el.avg.hrs3.value = STATE.avg.hrs3;
  el.avg.manual.value = STATE.avg.manual;

  // reakce na změny
  ['wage','bonusPct','bEvening','bNight','bWeekend','bCont','yearly','overtime','vacHours','mealVal','mode','ccy'].forEach(id=>{
    el[id].oninput = ()=>{
      STATE[id] = (id==='mode'||id==='ccy') ? el[id].value : n(el[id].value);
      save();
      if(id==='mode') renderBg();
      if(id==='yearly') refreshAnnualUI();
      calcPay();
    };
  });

  // průměrná – změny
  Object.entries(el.avg).forEach(([k,input])=>{
    input.oninput = ()=>{ STATE.avg[k] = n(input.value); save(); calcPay(); };
  });
}

// --- START ---
bind();
renderCalendar();
calcPay();
