// Směnářek 1.8.1 – help icon right, single holiday mark, namedays online + per-month rate + per-month fund + audit
const MEAL_DEDUCT = 40, LUNCH_DEDUCT = 40, MEAL_INFO_VALUE = 110;
const MAP12 = {D:'D 05:45–18:00', N:'N 17:45–06:00', V:'Dovolená'};
const MAP8  = {R:'R 06:00–14:00', O:'O 14:00–22:00', N:'N 22:00–06:00', V:'Dovolená'};

let state = JSON.parse(localStorage.getItem('smenarek_state_v181')||'{}');
if(!state.shifts) state.shifts={};
if(!state.rates) state.rates={};
if(!state.mode) state.mode='12';
if(state.bonus_pct==null) state.bonus_pct=10;
if(state.annual_bonus==null) state.annual_bonus=0;
if(state.cafeteria_ok==null) state.cafeteria_ok=false;

// ✨ mapy: per-měsíc hodnoty
if(!state.monthFunds)  state.monthFunds = {};  // { "YYYY-MM": Kč }
if(!state.monthRates)  state.monthRates = {};  // { "YYYY-MM": Kč/h }

// průměry a roční souhrny
if(!state.avg) state.avg={net1:null,h1:null,net2:null,h2:null,net3:null,h3:null,avg_manual:null};
if(!state.yearSummary) state.yearSummary={};

let current=new Date(), selectedDate=null;

const $=id=>document.getElementById(id);
const pad=n=>n<10?'0'+n:n;
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const ym=(d)=>d.getFullYear()+'-'+pad(d.getMonth()+1);
const md=d=>pad(d.getMonth()+1)+'-'+pad(d.getDate());
const daysIn=(y,m)=>new Date(y,m+1,0).getDate();
const firstDay=(y,m)=>{let n=new Date(y,m,1).getDay();return n===0?7:n};
const isW=d=>[0,6].includes(d.getDay());
const r2=x=>Math.round(x*100)/100;
const nval=v=>(+v)||0;
const money=x=>(Math.round((x||0)*100)/100).toLocaleString('cs-CZ',{minimumFractionDigits:2,maximumFractionDigits:2})+' Kč';

function save(){ localStorage.setItem('smenarek_state_v181', JSON.stringify(state)); }

// online nameday
async function setTodayNameday(){
  try{
    const d=new Date();
    const y=d.getFullYear(), m=('0'+(d.getMonth()+1)).slice(-2), dd=('0'+d.getDate()).slice(-2);
    const res = await fetch(`https://svatkyapi.cz/api/day?date=${y}-${m}-${dd}`);
    const data = await res.json();
    $('todayNameday').textContent = 'Svátek: ' + (data.name || '—');
  }catch(e){
    $('todayNameday').textContent = 'Svátek: —';
  }
}

// holidays
const HOLI_CACHE = {};
function easterSunday(year) {
  const a=year%19, b=Math.floor(year/100), c=year%100, d=Math.floor(b/4), e=b%4, f=Math.floor((b+8)/25),
        g=Math.floor((b-f+1)/3), h=(19*a+b-d-g+15)%30, i=Math.floor(c/4), k=c%4,
        l=(32+2*e+2*i-h-k)%7, m=Math.floor((a+11*h+22*l)/451),
        month=Math.floor((h+l-7*m+114)/31), day=1+((h+l-7*m+114)%31);
  return new Date(year, month-1, day);
}
function czechHolidays(year){
  if(HOLI_CACHE[year]) return HOLI_CACHE[year];
  const fixed=['01-01','05-01','05-08','07-05','07-06','09-28','10-28','11-17','12-24','12-25','12-26'];
  const set=new Set(fixed);
  const easter=easterSunday(year);
  const goodFriday=new Date(easter); goodFriday.setDate(easter.getDate()-2);
  const easterMonday=new Date(easter); easterMonday.setDate(easter.getDate()+1);
  const gf=pad(goodFriday.getMonth()+1)+'-'+pad(goodFriday.getDate());
  const em=pad(easterMonday.getMonth()+1)+'-'+pad(easterMonday.getDate());
  set.add(gf); set.add(em);
  HOLI_CACHE[year]=set; return set;
}
function isHoliday(dt){ return czechHolidays(dt.getFullYear()).has(md(dt)); }

