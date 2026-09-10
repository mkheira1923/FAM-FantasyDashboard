(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const fmt=n=>n==null?'—':Number(n).toLocaleString(undefined,{maximumFractionDigits:2});
const rec=(w,l,t=0)=>`${w??0}-${l??0}${t?`-${t}`:''}`;

async function loadData(){
  if(!('DecompressionStream' in window)) return null;
  const payloads=Object.values(window.FAM_PAYLOADS||{});
  if(!payloads.length) return null;
  const merged={};
  for(const encoded of payloads){
    const raw=atob(encoded);
    const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const chunk=JSON.parse(await new Response(stream).text());
    for(const [k,v] of Object.entries(chunk)){
      if(Array.isArray(merged[k])&&Array.isArray(v)) merged[k].push(...v);
      else if(merged[k]&&v&&typeof merged[k]==='object'&&typeof v==='object'&&!Array.isArray(v)) merged[k]={...merged[k],...v};
      else merged[k]=v;
    }
  }
  return merged;
}

function easternTime(iso){
  if(!iso) return 'Refresh time unavailable';
  const d=new Date(iso);
  return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(d);
}

function currentTeam(D,name){
  return D.managerSeasons.find(x=>x.manager===name&&x.season===D.meta.currentSeason)?.team_name||'';
}

function completedWeek(D){
  const rows=(D.weeklyScores||[]).filter(x=>x.season===D.meta.currentSeason&&x.tier==='REGULAR_SEASON'&&['W','L','T'].includes(x.result));
  if(!rows.length) return null;
  return Math.max(...rows.map(x=>Number(x.week)||0));
}

function uniqueMatchups(rows){
  const seen=new Set(),out=[];
  for(const r of rows){
    if(!r.manager||!r.opponent) continue;
    const key=[r.manager,r.opponent].sort().join('||');
    if(seen.has(key)) continue;
    seen.add(key);
    const other=rows.find(x=>x.manager===r.opponent&&x.opponent===r.manager);
    const a=r,b=other||{manager:r.opponent,score:r.opponent_score,result:r.result==='W'?'L':r.result==='L'?'W':'T'};
    const winner=a.result==='W'?a.manager:b.result==='W'?b.manager:null;
    out.push({a,b,winner,margin:Math.abs(Number(a.score||0)-Number(b.score||0)),total:Number(a.score||0)+Number(b.score||0)});
  }
  return out;
}

function refreshStatus(D){
  const text=easternTime(D.meta.generatedAtUtc);
  const hero=$('#lastRefreshHero'); if(hero) hero.textContent=text;
  const footer=$('#updatedAt'); if(footer) footer.textContent=`Data last refreshed ${text}`;
  $('.live-pill')?.remove();
}

function renderWeekHub(D){
  const root=$('#weekHub');
  if(!root) return;
  const week=completedWeek(D);
  const badge=$('#weekBadge');
  const title=$('#weekTitle');
  const subtitle=$('#weekSubtitle');
  if(badge) badge.textContent=week?`Week ${week} final`:`${D.meta.currentSeason} season`;
  if(title) title.textContent=week?`Week ${week} Results & Standings`:`${D.meta.currentSeason} Weekly Hub`;
  if(subtitle) subtitle.textContent=week?'The latest completed matchups, early standings and the fastest way into the rivalry receipts.':'This area will automatically turn into the latest weekly scoreboard as soon as ESPN posts completed results.';

  const resultRoot=$('#latestResults');
  const highlightRoot=$('#weekHighlights');
  const standingsRoot=$('#currentStandings');
  const standingsNote=$('#standingsNowNote');
  const seasonRows=(D.managerSeasons||[]).filter(x=>x.season===D.meta.currentSeason&&x.current_manager!==false);
  const hasGames=seasonRows.some(x=>Number(x.wins_espn||0)+Number(x.losses_espn||0)+Number(x.ties_espn||0)>0);

  if(week){
    const rows=(D.weeklyScores||[]).filter(x=>x.season===D.meta.currentSeason&&Number(x.week)===week&&x.tier==='REGULAR_SEASON'&&['W','L','T'].includes(x.result));
    const games=uniqueMatchups(rows).sort((x,y)=>y.total-x.total);
    resultRoot.innerHTML=games.map((g,i)=>{
      const aWin=g.winner===g.a.manager,bWin=g.winner===g.b.manager;
      return `<button class="score-matchup" data-a="${g.a.manager}" data-b="${g.b.manager}" aria-label="Open head to head for ${g.a.manager} and ${g.b.manager}"><div class="match-label"><span>Matchup ${i+1}</span><span>${g.margin.toFixed(2)} pt margin</span></div><div class="score-team ${aWin?'winner':'loser'}"><strong>${aWin?'✓ ':''}${g.a.manager}</strong><b>${fmt(g.a.score)}</b></div><div class="score-team ${bWin?'winner':'loser'}"><strong>${bWin?'✓ ':''}${g.b.manager}</strong><b>${fmt(g.b.score)}</b></div><div class="match-footer"><span>${currentTeam(D,g.a.manager)}</span><span>Tap for H2H →</span></div></button>`;
    }).join('');
    const allScores=rows.filter(x=>Number.isFinite(Number(x.score))).sort((a,b)=>Number(b.score)-Number(a.score));
    const high=allScores[0];
    const closest=[...games].sort((a,b)=>a.margin-b.margin)[0];
    const blowout=[...games].sort((a,b)=>b.margin-a.margin)[0];
    highlightRoot.innerHTML=[
      ['High score',high?`${high.manager} • ${fmt(high.score)}`:'—'],
      ['Closest game',closest?`${closest.a.manager} / ${closest.b.manager} • ${fmt(closest.margin)}`:'—'],
      ['Biggest win',blowout?`${blowout.winner||'Tie'} • ${fmt(blowout.margin)}`:'—']
    ].map(x=>`<div class="week-highlight"><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join('');
    $$('.score-matchup',resultRoot).forEach(btn=>btn.addEventListener('click',()=>jumpToH2H(btn.dataset.a,btn.dataset.b)));
  }else{
    resultRoot.innerHTML=`<div class="empty-week"><div><div class="football">🏈</div><strong>No completed ${D.meta.currentSeason} games yet</strong><p>The league archive is ready. After the first completed week, this panel will automatically show every winner, loser, score, margin, weekly high score and rivalry shortcut.</p></div></div>`;
    highlightRoot.innerHTML='';
  }

  if(hasGames){
    const sorted=[...seasonRows].sort((a,b)=>{
      const ag=Number(a.wins_espn||0)+Number(a.losses_espn||0)+Number(a.ties_espn||0),bg=Number(b.wins_espn||0)+Number(b.losses_espn||0)+Number(b.ties_espn||0);
      const ap=ag?(Number(a.wins_espn||0)+Number(a.ties_espn||0)*.5)/ag:0,bp=bg?(Number(b.wins_espn||0)+Number(b.ties_espn||0)*.5)/bg:0;
      return bp-ap||Number(b.points_for_espn||0)-Number(a.points_for_espn||0)||Number(a.playoff_seed||99)-Number(b.playoff_seed||99);
    });
    standingsRoot.innerHTML=sorted.map((s,i)=>`<div class="standing-now-row"><span class="pos">${i+1}</span><div class="club"><strong>${s.manager}</strong><small>${s.team_name||''}</small></div><span class="record">${rec(s.wins_espn,s.losses_espn,s.ties_espn)}</span><span class="pf">${fmt(s.points_for_espn)} PF</span></div>`).join('');
    standingsNote.textContent='Current regular-season record. For this quick view only, equal records are ordered by Points For.';
  }else{
    standingsRoot.innerHTML=`<div class="empty-week"><div><div class="football">📊</div><strong>Standings start with Week 1</strong><p>Everyone is still 0-0. This card will sort automatically once ESPN records completed games.</p></div></div>`;
    standingsNote.textContent='Preseason — no completed regular-season games yet.';
  }
}

function jumpToH2H(a,b){
  const A=$('#h2hA'),B=$('#h2hB');
  if(A&&B){A.value=a;B.value=b;A.dispatchEvent(new Event('change',{bubbles:true}));B.dispatchEvent(new Event('change',{bubbles:true}));}
  $('#h2h')?.scrollIntoView({behavior:'smooth',block:'start'});
}

function clarifyExistingUI(D){
  const current=$('#current .section-heading p');
  if(current) current.textContent="ESPN Power Rank is ESPN's projected team rank captured at each refresh. Draft = draft-day rank, Move = spots gained/lost since draft day, Seed = current ESPN playoff seed.";
  const managerP=$('#managers .section-heading p');
  if(managerP) managerP.textContent='Tap any manager for championships, season history, old team names and H2H receipts. Career REG = regular season; Title Playoff = championship-path games only; ESPN PR = latest ESPN Power Rank.';
  const currentTitle=$('#currentSeasonTitle'); if(currentTitle) currentTitle.textContent=`${D.meta.currentSeason} ESPN Power Board`;

  const annotate=()=>{
    $$('.manager-card .mini-stats').forEach(box=>{
      const labels=$$('small',box);
      if(labels[0]){labels[0].textContent='CAREER REG';labels[0].title='Career regular-season record';}
      if(labels[1]){labels[1].textContent='TITLE PLAYOFF';labels[1].title='Only games while still alive for the FAM championship';}
      if(labels[2]){labels[2].textContent='ESPN PR';labels[2].title="ESPN's latest Power Rank snapshot";}
    });
    $$('.power-card small').forEach(x=>x.title="ESPN's currentProjectedRank captured in the latest snapshot");
  };
  annotate();setTimeout(annotate,250);setTimeout(annotate,1000);
}

function addGuide(sectionId,anchorSelector,title,summary,items,open=false){
  const section=$(sectionId); if(!section||section.querySelector('.section-guide')) return;
  const anchor=section.querySelector(anchorSelector); if(!anchor) return;
  const guide=document.createElement('details');
  guide.className='section-guide';
  if(open) guide.open=true;
  guide.innerHTML=`<summary><span><b>ⓘ ${title}</b><small>${summary}</small></span><span class="guide-toggle">Details</span></summary><div class="guide-grid">${items.map(([term,desc])=>`<div><strong>${term}</strong><span>${desc}</span></div>`).join('')}</div>`;
  anchor.parentNode.insertBefore(guide,anchor);
}

function injectClarityGuides(){
  const quick=$('.quick-nav');
  if(quick&&!$('#countingGuide')){
    const d=document.createElement('details');
    d.id='countingGuide';d.className='site-counting-guide';
    d.innerHTML=`<summary><span>ⓘ How FAM records are counted</span><small>Open this anytime something looks unfamiliar</small></summary><div class="counting-grid"><div><b>Regular Season</b><span>Scheduled regular-season games only.</span></div><div><b>Title Playoffs</b><span>Only postseason games while a team is still alive for the championship.</span></div><div><b>All Competitive</b><span>Regular Season + Title Playoffs. No consolation or placement games.</span></div><div><b>All Postseason</b><span>Every postseason meeting, including title, placement and consolation games.</span></div><div><b>ESPN Power Rank</b><span>An ESPN projection saved in our weekly snapshot — not a custom ranking created by this site.</span></div></div>`;
    quick.insertAdjacentElement('afterend',d);
  }

  addGuide('#standings','.table-card','How to read the All-Time board','Career totals for the current 12 managers only.',[
    ['Record','W-L-T. Default view uses regular-season games; the toggle adds true championship-path playoff games.'],
    ['Win %','Wins divided by completed games, with a tie counting as half a win.'],
    ['Rings / Finals','FAM championships won / championship games reached.'],
    ['Playoff Apps','Seasons in which the manager reached the championship bracket.'],
    ['#1 Seeds','Seasons finishing the regular season as ESPN playoff seed #1.'],
    ['Points For','Career regular-season fantasy points scored.'],
    ['Avg Final Finish','Average final league finish across seasons where ESPN preserved a final finish.'],
    ['Since','First season credited to that manager as the primary owner.']
  ]);

  addGuide('#records','.records-grid','How the Record Book works','These are archive facts, not forecasts or power rankings.',[
    ['Single-game records','Calculated from completed archived matchups only.'],
    ['Season / Week','Shown when the underlying ESPN history identifies the exact game.'],
    ['Manager attribution','Historical records follow the canonical owner mapping, not reused ESPN team IDs.']
  ]);

  addGuide('#history','.season-hero','How to read Season History','A year-by-year ESPN snapshot with clearer field names.',[
    ['Final Finish','Final league placement ESPN preserved for that season.'],
    ['Points For / Against','Regular-season fantasy points scored / allowed.'],
    ['Playoff Seed','ESPN seed for that season.'],
    ['Draft-Day ESPN PR','ESPN projected rank recorded on draft day — not final standings.']
  ]);

  addGuide('#scores','.table-card','How to read the Score Archive','This table intentionally stores each completed matchup from both managers’ perspectives.',[
    ['Result','W, L or T for the manager shown on that row.'],
    ['Opponent Score','What that manager’s opponent scored in the same matchup.'],
    ['Game Type','Regular Season, Championship Playoff, Placement or Consolation.'],
    ['Why two rows per matchup?','It makes manager-level history, searches and H2H validation easier while preserving both perspectives.']
  ]);

  addGuide('#playoffs','.playoff-list','What counts as a Title Playoff game?','This section is intentionally stricter than ESPN’s broad postseason labels.',[
    ['Included','Games where the team was still alive to win the FAM championship.'],
    ['Excluded','Placement games after elimination and consolation-bracket games.'],
    ['Why','This keeps career playoff W-L from being inflated by games that could no longer lead to a title.']
  ]);

  addGuide('#draft','.draft-controls','How to read Draft History','Historical ESPN draft picks, filtered by season, manager or player.',[
    ['Overall Pick','Pick number across the entire draft.'],
    ['Round / Round Pick','Round number and the pick position inside that round.'],
    ['Keeper','Whether ESPN marked the selection as a keeper.'],
    ['Missing player name','Some older ESPN records preserved the pick but no longer expose a player name; the private archive still retains the source history.']
  ]);
}

const H2H_MODES={
  regular:['Regular Season','Regular-season meetings only. No postseason games are included.'],
  playoff:['Title Playoffs','Only games while both managers were still on the championship path.'],
  competitive:['All Competitive','Regular Season + Title Playoffs. Placement and consolation games are excluded.'],
  postseason:['All Postseason','Every postseason meeting: title-path, placement and consolation games.']
};

function findPair(D,a,b){
  return (D.h2h?.pairs||[]).find(x=>(x.manager_a===a&&x.manager_b===b)||(x.manager_a===b&&x.manager_b===a));
}

function orientPair(p,a){
  if(!p) return null;
  const flip=p.manager_a!==a;
  const one=prefix=>({a:Number(p[`${prefix}_${flip?'b':'a'}_wins`]||0),b:Number(p[`${prefix}_${flip?'a':'b'}_wins`]||0),t:Number(p[`${prefix}_ties`]||0)});
  return {regular:one('regular'),playoff:one('playoff'),combined:one('combined')};
}

function enhanceH2H(D){
  const section=$('#h2h'); if(!section) return;
  const toolbar=$('.matrix-toolbar',section);
  if(toolbar&&!$('#h2hReadKey')){
    const key=document.createElement('div');
    key.id='h2hReadKey';key.className='h2h-read-key';
    key.innerHTML=`<div><strong>How to read the matrix</strong><span>Every cell is <b>ROW manager’s W-L-T vs COLUMN manager</b>. Example: row Vijay × column Neil = Vijay’s record against Neil.</span></div><div class="color-key"><span><i class="key-green"></i> winning record</span><span><i class="key-red"></i> losing record</span><span><i class="key-gray"></i> tied/even</span></div><small>Tap any record cell to load that matchup above.</small>`;
    toolbar.parentNode.insertBefore(key,toolbar);
  }
  if(toolbar&&!$('#h2hModeNote')){
    const n=document.createElement('div');n.id='h2hModeNote';n.className='h2h-mode-note';toolbar.insertAdjacentElement('afterend',n);
  }

  const A=$('#h2hA'),B=$('#h2hB'),result=$('#h2hResult'),matrix=$('#h2hMatrix');
  const updateBreakdown=()=>{
    if(!A||!B||!result) return;
    const a=A.value,b=B.value,p=orientPair(findPair(D,a,b),a);
    $('.h2h-breakdown',result)?.remove();
    if(!p) return;
    const strip=document.createElement('div');strip.className='h2h-breakdown';
    strip.innerHTML=`<div class="breakdown-intro"><strong>Selected matchup breakdown</strong><span>The large cards above always show <b>All Competitive</b>, regardless of which matrix button is selected below.</span></div><div><small>Regular Season</small><strong>${a} ${rec(p.regular.a,p.regular.b,p.regular.t)} ${b}</strong></div><div><small>Title Playoffs</small><strong>${a} ${rec(p.playoff.a,p.playoff.b,p.playoff.t)} ${b}</strong></div><div><small>All Competitive</small><strong>${a} ${rec(p.combined.a,p.combined.b,p.combined.t)} ${b}</strong></div>`;
    result.appendChild(strip);
  };

  const activeMode=()=>$('#matrixMode button.active')?.dataset.mode||'regular';
  const annotateMatrix=mode=>{
    if(!matrix) return;
    const heads=$$('thead th',matrix);
    if(heads[0]){heads[0].textContent='ROW ↓ / COL →';heads[0].title='Read each cell as the row manager’s record against the column manager.';}
    const label=(H2H_MODES[mode]||H2H_MODES.regular)[0];
    $$('tbody tr',matrix).forEach(tr=>{
      const cells=$$('td',tr),row=cells[0]?.textContent.trim();
      cells.slice(1).forEach((td,i)=>{
        const col=heads[i+1]?.textContent.trim();
        if(!row||!col||td.textContent.trim()==='—') return;
        td.classList.add('h2h-clickable');td.dataset.row=row;td.dataset.col=col;
        td.title=`${row} vs ${col}: ${td.textContent.trim()} (${label}) — tap to load matchup`;
      });
    });
  };
  const updateMode=()=>{
    const mode=activeMode(),info=H2H_MODES[mode]||H2H_MODES.regular,n=$('#h2hModeNote');
    if(n) n.innerHTML=`<strong>Matrix view: ${info[0]}</strong><span>${info[1]}</span>`;
    annotateMatrix(mode);
  };

  A?.addEventListener('change',()=>setTimeout(updateBreakdown,0));
  B?.addEventListener('change',()=>setTimeout(updateBreakdown,0));
  $$('#matrixMode button').forEach(btn=>btn.addEventListener('click',()=>setTimeout(updateMode,0)));
  matrix?.addEventListener('click',e=>{
    const td=e.target.closest('td.h2h-clickable'); if(!td) return;
    if(A&&B){A.value=td.dataset.row;B.value=td.dataset.col;A.dispatchEvent(new Event('change',{bubbles:true}));B.dispatchEvent(new Event('change',{bubbles:true}));result?.scrollIntoView({behavior:'smooth',block:'center'});}
  });
  updateBreakdown();updateMode();
}

function makeTableLabelsClearer(){
  const configs=[
    ['#standingsTable',{'Playoff App.':'Playoff Apps','1 Seeds':'#1 Seeds','PF':'Points For','Avg Finish':'Avg Final Finish'}],
    ['#seasonTable',{'PF':'Points For','PA':'Points Against','Seed':'Playoff Seed','Draft PR':'Draft-Day ESPN PR'}],
    ['#scoresTable',{'Opp Score':'Opponent Score','Tier':'Game Type'}],
    ['#draftTable',{'Overall':'Overall Pick','Pick':'Round Pick'}]
  ];
  const apply=()=>configs.forEach(([sel,map])=>{const table=$(sel);if(!table)return;$$('thead th',table).forEach(th=>{const t=th.textContent.trim();if(map[t])th.textContent=map[t];});});
  apply();setTimeout(apply,250);setTimeout(apply,1000);
  configs.forEach(([sel])=>{const table=$(sel);if(table)new MutationObserver(()=>setTimeout(apply,0)).observe(table,{childList:true,subtree:true});});
}

function mobilePolish(){
  const menu=$('#mobileMenu');
  if(menu){
    menu.setAttribute('aria-expanded','false');
    menu.addEventListener('click',()=>setTimeout(()=>menu.setAttribute('aria-expanded',$('#nav')?.classList.contains('open')?'true':'false'),0));
  }
  if($('.back-top')) return;
  const top=document.createElement('button');
  top.className='back-top';top.type='button';top.setAttribute('aria-label','Back to top');top.textContent='↑';
  top.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));document.body.appendChild(top);
  const toggle=()=>top.classList.toggle('show',window.scrollY>650);window.addEventListener('scroll',toggle,{passive:true});toggle();
}

async function init(){
  const D=await loadData();
  if(!D) return;
  window.FAM_PUBLIC_DATA=D;
  refreshStatus(D);
  renderWeekHub(D);
  clarifyExistingUI(D);
  injectClarityGuides();
  enhanceH2H(D);
  makeTableLabelsClearer();
  mobilePolish();
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
