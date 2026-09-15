(()=>{
'use strict';

const $=(s,r=document)=>r.querySelector(s);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const n=(value,fallback=0)=>{const x=Number(value);return Number.isFinite(x)?x:fallback;};
const rec=(w,l,t=0)=>`${w??0}-${l??0}${Number(t||0)?`-${t}`:''}`;

const ordinal=value=>{
  const x=Number(value);
  if(!Number.isFinite(x)||x<=0) return null;
  const v=x%100;
  const suffix=(v>=11&&v<=13)?'th':({1:'st',2:'nd',3:'rd'}[x%10]||'th');
  return `${x}${suffix}`;
};

function injectStyles(){
  if($('#fuduStyles')) return;
  const style=document.createElement('style');
  style.id='fuduStyles';
  style.textContent=`
    #fudu{scroll-margin-top:82px}
    .fudu-layout{display:grid;grid-template-columns:.76fr 1.24fr;gap:14px}
    .fudu-board,.fudu-timeline{background:rgba(19,23,32,.9);border:1px solid var(--line);border-radius:20px;padding:18px;box-shadow:0 12px 36px rgba(0,0,0,.12)}
    .fudu-board-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
    .fudu-board-title span{font-size:10px;font-weight:900;letter-spacing:.1em;color:#d69aef;text-transform:uppercase}
    .fudu-board-title b{font-size:22px}
    .fudu-rule{margin:0 0 14px;padding:11px 12px;border:1px dashed rgba(214,154,239,.28);border-radius:12px;background:rgba(214,154,239,.045);color:var(--muted);font-size:10px;line-height:1.5}
    .fudu-row{display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:9px;align-items:center;padding:9px 2px;border-bottom:1px solid rgba(255,255,255,.055)}
    .fudu-row:last-child{border-bottom:0}
    .fudu-place{color:#737d89;font-size:11px;font-weight:900}
    .fudu-person{min-width:0}
    .fudu-person strong{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .fudu-person small{display:block;color:var(--muted);font-size:9px}
    .fudu-count{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:900;white-space:nowrap}
    .fudu-count .faces{font-size:13px;letter-spacing:-2px}
    .fudu-current{margin-top:14px;padding:13px;border-radius:14px;background:#11161e;border:1px solid #303845}
    .fudu-current small{display:block;color:#929cab;font-size:8px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}
    .fudu-current strong{display:block;margin-top:3px;font-size:15px}
    .fudu-current p{margin:3px 0 0;color:var(--muted);font-size:10px;line-height:1.45}
    .fudu-timeline{display:grid;gap:9px}
    .fudu-year{display:grid;grid-template-columns:58px minmax(0,1fr);gap:12px;align-items:start;padding:12px;border:1px solid var(--line);border-radius:14px;background:#10141b}
    .fudu-year.pending{border-style:dashed;opacity:.9}
    .fudu-season{font-size:14px;font-weight:950;color:#d7a8e9}
    .fudu-detail{min-width:0}
    .fudu-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
    .fudu-detail strong{display:block;font-size:14px}
    .fudu-detail .team{display:block;color:var(--muted);font-size:9px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .fudu-record{font-size:12px;font-weight:900;white-space:nowrap;font-variant-numeric:tabular-nums}
    .fudu-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .fudu-chip{display:inline-flex;align-items:center;gap:4px;padding:5px 7px;border-radius:999px;background:#171c25;border:1px solid #2d3541;color:#aeb7c3;font-size:8px;font-weight:800;white-space:nowrap}
    .fudu-chip.draft{border-color:rgba(245,197,66,.24);background:rgba(245,197,66,.06);color:#d9c783}
    .fudu-chip.last{border-color:rgba(214,154,239,.24);background:rgba(214,154,239,.055);color:#d7a8e9}
    .fudu-pending-copy{color:var(--muted);font-size:10px;line-height:1.45;margin-top:3px}
    @media(max-width:900px){.fudu-layout{grid-template-columns:1fr}}
    @media(max-width:520px){.fudu-board,.fudu-timeline{padding:14px}.fudu-year{grid-template-columns:48px minmax(0,1fr);padding:10px}.fudu-detail-head{gap:7px}.fudu-record{font-size:11px}.fudu-chip{font-size:7px}}
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

function draftSlot(D,season,manager){
  const rows=(D.draftHistory||[]).filter(r=>Number(r.season)===Number(season)&&r.manager===manager&&Number(r.round)===1);
  if(!rows.length) return null;
  rows.sort((a,b)=>n(a.overall_pick,999)-n(b.overall_pick,999));
  const first=rows[0];
  return n(first.round_pick||first.overall_pick,null);
}

function seasonFudu(D,season){
  const rows=(D.managerSeasons||[]).filter(x=>Number(x.season)===Number(season));
  if(!rows.length) return null;

  const seeded=rows.filter(x=>Number.isFinite(Number(x.playoff_seed))&&Number(x.playoff_seed)>0);
  let loser;
  if(seeded.length){
    const worstSeed=Math.max(...seeded.map(x=>Number(x.playoff_seed)));
    const tied=seeded.filter(x=>Number(x.playoff_seed)===worstSeed);
    loser=[...tied].sort((a,b)=>winPct(a)-winPct(b)||n(a.points_for_espn)-n(b.points_for_espn))[0];
  }else{
    loser=[...rows].sort((a,b)=>winPct(a)-winPct(b)||n(a.wins_espn)-n(b.wins_espn)||n(a.points_for_espn)-n(b.points_for_espn))[0];
  }
  if(!loser) return null;

  return {
    season:Number(season),
    manager:loser.manager,
    team:loser.team_name||'',
    wins:n(loser.wins_espn),
    losses:n(loser.losses_espn),
    ties:n(loser.ties_espn),
    seed:Number.isFinite(Number(loser.playoff_seed))?Number(loser.playoff_seed):null,
    leagueSize:rows.length,
    draftSlot:draftSlot(D,season,loser.manager)
  };
}

function latestCompletedRegularWeek(D,season){
  const weeks=(D.weeklyScores||[])
    .filter(x=>Number(x.season)===Number(season)&&x.tier==='REGULAR_SEASON'&&['W','L','T'].includes(x.result))
    .map(x=>Number(x.week)||0);
  return weeks.length?Math.max(...weeks):0;
}

function expectedCurrentRegularWeeks(D){
  const current=Number(D.meta?.currentSeason);
  const prior=[...new Set((D.weeklyScores||[]).map(x=>Number(x.season)).filter(y=>y<current))].sort((a,b)=>b-a);
  for(const season of prior){
    const max=latestCompletedRegularWeek(D,season);
    if(max) return max;
  }
  return 14;
}

function currentRegularSeasonComplete(D){
  const current=Number(D.meta?.currentSeason);
  const currentRows=(D.weeklyScores||[]).filter(x=>Number(x.season)===current);
  const hasPostseason=currentRows.some(x=>x.tier&&x.tier!=='REGULAR_SEASON'&&['W','L','T'].includes(x.result));
  if(hasPostseason) return true;
  const completed=latestCompletedRegularWeek(D,current);
  const expected=expectedCurrentRegularWeeks(D);
  return expected>0&&completed>=expected;
}

function faces(count){
  const shown=Math.min(Number(count)||0,4);
  return '🤡'.repeat(shown)+(Number(count)>4?'…':'');
}

function render(D){
  if($('#fudu')) return true;
  const champions=$('#champions');
  if(!champions) return false;

  injectStyles();

  const current=Number(D.meta?.currentSeason);
  const historicalYears=[...new Set((D.managerSeasons||[]).map(x=>Number(x.season)).filter(y=>Number.isFinite(y)&&y<current))].sort((a,b)=>a-b);
  const awards=historicalYears.map(y=>seasonFudu(D,y)).filter(Boolean);
  const currentComplete=currentRegularSeasonComplete(D);
  const currentAward=currentComplete?seasonFudu(D,current):null;
  const counted=currentAward?[...awards,currentAward]:awards;

  const totals=new Map();
  counted.forEach(x=>totals.set(x.manager,(totals.get(x.manager)||0)+1));
  const leaders=[...totals.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));

  const section=document.createElement('section');
  section.id='fudu';
  section.className='section-shell section-block';
  section.innerHTML=`
    <div class="section-heading">
      <div>
        <span class="kicker">THE OTHER TROPHY CASE</span>
        <h2>Fudu of the Year 🤡</h2>
        <p>The annual honor nobody wants: last place when the <b>regular season ends</b>. Playoffs, consolation and placement games never change the winner.</p>
      </div>
    </div>
    <div class="fudu-layout">
      <article class="fudu-board">
        <div class="fudu-board-title"><span>All-Time Wall of Shame</span><b>🤡</b></div>
        <p class="fudu-rule"><b>Rule:</b> ESPN's final regular-season standing / playoff seed decides it. The highest seed number is last place. Postseason results are ignored completely.</p>
        <div id="fuduLeaderboard">${leaders.map(([manager,count],i)=>`<div class="fudu-row"><span class="fudu-place">${i+1}</span><div class="fudu-person"><strong>${esc(manager)}</strong><small>${count===1?'1 Fudu season':`${count} Fudu seasons`}</small></div><span class="fudu-count"><span class="faces">${faces(count)}</span>${count}</span></div>`).join('')}</div>
        <div class="fudu-current"><small>${current} STATUS</small>${currentAward?`<strong>${esc(currentAward.manager)} has officially claimed it 🤡</strong><p>${rec(currentAward.wins,currentAward.losses,currentAward.ties)} regular season • ${ordinal(currentAward.seed)||'last'} of ${currentAward.leagueSize}</p>`:`<strong>TBD — regular season in progress</strong><p>No 2026 Fudu is awarded until the regular season is officially finished.</p>`}</div>
      </article>
      <div class="fudu-timeline" id="fuduTimeline">
        ${!currentAward?`<div class="fudu-year pending"><div class="fudu-season">${current}</div><div class="fudu-detail"><div class="fudu-detail-head"><div><strong>To be determined 🤡</strong><span class="team">Regular season still in progress</span></div></div><div class="fudu-pending-copy">This locks only after the final regular-season week. Playoff and consolation results will not affect it.</div></div></div>`:''}
        ${[...awards].sort((a,b)=>b.season-a.season).map(x=>{
          const draft=x.draftSlot?`${ordinal(x.draftSlot)} pick • Round 1`:'Draft slot unavailable';
          return `<div class="fudu-year"><div class="fudu-season">${x.season}</div><div class="fudu-detail"><div class="fudu-detail-head"><div><strong>🤡 ${esc(x.manager)}</strong><span class="team">${esc(x.team)}</span></div><span class="fudu-record">${rec(x.wins,x.losses,x.ties)}</span></div><div class="fudu-meta"><span class="fudu-chip last">Last place • ${x.seed?`${ordinal(x.seed)} of ${x.leagueSize}`:`${x.leagueSize} teams`}</span><span class="fudu-chip draft">🎯 Drafted ${draft}</span></div></div></div>`;
        }).join('')}
      </div>
    </div>`;

  champions.insertAdjacentElement('afterend',section);
  return true;
}

function boot(){
  let tries=0;
  const timer=setInterval(()=>{
    const D=window.FAM_PUBLIC_DATA;
    if(D&&render(D)){clearInterval(timer);return;}
    if(++tries>120) clearInterval(timer);
  },50);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