function applyBackground(){
  const layer=$('bg-layer'); if(!layer) return;
  const url = state.mode==='8' ? 'backgrounds/bg_8h.jpg' : 'backgrounds/bg_12h.jpg';
  layer.style.backgroundImage = `url("${url}")`;
}

function updateHeader(){
  const today = new Date();
  const t = state.shifts[ymd(today)]||'—';
  $('todayShift').textContent = 'Dnes: ' + (t==='—'?'—': (state.mode==='8'?MAP8[t]:MAP12[t]));
  setTodayNameday();
}

function nextCode(cur){
  return state.mode==='8'
    ? (cur===""?"R":cur==="R"?"O":cur==="O"?"N":cur==="N"?"V":"")
    : (cur===""?"D":cur==="D"?"N":cur==="N"?"V":"");
}

function setShift(dateStr,t,rerender=true){
  const valid = state.mode==='8' ? ['R','O','N','V',''] : ['D','N','V',''];
  if(!valid.includes(t)) return;
  if(t==='') delete state.shifts[dateStr]; else state.shifts[dateStr]=t;
  save(); if(rerender) renderCalendar();
}

function bindInputsOnce(){
  if(window._inputsBound) return; window._inputsBound=true;

  // globální sazby
  ['rate_base','rate_odpo','rate_noc','rate_vikend','rate_nepretrzity']
  .forEach(id=>{
    const el=$(id); if(!el) return;
    el.value = state.rates[id] ?? '';
    el.oninput=()=>{ state.rates[id]=el.value===''?null:nval(el.value); save(); calcPay(); };
  });

  // přímé prémie a roční motivační
  const bp=$('bonus_pct'); if(bp){ bp.value=state.bonus_pct; bp.oninput=()=>{ state.bonus_pct=nval(bp.value); save(); calcPay(); }; }
  const ab=$('annual_bonus'); if(ab){ ab.value=state.annual_bonus; ab.oninput=()=>{ state.annual_bonus=nval(ab.value); save(); calcPay(); }; }

  // Cafeterie
  const caf=$('caf_check'); if(caf){ caf.checked = !!state.cafeteria_ok; caf.onchange=()=>{ state.cafeteria_ok = caf.checked; save(); calcPay(); }; }

  // ⚠️ odstraněn globální „fond vedoucího“ (pole ani logika se tu už neřeší)

  // měsíční fond vedoucího
  const fbm = $('fund_bonus_month');
  if (fbm) {
    fbm.oninput = () => {
      const key = ym(current);
      const val = fbm.value === '' ? null : nval(fbm.value);
      if (val == null) delete state.monthFunds[key];
      else state.monthFunds[key] = val;
      save(); calcPay();
    };
  }

  // měsíční základní hodinovka
  const rbm = $('rate_base_month');
  if (rbm) {
    rbm.oninput = () => {
      const key = ym(current);
      const val = rbm.value === '' ? null : nval(rbm.value);
      if (val == null) delete state.monthRates[key];
      else state.monthRates[key] = val;
      save(); calcPay();
    };
  }

  // průměrné náhrady vstupy
  const fields = [
    ['avg_net1','net1'],['avg_net2','net2'],['avg_net3','net3'],
    ['avg_h1','h1'],['avg_h2','h2'],['avg_h3','h3'],['avg_manual','avg_manual']
  ];
  fields.forEach(([id,key])=>{
    const el=$(id); if(!el) return;
    el.value = state.avg[key] ?? '';
    el.oninput=()=>{ state.avg[key] = el.value===''?null:nval(el.value); save(); calcPay(); };
  });

  // kalendářové ovladače
  const prev=$('prev'), next=$('next'), setToday=$('setToday'), clearDay=$('clearDay');
  if(prev) prev.onclick=()=>{ current.setMonth(current.getMonth()-1); selectedDate=null; renderCalendar(); };
  if(next) next.onclick=()=>{ current.setMonth(current.getMonth()+1); selectedDate=null; renderCalendar(); };
  if(setToday) setToday.onclick=()=>{ const k=ymd(new Date()); const cur=state.shifts[k]||''; setShift(k,nextCode(cur)); };
  if(clearDay) clearDay.onclick=()=>{ if(!selectedDate) return alert('Klepni nejdřív na den.'); setShift(selectedDate,''); };

  const m12=$('mode12'), m8=$('mode8');
  if(m12) m12.onclick=()=>{ state.mode='12'; save(); renderCalendar(); };
  if(m8)  m8.onclick =()=>{ state.mode='8';  save(); renderCalendar(); };

  // audit toggle
  const tgl=$('toggleAudit');
  if(tgl){ tgl.onclick=()=>{ const box=$('audit'); if(!box) return; box.style.display = (box.style.display==='none' || !box.style.display) ? 'block' : 'none'; if(box.style.display==='block') renderAudit(); }; }
}

