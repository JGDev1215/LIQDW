'use strict';
// Presentation only. The detector events and OHLC are frozen research inputs.
(() => {
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors={bull:'#4dd4b0',bear:'#ee8691',range:'#e9bb6d',ref:'#89aeec',muted:'#8d9faf'};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const main=['NQ_YAHOO','NDX','SP500','NQ_LOCAL_FIXED','STORA','MPS','ORELL','MATSUI','SUMITOMO','BNY','ED'];
const labels={NQ_YAHOO:'NQ · futures · 2000+',NDX:'Nasdaq-100 · index · 1985+',SP500:'S&P 500 · HLC · 1962+',NQ_LOCAL_FIXED:'NQ · local fixed sample',STORA:'Stora Enso · origin 1288',MPS:'Monte dei Paschi · origin 1472',ORELL:'Orell Füssli · origin 1519',MATSUI:'Matsui Construction · origin 1586',SUMITOMO:'Sumitomo Metal Mining · origin 1590',BNY:'BNY · listing-history check',ED:'Consolidated Edison · listing check'};
const state={asset:'NQ_YAHOO',tf:'weekly',cursor:0,span:104,fvgOn:true,sweepOn:true,rangeOn:true,filledOn:false,kind:'displacement',k:1,selected:null,reference:null,measure:false,hover:null,playing:false};
// Curated for visual clarity from the frozen detector output. These are not selected for profitability.
const EXAMPLES=[
 {asset:'NQ_YAHOO',i:984,type:'sweep',rule:1,dir:1,k:4,reveal:4,span:30,title:'Sell-side liquidity sweep',summary:'The weekly low breaches a prior 4-week low, then the close returns above it.',look:['Find the amber prior-low line','Compare the wick with the close','The opposite boundary stays intact'],observed:'Four weeks later the close is 7,857.75, above both the 7,650.25 swept level and the 7,660.25 confirmation close.'},
 {asset:'NQ_YAHOO',i:538,type:'sweep',rule:1,dir:-1,k:4,reveal:4,span:30,title:'Buy-side sweep · counterexample',summary:'The weekly high breaches a prior 4-week high, then the close returns below it.',look:['Find the high above 2,323.00','Check the close below 2,323.00','Do not assume the next direction'],observed:'Four weeks later the close is 2,395.00—above the swept high. The rejection definition was valid; a sustained bearish move did not follow.'},
 {asset:'NQ_YAHOO',i:658,type:'zone',dir:1,kind:'sequence',reveal:7,span:34,title:'Bullish sweep → displacement FVG',summary:'A same-direction 1W sweep is followed within three weeks by a bullish displacement gap.',look:['Read the three-candle non-overlap','Mark CE at 2,895.50','Start revisit tracking next week'],observed:'The near edge is reached in week 4, CE in week 6, and the far edge in week 7. “Reached” describes the weekly range; it is not a fill claim.'},
 {asset:'NQ_YAHOO',i:798,type:'zone',dir:-1,kind:'sequence',reveal:14,span:40,title:'Bearish sweep → displacement FVG',summary:'The bearish zone sits above price; later price can travel toward it from below.',look:['Zone: 4,365.00–4,571.50','CE: 4,468.25','Watch thresholds in order'],observed:'The near edge is reached in week 9, CE in week 11, and the far edge in week 14. A zone can be approached from either side of the screen.'},
 {asset:'NQ_YAHOO',i:889,type:'zone',dir:1,kind:'displacement',reveal:12,span:34,title:'Partial FVG mitigation',summary:'Threshold states separate first touch, midpoint reach, and complete traversal.',look:['Zone: 5,985.50–6,039.00','CE: 6,012.25','Near edge is not the far edge'],observed:'Week 2 trades to 6,011.00, reaching CE, but the far edge at 5,985.50 remains unreached through week 12.'},
 {asset:'SP500',i:1263,type:'zone',dir:1,kind:'sequence',reveal:3,span:34,title:'Same sequence on S&P 500',summary:'The detector uses the same weekly geometry across instruments and price scales.',look:['Zone: 227.33–233.29','CE: 230.31','Compare the next three ranges'],observed:'The near edge is reached in week 1, CE in week 2, and the far edge in week 3. This is a separate cash-index series, not NQ futures.'}
];
let lesson=null;
let chart, scene={}, hits=[], timer=null, toastTimer=null, pointer=null;
const cache=new Map();
const series=()=>DATA[state.tf==='daily'?'daily':'series'][state.asset], bars=()=>series().bars;
const unit=()=>state.tf==='daily'?'session':'week', unitShort=()=>state.tf==='daily'?'D':'W';
const assetClass=()=>state.asset.startsWith('NQ_')?'futures':series().meta.symbol.startsWith('^')?'index':'equity';
const axisPrice=v=>Number.isFinite(v)&&Math.abs(v)>=1e6?`${number(v/1e6,3)}M`:price(v);
const dateAt=i=>bars()[i]?.[0]??'—';
const number=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
function price(v){if(!Number.isFinite(v))return '—';const d=state.asset.startsWith('NQ')?(Math.abs(v*4-Math.round(v*4))>1e-7?3:2):(Math.abs(v)<1?4:2);return number(v,d);}
const pct=v=>Number.isFinite(v)?`${v>0?'+':''}${number(v*100)}%`:'—';
const signed=v=>Number.isFinite(v)?`${v>0?'+':''}${price(v)}`:'—';
const color=z=>z.dir>0?colors.bull:colors.bear;

// A missing week ends observable lifecycle tracking. Never infer freshness across a gap.
function lifecycle(bs,z){
 const out={edgeAt:null,ceAt:null,farAt:null,gapAt:null};
 for(let i=z.i+1;i<bs.length;i++){
  const b=bs[i];if(!b[5]){out.gapAt=i;break;}
  const reached=p=>z.dir>0?b[3]<=p:b[2]>=p;
  if(out.edgeAt===null&&reached(z.dir>0?z.hi:z.lo))out.edgeAt=i;
  if(out.ceAt===null&&reached(z.ce))out.ceAt=i;
  if(reached(z.dir>0?z.lo:z.hi)){out.farAt=i;break;}
 }
 return out;
}
function zoneState(z,c){
 if(z.i>c)return 'unformed';
 if(z.farAt!==null&&z.farAt<=c)return 'far';
 if(z.gapAt!==null&&z.gapAt<=c)return 'unknown';
 if(z.ceAt!==null&&z.ceAt<=c)return 'ce';
 if(z.edgeAt!==null&&z.edgeAt<=c)return 'edge';
 return 'fresh';
}
const stateNames={fresh:'UNREACHED',edge:'NEAR EDGE REACHED',ce:'50% CE REACHED',far:'FAR EDGE REACHED',unknown:'STATE UNKNOWN · DATA GAP',unformed:'UNFORMED'};
function detectEvents(bs){
 const events=[],n=bs.length,ssl=Array(n).fill(false),bsl=Array(n).fill(false),finite=x=>Number.isFinite(x);
 for(const [ri,k] of [1,4,13,52].entries()){
  for(let i=k;i<n;i++){
   const cur=bs[i],prior=bs.slice(i-k,i);if(!cur[5]||prior.some(b=>!b[5]))continue;
   const upper=Math.max(...prior.map(b=>b[2])),lower=Math.min(...prior.map(b=>b[3])),up=cur[2]>upper,dn=cur[3]<lower;
   if(dn&&!up&&cur[4]>lower){events.push([i,ri,1,lower,null,null,null]);if(k===1)ssl[i]=true;}
   if(up&&!dn&&cur[4]<upper){events.push([i,ri,-1,upper,null,null,null]);if(k===1)bsl[i]=true;}
  }
 }
 const tr=Array(n).fill(null);
 for(let i=1;i<n;i++)if(bs[i][5]&&bs[i-1][5])tr[i]=Math.max(bs[i][2]-bs[i][3],Math.abs(bs[i][2]-bs[i-1][4]),Math.abs(bs[i][3]-bs[i-1][4]));
 for(let i=2;i<n;i++){
  if(!bs[i][5]||!bs[i-1][5]||!bs[i-2][5])continue;
  for(const dir of [1,-1]){
   const gap=dir>0?bs[i][3]>bs[i-2][2]:bs[i][2]<bs[i-2][3];if(!gap)continue;
   const lo=dir>0?bs[i-2][2]:bs[i][2],hi=dir>0?bs[i][3]:bs[i-2][3],ce=(lo+hi)/2;
   events.push([i,4,dir,null,lo,hi,ce]);
   const atrWindow=tr.slice(i-15,i-1),body=bs[i-1][4]-bs[i-1][1],bridge=bs[i-1][3]<=lo&&bs[i-1][2]>=hi;
   const atr=atrWindow.length===14&&atrWindow.every(finite)?atrWindow.reduce((a,b)=>a+b,0)/14:null;
   const displacement=bridge&&bs[i-1][6]&&atr!==null&&dir*body>0&&dir*body>=.5*atr;
   if(displacement){events.push([i,5,dir,null,lo,hi,ce]);const mask=dir>0?ssl:bsl;if([1,2,3].some(back=>mask[i-back]))events.push([i,6,dir,null,lo,hi,ce]);}
  }
 }
 events.sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]);return events;
}
function getCache(){
 const cacheKey=`${state.tf}:${state.asset}`;if(cache.has(cacheKey))return cache.get(cacheKey);
 const d=series(), allEvents=d.events||detectEvents(d.bars),flags=new Map(), zs=[];
 allEvents.filter(e=>e[1]>=5).forEach(e=>{const key=`${e[0]}:${e[2]}`;const f=flags.get(key)||{};f[e[1]]=true;flags.set(key,f);});
 allEvents.filter(e=>e[1]===4).forEach(e=>{const f=flags.get(`${e[0]}:${e[2]}`)||{};
  const z={id:`z${e[0]}_${e[2]}`,i:e[0],dir:e[2],lo:e[4],hi:e[5],ce:e[6],disp:!!f[5],combo:!!f[6]};
  Object.assign(z,lifecycle(d.bars,z));zs.push(z);
 });
 const result={zones:zs,byId:new Map(zs.map(z=>[z.id,z])),sweeps:allEvents.filter(e=>e[1]<4),events:allEvents};
 cache.set(cacheKey,result);return result;
}
const qualify=z=>state.kind==='all'||(state.kind==='sequence'?z.combo:z.disp);
function rangeLevels(){
 if(!state.rangeOn||state.cursor-state.k+1<0)return [];
 const b=bars(),start=state.cursor-state.k+1,win=b.slice(start,state.cursor+1);
 if(win.some(x=>!x[5]))return [];
 let hi=-Infinity,lo=Infinity,hiI=start,loI=start;
 win.forEach((x,j)=>{if(x[2]>=hi){hi=x[2];hiI=start+j;}if(x[3]<=lo){lo=x[3];loI=start+j;}});
 return [{id:'rhigh',type:'range',price:hi,i:hiI,formed:state.cursor,label:`${state.k}${unitShort()} HIGH`,side:1},
 {id:'rlow',type:'range',price:lo,i:loI,formed:state.cursor,label:`${state.k}${unitShort()} LOW`,side:-1}];
}
function makeScene(){
 const b=bars(),c=state.cursor,valid=b[c][5],p=valid?b[c][4]:null,start=Math.max(0,c-state.span+1),cs=getCache();
 const eligible=state.fvgOn?cs.zones.filter(z=>z.i<=c&&qualify(z)):[];
 const active=eligible.filter(z=>!['far','unknown'].includes(zoneState(z,c)));
 const distance=z=>p===null?c-z.i:(p<z.lo?z.lo-p:p>z.hi?p-z.hi:0);
 active.sort((a,b)=>distance(a)-distance(b)||b.i-a.i);
 let shown=active.slice(0,4);
 const sz=state.selected?.type==='zone'?cs.byId.get(state.selected.id):null;
 if(sz&&sz.i<=c&&state.fvgOn&&!shown.some(z=>z.id===sz.id))shown.push(sz);
 const history=state.fvgOn&&state.filledOn?eligible.filter(z=>z.farAt!==null&&z.farAt<=c&&z.farAt>=start&&!shown.some(a=>a.id===z.id)).sort((a,b)=>b.farAt-a.farAt).slice(0,8):[];
 const rule=[1,4,13,52].indexOf(state.k);
 const sweeps=state.sweepOn?cs.sweeps.filter(e=>e[1]===rule&&e[0]>=start&&e[0]<=c):[];
 const ranges=rangeLevels();
 const levels=[...ranges,...shown.filter(z=>!['far','unknown'].includes(zoneState(z,c))).map(z=>({id:z.id,type:'zone',price:z.ce,i:z.i,formed:z.i,lo:z.lo,hi:z.hi,dir:z.dir,label:`${z.dir>0?'Bullish':'Bearish'} FVG · CE`,z}))];
 const visible=b.slice(start,c+1).filter(x=>x[5]);
 let min=visible.length?Math.min(...visible.map(x=>x[3])):0,max=visible.length?Math.max(...visible.map(x=>x[2])):1;
 let spread=Math.max(max-min,Math.abs(max)*.01,1e-8);
 // Ordinary overlays do not squeeze the candles. A selected level is fitted explicitly.
 if(state.selected&&Number.isFinite(state.selected.price)){min=Math.min(min,state.selected.price);max=Math.max(max,state.selected.price);}
 if(state.reference&&Number.isFinite(state.reference.price)){min=Math.min(min,state.reference.price);max=Math.max(max,state.reference.price);}
 spread=Math.max(max-min,spread);
 return {start,end:c,p,valid,shown,history,sweeps,ranges,levels,activeCount:active.length,min:min-spread*.08,max:max+spread*.09,right:c+Math.max(8,Math.round(state.span*.12)),gapCount:b.slice(start,c+1).filter(x=>!x[5]).length};
}
function safeSelection(){
 if(state.selected&&state.selected.formed>state.cursor){state.selected=null;state.reference=null;}
 if(state.reference&&state.reference.i>state.cursor)state.reference=null;
 if(state.hover&&state.hover.i>state.cursor)state.hover=null;
}
function toast(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3200);}
function stop(){clearInterval(timer);timer=null;state.playing=false;$('playBtn').textContent='▶';$('playBtn').setAttribute('aria-label','Play chart replay');}
function setCursor(i){state.cursor=clamp(Math.round(i),0,bars().length-1);safeSelection();state.hover=null;$('tooltip').hidden=true;render();}
function select(item){
 state.selected={...item};
 if(!state.reference?.user)state.reference=scene.valid?{price:scene.p,i:state.cursor,user:false}:null;
 state.measure=false;button('measureBtn',false);render();
}
function selectZone(id){const z=getCache().byId.get(id);if(!z||z.i>state.cursor)return;select({id:z.id,type:'zone',formed:z.i,i:z.i,price:z.ce,label:`${z.dir>0?'Bullish':'Bearish'} FVG`,dir:z.dir});}
function selectSweep(e,jump=true){
 if(jump)setCursor(e[0]);
 const k=[1,4,13,52][e[1]];
 select({id:`s${e[0]}_${e[1]}_${e[2]}`,type:'sweep',formed:e[0],i:e[0],price:e[3],label:`${e[2]>0?'SSL':'BSL'} sweep · ${k}${unitShort()}`,dir:e[2],k,e});
}
function button(id,on){$(id).classList.toggle('active',on);$(id).setAttribute('aria-pressed',String(on));}
function headerOHLC(i){
 const b=bars()[i];if(!b)return;
 $('ohlc').innerHTML=`<span>${b[0]}</span>`+(b[5]?`${b[6]?`<span>O<b>${price(b[1])}</b></span>`:'<span>HLC only</span>'}<span>H<b>${price(b[2])}</b></span><span>L<b>${price(b[3])}</b></span><span>C<b>${price(b[4])}</b></span>`:`<span>Unavailable ${unit()}</span>`);
}
function levelHTML(l){
 const inside=l.type==='zone'&&scene.p>=l.lo&&scene.p<=l.hi;
 return `<button class="level-row ${l.type==='range'?'range':l.dir>0?'bull':'bear'} ${state.selected?.id===l.id&&state.selected.price===l.price?'selected':''}" data-level="${l.id}"><span><span class="label">${l.label}</span><small>${inside?'PRICE INSIDE ZONE':l.type==='zone'?stateNames[zoneState(l.z,state.cursor)]:`Completed ${state.k}-${unit()} range`}</small></span><span class="distance"><strong>${price(l.price)}</strong><small>${pct((l.price-scene.p)/scene.p)}</small></span></button>`;
}
function movement(target,formed){
 const b=bars(),c=state.cursor;if(c<1||formed>=c||!b[c][5]||!b[c-1][5])return 'Movement available after the next close';
 const a=b[c-1][4]-target,d=b[c][4]-target;
 if(d===0)return 'Closed at this level';
 if(a*d<0)return `Crossed between ${unit()} closes`;
 if(a===0)return 'Moved away from this level';
 const diff=Math.abs(d)-Math.abs(a);
 return Math.abs(diff)<1e-9?'Distance unchanged':diff<0?'Moved toward this level':'Moved away from this level';
}
function selectionHTML(){
 const s=state.selected;
 if(!s)return `<div class="select-placeholder"><span>↖</span><strong>Click a zone or a sweep</strong><p>See its state and measure the distance.${state.reference?`<br>Your reference: ${price(state.reference.price)}`:''}</p></div>`;
 let details='';
 if(s.type==='zone'){
  const z=getCache().byId.get(s.id),zs=zoneState(z,state.cursor);
  details=`<div class="zone-price">${price(z.lo)} — ${price(z.hi)}</div><span class="state-tag ${['far','unknown'].includes(zs)?'muted':''}">${stateNames[zs]}</span><div class="kv"><span>50% CE</span><strong>${price(z.ce)}</strong></div><div class="kv"><span>Confirmed</span><strong>${dateAt(z.i)}</strong></div>`;
  const reached=[['Near edge',z.edgeAt],['50% CE',z.ceAt],['Far edge',z.farAt]].filter(x=>x[1]!==null&&x[1]<=state.cursor);
  if(reached.length)details+=`<p class="hint">Reached/passed: ${reached.map(([name,i])=>`${name} ${dateAt(i)}`).join(' · ')}. Execution is not inferred.</p>`;
  if(z.combo)details+=`<p class="hint">Same-direction 1${unitShort()} sweep occurred 1–3 ${state.tf==='daily'?'sessions':'weeks'} before this displacement FVG.</p>`;
  if(zs==='unknown')details+='<p class="hint">Tracking stops at the first unavailable week.</p>';
 }else if(s.type==='sweep'){
  details=`<div class="zone-price">${price(s.price)}</div><span class="state-tag">${s.dir>0?'LOW SWEPT · CLOSED BACK ABOVE':'HIGH SWEPT · CLOSED BACK BELOW'}</span><div class="kv"><span>Confirmed</span><strong>${dateAt(s.i)}</strong></div><p class="hint">Prior ${s.k}-${unit()} ${s.dir>0?'low':'high'}. The opposite range boundary was not breached.</p>`;
 }else details=`<div class="zone-price">${price(s.price)}</div><span class="state-tag">FIXED SELECTED LEVEL</span><div class="kv"><span>Selected at close</span><strong>${dateAt(s.formed)}</strong></div><p class="hint">The selected level stays fixed during replay. The range overlay updates with each completed week.</p>`;
 const r=state.reference;
 details+=`<div class="measurement"><div class="kv"><span>${r?.user?'Your reference':'Reference close'}</span><strong>${r?price(r.price):'Set on chart'}</strong></div>${r?`<div class="move">${signed(s.price-r.price)} <small style="font:10px var(--mono)">${['futures','index'].includes(assetClass())?'pts':esc(series().meta.currency)} (${pct((s.price-r.price)/r.price)})</small></div><p class="hint">Distance to ${s.type==='zone'?'50% CE':'selected level'} · ${dateAt(r.i)}</p>`:''}<div class="movement"><span>↔</span><em>${movement(s.price,s.formed)}</em></div></div>`;
 return `<div class="selected-head"><strong>${esc(s.label)}</strong><button id="clearSelection" aria-label="Clear selection">✕</button></div><div class="selected-body">${details}</div>`;
}
function recent(){
 const rule=[1,4,13,52].indexOf(state.k),items=[];
 if(state.sweepOn)getCache().sweeps.filter(e=>e[1]===rule&&e[0]<=state.cursor).forEach(e=>items.push({i:e[0],label:`${e[2]>0?'△ SSL':'▽ BSL'} sweep`,e}));
 if(state.fvgOn)getCache().zones.filter(z=>z.i<=state.cursor&&qualify(z)).forEach(z=>items.push({i:z.i,label:`${z.dir>0?'▰ Bullish':'▰ Bearish'} ${z.combo?'sweep → FVG':'FVG'}`,z}));
 return items.sort((a,b)=>b.i-a.i).slice(0,4);
}
function sidebar(){
 const b=bars()[state.cursor],prev=bars()[state.cursor-1];
 $('asofPrice').textContent=axisPrice(scene.p);$('asofPrice').title=price(scene.p);$('asofDate').textContent=b[0];
 $('asofBadge').textContent=state.cursor===bars().length-1?'SNAPSHOT':'REPLAY';
 const change=b[5]&&prev?.[5]?(b[4]/prev[4]-1):null;
 $('weekChange').textContent=change===null?'No comparable previous close':`${pct(change)} · vs previous ${unit()}`;
 $('weekChange').className=change===null?'':change>=0?'up':'down';
 $('rangeLabel').textContent=`${state.k}${unitShort()} range`;
 const inside=scene.levels.filter(l=>l.type==='zone'&&scene.valid&&scene.p>=l.lo&&scene.p<=l.hi);
 const outside=scene.levels.filter(l=>!inside.includes(l));
 const above=outside.filter(l=>scene.valid&&l.price>=scene.p).sort((a,b)=>a.price-b.price).slice(0,2);
 const below=outside.filter(l=>scene.valid&&l.price<scene.p).sort((a,b)=>b.price-a.price).slice(0,2);
 $('aboveLevels').innerHTML=above.map(levelHTML).join('')||'<div class="level-empty">No nearby level in this view</div>';
 $('belowLevels').innerHTML=below.map(levelHTML).join('')||'<div class="level-empty">No nearby level in this view</div>';
 $('insideLevels').innerHTML=inside.length?`<span class="group-label">PRICE INSIDE ZONE</span>${inside.map(levelHTML).join('')}`:'';
 document.querySelectorAll('[data-level]').forEach(el=>el.onclick=()=>{const l=scene.levels.find(x=>x.id===el.dataset.level);if(l.type==='zone')selectZone(l.id);else select(l);});
 $('selection').innerHTML=selectionHTML();(state.selected?document.querySelector('aside > .levels-title'):document.querySelector('aside > .recent')).before($('selection'));if($('clearSelection'))$('clearSelection').onclick=()=>{state.selected=null;state.reference=null;render();};
 const re=recent();$('recentEvents').innerHTML=re.map((r,i)=>`<button class="event-row" data-recent="${i}"><span>${r.label}</span><time>${dateAt(r.i)}</time></button>`).join('')||'<div class="level-empty">No confirmed event yet</div>';
 document.querySelectorAll('[data-recent]').forEach(el=>el.onclick=()=>{const r=re[+el.dataset.recent];setCursor(r.i);if(r.z)selectZone(r.z.id);else selectSweep(r.e,false);});
}

