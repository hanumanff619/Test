/* Směnářek v1.8.1 (obnovená) + doplňky:
   - Přesčas / Fond vedoucího (Kč) => do hrubé
   - Roční motivační (Kč) => započítat pouze v měsících 6 a 11
   - CZ státní svátky uvnitř, jmeniny z namedays_cs.json (pokud existuje)
   - 12h/8h režim + pozadí backgrounds/bg_12h.jpg / backgrounds/bg_8h.jpg
   - LocalStorage klíč SMENAREK_V181
*/
const $ = (s, p=document)=>p.querySelector(s);
const $$= (s, p=document)=>[...p.querySelectorAll(s)];
const LSKEY = 'SMENAREK_V181';

const el = {
  cal: $('#cal'),
  todayShift: $('#todayShift'),
  todayName: $('#todayName'),
  summary: $('#summary'),
  results: $('#results'),
  bg: $('#bg-layer'),
  dlg: $('#dlg'),
  btnSettings: $('#btnSettings'),
  // inputs
  wage: $('#st_wage'),
  bonusPct: $('#st_bonusPct'),
  bEvening: $('#st_b_evening'),
  bNight: $('#st_b_night'),
  bWeekend: $('#st_b_weekend'),
  bCont: $('#st_b_cont'),
  overtime: $('#st_overtime'),
  yearly: $('#st_yearly'),
  vacHours: $('#st_vac_hours'),
  mealVal: $('#st_meal_val'),
  avg: {
    net1: $('#avg_net1'), hrs1: $('#avg_hrs1'),
    net2: $('#avg_net2'), hrs2: $('#avg_hrs2'),
    net3: $('#avg_net3'), hrs3: $('#avg_hrs3'),
    manual: $('#avg_manual')
  },
  mode: $('#st_mode'), ccy: $('#st_ccy'),
  lunch: $('#st_lunch'), lunchCnt: $('#st_lunch_cnt'),
  mealD: $('#st_meal_d'), mealN: $('#st_meal_n'),
  btnToday: $('#btnToday'), btnClear: $('#btnClear'),
  prev: $('#prevMonth'), next: $('#nextMonth'),
  dlgCancel: $('#btnCancel'), dlgSave: $('#btnSave')
};

const STATE = load() || defaults();
let CUR = new Date(STATE.viewYear, STATE.viewMonth, 1);

// státní svátky CZ „MM-DD“
const HOLI = new Set(["01-01","05-01","05-08","07-05","07-06","09-28","10-28","11-17","12-24","12-25","12-26","04-??"]); // Velikonoce po neřešíme zde

// jmeniny (lazy)
let namedays = null;
fetch('namedays_cs.json').then(r=>r.ok?r.json():null).then(d=>{namedays=d; renderHeaderToday();}).catch(()=>{});

function defaults(){
  return {
    viewYear: (new Date()).getFullYear(),
    viewMonth: (new Date()).getMonth(),
    mode: "12",
    wage: 185, bonusPct: 10,
    bEvening:10, bNight:25, bWeekend:35, bCont:4,
    overtime:0, yearly:0,
    vacHours: 11.25, mealVal:110,
    avg:{net1:0,hrs1:0,net2:0,hrs2:0,net3:0,hrs3:0,manual:0},
    lunch:40, lunchCnt:0, mealD:1, mealN:2,
    ccy:"Kč",
    days:{} // "YYYY-MM-DD": "", "D","N","V","R"
  };
}
function save(){ localStorage.setItem(LSKEY, JSON.stringify(STATE)); }
function load(){ try{return JSON.parse(localStorage.getItem(LSKEY));}catch(e){return null;} }

// helpers
const pad=n=>String(n).padStart(2,'0');
const key = d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

function renderBg(){
  el.bg.style.backgroundImage = `url(backgrounds/bg_${STATE.mode==='12'?'12h':'8h'}.jpg)`;
}