// po přepnutí měsíce doplnit hodnoty měsíčních polí
function refreshMonthScopedInputs(){
  const key = ym(current);
  const fbm = $('fund_bonus_month');
  if (fbm) fbm.value = state.monthFunds[key] ?? '';
  const rbm = $('rate_base_month');
  if (rbm) rbm.value = state.monthRates[key] ?? '';
}

// spočítat statistiky měsíce (akumulační)
function updateStats(){
  const y=current.getFullYear(), m=current.getMonth(), last=new Date(y,m+1,0);
  const DAILY_WORKED = 11.25;
  const VAC12 = 11.25;
  const H8 = 8.0;

  let dDay=0,nDay=0,vac=0,hours=0,nightH=0,afterH=0,weekendH=0,holWorkedH=0;

  for(let i=1;i<=last.getDate();i++){
    const dt=new Date(y,m,i), key=ymd(dt), t=state.shifts[key];
    if(!t) continue;

    if(t==='V'){ vac++; continue; }

    if(state.mode==='8'){
      const h=H8;
      if(t==='R'){ hours+=h; afterH+=h; if(isW(dt)) weekendH+=h; }
      if(t==='O'){ hours+=h; afterH+=h; if(isW(dt)) weekendH+=h; }
      if(t==='N'){ hours+=h; nightH+=7.25; if(isW(dt)) weekendH+=h; } // ✨ noční = 7.25
      if(isHoliday(dt)) holWorkedH+=8;
      const next=new Date(y,m,i+1);
      if(t==='N' && isHoliday(next)) holWorkedH+=6;
    } else {
      if(t==='D'){
        dDay++; hours+=DAILY_WORKED;
        afterH+=3.75; // ✨ dříve 4.00
        if(isW(dt)) weekendH+=DAILY_WORKED;
        if(isHoliday(dt)) holWorkedH+=VAC12;
      }
      if(t==='N'){
        nDay++; hours+=DAILY_WORKED;
        afterH += 4.00; // ✨ dříve 4.25
        nightH += 7.25; // ✨ dříve 8.00
        const wd=dt.getDay();
        if(wd===5) weekendH+=6;
        else if(wd===6) weekendH+=DAILY_WORKED;
        else if(wd===0) weekendH+=6.25;
        if(isHoliday(dt)) holWorkedH+=VAC12;
        const next=new Date(y,m,i+1);
        if(isHoliday(next)) holWorkedH+=6;
      }
    }
  }

  const head = state.mode==='8'
    ? `Ranní+Odpolední: <b>${r2(afterH/8)}</b> • Noční: <b>${r2(nightH/7.25)}</b> • Dovolené: <b>${vac}</b>`
    : `Denní: <b>${dDay}</b> • Noční: <b>${nDay}</b> • Dovolené: <b>${vac}</b>`;
  $('stats').innerHTML = [head, `Hodiny: <b>${r2(hours)}</b>`, `Svátek odpracovaný: <b>${r2(holWorkedH)} h</b>`].join('<br>');

  if(state.mode==='12'){
    $('substats').style.display='block';
    $('substats').innerHTML = [
      `<div class="payline"><span>Odpolední hodiny (D: 3.75, N: 4.00)</span><span><b>${r2(afterH)}</b> h</span></div>`,
      `<div class="payline"><span>Noční hodiny (22–6) — 7.25/h</span><span><b>${r2(nightH)}</b> h</span></div>`,
      `<div class="payline"><span>Víkendové hodiny</span><span><b>${r2(weekendH)}</b> h</span></div>`
    ].join('');
  } else $('substats').style.display='none';

  state._calc={hours,afterH,nightH,weekendH,vac,holWorkedH,DAILY_WORKED,H8:8.0,VAC12:11.25,VAC8:8.0};
  save();
}