// A single canvas draws candles and overlays. All x coordinates are completed-bar indices.
const overlay={id:'liquidityOverlay',afterDraw(c){
 if(!scene.shown)return;
 const ctx=c.ctx,{left,right,top,bottom}=c.chartArea,x=c.scales.x,y=c.scales.y;
 const queuedLabels=[];
 const queueLabel=(text,py,col,priority=2)=>queuedLabels.push({text,py,col,priority});
 const X=i=>x.getPixelForValue(i),Y=p=>y.getPixelForValue(p),w=clamp(Math.abs(X(1)-X(0))*.62,1,15);
 hits=[];ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
 const line=(xa,ya,xb,yb,col,width=1,dash=[])=>{ctx.strokeStyle=col;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(xa,ya);ctx.lineTo(xb,yb);ctx.stroke();ctx.setLineDash([]);};
 const label=(text,px,py,col,align='left',bg='#11202d')=>{ctx.font='10px ui-monospace, monospace';const tw=ctx.measureText(text).width;const leftX=clamp(align==='right'?px-tw-9:px,left+1,Math.max(left+1,right-tw-9));ctx.fillStyle=bg;ctx.fillRect(leftX,py-8,tw+9,16);ctx.fillStyle=col;ctx.textAlign='left';ctx.fillText(text,leftX+4,py+3);};
 const drawZone=(z,historical=false)=>{
  const zs=zoneState(z,state.cursor),stop=zs==='far'?z.farAt:zs==='unknown'?z.gapAt:scene.right;
  if(stop<scene.start)return;
  const xa=X(Math.max(scene.start-.5,z.i)),xb=X(Math.min(stop,scene.right)),yt=Y(z.hi),yb=Y(z.lo),sel=state.selected?.id===z.id,col=color(z);
  ctx.globalAlpha=historical?.035:sel?.17:.075;ctx.fillStyle=col;ctx.fillRect(xa,yt,Math.max(2,xb-xa),Math.max(1,yb-yt));ctx.globalAlpha=1;
  const opacity=historical?'25':sel?'bd':'60';
  line(xa,yt,xb,yt,col+opacity,sel?1.25:.8);line(xa,yb,xb,yb,col+opacity,sel?1.25:.8);
  line(xa,Y(z.ce),xb,Y(z.ce),col+(historical?'30':'80'),sel?1.2:.8,[4,5]);
  if(!historical&&yb>=top&&yt<=bottom){hits.push({type:'zone',id:z.id,x1:Math.max(left,xa),x2:Math.min(right,xb),y1:Math.max(top,yt-3),y2:Math.min(bottom,yb+3),ce:Y(z.ce)});}
  if(sel)queueLabel(`FVG CE ${axisPrice(z.ce)}`,clamp(Y(z.ce),top+12,bottom-12),col,0);
  else if(c.width>600&&!historical&&scene.shown.indexOf(z)<2&&Y(z.ce)>=top+10&&Y(z.ce)<=bottom-10)queueLabel(`${z.dir>0?'BULL':'BEAR'} CE ${axisPrice(z.ce)}`,Y(z.ce),col);
 };
 scene.history.forEach(z=>drawZone(z,true));scene.shown.forEach(z=>drawZone(z));
 // Invalid weeks remain explicit blank bands; no fabricated candle or connecting line.
 for(let i=scene.start;i<=scene.end;i++){
  const b=bars()[i],xx=X(i);
  if(!b[5]){ctx.fillStyle='#879bb514';ctx.fillRect(xx-w,top,w*2,bottom-top);continue;}
  const up=b[6]?b[4]>=b[1]:!bars()[i-1]?.[5]||b[4]>=bars()[i-1][4],col=up?'#9bbfb5':'#b88791';
  line(xx,Y(b[2]),xx,Y(b[3]),col,1);
  if(b[6]){const ot=Y(b[1]),ct=Y(b[4]);ctx.fillStyle=col;ctx.fillRect(xx-w/2,Math.min(ot,ct),w,Math.max(1,Math.abs(ot-ct)));}
  else line(xx,Y(b[4]),xx+w/2+1,Y(b[4]),col,1.3);
 }
 for(const r of scene.ranges){
  const py=Y(r.price);line(X(Math.max(scene.start,r.i)),py,right,py,colors.range+'80',1,[7,4]);
  queueLabel(c.width<600?(r.side>0?'HIGH':'LOW'):r.label,clamp(py+(r.side>0?-9:10),top+10,bottom-10),colors.range,1);
  hits.push({type:'range',id:r.id,x1:Math.max(left,X(r.i)),x2:right,y1:py-5,y2:py+5});
 }
 const occupied=[];
 for(const l of queuedLabels.sort((a,b)=>a.priority-b.priority)){
  let py=l.py;const candidates=[0,18,-18,36,-36,54,-54,72,-72];
  for(const offset of candidates){const candidate=clamp(l.py+offset,top+10,bottom-10);if(!occupied.some(p=>Math.abs(p-candidate)<17)){py=candidate;break;}}
  occupied.push(py);if(Math.abs(py-l.py)>2)line(right-7,l.py,right-12,py,l.col+'70',.8);label(l.text,right-5,py,l.col,'right');
 }
 for(const e of scene.sweeps){
  const b=bars()[e[0]],xx=X(e[0]),py=Y(e[2]>0?b[3]:b[2])+(e[2]>0?9:-9),dir=e[2];
  ctx.beginPath();ctx.moveTo(xx,py-dir*3);ctx.lineTo(xx-3,py+dir*3);ctx.lineTo(xx+3,py+dir*3);ctx.closePath();ctx.strokeStyle=colors.range;ctx.lineWidth=1;ctx.stroke();
  hits.push({type:'sweep',e,x1:xx-7,x2:xx+7,y1:py-7,y2:py+7});
 }
 const s=state.selected;
 if(s?.type==='sweep'){
  const py=Y(s.price),xx=X(s.i);line(X(Math.max(scene.start,s.i-s.k)),py,Math.min(right,xx+25),py,colors.range,1.4,[3,3]);
  if(xx>=left&&xx<=right)label(s.label,clamp(xx+12,left,right-120),clamp(py+(s.dir>0?27:-27),top+12,bottom-12),colors.range);
 }
 if(scene.valid){line(X(scene.start-.4),Y(scene.p),right,Y(scene.p),'#71879955',.8,[2,5]);}
 if(state.reference){
  const r=state.reference,ry=Y(r.price);line(X(Math.max(scene.start,r.i)),ry,right-5,ry,colors.ref+'ad',1,[5,5]);
  ctx.fillStyle=colors.ref;ctx.beginPath();ctx.arc(X(Math.max(scene.start,r.i)),ry,3,0,Math.PI*2);ctx.fill();
  if(s){const tx=X(state.cursor+(scene.right-state.cursor)*.42),ty=Y(s.price);
   line(tx,ry,tx,ty,colors.ref,1.5);line(tx-4,ry,tx+4,ry,colors.ref,1.5);line(tx-4,ty,tx+4,ty,colors.ref,1.5);
   label(signed(s.price-r.price),tx+7,(ry+ty)/2,colors.ref);
  }
  label(r.user?'YOUR REFERENCE':'REFERENCE CLOSE',Math.max(left+4,X(Math.max(scene.start,r.i))-110),clamp(ry-11,top+10,bottom-10),colors.ref);
 }
 if(state.hover){
  const h=state.hover;line(h.x,top,h.x,bottom,'#a0b6c34a',.8,[3,4]);line(left,h.y,right,h.y,'#a0b6c34a',.8,[3,4]);
  label(price(y.getValueForPixel(h.y)),right-5,clamp(h.y,top+10,bottom-10),'#c8d8e2','right','#293b4b');
 }
 ctx.restore();
 // Last-close price pill is drawn over the right axis for rapid orientation.
 ctx.save();
 if(scene.valid){const py=clamp(Y(scene.p),top+9,bottom-9);ctx.font='10px ui-monospace, monospace';ctx.fillStyle='#324a58';ctx.fillRect(right+1,py-9,Math.min(c.width-right-2,89),18);ctx.fillStyle='#edf4f5';ctx.textAlign='left';ctx.fillText(axisPrice(scene.p),right+5,py+3);}
 ctx.restore();
}};

