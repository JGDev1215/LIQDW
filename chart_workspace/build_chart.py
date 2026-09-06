"""Chart-first presentation of existing frozen evidence. No market DB access."""
from pathlib import Path
from datetime import datetime,timezone
from zoneinfo import ZoneInfo
import csv,json,hashlib,math

ROOT=Path(__file__).resolve().parent
SOURCE=ROOT.parent
RULES=['sweep_1','sweep_4','sweep_13','sweep_52','fvg_raw','fvg_disp','sweep_fvg']
DAILY_BASE=['NQ_YAHOO','NDX','SP500','STORA','MPS','ORELL','MATSUI','SUMITOMO','BNY','ED']
STOCKS={'STORA','MPS','ORELL','MATSUI','SUMITOMO','BNY','ED'}

def num(s):
 try:
  v=float(s)
  return v if math.isfinite(v) else None
 except (ValueError,TypeError):return None

def compact(x):return json.dumps(x,ensure_ascii=False,separators=(',',':'),allow_nan=False).replace('</','<\\/')

def daily_bars(key,meta):
 p=SOURCE/'raw'/f'{key}.json';raw=json.loads(p.read_text())['chart']['result'][0]
 quote=raw['indicators']['quote'][0];tz=ZoneInfo(raw['meta']['exchangeTimezoneName']);seen=set();bars=[]
 for i,stamp in enumerate(raw['timestamp']):
  date=datetime.fromtimestamp(stamp,timezone.utc).astimezone(tz).date().isoformat()
  if date in seen:raise ValueError(f'duplicate daily date {key} {date}')
  seen.add(date);o,h,l,c=[num(quote.get(k,[None]*len(raw['timestamp']))[i]) for k in ('open','high','low','close')]
  volume=num(quote.get('volume',[None]*len(raw['timestamp']))[i])
  hlc=all(x is not None and x>0 for x in (h,l,c))
  if hlc:
   tol=abs(c)*1e-6;hlc=h>=l and h+tol>=c and l-tol<=c
   if hlc:h=max(h,c);l=min(l,c)
  if key in STOCKS and (volume is None or volume<=0):hlc=False
  ohlc=hlc and o is not None and o>0 and h+abs(c)*1e-6>=o and l-abs(c)*1e-6<=o
  if key=='SP500' and date<'1962-01-01':hlc=ohlc=False
  if key=='SP500' and date<'1982-04-26':ohlc=False
  bars.append([date,o if ohlc else None,h if hlc else None,l if hlc else None,c if hlc else None,int(hlc),int(ohlc)])
 start=next(i for i,b in enumerate(bars) if b[5]);bars=bars[start:]
 valid=sum(b[5] for b in bars);ohlc=sum(b[6] for b in bars)
 info={**meta,'start':next(b[0] for b in bars if b[5]),'end':next(b[0] for b in reversed(bars) if b[5]),'days':len(bars),'valid_days':valid,'ohlc_days':ohlc}
 return {'meta':info,'bars':bars}

def build():
 study=json.loads((SOURCE/'results/study.json').read_text())
 datasets={};daily={};hashes={}
 for m in study['metadata']:
  p=SOURCE/'data'/f"{m['id']}.csv"
  hashes[str(p.relative_to(SOURCE))]=hashlib.sha256(p.read_bytes()).hexdigest()
  with p.open() as f:rows=list(csv.DictReader(f))
  start=next(i for i,r in enumerate(rows) if r['valid_hlc']=='True')
  bars=[]
  for r in rows[start:]:
   valid=r['valid_hlc']=='True';ohlc=r['valid_ohlc']=='True'
   bars.append([r['week'],num(r['open']) if ohlc else None,
       *[num(r[k]) if valid else None for k in ['high','low','close']],int(valid),int(ohlc)])
  datasets[m['id']]={'meta':m,'bars':bars,'events':[]}
 meta_by_id={m['id']:m for m in study['metadata']}
 for key in DAILY_BASE:
  p=SOURCE/'raw'/f'{key}.json';hashes[str(p.relative_to(SOURCE))]=hashlib.sha256(p.read_bytes()).hexdigest()
  daily[key]=daily_bars(key,meta_by_id[key])
 # The modern S&P choice shares the same source and begins at the reliable-open boundary.
 modern=[b for b in daily['SP500']['bars'] if b[0]>='1982-04-26']
 daily['SP500_MODERN']={'meta':{**meta_by_id['SP500_MODERN'],'start':modern[0][0],'end':modern[-1][0],'days':len(modern),'valid_days':sum(b[5] for b in modern),'ohlc_days':sum(b[6] for b in modern)},'bars':modern}
 with (SOURCE/'results/events.csv').open() as f:
  for r in csv.DictReader(f):
   if r['rule'] not in RULES:continue
   d=datasets[r['asset']];i=int(r['i'])
   assert d['bars'][i][0]==r['date']
   d['events'].append([i,RULES.index(r['rule']),int(r['direction']),num(r['reference']),num(r['lower']),num(r['upper']),num(r['ce'])])
 hashes['results/events.csv']=hashlib.sha256((SOURCE/'results/events.csv').read_bytes()).hexdigest()
 hashes['results/study.json']=hashlib.sha256((SOURCE/'results/study.json').read_bytes()).hexdigest()
 payload={'series':datasets,'daily':daily,'rules':RULES,'summary':[r for r in study['summary'] if r['period']=='all' and r['horizon']==4 and r['rule'] in RULES],
    'fills':[r for r in study['fills'] if r['horizon']==13],'cutoff':'2026-09-04'}
 text=(ROOT/'chart_template.html').read_text().replace('__CHARTJS__',(SOURCE/'chart.umd.min.js').read_text()).replace('__DATA__',compact(payload))
 text=text.replace('__APP_JS__',(ROOT/'app.js').read_text()).replace('__STYLE__',(ROOT/'style.css').read_text())
 output=ROOT/'weekly_liquidity_chart.html';output.write_text(text)
 (ROOT/'input_manifest.json').write_text(json.dumps(hashes,indent=2))
 (ROOT/'chart_data.json').write_text(compact(payload))
 print(json.dumps({'bytes':output.stat().st_size,'weekly_series':len(datasets),'weekly_bars':sum(len(d['bars']) for d in datasets.values()),'weekly_events':sum(len(d['events']) for d in datasets.values()),'daily_series':len(daily),'daily_bars':sum(len(d['bars']) for d in daily.values())}))

if __name__=='__main__':build()