// auto průměr z historie (když ruční i 3 vstupy jsou prázdné)
function autoAvgFromHistory(){
  const y = current.getFullYear(), m = current.getMonth();
  const months = [];
  for(let k=1;k<=12;k++){
    const mm = (m - k + 12) % 12;
    const yy = m - k < 0 ? y - 1 : y;
    if(state.yearSummary?.[yy]?.[mm]){
      months.push(state.yearSummary[yy][mm]);
      if(months.length>=3) break;
    }
  }
  if(!months.length) return 0;
  const sumNet = months.reduce((a,b)=>a+(b.net||0),0);
  const sumH   = months.reduce((a,b)=>a+(b.hours||0),0);
  return sumH>0 ? (sumNet/sumH) : 0;
}

function avgRate(){
  const man = nval(state.avg.avg_manual||0);
  if(man>0) return man;

  const sNet=(state.avg.net1||0)+(state.avg.net2||0)+(state.avg.net3||0);
  const sH  =(state.avg.h1||0)+(state.avg.h2||0)+(state.avg.h3||0);
  if (sNet>0 && sH>0) return sNet/sH;

  const hist = autoAvgFromHistory();
  return hist>0 ? hist : 0;
}
function updateAvgInfo(){
  const v = avgRate();
  $('avg_info').textContent = 'Průměrná náhrada: ' + money(v);
}

// denní rozpad pro audit
function computeDailyBreakdown(){
  const y=current.getFullYear(), m=current.getMonth();
  const last=daysIn(y,m);
  const rows=[];
  for(let i=1;i<=last;i++){
    const dt=new Date(y,m,i), key=ymd(dt), t=state.shifts[key]||'';
    let worked=0, afterH=0, nightH=0, weekendH=0, holH=0;
    if(t){
      if(t==='V'){
        // dovolená do worked ne
      }else if(state.mode==='8'){
        worked=8;
        if(t==='R'||t==='O') afterH+=8;
        if(t==='N') nightH+=7.25; // ✨
        if(isW(dt)) weekendH+=8;
        if(isHoliday(dt)) holH+=8;
        if(t==='N' && isHoliday(new Date(y,m,i+1))) holH+=6;
      }else{
        // 12h
        worked=11.25;
        if(t==='D'){
          afterH+=3.75; // ✨
          if(isW(dt)) weekendH+=11.25;
          if(isHoliday(dt)) holH+=11.25;
        }
        if(t==='N'){
          afterH+=4.00; nightH+=7.25; // ✨
          const wd=dt.getDay();
          if(wd===5) weekendH+=6;
          else if(wd===6) weekendH+=11.25;
          else if(wd===0) weekendH+=6.25;
          if(isHoliday(dt)) holH+=11.25;
          if(isHoliday(new Date(y,m,i+1))) holH+=6;
        }
      }
    }
    rows.push({date:key, label:i, shift:t, worked, afterH, nightH, weekendH, holH});
  }
  return rows;
}
function renderAudit(){
  const box=$('audit'); if(!box) return;
  const rows=computeDailyBreakdown();
  const sum=(k)=>rows.reduce((a,b)=>a+(b[k]||0),0);
  const head = `
    <div class="payline" style="font-weight:700">
      <span>Den</span><span>Směna</span><span>Odprac.</span><span>Odpol.</span><span>Noční</span><span>Víkend</span><span>Svátek h</span>
    </div>`;
  const body = rows.map(r=>`
    <div class="payline" style="gap:.6rem">
      <span>${r.label}.</span>
      <span>${r.shift||'—'}</span>
      <span>${r2(r.worked)}</span>
      <span>${r2(r.afterH)}</span>
      <span>${r2(r.nightH)}</span>
      <span>${r2(r.weekendH)}</span>
      <span>${r2(r.holH)}</span>
    </div>`).join('');
  const foot = `
    <div class="payline" style="font-weight:700">
      <span>Součet</span><span></span>
      <span>${r2(sum('worked'))}</span>
      <span>${r2(sum('afterH'))}</span>
      <span>${r2(sum('nightH'))}</span>
      <span>${r2(sum('weekendH'))}</span>
      <span>${r2(sum('holH'))}</span>
    </div>`;
  box.innerHTML = head + body + foot;
}