function render(){
 safeSelection();scene=makeScene();const d=series(),b=bars();
 const daily=state.tf==='daily';$('timeframe').value=state.tf;$('brandTf').textContent=daily?'1D':'1W';$('dateLabel').textContent=daily?'Session date':'Week ending';$('footerTf').textContent=daily?'Daily':'Weekly';
 [...$('lookback').options].forEach(o=>o.textContent=`${o.value} ${daily?(o.value==='1'?'session':'sessions'):(o.value==='1'?'week':'weeks')}`);
 $('chartSymbol').textContent=d.meta.symbol;$('chartBasis').textContent=assetClass()==='index'?'cash index':assetClass()==='futures'?'futures continuation':d.meta.currency+' · equity';headerOHLC(state.cursor);
 $('date').min=b[0][0];$('date').max=b.at(-1)[0];$('date').value=b[state.cursor][0];$('timeline').max=b.length-1;$('timeline').value=state.cursor;
 $('firstDate').textContent=b[0][0];$('lastDate').textContent=b.at(-1)[0];
 $('replayLabel').textContent=state.cursor===b.length-1?`Last completed ${unit()}`:`${b.length-1-state.cursor} ${daily?'sessions':'weeks'} before snapshot`;
 $('stepBack').disabled=state.cursor===0;$('stepForward').disabled=state.cursor===b.length-1;
 $('chartEmpty').hidden=scene.valid;$('chartEmpty').textContent=`Unavailable ${unit()} · move replay to a valid candle`;
 $('statusText').textContent=`${scene.shown.length} zones shown${scene.activeCount>4?` / ${scene.activeCount} active`:''} · ${Math.min(state.span,state.cursor+1)} ${daily?'sessions':'weeks'} in view${scene.gapCount?` · ${scene.gapCount} unavailable`:''}${b[state.cursor][5]&&!b[state.cursor][6]?' · HLC only; open unavailable':''}`;
 $('footerSource').textContent=`${state.asset.startsWith('NQ_LOCAL')?'Local frozen sample':daily?'Yahoo daily snapshot':'Yahoo weekly aggregate'} · ${b[0][0]} — ${b.at(-1)[0]}`;
 const high=[],low=[];for(let i=scene.start;i<=scene.end;i++)if(b[i][5]){high.push({x:i,y:b[i][2]});low.push({x:i,y:b[i][3]});}
 if(!chart){
  chart=new Chart($('priceChart'),{type:'scatter',data:{datasets:[{data:high,pointRadius:0},{data:low,pointRadius:0}]},plugins:[overlay],options:{responsive:true,maintainAspectRatio:false,animation:false,events:[],devicePixelRatio:Math.min(window.devicePixelRatio||1,2),layout:{padding:{left:14,right:8,top:13,bottom:1}},plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{type:'linear',min:scene.start-.7,max:scene.right,grid:{color:'#23313e77',drawTicks:false},border:{display:false},ticks:{color:'#758b9e',maxTicksLimit:8,font:{size:10},padding:10,callback(v){const i=Math.round(v);if(i<scene.start||i>state.cursor)return '';const dt=dateAt(i);return dt==='—'?'':new Date(dt+'T12:00:00Z').toLocaleDateString('en-GB',state.tf==='daily'?{day:'2-digit',month:'short',timeZone:'UTC'}:{month:'short',year:'2-digit',timeZone:'UTC'});}}},y:{position:'right',afterFit:scale=>{scale.width=82;},min:scene.min,max:scene.max,border:{display:false},grid:{color:'#23313e88',drawTicks:false},ticks:{color:'#8799a9',maxTicksLimit:9,includeBounds:false,font:{family:'ui-monospace',size:10},padding:10,callback:v=>Math.abs(v)>=1e6?`${number(v/1e6,1)}M`:number(v,Math.abs(v)<2?2:0)}}}}});
 }else{chart.data.datasets[0].data=high;chart.data.datasets[1].data=low;chart.options.scales.x.min=scene.start-.7;chart.options.scales.x.max=scene.right;chart.options.scales.y.min=scene.min;chart.options.scales.y.max=scene.max;chart.update('none');}
 sidebar();renderLesson();const ev=navigationEvents();$('prevEvent').disabled=!ev.some(e=>e.i<state.cursor);$('nextEvent').disabled=!ev.some(e=>e.i>state.cursor);
}
function navigationEvents(){
 const kind=$('eventKind').value,cs=getCache();
 if(kind==='sweep')return cs.sweeps.filter(e=>e[1]===[1,4,13,52].indexOf(state.k)).map(e=>({i:e[0],e}));
 return cs.zones.filter(z=>kind==='sequence'?z.combo:qualify(z)).map(z=>({i:z.i,z}));
}
function navigateEvent(dir){stop();const ev=navigationEvents().filter(e=>dir>0?e.i>state.cursor:e.i<state.cursor).sort((a,b)=>dir>0?a.i-b.i:b.i-a.i);if(!ev.length){toast('No further event in this snapshot');return;}const r=ev[0];setCursor(r.i);if(r.z)selectZone(r.z.id);else selectSweep(r.e,false);}
function syncAssetAvailability(){document.querySelectorAll('#asset option').forEach(o=>{o.disabled=state.tf==='daily'&&!DATA.daily[o.value];o.title=o.disabled?'Daily source is not available in the frozen study':'';});}
function switchAsset(id){
 if(state.tf==='daily'&&!DATA.daily[id]){toast('1D is unavailable for this frozen series');$('asset').value=state.asset;return false;}
 stop();state.asset=id;state.cursor=bars().length-1;state.selected=null;state.reference=null;state.hover=null;state.measure=false;button('measureBtn',false);$('toast').hidden=true;state.span=innerWidth<650?(state.tf==='daily'?78:52):(state.tf==='daily'?126:104);$('asset').value=id;render();return true;
}
function switchTimeframe(tf){
 if(tf==='daily'&&!DATA.daily[state.asset]){$('timeframe').value=state.tf;toast('Daily candles are unavailable for this local or sensitivity series');return false;}
 exitLesson();stop();state.tf=tf;state.cursor=bars().length-1;state.span=innerWidth<650?(tf==='daily'?78:52):(tf==='daily'?126:104);state.selected=null;state.reference=null;state.hover=null;state.measure=false;button('measureBtn',false);syncAssetAvailability();render();return true;
}
function zoom(f){state.span=clamp(Math.round(state.span*f),20,520);render();}
function openDrawer(title,html){stop();$('drawerTitle').textContent=title;$('drawerBody').innerHTML=html;$('drawer').showModal();}
function startLesson(index){
 stop();lesson={index:clamp(index,0,EXAMPLES.length-1)};const ex=EXAMPLES[lesson.index];
 $('toast').hidden=true;clearTimeout(toastTimer);
 state.tf='weekly';state.asset=ex.asset;state.cursor=ex.i;state.span=ex.span;state.fvgOn=true;state.sweepOn=true;state.rangeOn=true;state.filledOn=false;state.kind=ex.kind||'displacement';state.k=ex.k||1;state.reference={price:DATA.series[ex.asset].bars[ex.i][4],i:ex.i,user:false};state.measure=false;state.hover=null;
 $('timeframe').value='weekly';syncAssetAvailability();$('asset').value=ex.asset;$('fvgKind').value=state.kind;$('lookback').value=String(state.k);button('toggleFvg',true);button('toggleSweeps',true);button('toggleRange',true);button('toggleFilled',false);button('measureBtn',false);
 if(ex.type==='zone'){const z=getCache().byId.get(`z${ex.i}_${ex.dir}`);state.selected={id:z.id,type:'zone',formed:z.i,i:z.i,price:z.ce,label:`${z.dir>0?'Bullish':'Bearish'} FVG`,dir:z.dir};}
 else{const e=getCache().sweeps.find(e=>e[0]===ex.i&&e[1]===ex.rule&&e[2]===ex.dir);state.selected={id:`s${e[0]}_${e[1]}_${e[2]}`,type:'sweep',formed:e[0],i:e[0],price:e[3],label:`${e[2]>0?'SSL':'BSL'} sweep · ${ex.k}W`,dir:e[2],k:ex.k,e};}
 if($('drawer').open)$('drawer').close();render();$('sidebar').scrollTop=0;
}
function exitLesson(){lesson=null;$('lessonPanel').hidden=true;}
function renderLesson(){
 const p=$('lessonPanel');if(!lesson){p.hidden=true;return;}const ex=EXAMPLES[lesson.index],elapsed=state.asset===ex.asset?state.cursor-ex.i:0,revealed=elapsed>=ex.reveal;
 p.hidden=false;$('lessonStep').textContent=`EXAMPLE ${lesson.index+1} / ${EXAMPLES.length} · ${labels[ex.asset]?.split(' · ')[0]||ex.asset} · CONFIRMED ${dateAt(ex.i)}`;$('lessonTitle').textContent=ex.title;
 $('lessonPrompt').textContent=revealed?ex.observed:ex.summary;
 $('lessonChecks').classList.toggle('revealed',revealed);$('lessonChecks').innerHTML=revealed?`<span>Observed ${ex.reveal} weeks later</span><span>One historical path</span>`:ex.look.map(x=>`<span>${esc(x)}</span>`).join('');
 $('lessonReveal').textContent=revealed?'Reset example':`Reveal ${ex.reveal} weeks`;$('lessonPrev').disabled=lesson.index===0;$('lessonNext').disabled=lesson.index===EXAMPLES.length-1;
}
function examplesCatalog(){
 openDrawer('Pattern examples',`<span class="badge">GUIDED REPLAY · REAL FROZEN EVENTS</span><p class="example-intro">Start at the confirmation close, read the marked geometry, then reveal later weekly bars. The examples were selected because the thresholds are visually legible—not because they form a profitable sample.</p>${EXAMPLES.map((x,i)=>`<button class="example-card" data-example="${i}"><span>EXAMPLE ${i+1} · ${x.asset==='SP500'?'S&P 500':'NQ'} · ${DATA.series[x.asset].bars[x.i][0]}</span><strong>${x.title}</strong><small>${x.summary}</small></button>`).join('')}<div class="example-method"><p><b>Why include the counterexample?</b><br>A valid sweep describes one completed candle relative to earlier highs or lows. It does not guarantee what the next candle will do.</p><small>All levels use this project's frozen definitions. FVG revisit checks begin after formation. Weekly threshold reach is not treated as executable fill. Use the ordinary replay controls if you prefer to reveal one week at a time.</small></div>`);
 document.querySelectorAll('[data-example]').forEach(el=>el.onclick=()=>startLesson(+el.dataset.example));
}
function guide(){
 openDrawer('Read the chart',`<span class="badge">COMPLETED BARS ONLY · 1W / 1D</span><p>Choose weekly or daily beside the instrument. Drag to rewind. Scroll to zoom. Click a coloured zone or a sweep triangle to inspect it. Use <b>↕ Reference</b>, then click the chart, to measure from your own price.</p>
 <div class="guide-card"><h3>Liquidity levels</h3><svg viewBox="0 0 320 100" role="img" aria-label="Price pierces a prior low, then closes back above it"><path d="M10 54H310" stroke="#e9bb6d" stroke-dasharray="6 4"/><path d="M35 25V50M65 34V54M95 15V45M170 17V83M210 19V47" stroke="#92b9ad" stroke-width="2"/><path d="M28 33h14v9H28zM58 41h14v7H58zM88 23h14v12H88zM163 30h14v14h-14zM203 25h14v13h-14z" fill="#92b9ad"/><text x="225" y="49" fill="#e9bb6d" font-size="11">prior low</text><text x="126" y="98" fill="#e9bb6d" font-size="10">SSL sweep ↑</text></svg><p>Range highs/lows are <b>proxies</b> for places orders may cluster. OHLC does not reveal resting orders or their quantity.</p><p>A <b>sell-side sweep (SSL)</b> trades below the prior range low, then closes above it. A <b>buy-side sweep (BSL)</b> trades above the prior range high, then closes below it.</p><small>The selected lookback is 1, 4, 13 or 52 prior completed bars: weeks on 1W, trading sessions on 1D. Strict breach and reclaim; equality and both-sided breaches are excluded. The current range lines include the completed replay bar and become the following bar's references.</small></div>
 <div class="guide-card"><h3>Fair value gap · FVG</h3><svg viewBox="0 0 320 115" role="img" aria-label="Three candles create a bullish FVG between candle one's high and candle three's low"><rect x="40" y="37" width="260" height="33" fill="#4dd4b0" opacity=".12"/><path d="M40 37H300M40 70H300" stroke="#4dd4b0" stroke-width="1"/><path d="M40 53.5H300" stroke="#4dd4b0" stroke-dasharray="4 4"/><path d="M60 70V105M130 22V94M200 6V37" stroke="#92b9ad" stroke-width="2"/><path d="M53 80h14v18H53zM123 28h14v55h-14zM193 12h14v19h-14z" fill="#92b9ad"/><text x="232" y="32" fill="#4dd4b0" font-size="10">near edge</text><text x="232" y="50" fill="#4dd4b0" font-size="10">50% CE</text><text x="232" y="83" fill="#4dd4b0" font-size="10">far edge</text></svg><p>A three-candle <b>price non-overlap</b>, confirmed only when candle 3 closes. This study's definition is geometric; it does not establish fair economic value or prove unfilled orders.</p><div class="formula">Bullish: Low[t] &gt; High[t−2]<br>Zone: High[t−2] … Low[t]<br>Bearish: High[t] &lt; Low[t−2]<br>Zone: High[t] … Low[t−2]<br>CE = (lower edge + upper edge) / 2</div><p><b>Displacement</b> requires the middle candle to move in the gap direction, have a body ≥ 0.5 × prior 14-bar mean true range, and span both zone edges. <b>Sweep → FVG</b> also requires a same-direction sweep 1–3 bars earlier.</p></div>
 <div class="guide-card"><h3>What the states mean</h3><p><b>Unreached → near edge → CE → far edge.</b> Tracking starts on the bar after confirmation. A bar's range can reach or pass several thresholds at once. Filled zones shows far-edge-reached history faintly; this is not evidence of executable fills.</p><p>Four nearest active zones appear by default. A selected older zone can appear as a fifth. An unavailable bar ends known lifecycle tracking. HLC-only bars have a close tick and no invented candle body.</p></div>
 <div class="guide-card"><h3>Toward or away</h3><p>The blue bracket measures a price difference. The selection panel compares consecutive closes against the same fixed target. Crossing a level is shown separately. No direction or trade outcome is forecast.</p><small>NQ CE values may sit between executable ticks; the mathematical midpoint is retained. These are descriptive overlays, not entry/stop instructions. Guided examples and saved backtest statistics are weekly.</small></div><p><b>Keyboard:</b> ← / → one bar · space play/pause · + / − zoom · ? guide.</p>`);
}
function evidence(){
 const s=state.selected,rule=s?.type==='sweep'?`sweep_${s.k}`:state.kind==='all'?'fvg_raw':state.kind==='sequence'?'sweep_fvg':'fvg_disp';
 const rows=DATA.summary.filter(r=>r.asset===state.asset&&r.rule===rule);
 const fills=DATA.fills.filter(r=>r.asset===state.asset&&r.rule===rule);
 const hasCI=rows.some(r=>r.ci_low!==null);
 openDrawer('Weekly backtest evidence',`<span class="badge">WEEKLY FULL SNAPSHOT · NOT REPLAY-TIME KNOWLEDGE</span>${state.tf==='daily'?'<div class="note"><p>The visible chart is daily. The saved performance study is weekly, so these statistics do not evaluate the daily signals.</p></div>':''}<div class="note"><p>These statistics use the complete frozen weekly sample through ${esc(DATA.series[state.asset]?.meta.end||series().meta.end)}. They can include observations after the replay date.</p></div><h3>${esc(series().meta.name)}</h3><p>Rule: <b>${esc(rule.replaceAll('_',' '))}</b>. Direction-adjusted return from the signal week's close to the close 4 weeks later. Positive means movement in the event direction.</p><table><thead><tr><th>Direction</th><th>n</th><th>Mean</th><th>Baseline</th><th>Excess</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.direction>0?'Bullish':'Bearish'}</td><td>${r.n}</td><td>${pct(r.mean)}</td><td>${pct(r.baseline)}</td><td>${pct(r.excess)}</td></tr>`).join('')}</tbody></table>${hasCI?`<h3>95% block-bootstrap interval · excess</h3>${rows.map(r=>`<div class="kv"><span>${r.direction>0?'Bullish':'Bearish'}</span><strong>${r.ci_low===null?'Not estimated':`${pct(r.ci_low)} to ${pct(r.ci_high)}`}</strong></div>`).join('')}`:'<p><small>No confidence interval was estimated for this sensitivity rule.</small></p>'}
 ${fills.length?`<h3>Threshold reached/passed within 13 weeks</h3><table><thead><tr><th>Direction</th><th>Eligible n</th><th>50% CE</th><th>Far edge</th></tr></thead><tbody>${fills.map(r=>`<tr><td>${r.direction>0?'Bullish':'Bearish'}</td><td>${r.n}</td><td>${number(100*r.ce_rate,1)}%</td><td>${number(100*r.far_rate,1)}%</td></tr>`).join('')}</tbody></table><p><small>Censored observations excluded. Gap-through counts as reached/passed, not an executable limit fill.</small></p>`:''}
 <div class="note"><p>The original study's 18 core 4-week excess-return intervals all span zero. This evidence does not establish a reliable directional edge.</p></div><p><small>Events can overlap. Baselines use eligible weeks and matched direction. No trading costs enter this event-return table. The original report retains the mechanical-position tests, chronological splits and full methodology.</small></p><p><a href="../weekly_liquidity_backtest.html" target="_blank" rel="noopener">Open the full frozen backtest report ↗</a></p>`);
}
function sources(){
 const m=series().meta,a=m.audit||{},b=bars();
 const local=state.asset.startsWith('NQ_LOCAL'),stock=assetClass()==='equity';
 const daily=state.tf==='daily',label=daily?'session':'week';
 openDrawer('Source & data limits',`<span class="badge">FROZEN RESEARCH INPUTS · ${daily?'DAILY':'WEEKLY'}</span><h3>${esc(m.name)}</h3><div class="kv"><span>Instrument</span><strong>${esc(m.symbol)} · ${esc(m.currency)}</strong></div><div class="kv"><span>First eligible HLC ${label}</span><strong>${b[0][0]}</strong></div><div class="kv"><span>Last ${label}</span><strong>${b.at(-1)[0]}</strong></div><div class="kv"><span>Valid HLC ${daily?'sessions':'weeks'}</span><strong>${number(daily?m.valid_days:m.valid_weeks,0)}</strong></div><div class="kv"><span>Valid OHLC ${daily?'sessions':'weeks'}</span><strong>${number(daily?m.ohlc_days:m.ohlc_weeks,0)}</strong></div><p>${local?'This is a frozen derivative of read-only local minute data. Coverage filters apply; it is a separate series from Yahoo futures. The fixed sample stops before the source became mutable.':daily?'This chart embeds the frozen Yahoo daily snapshot. Dates use each market’s exchange timezone. Daily sweep and FVG overlays are descriptive calculations and were not included in the weekly performance backtest.':'This chart embeds weekly aggregates of the Yahoo daily snapshot. Each market uses its source timezone and Friday week labels. Series are kept separate.'}</p>
 ${state.asset==='SP500'?'<div class="note"><p>Usable high/low history begins in 1962. Earlier close-copy bars cannot support sweeps or FVGs. Before 26 Apr 1982, opening-price provenance is insufficient: those bars are HLC-only and displacement detection is disabled.</p></div>':state.asset==='SP500_MODERN'?'<div class="note"><p>This modern S&P 500 series begins at the 26 Apr 1982 opening-price reliability boundary. Earlier history is not embedded in this series.</p></div>':''}
 ${assetClass()==='futures'?'<p>Continuation data can contain roll artifacts. These overlays are not a reconstruction of executable individual contracts, spreads or transaction costs.</p>':''}
 ${stock?`<p>${m.origin?`Company origin: <b>${esc(m.origin)}</b>. `:''}The five early-origin companies are research candidates, not a certified world ranking of the oldest continuously traded shares. Company age is not the length of available price history.</p><p>Raw and adjusted sensitivity series are distinct choices. Corporate actions can distort raw prices. No-trade and invalid weeks are omitted from signal detection; the survivors-only sample is not representative of all historical stocks.</p>`:''}
 <p>Blank bands represent invalid or unavailable HLC ${daily?'sessions':'weeks'}. Chart overlays are computed from saved event rows; the original database and analytical results are unchanged.</p>${typeof m.source==='string'&&/^https?:\/\//.test(m.source)?`<p><a href="${esc(m.source)}" target="_blank" rel="noopener">Source snapshot endpoint ↗</a></p>`:''}<p><a href="../weekly_liquidity_backtest.html" target="_blank" rel="noopener">Full research, audit and references ↗</a></p><small>Source data were frozen on 06 Sep 2026. Nothing is streamed live. This chart is reproducible offline.</small>`);
}

