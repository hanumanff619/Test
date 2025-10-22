// patch_v182.js – neinvazivní doplněk: Roční (jen 6/11) + Přesčas/Fond
(function(){
  const $ = (s, p=document)=>p.querySelector(s);
  const $$= (s, p=document)=>[...p.querySelectorAll(s)];
  const parseCZ = v => Number(String(v??'').replace(/\s/g,'').replace(',','.'))||0;

  // --- 1) Najdeme řádky "Hrubá mzda" a "Čistá mzda" ve Výsledcích ---
  function findResultRow(label){
    // hledáme divy se dvěma buňkami: [název][hodnota]
    const rows = $$('#card-results .results .row, .results .row, .result-row');
    for(const r of rows){
      const nameEl = r.firstElementChild;
      const valEl  = r.lastElementChild;
      if(!nameEl || !valEl) continue;
      const name = nameEl.textContent.trim().toLowerCase();
      if(name === label.toLowerCase()) return {row:r, valEl};
    }
    return null;
  }

  function readMoney(text){
    // vrátí {num, suffix} – num=číslo, suffix=zbytek (měna atd.)
    const m = String(text||'').match(/([-+]?\d[\d\s,.]*)/);
    const num = m ? parseCZ(m[1]) : 0;
    const suffix = String(text||'').slice(m ? m.index + m[0].length : 0);
    return {num, suffix};
  }

  function fmtCZ(n, suffix){
    return (n||0).toLocaleString('cs-CZ',{minimumFractionDigits:2,maximumFractionDigits:2}) + (suffix||'');
  }

  // --- 2) Zjistit aktuální "zobrazený měsíc" pro roční bonus ---
  const CZ_MONTHS = ["leden","únor","březen","duben","květen","červen","červenec","srpen","září","říjen","listopad","prosinec"];

  // ----- robustnější zjištění měsíce -----
const MONTHS_NORM = ["leden","unor","brezen","duben","kveten","cerven","cervenec","srpen","zari","rijen","listopad","prosinec"];
const STRIP = s => String(s||"").toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g,""); // bez diakritiky

function monthIndexFromUI(){
  // 1) zkusíme text z okolí kalendáře
  const containers = [
    '#card-calendar','.calendar','.todayBox','#calendar',
    '.head h2','.calendar h2','#monthLabel','.month-label',
    '#monthTitle','.month-title'
  ];
  for(const sel of containers){
    const el = document.querySelector(sel);
    if(!el) continue;
    const t = STRIP(el.textContent);
    for(let i=0;i<MONTHS_NORM.length;i++){
      if(t.includes(MONTHS_NORM[i])) return i; // 0..11
    }
  }
  // 2) jakýkoliv element s textem měsíce v dokumentu
  const all = STRIP(document.body.textContent).slice(0,50000);
  for(let i=0;i<MONTHS_NORM.length;i++){
    if(all.includes(MONTHS_NORM[i])) return i;
  }
  // 3) poslední záchrana – současný měsíc zařízení
  return new Date().getMonth();
}

// … níže v souboru ponech vše stejné, jen v části s MutationObserverem nahraď „titleNode“ robustnější verzí:
const titleCandidates = [
  '#card-calendar','.calendar','.todayBox','#calendar',
  '#monthLabel','.month-label','#monthTitle','.month-title','.head h2','.calendar h2'
].map(s => document.querySelector(s)).filter(Boolean);

if ('MutationObserver' in window && titleCandidates.length){
  const mo = new MutationObserver(()=>setTimeout(applyPatch,0));
  titleCandidates.forEach(n => mo.observe(n,{childList:true,subtree:true,characterData:true}));
}

  // první pokus po načtení
  window.addEventListener('load', ()=> setTimeout(applyPatch, 0));
})();