function renderCalendar(){
  renderBg();
  const y = CUR.getFullYear(), m = CUR.getMonth();
  STATE.viewYear = y; STATE.viewMonth = m; save();

  const first = new Date(y,m,1);
  const startDay = (first.getDay()+6)%7; // Po=0
  const daysIn = new Date(y,m+1,0).getDate();

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
        html+=`<td data-k="${k}" class="${classes.join(' ')}"><div class="mark">${mark||''}</div><div style="position:absolute;left:.35rem;bottom:.35rem;font-size:.75rem;opacity:.8">${d}</div></td>`;
        d++;
      }
    }
    html+='</tr>';
  }
  html+='</tbody>';
  el.cal.innerHTML = html;

  // interactions
  $$('#cal td[data-k]').forEach(td=>{
    td.onclick = ()=>{
      const k = td.getAttribute('data-k');
      const order = STATE.mode==='12' ? ['','D','N','V'] : ['','R','O','N','V'];
      const cur = STATE.days[k]||'';
      const next = order[(order.indexOf(cur)+1)%order.length];
      if(next) STATE.days[k]=next; else delete STATE.days[k];
      save(); renderCalendar(); compute();
    };
  });

  renderHeaderToday();
}

function renderHeaderToday(){
  const today = new Date();
  const tk = key(today);
  const shift = STATE.days[tk] || '—';
  el.todayShift.textContent = `Dnes: ${shift}`;
  // jmeniny
  if(namedays){
    const mmdd = `${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
    el.todayName.textContent = namedays[mmdd] || '—';
  }
}

function monthDelta(delta){ CUR = new Date(CUR.getFullYear(), CUR.getMonth()+delta, 1); renderCalendar(); compute(); }

// compute
function hoursPerShift(code){
  if(STATE.mode==='12'){
    if(code==='D'||code==='N'||code==='V') return 11.25;
    return 0;
  }else{
    if(code==='R') return 8;
    if(code==='O'||code==='N'||code==='V') return 8;
    return 0;
  }
}

function compute(){
  const m = CUR.getMonth()+1, y = CUR.getFullYear();
  let den=0,noc=0,vik=0,ran=0;
  let hours=0, wendHours=0, nightHours=0, eveHours=0;

  // projít měsíc
  const daysIn = new Date(y,m,0).getDate();
  for(let d=1; d<=daysIn; d++){
    const k = `${y}-${pad(m)}-${pad(d)}`;
    const code = STATE.days[k];
    if(!code) continue;

    const date = new Date(y,m-1,d);
    const dow = (date.getDay()+6)%7; // 0..6 (Po..Ne)
    const hrs = hoursPerShift(code);
    hours += hrs;

    // D/N/V/R počty
    if(code==='D') den++;
    if(code==='N') { noc++; nightHours += STATE.mode==='12'?4.25: (STATE.mode==='8'?4.25:0); } // 22–06 = 8, ale příplatek jen 22–06 → 4.25 (od 17:45 do 22 u 12h jsme řešili jako 4.25)
    if(code==='O') eveHours += 4.00;
    if(code==='R') ran++;

    // víkend = So/Ne; u 12h režimu: Víkend příplatek jen při D nebo N přes víkendovou část
    if(dow>=5){ // So=5, Ne=6
      wendHours += hrs;
    }
  }

  // vstupy
  const W = Number(el.wage.value)||STATE.wage;
  const Bpct = (Number(el.bonusPct.value)||STATE.bonusPct)/100;
  const B_e = Number(el.bEvening.value)||STATE.bEvening;
  const B_n = Number(el.bNight.value)||STATE.bNight;
  const B_w = Number(el.bWeekend.value)||STATE.bWeekend;
  const B_c = Number(el.bCont.value)||STATE.bCont;
  const Overtime = Number(el.overtime.value)||STATE.overtime;
  let Yearly = Number(el.yearly.value)||STATE.yearly;
  const vacDay = Number(el.vacHours.value)||STATE.vacHours;
  const mealVal = Number(el.mealVal.value)||STATE.mealVal;
  const ccy = el.ccy.value;

  // roční motivační jen v červnu a listopadu
  const thisMonth = CUR.getMonth()+1;
  if(!(thisMonth===6 || thisMonth===11)){ Yearly = 0; }

  // obědy & stravenky
  // Obědy: automaticky = počet D (12h) resp. R (8h) – lze přepsat v nastavení (st_lunch_cnt)
  let autoLunchCnt = STATE.mode==='12' ? den : ran;
  let lunchCnt = Number(el.lunchCnt.value)||autoLunchCnt;
  let lunchTotal = lunchCnt * (Number(el.lunch.value)||STATE.lunch); // odečet (mínus)
  // Stravenky ks: za denní 1, za noční 2 (nastavitelné)
  const mealKs = (Number(el.mealD.value)||STATE.mealD) * (STATE.mode==='12'?den:ran)
               + (Number(el.mealN.value)||STATE.mealN) * noc;
  const mealMoney = mealKs * mealVal;

  // průměrná náhrada (Kč/h)
  let avg = Number(el.avg.manual.value)||0;
  if(!avg){
    const n1=Number(el.avg.net1.value)||0, h1=Number(el.avg.hrs1.value)||0;
    const n2=Number(el.avg.net2.value)||0, h2=Number(el.avg.hrs2.value)||0;
    const n3=Number(el.avg.net3.value)||0, h3=Number(el.avg.hrs3.value)||0;
    const num = n1+n2+n3, deno = h1+h2+h3;
    avg = deno>0 ? num/deno : 0;
  }

  // základy
  const zaklad = hours * W;
  const bonusPriamy = zaklad * Bpct;

  // příplatky (z nastavených fixních Kč/h)
  const eve = eveHours * B_e;
  const night = nightHours * B_n;
  const weekend = wendHours * B_w;
  const cont = hours * B_c;

  // svátek / dovolená (z průměru) – pokud bys chtěl, doplň do kalendáře označení „S“ a „V“ a dopočítej hodiny × avg.
  const svatekKc = 0;

  // HRUBÁ
  const hruba = zaklad + bonusPriamy + eve + night + weekend + cont + svatekKc + Overtime + Yearly;

  // „čistá“ (odhad) – z v1.8.1 jsme nechávali jen orientační snížení 22% (daň+poj.) – můžeš si upravit.
  const cista = hruba * 0.78 - lunchTotal; // obědy se odečítají až tady

  // SUMMARY
  el.summary.innerHTML =
    `Směny – D:${den} N:${noc} V:${vik} R:${ran}<br>`+
    `Hodiny celkem: ${hours.toFixed(2)}<br>`+
    `Přímé prémie (% z hodinovky): ${bonusPriamy.toFixed(2)} ${ccy}<br>`+
    `Příplatky – Odpo: ${eve.toFixed(2)} ${ccy}, Noc: ${night.toFixed(2)} ${ccy}, Vík: ${weekend.toFixed(2)} ${ccy}<br>`+
    `Nepřetrž.: ${cont.toFixed(2)} ${ccy}<br>`+
    `Přesčas / Fond: ${Overtime.toFixed(2)} ${ccy}, Roční: ${Yearly.toFixed(2)} ${ccy}<br>`+
    `Obědy: ${lunchCnt} ks (−${lunchTotal.toFixed(2)} ${ccy}), Stravenky: ${mealKs} ks (+${mealMoney.toFixed(2)} ${ccy})`;

  // RESULTS
  const rows = [
    ['Hrubá mzda', hruba],
    ['Čistá mzda (odhad)', cista],
    ['Stravenky', mealMoney],
    ['Cafeterie (mimo čistou) – docházkový',  STATE.mode==='12'||STATE.mode==='8' ? 1000 : 0], // pokud chceš automatický checkbox, přidej stav do STATE
  ];
  el.results.innerHTML = rows.map(([k,v],i)=>(
    `<div class="row ${i<3?'green':''}"><div>${k}</div><div>${v.toLocaleString('cs-CZ',{minimumFractionDigits:2,maximumFractionDigits:2})} ${ccy}</div></div>`
  )).join('');
}

function bind(){
  // navigace
  el.prev.onclick=()=>monthDelta(-1);
  el.next.onclick=()=>monthDelta(1);
  el.btnToday.onclick=()=>{ CUR=new Date(); CUR.setDate(1); renderCalendar(); compute(); };
  el.btnClear.onclick=()=>{
    const today = key(new Date());
    delete STATE.days[today]; save(); renderCalendar(); compute();
  };
  // nastavení
  el.btnSettings.onclick=()=>el.dlg.showModal();
  el.dlgCancel.onclick=()=>el.dlg.close();
  el.dlgSave.onclick=()=>{
    // ulož do STATE
    STATE.wage = Number(el.wage.value)||STATE.wage;
    STATE.bonusPct = Number(el.bonusPct.value)||STATE.bonusPct;
    STATE.bEvening = Number(el.bEvening.value)||STATE.bEvening;
    STATE.bNight = Number(el.bNight.value)||STATE.bNight;
    STATE.bWeekend = Number(el.bWeekend.value)||STATE.bWeekend;
    STATE.bCont = Number(el.bCont.value)||STATE.bCont;
    STATE.overtime = Number(el.overtime.value)||STATE.overtime;
    STATE.yearly = Number(el.yearly.value)||STATE.yearly;
    STATE.vacHours = Number(el.vacHours.value)||STATE.vacHours;
    STATE.mealVal = Number(el.mealVal.value)||STATE.mealVal;
    STATE.avg = {
      net1:Number(el.avg.net1.value)||0, hrs1:Number(el.avg.hrs1.value)||0,
      net2:Number(el.avg.net2.value)||0, hrs2:Number(el.avg.hrs2.value)||0,
      net3:Number(el.avg.net3.value)||0, hrs3:Number(el.avg.hrs3.value)||0,
      manual:Number(el.avg.manual.value)||0
    };
    STATE.mode = el.mode.value;
    STATE.ccy = el.ccy.value;
    STATE.lunch = Number(el.lunch.value)||STATE.lunch;
    STATE.lunchCnt = Number(el.lunchCnt.value)||0;
    STATE.mealD = Number(el.mealD.value)||STATE.mealD;
    STATE.mealN = Number(el.mealN.value)||STATE.mealN;
    save(); el.dlg.close(); renderBg(); compute();
  };

  // přenést hodnoty do UI
  el.wage.value=STATE.wage; el.bonusPct.value=STATE.bonusPct;
  el.bEvening.value=STATE.bEvening; el.bNight.value=STATE.bNight;
  el.bWeekend.value=STATE.bWeekend; el.bCont.value=STATE.bCont;
  el.overtime.value=STATE.overtime; el.yearly.value=STATE.yearly;
  el.vacHours.value=STATE.vacHours; el.mealVal.value=STATE.mealVal;
  el.avg.net1.value=STATE.avg.net1; el.avg.hrs1.value=STATE.avg.hrs1;
  el.avg.net2.value=STATE.avg.net2; el.avg.hrs2.value=STATE.avg.hrs2;
  el.avg.net3.value=STATE.avg.net3; el.avg.hrs3.value=STATE.avg.hrs3;
  el.avg.manual.value=STATE.avg.manual;
  el.mode.value=STATE.mode; el.ccy.value=STATE.ccy;
  el.lunch.value=STATE.lunch; el.lunchCnt.value=STATE.lunchCnt;
  el.mealD.value=STATE.mealD; el.mealN.value=STATE.mealN;
}

bind();
renderCalendar();
compute();
