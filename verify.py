"""Independent scalar detector, arithmetic, raw-bar and evidence checks."""
import csv,json,math,hashlib,random,sqlite3
from pathlib import Path
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
import pandas as pd
from prepare import ROOT

def close(a,b):
 return math.isclose(a,b,rel_tol=2e-8,abs_tol=2e-7)

def run():
 study=json.loads((ROOT/'results/study.json').read_text());manifest=json.loads((ROOT/'results/manifest.json').read_text())
 for name,h in manifest['raw_files'].items():assert hashlib.sha256((ROOT/'raw'/name).read_bytes()).hexdigest()==h
 with (ROOT/'results/events.csv').open() as f:actual=list(csv.DictReader(f))
 grouped={}
 for e in actual:grouped.setdefault((e['asset'],e['rule'],int(e['direction'])),[]).append(e)
 all_events={};weekly={};verified_events=0;verified_returns=0
 for m in study['metadata']:
  asset=m['id'];d=pd.read_csv(ROOT/'data'/f'{asset}.csv',float_precision='round_trip');d=d.iloc[next(i for i,v in enumerate(d.valid_hlc) if v):].reset_index(drop=True)
  bars=d.to_dict('records');weekly[asset]=bars;expected={};sweeps={1:set(),-1:set()}
  for i,b in enumerate(bars):
   if not b['valid_hlc']:continue
   def add(rule,side,**levels):expected[(asset,b['week'],rule,side)]=dict(i=i,**levels)
   for k in (1,4,13,52):
    past=bars[max(0,i-k):i]
    if len(past)!=k or not all(x['valid_hlc'] for x in past):continue
    hi=max(x['high'] for x in past);lo=min(x['low'] for x in past)
    up=b['high']>hi;dn=b['low']<lo
    if dn and not up and b['close']>lo:
     add(f'sweep_{k}',1,reference=lo)
     if k==1:sweeps[1].add(i)
    if up and not dn and b['close']<hi:
     add(f'sweep_{k}',-1,reference=hi)
     if k==1:sweeps[-1].add(i)
    if up and not dn and b['close']>hi:add(f'breakout_{k}',1,reference=hi)
    if dn and not up and b['close']<lo:add(f'breakout_{k}',-1,reference=lo)
   if i<2 or not all(x['valid_hlc'] for x in bars[i-2:i+1]):continue
   if b['low']>bars[i-2]['high']:side=1;lo=bars[i-2]['high'];hi=b['low']
   elif b['high']<bars[i-2]['low']:side=-1;lo=b['high'];hi=bars[i-2]['low']
   else:continue
   levels=dict(lower=lo,upper=hi,ce=(lo+hi)/2)
   add('fvg_raw',side,**levels)
   if i<16 or not bars[i-1]['valid_ohlc'] or not all(x['valid_hlc'] for x in bars[i-16:i-1]):continue
   trs=[max(bars[j]['high']-bars[j]['low'],abs(bars[j]['high']-bars[j-1]['close']),abs(bars[j]['low']-bars[j-1]['close'])) for j in range(i-15,i-1)]
   middle=bars[i-1]
   if middle['low']<=lo and middle['high']>=hi and side*(middle['close']-middle['open'])>0 and side*(middle['close']-middle['open'])>=.5*sum(trs)/14:
    add('fvg_disp',side,**levels)
    if any(j in sweeps[side] for j in range(i-3,i)):add('sweep_fvg',side,**levels)
  observed={(e['asset'],e['date'],e['rule'],int(e['direction'])):e for e in actual if e['asset']==asset}
  assert expected.keys()==observed.keys(),(asset,'detector mismatch',list(expected.keys()-observed.keys())[:3],list(observed.keys()-expected.keys())[:3])
  for key,ref in expected.items():
   e=observed[key];verified_events+=1
   for field,value in ref.items():assert close(float(e[field]),value),(key,field)
   i=ref['i'];side=key[3]
   for h in (1,4,13):
    valid=i+h<len(bars) and all(x['valid_hlc'] for x in bars[i:i+h+1])
    value=e[f'return_{h}']
    if valid:
     assert value and close(float(value),side*(bars[i+h]['close']/bars[i]['close']-1)),(key,h)
     verified_returns+=1
    else:assert not value,(key,h,'should be unavailable')
  all_events.update(observed)
 # Recompute all means/medians and counts independently from event CSV.
 for r in study['summary']:
  bars=weekly[r['asset']];split=int(len(bars)*.7);h=r['horizon']
  selected=[]
  for e in grouped.get((r['asset'],r['rule'],r['direction']),[]):
   i=int(e['i'])
   if r['period']=='early' and i+h>=split:continue
   if r['period']=='late' and i<split:continue
   if e[f'return_{h}']:selected.append(float(e[f'return_{h}']))
  assert len(selected)==r['n']
  if selected:
   assert close(sum(selected)/len(selected),r['mean'])
   ordered=sorted(selected);mid=len(ordered)//2;median=ordered[mid] if len(ordered)%2 else sum(ordered[mid-1:mid+1])/2
   assert close(median,r['median'])
 # Independently recompute every FVG follow-up denominator and threshold count.
 for r in study['fills']:
  bars=weekly[r['asset']];side=r['direction'];h=r['horizon'];full=[]
  group=grouped.get((r['asset'],r['rule'],side),[])
  for e in group:
   i=int(e['i']);window=bars[i+1:i+h+1]
   if len(window)!=h or not all(b['valid_hlc'] for b in window):continue
   levels={'edge':float(e['upper'] if side==1 else e['lower']),'ce':float(e['ce']),'far':float(e['lower'] if side==1 else e['upper'])}
   result={}
   for name,level in levels.items():
    hit=[j for j,b in enumerate(window) if b['low']<=level] if side==1 else [j for j,b in enumerate(window) if b['high']>=level]
    result[name]=dict(hit=bool(hit),wait=hit[0]+1 if hit else None,touch=any(b['low']<=level<=b['high'] for b in window))
   full.append(result)
  assert len(full)==r['n'] and len(group)-len(full)==r['censored']
  for name in ['edge','ce','far']:
   assert sum(v[name]['hit'] for v in full)==r[name+'_hits']
   assert sum(v[name]['touch'] for v in full)==r[name+'_range_touches']
   waits=sorted(v[name]['wait'] for v in full if v[name]['hit'])
   if waits:
    mid=len(waits)//2;median=waits[mid] if len(waits)%2 else sum(waits[mid-1:mid+1])/2
    assert close(median,r[name+'_median_wait']),(r['asset'],r['rule'],side,h,name,median,r[name+'_median_wait'])
 # Independently reconstruct 5 valid weeks for each external base asset from raw daily JSON.
 raw_checks=0
 rng=random.Random(20260906)
 for m in study['metadata']:
  if m['id'].endswith('_ADJ') or m['id'].startswith('NQ_LOCAL') or m['id']=='SP500_MODERN':continue
  r=json.loads((ROOT/'raw'/f"{m['id']}.json").read_text())['chart']['result'][0];q=r['indicators']['quote'][0]
  groups={}
  for i,ts in enumerate(r['timestamp']):
   day=datetime.fromtimestamp(ts,ZoneInfo(r['meta']['exchangeTimezoneName'])).date()
   friday=day+timedelta(days=4-day.weekday())
   values=[q[k][i] for k in ['open','high','low','close']]
   if 'stock' in m['kind'] and not (q['volume'][i] and q['volume'][i]>0):continue
   if any(v is None for v in values):continue
   groups.setdefault(str(friday),[]).append(values)
  options=[b for b in weekly[m['id']] if b['valid_ohlc']]
  for b in rng.sample(options,min(5,len(options))):
   vals=groups[b['week']];ref=[vals[0][0],max(v[1] for v in vals),min(v[2] for v in vals),vals[-1][3]]
   for k,v in zip(['open','high','low','close'],ref):assert close(b[k],v),(m['id'],b['week'],k)
   raw_checks+=1
 # All mechanical trades: independently check next-open timing and non-overlap.
 with (ROOT/'results/mechanical_trades.csv').open() as f:trades=list(csv.DictReader(f))
 previous={}
 for t in trades:
  bars=weekly[t['asset']];idx={b['week']:i for i,b in enumerate(bars)};signal=idx[t['signal']]
  assert idx[t['entry']]==signal+1 and idx[t['exit']]==signal+4
  group=(t['asset'],t['rule'])
  assert idx[t['entry']]>previous.get(group,-1);previous[group]=idx[t['exit']]
  gross=int(t['direction'])*(float(t['exit_close'])/float(t['entry_open'])-1)
  for k,cost in [('gross',0),('net10',.001),('net25',.0025)]:assert close(float(t[k]),gross-cost)
 core=[r for r in study['summary'] if r['asset'] in ['NQ_YAHOO','NDX','SP500'] and r['horizon']==4 and r['period']=='all' and r['rule'] in ['sweep_1','fvg_disp','sweep_fvg']]
 assert len(core)==18 and all(r['ci_low']<=0<=r['ci_high'] for r in core)
 report=dict(raw_hashes=len(manifest['raw_files']),independently_matched_events=verified_events,
  independently_matched_forward_returns=verified_returns,summary_rows=len(study['summary']),
  independent_raw_weekly_aggregations=raw_checks,fvg_followup_rows_verified=len(study['fills']),mechanical_positions_verified=len(trades),
  benchmark_intervals_spanning_zero=len(core),status='PASS')
 (ROOT/'results/verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))

if __name__=='__main__':run()
