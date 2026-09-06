const {chromium}=require('/Users/soonjeongguan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('path'),fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1});
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto('file://'+path.join(__dirname,'weekly_liquidity_backtest.html'));
 await page.locator('#kpis .num').first().waitFor();
 const initial=await page.locator('#kpis').innerText();
 if(!initial.includes('195')||!initial.includes('1.19%'))throw Error('Initial headline numbers mismatch');
 await page.screenshot({path:path.join(__dirname,'results/report_top.png')});
 await page.locator('#gaps').scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(__dirname,'results/report_fvg.png')});
 const charts=await page.evaluate(()=>Object.entries(Chart.instances).map(([id,c])=>({id:c.canvas.id,w:c.width,h:c.height,ymin:c.scales.y?.min,ymax:c.scales.y?.max,points:c.data.datasets[0]?.data.filter(x=>x!==null).length})));
 if(charts.some(c=>c.w<100||c.h<100))throw Error('Chart geometry');
 if(charts.find(c=>c.id==='exampleChart').ymax<100)throw Error('Missing candlestick price scale');
 for(const asset of ['SP500','MPS','ORELL','MATSUI_ADJ','NQ_LOCAL_FIXED']){
  await page.selectOption('#asset',asset);await page.selectOption('#rule','sweep_fvg');await page.selectOption('#direction','-1');
  const text=await page.locator('#activeDescription').innerText();if(!text.includes('Bearish'))throw Error('Filter failed');
  await page.selectOption('#horizon','13');await page.selectOption('#fillRule','fvg_raw');await page.selectOption('#exampleDirection','-1');
 }
 await page.selectOption('#asset','NQ_YAHOO');await page.selectOption('#rule','sweep_1');await page.selectOption('#direction','1');await page.selectOption('#horizon','4');
 const downloadPromise=page.waitForEvent('download');await page.locator('#downloadEvents').click();const download=await downloadPromise;
 await download.saveAs(path.join(__dirname,'results/browser_export_test.csv'));
 const exportText=fs.readFileSync(path.join(__dirname,'results/browser_export_test.csv'),'utf8');
 if(!exportText.includes('NQ_YAHOO')||!exportText.includes('sweep_1'))throw Error('Export failed');
 await page.locator('#nextPage').click();if(!(await page.locator('#eventCount').innerText()).startsWith('16'))throw Error('Pagination failed');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(__dirname,'results/report_mobile.png')});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
 if(overflow)throw Error('Mobile page overflow');
 if(errors.length)throw Error(errors.join('\n'));
 if(requests.some(u=>u.startsWith('http')))throw Error('Report requested remote dependency');
 const report={status:'PASS',console_errors:errors,external_requests:0,filter_cases:5,download_verified:true,pagination_verified:true,mobile_width:390,charts};
 fs.writeFileSync(path.join(__dirname,'results/browser_verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
