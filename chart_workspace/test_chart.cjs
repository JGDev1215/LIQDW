const {chromium}=require('/Users/soonjeongguan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const report={checks:[],errors:[],externalRequests:[],screenshots:[]};
const pass=(name,details)=>report.checks.push({name,status:'PASS',details});
(async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'input_manifest.json')));
 for(const [name,hash]of Object.entries(manifest))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',name))).digest('hex'),hash);
 pass('Frozen inputs unchanged',Object.keys(manifest).length+' SHA-256 comparisons');
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url()))report.externalRequests.push(r.url());});
 await page.route(/^https?:/,r=>r.abort());
 await page.goto('file://'+path.join(__dirname,'weekly_liquidity_chart.html'));
 await page.waitForFunction(()=>window.chartApp?.getChart());
 const audit=await page.evaluate(()=>{
  const fail=s=>{throw new Error(s);},ok=(b,s)=>{if(!b)fail(s);};
  // Independently derive reached thresholds from each observed prefix only.
  function observed(z,bs,c){let answer='fresh';for(let i=z.i+1;i<=c;i++){const b=bs[i];if(!b[5])return 'unknown';const far=z.dir>0?b[3]<=z.lo:b[2]>=z.hi;if(far)return 'far';const ce=z.dir>0?b[3]<=z.ce:b[2]>=z.ce;if(ce)answer='ce';else if(answer==='fresh'&&(z.dir>0?b[3]<=z.hi:b[2]>=z.lo))answer='edge';}return answer;}
  let views=0,zones=0,markers=0;
  for(const id of Object.keys(DATA.series)){
   chartApp.switchAsset(id);const bs=DATA.series[id].bars;
   for(const c of [0,Math.min(32,bs.length-1),Math.floor(bs.length*.25),Math.floor(bs.length*.5),bs.length-1]){
    chartApp.setCursor(c);const sc=chartApp.getScene();views++;
    ok(sc.shown.length<=4,`${id}: default zone cap`);
    ok(chartApp.getChart().data.datasets.every(d=>d.data.every(p=>p.x<=c)),`${id}: future candle`);
    for(const z of sc.shown){ok(z.i<=c,`${id}: unformed zone`);ok(chartApp.zoneState(z,c)===observed(z,bs,c),`${id}: future lifecycle leakage`);zones++;}
    for(const e of sc.sweeps){ok(e[0]<=c,`${id}: future sweep`);markers++;}
    for(const r of sc.ranges){ok(r.i<=c,`${id}: future range`);ok(r.price===(r.side>0?bs[c][2]:bs[c][3]),`${id}: 1W range definition`);}
   }
  }
  chartApp.switchAsset('NQ_YAHOO');
  const z={i:2,dir:1,lo:9,hi:11,ce:10};
  const b=(l,h=12)=>['fixture',11,h,l,11,1,1];
  const bs=[b(7),b(8),b(11),b(10.5),b(10),b(9)];
  const life={...z,...chartApp.lifecycle(bs,z)};
  ok([1,2,3,4,5].map(c=>chartApp.zoneState(life,c)).join(',')==='unformed,fresh,edge,ce,far','fixture lifecycle chronology');
  const gap={...z,...chartApp.lifecycle([...bs.slice(0,4),['gap',null,null,null,null,0,0],b(8)],z)};
  ok(chartApp.zoneState(gap,5)==='unknown','gap must not silently bridge');
  ok(life.edgeAt===3&&life.ceAt===4&&life.farAt===5,'formation week must not count as revisit');
  const halfway=chartApp.getZones().find(z=>Math.abs(z.ce*4-Math.round(z.ce*4))>1e-6);
  ok(!!halfway,'NQ exact midpoint fixture exists');chartApp.setCursor(halfway.i);chartApp.selectZone(halfway.id);
  ok(document.getElementById('selection').textContent.includes(halfway.ce.toLocaleString('en-US',{minimumFractionDigits:3,maximumFractionDigits:3})),'NQ midpoint precision lost');
  chartApp.setCursor(halfway.i-1);ok(!chartApp.getState().selected,'unformed selected zone remains');
  chartApp.switchAsset('SP500');chartApp.setCursor(10);
  ok(DATA.series.SP500.bars[10][1]===null&&DATA.series.SP500.bars[10][6]===0,'early SP500 open fabricated');
  ok(document.getElementById('ohlc').textContent.includes('HLC only'),'HLC labeling missing');
  return {views,zones,markers,firstSP500:DATA.series.SP500.bars[0][0]};
 });
 pass('20 series × 5 replay dates: no future candles/overlays; independent lifecycle check',audit);
 pass('Synthetic fixtures: confirmation, edge, CE, far edge and missing-week censoring');
 pass('Exact between-tick NQ midpoint and early S&P 500 HLC rendering');
 await page.screenshot({path:path.join(__dirname,'sp500_hlc.png')});report.screenshots.push('sp500_hlc.png');
 await page.selectOption('#asset','NQ_YAHOO');
 await page.selectOption('#lookback','4');
 assert.equal(await page.evaluate(()=>{const s=chartApp.getState(),bs=DATA.series[s.asset].bars.slice(s.cursor-3,s.cursor+1),rs=chartApp.getScene().ranges;return rs[0].price===Math.max(...bs.map(b=>b[2]))&&rs[1].price===Math.min(...bs.map(b=>b[3]));}),true);
 pass('Four-week range uses exactly four completed weeks');
 await page.selectOption('#lookback','1');
 await page.click('#prevEvent');
 const selected=await page.evaluate(()=>chartApp.getState());
 assert.equal(selected.selected.type,'zone');assert.equal(selected.selected.formed,selected.cursor);
 const oldRef=selected.reference.price,target=selected.selected.price;
 assert.equal(await page.locator('#selection').innerText().then(t=>t.includes('UNREACHED')),true);
 await page.click('#stepForward');
 assert.equal(await page.evaluate(()=>chartApp.getState().reference.price),oldRef);
 pass('Event navigation selects the confirmation close; measurement reference stays fixed', {reference:oldRef,target,difference:target-oldRef});
 await page.click('#measureBtn');
 const area=await page.evaluate(()=>chartApp.getChart().chartArea);
 const rect=await page.locator('canvas').boundingBox();
 const mx=area.left+(area.right-area.left)*.72,my=area.top+(area.bottom-area.top)*.38;
 await page.evaluate(()=>document.querySelector('canvas').addEventListener('pointerup',e=>{window.auditExpectedPrice=chartApp.getChart().scales.y.getValueForPixel(e.clientY-document.querySelector('canvas').getBoundingClientRect().top);},{capture:true,once:true}));
 await page.mouse.click(rect.x+mx,rect.y+my);
 const expected=await page.evaluate(()=>window.auditExpectedPrice);
 const ref=await page.evaluate(()=>chartApp.getState().reference);
 assert.equal(ref.user,true);assert.ok(Math.abs(ref.price-expected)<1e-8);
 pass('Custom reference click maps to exact chart price',{reference:ref.price});
 await page.screenshot({path:path.join(__dirname,'desktop_selected.png')});report.screenshots.push('desktop_selected.png');
 const span=await page.evaluate(()=>chartApp.getState().span);await page.click('#zoomIn');assert.ok(await page.evaluate(()=>chartApp.getState().span)<span);
 await page.click('#resetView');
 await page.click('#focusBtn');assert.equal(await page.locator('body').getAttribute('class'),'focus');await page.click('#focusBtn');
 await page.click('#latestBtn');const cursor=await page.evaluate(()=>chartApp.getState().cursor);
 await page.click('#stepBack');assert.equal(await page.evaluate(()=>chartApp.getState().cursor),cursor-1);
 await page.locator('#playBtn').click();await page.waitForTimeout(760);await page.locator('#playBtn').click();assert.equal(await page.evaluate(()=>chartApp.getState().cursor),cursor);
 pass('Zoom, reset, focus, single-step and timed replay controls');
 await page.selectOption('#eventKind','sweep');await page.click('#prevEvent');
 assert.equal(await page.evaluate(()=>{const s=chartApp.getState();return s.selected.type==='sweep'&&s.cursor===s.selected.i;}),true);
 await page.screenshot({path:path.join(__dirname,'desktop_sweep.png')});report.screenshots.push('desktop_sweep.png');
 await page.click('#evidenceBtn');assert.match(await page.locator('#drawerBody').innerText(),/FULL SNAPSHOT/);await page.click('#closeDrawer');
 await page.click('#guideBtn');assert.match(await page.locator('#drawerBody').innerText(),/OHLC does not reveal/);await page.click('#closeDrawer');
 await page.click('#sourceBtn');assert.match(await page.locator('#drawerBody').innerText(),/FROZEN RESEARCH INPUTS/);await page.click('#closeDrawer');
 pass('Evidence, definitions and provenance stay in optional drawers');
 const dailyAudit=await page.evaluate(()=>{
  const ok=(b,s)=>{if(!b)throw new Error(s)},ids=Object.keys(DATA.daily),audit=[];
  function ref(bs){
   const es=[],ssl=Array(bs.length).fill(false),bsl=Array(bs.length).fill(false);
   for(const [ri,k] of [1,4,13,52].entries())for(let i=k;i<bs.length;i++){const cur=bs[i],p=bs.slice(i-k,i);if(!cur[5]||p.some(x=>!x[5]))continue;const hi=Math.max(...p.map(x=>x[2])),lo=Math.min(...p.map(x=>x[3])),up=cur[2]>hi,dn=cur[3]<lo;if(dn&&!up&&cur[4]>lo){es.push([i,ri,1]);if(k===1)ssl[i]=true;}if(up&&!dn&&cur[4]<hi){es.push([i,ri,-1]);if(k===1)bsl[i]=true;}}
   const tr=Array(bs.length).fill(null);for(let i=1;i<bs.length;i++)if(bs[i][5]&&bs[i-1][5])tr[i]=Math.max(bs[i][2]-bs[i][3],Math.abs(bs[i][2]-bs[i-1][4]),Math.abs(bs[i][3]-bs[i-1][4]));
   for(let i=2;i<bs.length;i++){if(!bs[i][5]||!bs[i-1][5]||!bs[i-2][5])continue;for(const dir of [1,-1]){const gap=dir>0?bs[i][3]>bs[i-2][2]:bs[i][2]<bs[i-2][3];if(!gap)continue;const lo=dir>0?bs[i-2][2]:bs[i][2],hi=dir>0?bs[i][3]:bs[i-2][3],ce=(lo+hi)/2;es.push([i,4,dir]);const tw=tr.slice(i-15,i-1),atr=tw.length===14&&tw.every(Number.isFinite)?tw.reduce((a,b)=>a+b,0)/14:null,body=bs[i-1][4]-bs[i-1][1],disp=bs[i-1][6]&&atr!==null&&bs[i-1][3]<=lo&&bs[i-1][2]>=hi&&dir*body>0&&dir*body>=.5*atr;if(disp){es.push([i,5,dir]);const m=dir>0?ssl:bsl;if([1,2,3].some(back=>m[i-back]))es.push([i,6,dir]);}}}
   return es.sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]);
  }
  chartApp.switchTimeframe('daily');
  for(const id of ids){chartApp.switchAsset(id);const bs=DATA.daily[id].bars,got=chartApp.getEvents().map(e=>e.slice(0,3)),want=ref(bs);ok(JSON.stringify(got)===JSON.stringify(want),`${id}: daily detector mismatch`);for(const c of [0,Math.floor(bs.length*.4),bs.length-1]){chartApp.setCursor(c);const sc=chartApp.getScene();ok(sc.shown.length<=4,`${id}: daily zone cap`);ok(chartApp.getChart().data.datasets.every(d=>d.data.every(p=>p.x<=c)),`${id}: daily future candle`);ok(sc.shown.every(z=>z.i<=c),`${id}: daily future zone`);}audit.push({id,days:bs.length,events:got.length,first:bs[0][0]});}
  ok(DATA.daily.SP500.bars[0][0]>='1962-01-01','daily S&P begins before eligibility');ok(DATA.daily.SP500.bars[0][1]===null,'daily S&P early open fabricated');return audit;
 });
 pass('Daily 1D detector matches independent sweep/FVG reference across 11 frozen series',dailyAudit);
 await page.selectOption('#asset','NQ_YAHOO');await page.click('#sourceBtn');assert.match(await page.locator('#drawerBody').innerText(),/DAILY/);await page.click('#closeDrawer');await page.click('#evidenceBtn');assert.match(await page.locator('#drawerBody').innerText(),/visible chart is daily/i);await page.click('#closeDrawer');
 await page.screenshot({path:path.join(__dirname,'daily_nq.png')});report.screenshots.push('daily_nq.png');
 const dailyAvailability=await page.evaluate(()=>{const local=document.querySelector('#asset option[value="NQ_LOCAL_FIXED"]'),localDisabled=local.disabled;const blocked=chartApp.switchAsset('NQ_LOCAL_FIXED')===false&&chartApp.getState().asset==='NQ_YAHOO';const weekly=chartApp.switchTimeframe('weekly');chartApp.switchAsset('NQ_LOCAL_FIXED');const dailyBlocked=chartApp.switchTimeframe('daily')===false&&chartApp.getState().tf==='weekly';chartApp.switchAsset('NQ_YAHOO');return {localDisabled,blocked,dailyBlocked,weekly};});
 assert.deepEqual(dailyAvailability,{localDisabled:true,blocked:true,dailyBlocked:true,weekly:true});pass('1D unavailable local/sensitivity series are disabled without fabrication',dailyAvailability);
 await page.click('#examplesBtn');assert.equal(await page.locator('[data-example]').count(),6);assert.match(await page.locator('#drawerBody').innerText(),/not because they form a profitable sample/i);
 await page.locator('[data-example="0"]').click();
 const lessons=[];
 for(let n=0;n<6;n++){
  const atStart=await page.evaluate(n=>{const ex=chartApp.getExamples()[n],s=chartApp.getState(),sc=chartApp.getScene(),rule=ex.type==='zone'?4:ex.rule;return {ex,s,lesson:chartApp.getLesson(),eventFound:DATA.series[ex.asset].events.some(e=>e[0]===ex.i&&e[1]===rule&&e[2]===ex.dir),futureCandle:chartApp.getChart().data.datasets.some(d=>d.data.some(p=>p.x>s.cursor)),futureZone:sc.shown.some(z=>z.i>s.cursor),title:document.getElementById('lessonTitle').textContent,prompt:document.getElementById('lessonPrompt').textContent};},n);
  assert.equal(atStart.lesson.index,n);assert.equal(atStart.eventFound,true);assert.equal(atStart.s.asset,atStart.ex.asset);assert.equal(atStart.s.cursor,atStart.ex.i);assert.equal(atStart.s.selected.type,atStart.ex.type);assert.equal(atStart.futureCandle,false);assert.equal(atStart.futureZone,false);assert.equal(atStart.title,atStart.ex.title);
  await page.click('#lessonReveal');
  const after=await page.evaluate(n=>{const ex=chartApp.getExamples()[n],s=chartApp.getState();return {cursor:s.cursor,expected:ex.i+ex.reveal,prompt:document.getElementById('lessonPrompt').textContent,observed:ex.observed,button:document.getElementById('lessonReveal').textContent};},n);
  assert.equal(after.cursor,after.expected);assert.equal(after.prompt,after.observed);assert.equal(after.button,'Reset example');lessons.push({title:atStart.title,confirmation:atStart.ex.i,revealWeeks:atStart.ex.reveal});
  if(n<5)await page.click('#lessonNext');
 }
 await page.screenshot({path:path.join(__dirname,'guided_example.png')});report.screenshots.push('guided_example.png');
 assert.equal(await page.locator('#lessonNext').isDisabled(),true);await page.click('#lessonPrev');assert.equal(await page.evaluate(()=>chartApp.getLesson().index),4);
 await page.click('#lessonExit');assert.equal(await page.locator('#lessonPanel').isHidden(),true);
 pass('Six guided examples start at confirmation, reveal only on request, and navigate/reset/exit',{lessons});
 await page.click('#latestBtn');await page.screenshot({path:path.join(__dirname,'desktop_final.png')});report.screenshots.push('desktop_final.png');
 const wide=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,height:innerHeight,scrollHeight:document.documentElement.scrollHeight}));
 assert.equal(wide.scroll,wide.width);assert.equal(wide.height,wide.scrollHeight);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
 const mobile=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,canvas:document.querySelector('canvas').getBoundingClientRect().toJSON()}));
 assert.equal(mobile.width,mobile.scroll);assert.ok(mobile.canvas.height>250);
 await page.screenshot({path:path.join(__dirname,'mobile_final.png'),fullPage:true});report.screenshots.push('mobile_final.png');
 await page.evaluate(()=>chartApp.startLesson(0));await page.waitForTimeout(100);
 const mobileLesson=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,panel:document.getElementById('lessonPanel').getBoundingClientRect().toJSON(),canvas:document.querySelector('canvas').getBoundingClientRect().toJSON()}));
 assert.equal(mobileLesson.scroll,mobileLesson.width);assert.ok(mobileLesson.panel.height>80);assert.ok(mobileLesson.canvas.height>250);
 await page.screenshot({path:path.join(__dirname,'mobile_example.png'),fullPage:true});report.screenshots.push('mobile_example.png');
 pass('Desktop fits viewport; mobile has no horizontal overflow and a usable chart',{wide,mobile});
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);
 pass('Offline browser run: zero JavaScript errors and zero external requests');
 fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(report,null,2));
 await browser.close();console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(__dirname,'verification_failed.json'),JSON.stringify({...report,failure:String(e)},null,2));process.exit(1)});
