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
  const live=$('.live-pill span'); if(live){live.textContent='Fresh ESPN snapshot';live.title=`Last refreshed ${text}`;}
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
    standingsNote.textContent='Current ESPN regular-season record; ties are broken here by points for for display only.';
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
  if(managerP) managerP.textContent='Tap any manager for championships, season history, old team names and H2H receipts. REG = career regular season; PLAYOFF = true championship-path games; ESPN PR = latest ESPN Power Rank.';
  const currentTitle=$('#currentSeasonTitle'); if(currentTitle) currentTitle.textContent=`${D.meta.currentSeason} ESPN Power Board`;

  const annotate=()=>{
    $$('.manager-card .mini-stats').forEach(box=>{
      const labels=$$('small',box);
      if(labels[0]){labels[0].textContent='CAREER REG';labels[0].title='Career regular-season record';}
      if(labels[1]){labels[1].textContent='TITLE PLAYOFF';labels[1].title='Only games on the championship path';}
      if(labels[2]){labels[2].textContent='ESPN PR';labels[2].title="ESPN's latest Power Rank snapshot";}
    });
    $$('.power-card small').forEach(x=>x.title="ESPN's currentProjectedRank captured in the latest snapshot");
  };
  annotate();
  const managerGrid=$('#managerGrid'); if(managerGrid) new MutationObserver(annotate).observe(managerGrid,{childList:true,subtree:true});
}

function mobilePolish(){
  const menu=$('#mobileMenu');
  if(menu){
    menu.setAttribute('aria-expanded','false');
    menu.addEventListener('click',()=>setTimeout(()=>menu.setAttribute('aria-expanded',$('#nav')?.classList.contains('open')?'true':'false'),0));
  }
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
  mobilePolish();
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