// UI wiring.
const extras=Object.keys(DATA.series).filter(id=>!main.includes(id));
$('asset').innerHTML=`<optgroup label="Primary charts">${main.filter(id=>DATA.series[id]).map(id=>`<option value="${id}">${esc(labels[id]||DATA.series[id].meta.name)}</option>`).join('')}</optgroup><optgroup label="Sensitivity / alternate price basis">${extras.map(id=>`<option value="${id}">${esc(DATA.series[id].meta.name)}</option>`).join('')}</optgroup>`;
$('asset').onchange=e=>{exitLesson();switchAsset(e.target.value);};
$('timeframe').onchange=e=>switchTimeframe(e.target.value);
for(const [id,key] of [['toggleFvg','fvgOn'],['toggleSweeps','sweepOn'],['toggleRange','rangeOn'],['toggleFilled','filledOn']])$(id).onclick=()=>{state[key]=!state[key];button(id,state[key]);if(id==='toggleFvg'&&!state[key]&&state.selected?.type==='zone'){state.selected=null;state.reference=null;}render();};
$('fvgKind').onchange=e=>{state.kind=e.target.value;if(state.selected?.type==='zone'){state.selected=null;state.reference=null;}render();};
$('lookback').onchange=e=>{state.k=+e.target.value;render();};
$('measureBtn').onclick=()=>{state.measure=!state.measure;button('measureBtn',state.measure);if(state.measure)toast('Click a price on the chart to set your reference');};
$('zoomIn').onclick=()=>zoom(.78);$('zoomOut').onclick=()=>zoom(1.3);
$('resetView').onclick=()=>{exitLesson();state.span=104;state.selected=null;state.reference=null;state.measure=false;button('measureBtn',false);render();};
$('focusBtn').onclick=()=>{const on=document.body.classList.toggle('focus');button('focusBtn',on);$('focusBtn').textContent=on?'Exit focus':'Focus ⛶';requestAnimationFrame(()=>chart.resize());};
$('stepBack').onclick=()=>{stop();setCursor(state.cursor-1);};$('stepForward').onclick=()=>{stop();setCursor(state.cursor+1);};
$('playBtn').onclick=()=>{if(state.playing){stop();return;}if(state.cursor===bars().length-1)setCursor(Math.max(0,state.cursor-state.span));state.playing=true;$('playBtn').textContent='Ⅱ';$('playBtn').setAttribute('aria-label','Pause chart replay');timer=setInterval(()=>{if(state.cursor>=bars().length-1){stop();return;}setCursor(state.cursor+1);},state.tf==='daily'?220:650);};
$('date').onchange=e=>{stop();const i=bars().findLastIndex(b=>b[0]<=e.target.value);setCursor(Math.max(0,i));};
$('timeline').oninput=e=>{stop();setCursor(+e.target.value);};
$('latestBtn').onclick=()=>{stop();state.selected=null;state.reference=null;setCursor(bars().length-1);};
$('prevEvent').onclick=()=>navigateEvent(-1);$('nextEvent').onclick=()=>navigateEvent(1);$('eventKind').onchange=()=>render();
$('examplesBtn').onclick=examplesCatalog;$('guideBtn').onclick=guide;$('evidenceBtn').onclick=evidence;$('sourceBtn').onclick=sources;
$('lessonPrev').onclick=()=>startLesson(lesson.index-1);$('lessonNext').onclick=()=>startLesson(lesson.index+1);
$('lessonReveal').onclick=()=>{const ex=EXAMPLES[lesson.index];if(state.asset===ex.asset&&state.cursor>=ex.i+ex.reveal)startLesson(lesson.index);else setCursor(ex.i+ex.reveal);};
$('lessonExit').onclick=()=>{exitLesson();render();};
$('closeDrawer').onclick=()=>$('drawer').close();$('drawer').onclick=e=>{if(e.target===$('drawer')&&e.clientX<$('drawer').getBoundingClientRect().left)$('drawer').close();};
function pos(e){const r=$('priceChart').getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
function hitAt(p){return [...hits].sort((a,b)=>({sweep:0,range:1,zone:2}[a.type]-{sweep:0,range:1,zone:2}[b.type])).find(h=>p.x>=h.x1&&p.x<=h.x2&&p.y>=h.y1&&p.y<=h.y2);}
function onClick(p){
 const area=chart.chartArea;if(p.x<area.left||p.x>area.right||p.y<area.top||p.y>area.bottom)return;
 if(state.measure){const i=clamp(Math.round(chart.scales.x.getValueForPixel(p.x)),scene.start,state.cursor);state.reference={price:chart.scales.y.getValueForPixel(p.y),i,user:true};state.measure=false;button('measureBtn',false);render();toast('Reference set · click a zone or level to measure');return;}
 const hit=hitAt(p);if(!hit)return;
 if(hit.type==='zone')selectZone(hit.id);else if(hit.type==='sweep'){stop();selectSweep(hit.e);}else{const r=scene.ranges.find(x=>x.id===hit.id);if(r)select(r);}
}
const canvas=$('priceChart');
canvas.addEventListener('pointerdown',e=>{const p=pos(e);pointer={...p,cursor:state.cursor,drag:false};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{
 const p=pos(e),a=chart.chartArea;
 if(pointer){const delta=p.x-pointer.x;if(Math.abs(delta)>5)pointer.drag=true;if(pointer.drag){stop();const step=(a.right-a.left)/(scene.right-scene.start);setCursor(pointer.cursor-Math.round(delta/step));return;}}
 if(p.x<a.left||p.x>a.right||p.y<a.top||p.y>a.bottom){state.hover=null;$('tooltip').hidden=true;chart.draw();return;}
 const i=clamp(Math.round(chart.scales.x.getValueForPixel(p.x)),scene.start,state.cursor);state.hover={...p,i};headerOHLC(i);
 const h=hitAt(p),tt=$('tooltip');
 if(h?.type==='zone'){const z=getCache().byId.get(h.id);tt.innerHTML=`<strong>${z.dir>0?'Bullish':'Bearish'} FVG${z.combo?' · after sweep':''}</strong>${price(z.lo)} – ${price(z.hi)}<small>50% CE ${price(z.ce)} · ${stateNames[zoneState(z,state.cursor)]}</small><small>Confirmed ${dateAt(z.i)} · click to inspect</small>`;}
 else if(h?.type==='sweep')tt.innerHTML=`<strong>${h.e[2]>0?'SSL':'BSL'} sweep · ${state.k}${unitShort()}</strong>Level ${price(h.e[3])}<small>${dateAt(h.e[0])} · click to replay this close</small>`;
 else if(h?.type==='range'){const r=scene.ranges.find(l=>l.id===h.id);tt.innerHTML=`<strong>${r.label}</strong>${price(r.price)}<small>Next-week reference · click to hold fixed</small>`;}
 tt.hidden=!h;if(h){tt.style.left=`${clamp(p.x+16,6,Math.max(6,canvas.clientWidth-260))}px`;tt.style.top=`${clamp(p.y-80,4,Math.max(4,canvas.clientHeight-110))}px`;}
 chart.draw();
});
canvas.addEventListener('pointerup',e=>{if(pointer&&!pointer.drag)onClick(pos(e));pointer=null;});
canvas.addEventListener('pointercancel',()=>{pointer=null;});
canvas.addEventListener('pointerleave',()=>{state.hover=null;$('tooltip').hidden=true;headerOHLC(state.cursor);chart.draw();});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?1.13:.88);},{passive:false});
document.addEventListener('keydown',e=>{
 if($('drawer').open||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;
 if(e.key==='ArrowLeft'){e.preventDefault();stop();setCursor(state.cursor-1);}else if(e.key==='ArrowRight'){e.preventDefault();stop();setCursor(state.cursor+1);}else if(e.code==='Space'){e.preventDefault();$('playBtn').click();}else if(e.key==='+'||e.key==='=')zoom(.78);else if(e.key==='-')zoom(1.3);else if(e.key==='?')guide();else if(e.key==='Escape'){state.measure=false;button('measureBtn',false);}
});
let mobileView=innerWidth<650;
window.addEventListener('resize',()=>{const next=innerWidth<650;if(next!==mobileView){mobileView=next;if(next&&state.span>78)state.span=state.tf==='daily'?78:52;render();}});
// Narrow audit surface used by the offline UI/data tests; no network or order execution.
window.chartApp={getState:()=>JSON.parse(JSON.stringify(state)),getScene:()=>JSON.parse(JSON.stringify(scene)),getHits:()=>JSON.parse(JSON.stringify(hits)),getZones:()=>getCache().zones.map(z=>({...z})),getEvents:()=>getCache().events.map(e=>[...e]),getExamples:()=>JSON.parse(JSON.stringify(EXAMPLES)),getLesson:()=>lesson?{...lesson}:null,startLesson,lifecycle,zoneState,detectEvents,setCursor,switchAsset,switchTimeframe,selectZone,getChart:()=>chart,movement};
syncAssetAvailability();switchAsset(state.asset);
})();