function calcPay(){
  const avg=avgRate(); updateAvgInfo();
  const C=state._calc||{hours:0,afterH:0,nightH:0,weekendH:0, vac:0, holWorkedH:0, DAILY_WORKED:12.25, H8:8.0, VAC12:11.25, VAC8:8.0};

  // základ z měsíční mapy (pokud existuje), jinak globální
  const ymKey = ym(current);
  const baseRateMonth = nval(state.monthRates?.[ymKey] ?? 0);
  const baseRateGlobal = nval(state.rates['rate_base']);
  const effectiveBaseRate = baseRateMonth > 0 ? baseRateMonth : baseRateGlobal;

  const r={
    base: effectiveBaseRate,
    odpo:nval(state.rates['rate_odpo']),
    noc:nval(state.rates['rate_noc']),
    vikend:nval(state.rates['rate_vikend']),
    nepretrzity:nval(state.rates['rate_nepretrzity'])
  };

  const basePay = r.base * C.hours;
  const odpoPay = r.odpo * C.afterH;
  const nightPay= r.noc  * C.nightH;
  const wkPay   = r.vikend * C.weekendH;
  const holPay  = avg * C.holWorkedH;
  const nepret  = r.nepretrzity * C.hours;
  const prime   = basePay * ((state.bonus_pct||0)/100);
  const vacHours = (state.mode==='8' ? C.VAC8 : C.VAC12);
  const vacPay  = vacHours * avg * C.vac;

  // Roční motivační: jen 6/11
  const month = (current instanceof Date) ? current.getMonth() : (new Date()).getMonth();
  const annualBonus = (month===5 || month===10) ? (state.annual_bonus||0) : 0;

  // Fond vedoucího: pouze měsíční (bez globálního)
  const fund = nval(state.monthFunds?.[ymKey] ?? 0);

  // Stravenky/obědy
  function mealsCalc(){
    let y=current.getFullYear(), m=current.getMonth(), end=new Date(y,m+1,0), count=0, lunches=0;
    for(let i=1;i<=end.getDate();i++){
      const dt=new Date(y,m,i), key=ymd(dt), t=state.shifts[key];
      if(!t||t==='V') continue;
      if(state.mode==='12'){
        if(t==='N'){ count+=2; }
        if(t==='D'){ if(isW(dt)) count+=2; else { count+=1; lunches++; } }
      }else{
        if(t==='N'){ count+=2; }
        if(t==='R'||t==='O'){ if(isW(dt)) count+=2; else { count+=1; lunches++; } }
      }
    }
    return {count,lunches};
  }
  const mc=mealsCalc();
  const mealDeduct = mc.count*MEAL_DEDUCT, lunchDeduct=mc.lunches*LUNCH_DEDUCT, mealValue=mc.count*MEAL_INFO_VALUE;

  const gross = basePay+odpoPay+nightPay+wkPay+holPay+nepret+prime+vacPay + annualBonus + fund;
  const social=gross*0.065, health=gross*0.045;
  const tax=Math.max(0,(gross-social-health)*0.15-2570);
  const netBeforeMeals=gross-social-health-tax;
  const net=netBeforeMeals - (mealDeduct + lunchDeduct);

  const caf = state.cafeteria_ok ? 1000 : 0;

  $('pay').innerHTML = [
    ['Základ',money(basePay)+' '+(baseRateMonth>0?`(měs. ${money(r.base)}/h)`:`(${money(r.base)}/h)`)],
    ['Odpolední',money(odpoPay)],['Noční',money(nightPay)],
    ['Víkend',money(wkPay)],['Svátek (průměr × hodiny)',money(holPay)],['Nepřetržitý provoz',money(nepret)],
    ['Přímé prémie ('+(state.bonus_pct||0)+'%)',money(prime)],['Náhrada za dovolenou',money(vacPay)],
    ['Fond vedoucího (měsíc)',money(fund)],
    ['Roční motivační',money(annualBonus)],
    ['Srážka stravenky','− '+money(mealDeduct)],['Srážka obědy','− '+money(lunchDeduct)]
  ].map(([k,v])=>`<div class="payline"><span>${k}</span><span><b>${v}</b></span></div>`).join('');

  $('gross').textContent = '💼 Hrubá mzda: ' + money(gross);
  $('net').textContent   = '💵 Čistá mzda (odhad): ' + money(net);
  $('meal').textContent  = '🍽️ Stravenky: ' + money(mealValue);
  $('cafInfo').textContent = '🎁 Cafeterie (mimo čistou): ' + money(caf);

  // roční přehled – ulož i stravenky pro součty
  const y = current.getFullYear();
  if(!state.yearSummary[y]) state.yearSummary[y]={};
  state.yearSummary[y][current.getMonth()] = {
    gross, net, hours: C.hours, mealCount: mc.count, mealValue: mealValue, ts: Date.now()
  };
  save();

  // pokud je audit otevřený, překreslit
  const auditBox=$('audit');
  if(auditBox && auditBox.style.display==='block') renderAudit();

  renderYearSummary();
}

