const {chromium}=require('/Users/soonjeongguan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file://'+path.join(__dirname,'weekly_liquidity_chart.html'));
 await page.waitForFunction(()=>window.chartApp?.getChart());
 await page.screenshot({path:path.join(__dirname,'desktop_initial.png')});
 console.log(JSON.stringify({errors,scene:await page.evaluate(()=>({state:chartApp.getState(),visible:chartApp.getScene().shown.map(z=>({id:z.id,ce:z.ce,status:chartApp.zoneState(z,chartApp.getState().cursor)})),area:chartApp.getChart().chartArea})),layout:await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,height:innerHeight,canvas:document.querySelector('canvas').getBoundingClientRect().toJSON()}))},null,2));
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
 await page.screenshot({path:path.join(__dirname,'mobile_inspect.png'),fullPage:true});
 console.log(JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth).map(e=>({tag:e.tagName,id:e.id,cls:e.className,rect:e.getBoundingClientRect().toJSON()}))),null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
