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

  function monthIndexFromUI(){
    // zkusíme běžné titulky; pokud nenajdeme, vezmeme aktuální měsíc
    const cand = $('#monthLabel,.month-label,#monthTitle,.month-title,.calendar h2,.todayBox h2,.kal-h2');
    if(cand){
      const t = cand.textContent.toLowerCase();
      for(let i=0;i<CZ_MONTHS.length;i++) if(t.includes(CZ_MONTHS[i])) return i; // 0..11
    }
    return new Date().getMonth();
  }

  // --- 3) Vstupy a perzistence (držíme si hodnoty) ---
  const inpAnnual = $('#patch_annual');
  const inpFond   = $('#patch_fond');

  const LS_A = 'SMENAREK_PATCH_ANNUAL';
  const LS_F = 'SMENAREK_PATCH_FOND';

  if(inpAnnual) inpAnnual.value = localStorage.getItem(LS_A) ?? inpAnnual.value ?? '0';
  if(inpFond)   inpFond.value   = localStorage.getItem(LS_F) ?? inpFond.value   ?? '0';

  inpAnnual && inpAnnual.addEventListener('input', ()=> localStorage.setItem(LS_A, inpAnnual.value||'0'));
  inpFond   && inpFond.addEventListener('input',   ()=> localStorage.setItem(LS_F, inpFond.value||'0'));

  // --- 4) Samotné přičtení k výsledkům (po tvém výpočtu) ---
  function applyPatch(){
    const grossRow = findResultRow('Hrubá mzda');
    const netRow   = findResultRow('Čistá mzda');
    if(!grossRow || !netRow) return; // když výsledky ještě nejsou vykreslené

    const g = readMoney(grossRow.valEl.textContent);
    const n = readMoney(netRow.valEl.textContent);

    const monthIdx = monthIndexFromUI(); // 0..11
    const annualRaw = parseCZ(inpAnnual?.value);
    const annual = (monthIdx===5 || monthIdx===10) ? annualRaw : 0; // 5=červen, 10=listopad

    const fond = parseCZ(inpFond?.value);

    const newGross = g.num + annual + fond;
    const newNet   = n.num + annual + fond;

    grossRow.valEl.textContent = fmtCZ(newGross, g.suffix);
    netRow.valEl.textContent   = fmtCZ(newNet,   n.suffix);

    // přidáme/aktualizujeme řádky v Přehledu (pokud tam máš container)
    const summary = $('#summary');
    if(summary){
      const lineId = (id)=>`patch-${id}`;
      function upsertLine(id, label, val){
        let node = summary.querySelector(`#${lineId(id)}`);
        const html = `<div id="${lineId(id)}">${label}: ${fmtCZ(val, g.suffix)}</div>`;
        if(node) node.outerHTML = html; else summary.insertAdjacentHTML('beforeend', html);
      }
      upsertLine('overtime', 'Přesčas / Fond', fond);
      upsertLine('annual',   'Roční (6/11)',   annual);
    }
  }

  // --- 5) Spouštění po akcích (klik v kalendáři, změny vstupů, přepnutí měsíce…) ---
  function wire(selector, type){
    document.addEventListener(type, ev=>{
      if(ev.target.closest(selector)) setTimeout(applyPatch, 0);
    }, true);
  }
  ['click','input','change'].forEach(t=>{
    ['#calendar','.calendar','.day','input','select','#btnPrev','#btnNext','#btnToday','.btn']
      .forEach(sel=>wire(sel,t));
  });

  // při změně titulku měsíce (přepínání šipkami)
  const titleNode = $('#monthLabel,.month-label,#monthTitle,.month-title,.calendar h2,.todayBox h2,.kal-h2');
  if (titleNode && 'MutationObserver' in window){
    const mo = new MutationObserver(()=>setTimeout(applyPatch,0));
    mo.observe(titleNode,{childList:true,subtree:true,characterData:true});
  }

  // první pokus po načtení
  window.addEventListener('load', ()=> setTimeout(applyPatch, 0));
})();
