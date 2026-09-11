(()=>{
'use strict';

const ordinal=n=>{
  const x=Number(n);
  if(!Number.isFinite(x)) return null;
  const v=x%100;
  const suffix=(v>=11&&v<=13)?'th':({1:'st',2:'nd',3:'rd'}[x%10]||'th');
  return `${x}${suffix}`;
};

function getDraftSlot(D,season,manager){
  const rows=(D.draftHistory||[]).filter(r=>Number(r.season)===Number(season)&&r.manager===manager&&Number(r.round)===1);
  if(!rows.length) return null;
  rows.sort((a,b)=>Number(a.overall_pick||999)-Number(b.overall_pick||999));
  const r=rows[0];
  return Number(r.round_pick||r.overall_pick)||null;
}

function annotateChampionDraftSlots(){
  const D=window.FAM_PUBLIC_DATA;
  const timeline=document.querySelector('#champTimeline');
  if(!D||!timeline||!timeline.children.length) return false;

  const champs=new Map((D.championships||[]).map(c=>[Number(c.season),c]));
  [...timeline.querySelectorAll('.champ-year')].forEach(card=>{
    if(card.querySelector('.champ-draft-slot')) return;
    const season=Number(card.querySelector('.year')?.textContent?.trim());
    const champ=champs.get(season);
    if(!champ) return;
    const slot=getDraftSlot(D,season,champ.champion);
    const detail=card.querySelector(':scope > div:nth-child(2)');
    if(!detail) return;

    const badge=document.createElement('div');
    badge.className='champ-draft-slot';
    if(slot){
      badge.innerHTML=`<span class="draft-icon">🎯</span><span><small>CHAMPION'S DRAFT POSITION</small><strong>${ordinal(slot)} pick <em>• Round 1</em></strong></span>`;
      badge.title=`${champ.champion} drafted from the ${ordinal(slot)} position in Round 1 of the ${season} FAM draft.`;
    }else{
      badge.innerHTML='<span class="draft-icon">🎯</span><span><small>CHAMPION\'S DRAFT POSITION</small><strong>Not available in ESPN draft history</strong></span>';
    }
    detail.appendChild(badge);
  });
  return true;
}

function boot(){
  let attempts=0;
  const run=()=>{
    attempts++;
    if(annotateChampionDraftSlots()||attempts>40) return;
    setTimeout(run,150);
  };
  run();

  const timeline=document.querySelector('#champTimeline');
  if(timeline){
    new MutationObserver(()=>annotateChampionDraftSlots()).observe(timeline,{childList:true,subtree:true});
  }
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
