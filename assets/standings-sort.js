(()=>{
'use strict';

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const fmt=n=>n==null||n===''?'—':Number(n).toLocaleString(undefined,{maximumFractionDigits:2});
const rec=(w,l,t=0)=>`${w??0}-${l??0}${Number(t||0)?`-${t}`:''}`;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const n=(value,fallback=0)=>{const x=Number(value);return Number.isFinite(x)?x:fallback;};

function injectStyles(){
  if($('#standingsSortStyles')) return;
  const style=document.createElement('style');
  style.id='standingsSortStyles';
  style.textContent=`
    .quick-standings-scroll{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
    .quick-standings-table{width:100%;border-collapse:collapse;table-layout:fixed;font-variant-numeric:tabular-nums}
    .quick-standings-table th{padding:0 4px 7px;color:#8f99a8;font-size:9px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;text-align:right;white-space:nowrap}
    .quick-standings-table th:first-child{width:24px;text-align:left}
    .quick-standings-table th:nth-child(2){text-align:left}
    .quick-standings-table th:nth-child(3){width:52px}
    .quick-standings-table th:nth-child(4),.quick-standings-table th:nth-child(5){width:58px}
    .quick-standings-table td{padding:8px 4px;border-bottom:1px solid rgba(255,255,255,.055);vertical-align:middle}
    .quick-standings-table tbody tr:last-child td{border-bottom:0}
    .quick-standings-table .qs-rank{color:#747e8b;font-size:11px;font-weight:900}
    .quick-standings-table .qs-team{min-width:0;text-align:left}
    .quick-standings-table .qs-team strong{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .quick-standings-table .qs-team small{display:block;color:var(--muted);font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .quick-standings-table .qs-record{font-size:12px;font-weight:900;text-align:right;white-space:nowrap}
    .quick-standings-table .qs-stat{color:#d6dbe3;font-size:10px;text-align:right;white-space:nowrap}
    .quick-sort,.season-sort{appearance:none;border:0;background:transparent;color:inherit;font:inherit;font-weight:inherit;letter-spacing:inherit;text-transform:inherit;padding:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:flex-end;gap:3px;white-space:nowrap}
    .quick-sort:hover,.quick-sort:focus-visible,.season-sort:hover,.season-sort:focus-visible{color:#fff}
    .quick-sort:focus-visible,.season-sort:focus-visible{outline:2px solid rgba(255,255,255,.7);outline-offset:3px;border-radius:3px}
    .quick-sort.active,.season-sort.active{color:#fff}
    .sort-arrow{display:inline-block;min-width:8px;color:#8d96a4;font-size:.9em;text-align:center}
    .quick-sort.active .sort-arrow,.season-sort.active .sort-arrow{color:#ff6b70}
    #seasonTable th.sortable-col{white-space:nowrap}
    #seasonTable th.sortable-col .season-sort{width:100%}
    #seasonTable th.num.sortable-col .season-sort{justify-content:flex-end}
    #seasonTable th:not(.num).sortable-col .season-sort{justify-content:flex-start}
    @media(max-width:460px){
      .quick-standings-table th{font-size:8px;padding-inline:2px}
      .quick-standings-table td{padding:8px 2px}
      .quick-standings-table th:first-child{width:22px}
      .quick-standings-table th:nth-child(3){width:46px}
      .quick-standings-table th:nth-child(4),.quick-standings-table th:nth-child(5){width:52px}
      .quick-standings-table .qs-team strong{font-size:11px}
      .quick-standings-table .qs-team small{font-size:8px}
      .quick-standings-table .qs-record{font-size:11px}
      .quick-standings-table .qs-stat{font-size:9px}
    }
  `;
  document.head.appendChild(style);
}

function gamesPlayed(row){
  return n(row.wins_espn)+n(row.losses_espn)+n(row.ties_espn);
}

function winPct(row){
  const games=gamesPlayed(row);
  return games?(n(row.wins_espn)+n(row.ties_espn)*.5)/games:0;
}

function standingsCompare(a,b){
  return winPct(b)-winPct(a)
    || n(b.wins_espn)-n(a.wins_espn)
    || n(b.points_for_espn)-n(a.points_for_espn)
    || n(a.playoff_seed,99)-n(b.playoff_seed,99)
    || String(a.manager||'').localeCompare(String(b.manager||''));
}

function defaultDirection(key){
  return ['pa','finish','manager','team','seed','draft'].includes(key)?'asc':'desc';
}

function sortArrow(active,dir){
  return active?(dir==='asc'?'↑':'↓'):'↕';
}

function renderQuickStandings(D){
  const root=$('#currentStandings');
  const note=$('#standingsNowNote');
  if(!root||!note) return;
  const rows=(D.managerSeasons||[]).filter(x=>x.season===D.meta.currentSeason&&x.current_manager!==false);
  if(!rows.length||!rows.some(x=>gamesPlayed(x)>0)) return;

  const official=[...rows].sort(standingsCompare);
  const rankByManager=new Map(official.map((row,i)=>[row.manager,i+1]));
  const state={key:'standings',dir:'desc'};

  const compare=(a,b)=>{
    if(state.key==='standings'){
      const base=standingsCompare(a,b);
      return state.dir==='desc'?base:-base;
    }
    let av,bv;
    if(state.key==='pf'){av=n(a.points_for_espn);bv=n(b.points_for_espn);}
    else {av=n(a.points_against_espn);bv=n(b.points_against_espn);}
    const base=av-bv;
    if(base) return state.dir==='asc'?base:-base;
    return standingsCompare(a,b);
  };

  const render=()=>{
    const sorted=[...rows].sort(compare);
    const cols=[['standings','W-L'],['pf','PF'],['pa','PA']];
    root.innerHTML=`<div class="quick-standings-scroll"><table class="quick-standings-table"><thead><tr><th>#</th><th>Manager</th>${cols.map(([key,label])=>{const active=state.key===key;return `<th aria-sort="${active?(state.dir==='asc'?'ascending':'descending'):'none'}"><button type="button" class="quick-sort${active?' active':''}" data-sort="${key}" aria-label="Sort current standings by ${label}">${label}<span class="sort-arrow">${sortArrow(active,state.dir)}</span></button></th>`;}).join('')}</tr></thead><tbody>${sorted.map(s=>`<tr><td class="qs-rank">${rankByManager.get(s.manager)||'—'}</td><td class="qs-team"><strong>${esc(s.manager)}</strong><small>${esc(s.team_name||'')}</small></td><td class="qs-record">${rec(s.wins_espn,s.losses_espn,s.ties_espn)}</td><td class="qs-stat">${fmt(s.points_for_espn)}</td><td class="qs-stat">${fmt(s.points_against_espn)}</td></tr>`).join('')}</tbody></table></div>`;
    note.textContent='Current regular-season standings. Tap W-L, PF or PA to sort; the # column always shows the actual standings position.';
    $$('.quick-sort',root).forEach(btn=>btn.addEventListener('click',()=>{
      const key=btn.dataset.sort;
      if(state.key===key) state.dir=state.dir==='asc'?'desc':'asc';
      else {state.key=key;state.dir=defaultDirection(key);}
      render();
    }));
  };
  render();
}

function enhanceSeasonTable(D){
  const table=$('#seasonTable');
  const filter=$('#seasonFilter');
  if(!table||!filter||table.dataset.sortEnhanced==='true') return;
  table.dataset.sortEnhanced='true';

  const state={key:'finish',dir:'asc'};
  const columns=[
    ['finish','Final Finish',false],
    ['manager','Manager',false],
    ['team','Team',false],
    ['record','W-L',false],
    ['pf','Points For',true],
    ['pa','Points Against',true],
    ['seed','Playoff Seed',true],
    ['draft','Draft-Day ESPN PR',true]
  ];

  const valueCompare=(a,b,key)=>{
    if(key==='manager') return String(a.manager||'').localeCompare(String(b.manager||''));
    if(key==='team') return String(a.team_name||'').localeCompare(String(b.team_name||''));
    if(key==='record'){
      return winPct(a)-winPct(b)
        || n(a.wins_espn)-n(b.wins_espn)
        || n(a.points_for_espn)-n(b.points_for_espn)
        || n(b.losses_espn)-n(a.losses_espn);
    }
    if(key==='pf') return n(a.points_for_espn)-n(b.points_for_espn);
    if(key==='pa') return n(a.points_against_espn)-n(b.points_against_espn);
    if(key==='finish') return n(a.final_finish,999)-n(b.final_finish,999);
    if(key==='seed') return n(a.playoff_seed,999)-n(b.playoff_seed,999);
    return n(a.draft_day_power_rank,999)-n(b.draft_day_power_rank,999);
  };

  const fallback=(a,b)=>standingsCompare(a,b)||String(a.manager||'').localeCompare(String(b.manager||''));

  const render=()=>{
    const year=Number(filter.value);
    if(!year) return;
    const champion=(D.championships||[]).find(x=>x.season===year);
    const rows=(D.managerSeasons||[]).filter(x=>x.season===year);
    rows.sort((a,b)=>{
      const base=valueCompare(a,b,state.key);
      if(base) return state.dir==='asc'?base:-base;
      return fallback(a,b);
    });

    table.querySelector('thead').innerHTML=`<tr>${columns.map(([key,label,isNum])=>{const active=state.key===key;return `<th class="${isNum?'num ':''}sortable-col" aria-sort="${active?(state.dir==='asc'?'ascending':'descending'):'none'}"><button type="button" class="season-sort${active?' active':''}" data-sort="${key}" aria-label="Sort season table by ${label}">${label}<span class="sort-arrow">${sortArrow(active,state.dir)}</span></button></th>`;}).join('')}</tr>`;
    table.querySelector('tbody').innerHTML=rows.map(s=>`<tr><td>${s.final_finish??'—'}${champion?.champion===s.manager?' 🏆':''}</td><td class="manager-cell">${esc(s.manager)}</td><td>${esc(s.team_name||'')}</td><td>${rec(s.wins_espn,s.losses_espn,s.ties_espn)}</td><td class="num">${fmt(s.points_for_espn)}</td><td class="num">${fmt(s.points_against_espn)}</td><td class="num">${s.playoff_seed??'—'}</td><td class="num">${s.draft_day_power_rank||'—'}</td></tr>`).join('');
  };

  table.addEventListener('click',event=>{
    const btn=event.target.closest('.season-sort');
    if(!btn) return;
    const key=btn.dataset.sort;
    if(state.key===key) state.dir=state.dir==='asc'?'desc':'asc';
    else {state.key=key;state.dir=defaultDirection(key);}
    render();
  });

  filter.addEventListener('change',()=>{
    state.key='finish';
    state.dir='asc';
    setTimeout(render,0);
  });

  render();
}

function init(D){
  injectStyles();
  renderQuickStandings(D);
  enhanceSeasonTable(D);
}

function waitForReady(){
  let tries=0;
  const timer=setInterval(()=>{
    const D=window.FAM_PUBLIC_DATA;
    const ready=D&&$('#currentStandings')&&$('#seasonTable')&&$('#seasonFilter')?.options.length;
    if(ready){clearInterval(timer);init(D);return;}
    if(++tries>120) clearInterval(timer);
  },50);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',waitForReady); else waitForReady();
})();