function renderYearSummary(){
  const box = $('yearSummary');
  if(!box) return;
  const y = current.getFullYear();
  const rows = state.yearSummary?.[y] || {};
  const months = Object.keys(rows).map(k=>+k).sort((a,b)=>a-b);
  let sumGross=0, sumNet=0, sumMealCount=0, sumMealVal=0;
  months.forEach(m=>{
    sumGross += rows[m].gross||0;
    sumNet   += rows[m].net||0;
    sumMealCount += rows[m].mealCount||0;
    sumMealVal   += rows[m].mealValue||0;
  });
  box.innerHTML = `
    <hr>
    <div class="payline"><span>Součet hrubé (rok ${y})</span><span><b>${money(sumGross)}</b></span></div>
    <div class="payline"><span>Součet čisté (rok ${y})</span><span><b>${money(sumNet)}</b></span></div>
    <div class="payline"><span>Součet stravenek (rok ${y})</span><span><b>${sumMealCount} ks — ${money(sumMealVal)}</b></span></div>
    <div class="subtle">Započítáno měsíců: ${months.length}</div>
  `;
}

function renderCalendar(){
  document.body.classList.toggle('mode8', state.mode==='8');
  applyBackground();

  const y=current.getFullYear(), m=current.getMonth();
  $('monthLabel').textContent=new Date(y,m).toLocaleString('cs-CZ',{month:'long',year:'numeric'});
  const total=daysIn(y,m), start=firstDay(y,m)-1;

  const todayKey = ymd(new Date());
  let html=`<thead><tr>${["Po","Út","St","Čt","Pá","So","Ne"].map(d=>`<th>${d}</th>`).join("")}</tr></thead><tbody>`;
  let day=1;
  for(let r=0;r<6;r++){
    html+="<tr>";
    for(let c=0;c<7;c++){
      if((r===0&&c<start) || day>total){ html+="<td></td>"; continue; }
      const dt=new Date(y,m,day), key=ymd(dt), t=state.shifts[key]||"";
      const classes=[t];
      if(selectedDate===key) classes.push('selected');
      if(key===todayKey) classes.push('today');
      html+=`<td data-date="${key}" class="${classes.join(' ')}">
               <div class="daynum">${day}${isHoliday(dt)?' 🎌':''}</div>
               ${t?`<span class="badge">${t}</span>`:''}
             </td>`;
      day++;
    }
    html+="</tr>";
  }
  html+="</tbody>";
  $('cal').innerHTML=html;

  $('cal').querySelectorAll('td[data-date]').forEach(td=>{
    td.onclick=()=>{
      const key=td.getAttribute('data-date'); selectedDate=key;
      const cur=state.shifts[key]||''; setShift(key,nextCode(cur),false); renderCalendar();
    };
  });

  updateStats(); updateHeader(); bindInputsOnce();
  refreshMonthScopedInputs();
  calcPay();
}

renderCalendar();
