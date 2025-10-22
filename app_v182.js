(()=>{
  const $=s=>document.querySelector(s);
  const stKey='smenarek_v2_settings';
  const monthsKey='smenarek_v2_months';
  const fmt=n=>(n||0).toLocaleString('cs-CZ',{minimumFractionDigits:2,maximumFractionDigits:2});

  // BG podle režimu (12h / 8h)
  const bg=$('#bg-layer');
  const setBg=()=>{ const mode=$('#in_mode').value; bg.style.backgroundImage=`url('backgrounds/${mode==='12'?'bg_12h.jpg':'bg_8h.jpg'}')`; };

  // inputs/výstupy
  const inMonth=$('#in_month'),inMode=$('#in_mode'),inD=$('#in_countD'),inN=$('#in_countN'),inVac=$('#in_vacDays'),
        inHol=$('#in_holidayHours'),inWend=$('#in_weekendHours'),inMeals=$('#in_meals'),inVouch=$('#in_vouchers'),
        inOver=$('#in_overtime'),inAvgM=$('#in_avgManual'),inCaf=$('#in_caf');

  const outH=$('#out_hours'),outBase=$('#out_base'),outBonus=$('#out_bonus'),outAdd=$('#out_addons'),
        outVac=$('#out_vac'),outOver=$('#out_overtime'),outMeals=$('#out_meals'),outGross=$('#out_gross'),
        outNet=$('#out_net'),outCaf=$('#out_caf');

  // Nastavení prvky
  const st={wage:$('#st_wage'),directPct:$('#st_directPct'),bAfternoon:$('#st_b_afternoon'),
            bNight:$('#st_b_night'),bWeekend:$('#st_b_weekend'),bCont:$('#st_b_cont'),
            avgAuto:$('#st_avgAuto'),vacHoursPerDay:$('#st_vacHoursPerDay'),annual:$('#st_annual'),
            mealPrice:$('#st_mealPrice'),vouchDed:$('#st_vouchDed'),vouchVal:$('#st_vouchVal'),
            vouchPerDay:$('#st_vouchPerDay'),vouchPerNight:$('#st_vouchPerNight')};

  function loadSettings(){
    const s=JSON.parse(localStorage.getItem(stKey)||'{}');
    for(const k in st){ if(s[k]!=null) st[k].value=s[k]; }
    setBg();
  }
  function saveSettings(){
    const s={}; for(const k in st) s[k]=Number(st[k].value)||0;
    localStorage.setItem(stKey,JSON.stringify(s));
    $('#dlgSettings').close();
    calc();
  }

  // month key YYYY-MM
  const mkey=()=> (inMonth.value||new Date().toISOString().slice(0,7)).slice(0,7);

  // uložené měsíce (pro auto průměrnou náhradu)
  const smonths=()=> JSON.parse(localStorage.getItem(monthsKey)||'[]');
  function saveMonth(rec){
    const arr=smonths().filter(r=>r.m!==rec.m);
    arr.push(rec);
    localStorage.setItem(monthsKey,JSON.stringify(arr));
  }

  // auto průměrná náhrada z posledních 3 uložených měsíců (čistá/hod)
  function avgLast3(){
    const arr=smonths().sort((a,b)=>a.m.localeCompare(b.m)).slice(-3);
    if(arr.length<3) return Number(st.avgAuto.value)||0;
    let sum=0;
    arr.forEach(r=>{ sum+=(r.hours>0?(r.net/r.hours):0); });
    const val=sum/arr.length;
    st.avgAuto.value=val.toFixed(2);
    const cur=JSON.parse(localStorage.getItem(stKey)||'{}'); cur.avgAuto=Number(st.avgAuto.value);
    localStorage.setItem(stKey,JSON.stringify(cur));
    return val;
  }

  // roční motivační jen v 06 a 11
  function annualForMonth(){
    const m=Number(mkey().slice(5,7));
    return (m===6||m===11)?(Number(st.annual.value)||0):0;
  }

  function calc(){
    setBg();
    const S=Object.fromEntries(Object.entries(st).map(([k,e])=>[k,Number(e.value)||0]));

    const D=+inD.value||0, N=+inN.value||0, vacD=+inVac.value||0, hol=+inHol.value||0,
          wend=+inWend.value||0, meals=+inMeals.value||0,
          vouchManual=(inVouch.value===''?null:(+inVouch.value||0)),
          over=+inOver.value||0, caf=inCaf?.checked===true;

    const basePerShift=(inMode.value==='12')?11.25:8.0;
    const hours=basePerShift*(D+N);

    // průměrná náhrada
    const avg = (+inAvgM.value>0) ? +inAvgM.value : (avgLast3() || S.avgAuto || 0);

    // příplatkové hodiny (zjednodušeně – stejně jako v dohodě)
    const afternoonH = 4*D;
    const nightH     = 8*N;
    const contH      = hours;
    const wendH      = wend;
    const holH       = hol;

    // základ
    const base   = hours * S.wage;
    const direct = base * (S.directPct/100);

    // příplatky
    const addons = afternoonH*S.bAfternoon + nightH*S.bNight + wendH*S.bWeekend + holH*avg + contH*S.bCont;

    // dovolená
    const vac = vacD * S.vacHoursPerDay * avg;

    // hrubá mzda (vč. přesčas/fond + roční motivační jen v červnu/listopadu)
    const gross = base + direct + addons + vac + over + annualForMonth();

    // čistá orientačně (27 % záloha)
    const net = gross * 0.73;

    // stravenky & obědy – do čisté: −oběd −srážka za stravenku; info +hodnota stravenek
    const autoV = D*S.vouchPerDay + N*S.vouchPerNight;
    const V = (vouchManual==null) ? autoV : vouchManual;
    const minus = meals*S.mealPrice + V*S.vouchDed;
    const plus  = V*S.vouchVal;
    const netAfter = Math.max(0, net - minus);

    // výstupy
    outH.textContent    = hours.toFixed(2);
    outBase.textContent = fmt(base);
    outBonus.textContent= fmt(direct);
    outAdd.textContent  = fmt(addons);
    outVac.textContent  = fmt(vac);
    outOver.textContent = fmt(over);
    outMeals.textContent= fmt(plus - minus);
    outGross.textContent= fmt(gross);
    outNet.textContent  = fmt(netAfter);
    outCaf.textContent  = fmt(caf?1000:0);
  }

  function onSaveMonth(){
    const rec={
      m:mkey(),
      hours:+($('#out_hours').textContent||0),
      gross:Number(($('#out_gross').textContent||'0').replace(/\s/g,'').replace(',','.'))||0,
      net:Number(($('#out_net').textContent||'0').replace(/\s/g,'').replace(',','.'))||0
    };
    saveMonth(rec);
    alert('Měsíc uložen ✅');
  }

  // UI
  $('#btnSettings').addEventListener('click',()=>$('#dlgSettings').showModal());
  $('#btnSaveSettings').addEventListener('click',(e)=>{e.preventDefault();saveSettings()});
  $('#btnCalc').addEventListener('click',calc);
  $('#btnSaveMonth').addEventListener('click',onSaveMonth);
  $('#in_mode').addEventListener('change',setBg);

  // init
  (function init(){
    inMonth.value=new Date().toISOString().slice(0,7);
    loadSettings();
    if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
    calc();
  })();
})();
