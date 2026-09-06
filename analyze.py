"""Causal-at-formation weekly pattern detector and descriptive backtest."""
from pathlib import Path
import json, math, hashlib
import numpy as np
import pandas as pd
from prepare import ROOT, COLS, dump

HORIZONS=(1,4,13)
PRIMARY=('sweep_1','fvg_disp','sweep_fvg')
LABELS={'sweep_1':'Prior-week rejection sweep','sweep_4':'4-week rejection sweep',
 'sweep_13':'13-week rejection sweep','sweep_52':'52-week rejection sweep',
 'breakout_1':'Prior-week accepted breakout','breakout_4':'4-week accepted breakout',
 'breakout_13':'13-week accepted breakout','breakout_52':'52-week accepted breakout',
 'fvg_raw':'All three-candle FVGs','fvg_disp':'Displacement FVG','sweep_fvg':'Sweep → displacement FVG'}

def load_weekly(key):
 d=pd.read_csv(ROOT/'data'/f'{key}.csv',parse_dates=['week'],float_precision='round_trip').set_index('week')
 for col in ('valid_hlc','valid_ohlc'):d[col]=d[col].eq(True)
 # Invalid early history is retained in CSV, but irrelevant leading bars are removed here.
 first=np.flatnonzero(d.valid_hlc.values)[0]
 return d.iloc[first:].copy()

def detect(d):
 h,l,c=[d[x].where(d.valid_hlc) for x in ['high','low','close']]
 events=[];counts=[]
 def add(mask,rule,direction,extra=None):
  for i in np.flatnonzero(mask.fillna(False).values):
   e=dict(i=int(i),date=str(d.index[i].date()),rule=rule,direction=direction)
   if extra:
    for k,v in extra.items():e[k]=float(v.iloc[i])
   events.append(e)
 masks={}
 for k in (1,4,13,52):
  upper=h.shift(1).rolling(k,min_periods=k).max();lower=l.shift(1).rolling(k,min_periods=k).min()
  eligible=upper.notna()&lower.notna()&c.notna()
  up=(h>upper)&eligible;dn=(l<lower)&eligible;both=up&dn
  ss=dn&~up&(c>lower);bs=up&~dn&(c<upper)
  for side,mask in [(1,ss),(-1,bs)]:
   add(mask,f'sweep_{k}',side,dict(reference=lower if side==1 else upper))
  add(up&~dn&(c>upper),f'breakout_{k}',1,dict(reference=upper))
  add(dn&~up&(c<lower),f'breakout_{k}',-1,dict(reference=lower))
  counts.append(dict(lookback=k,eligible=int(eligible.sum()),both_sides=int(both.sum()),
    ssl_rejections=int(ss.sum()),bsl_rejections=int(bs.sum()),any_breach=int((up|dn).sum())))
  if k==1:masks={1:ss,-1:bs}
 valid3=c.notna().rolling(3,min_periods=3).sum().eq(3)
 prev=c.shift(1)
 tr=pd.concat([h-l,(h-prev).abs(),(l-prev).abs()],axis=1).max(axis=1)
 tr=tr.where(c.notna()&prev.notna())
 atr=tr.rolling(14,min_periods=14).mean()
 body=d.close.shift(1)-d.open.shift(1)
 for side,mask in [(1,(l>h.shift(2))&valid3),(-1,(h<l.shift(2))&valid3)]:
  lower=h.shift(2) if side==1 else h
  upper=l if side==1 else l.shift(2)
  bridge=(l.shift(1)<=lower)&(h.shift(1)>=upper)
  displacement=mask&bridge&(side*body>0)&(side*body>=.5*atr.shift(2))&d.valid_ohlc.shift(1,fill_value=False)
  extra=dict(lower=lower,upper=upper,ce=(lower+upper)/2,width_pct=(upper-lower)/c,
             bridge=bridge.astype(float))
  add(mask,'fvg_raw',side,extra)
  add(displacement,'fvg_disp',side,extra)
  prior=masks[side].shift(1,fill_value=False).rolling(3,min_periods=1).max().eq(1)
  add(displacement&prior,'sweep_fvg',side,extra)
 events.sort(key=lambda x:(x['i'],x['rule'],x['direction']))
 return events,counts

def forward(d,h):
 valid=d.valid_hlc.rolling(h+1,min_periods=h+1).sum().shift(-h).eq(h+1)
 r=(d.close.shift(-h)/d.close-1).where(valid)
 return r.values

def bootstrap_weights(n,B=1000,block=26):
 rng=np.random.default_rng(20260906+n)
 starts=rng.integers(0,n,size=(B,math.ceil(n/block)))
 idx=((starts[:,:,None]+np.arange(block))%n).reshape(B,-1)[:,:n]
 w=np.zeros((B,n),dtype=np.float64)
 for b in range(B):w[b]=np.bincount(idx[b],minlength=n)
 return w

def period_masks(n,h):
 split=int(n*.7);idx=np.arange(n)
 return {'all':np.ones(n,dtype=bool),'early':idx+h<split,'late':idx>=split}

def summarize(d,events,asset_id,ci_enabled=True):
 n=len(d);era=(d.index.year//10*10).values;w=bootstrap_weights(n) if ci_enabled else None
 groups={}
 for e in events:groups.setdefault((e['rule'],e['direction']),[]).append(e['i'])
 rows=[];eras=[]
 for horizon in HORIZONS:
  raw=forward(d,horizon)
  for period,pm in period_masks(n,horizon).items():
   r=np.where(pm,raw,np.nan);valid=np.isfinite(r)
   baseline=np.full(n,np.nan)
   for y in np.unique(era):
    ix=(era==y)&valid
    if ix.any():baseline[era==y]=r[ix].mean()
   for (rule,side),ids in groups.items():
    m=np.zeros(n,dtype=bool);m[ids]=True;m&=valid
    ix=np.flatnonzero(m);rr=side*r[ix];ex=side*(r[ix]-baseline[ix]);count=len(ix)
    row=dict(asset=asset_id,rule=rule,direction=side,horizon=horizon,period=period,
      formed=int(np.count_nonzero(np.isin(np.arange(n),ids)&pm)),n=count,
      mean=float(rr.mean()) if count else None,median=float(np.median(rr)) if count else None,
      sd=float(rr.std(ddof=1)) if count>1 else None,
      q25=float(np.quantile(rr,.25)) if count else None,q75=float(np.quantile(rr,.75)) if count else None,
      positive=float((rr>0).mean()) if count else None,baseline=float((side*baseline[ix]).mean()) if count else None,
      excess=float(ex.mean()) if count else None,ci_low=None,ci_high=None)
    if w is not None and period=='all' and horizon==4 and rule in PRIMARY and count>=20:
     # Resample entire timeline in 26-week blocks. Re-estimate decade baselines.
     nn=w@m.astype(float);num=w@np.where(m,np.nan_to_num(r),0)
     expected=np.zeros(len(w))
     for y in np.unique(era):
      v=valid&(era==y);me=m&(era==y)
      denom=w@v.astype(float)
      bmean=np.divide(w@np.where(v,np.nan_to_num(r),0),denom,out=np.zeros(len(w)),where=denom>0)
      expected+=(w@me.astype(float))*bmean
     values=np.divide(side*(num-expected),nn,out=np.full(len(w),np.nan),where=nn>0)
     row['ci_low'],row['ci_high']=map(float,np.nanquantile(values,[.025,.975]))
    rows.append(row)
    if horizon==4 and period=='all' and rule in PRIMARY:
     for y in np.unique(era):
      j=ix[era[ix]==y]
      if len(j):eras.append(dict(asset=asset_id,rule=rule,direction=side,era=int(y),n=len(j),
         mean=float((side*r[j]).mean()),excess=float((side*(r[j]-baseline[j])).mean())))
 return rows,eras

def revisit_one(d,e,h):
 i=e['i'];side=e['direction'];future=d.iloc[i+1:i+h+1]
 if len(future)!=h or not future.valid_hlc.all():return None
 levels={'edge':e['upper'] if side==1 else e['lower'],'ce':e['ce'],'far':e['lower'] if side==1 else e['upper']}
 result={}
 for name,level in levels.items():
  hits=(future.low<=level) if side==1 else (future.high>=level)
  loc=np.flatnonzero(hits.values)
  result[name+'_hit']=bool(len(loc));result[name+'_wait']=int(loc[0]+1) if len(loc) else None
  # Range-containing touch can occur after an initial opening jump beyond the level.
  result[name+'_range_touch']=bool(((future.low<=level)&(future.high>=level)).any())
  if len(loc):
   first=future.iloc[loc[0]]
   result[name+'_open_pass']=bool(first.valid_ohlc and (first.open<level if side==1 else first.open>level))
   result[name+'_open_known']=bool(first.valid_ohlc)
  else:result[name+'_open_pass']=False;result[name+'_open_known']=False
 return result

def revisits(d,events,asset_id):
 rows=[];logs=[]
 for rule in ('fvg_raw','fvg_disp','sweep_fvg'):
  for side in (1,-1):
   group=[e for e in events if e['rule']==rule and e['direction']==side]
   for h in (1,4,13,52):
    outcomes=[revisit_one(d,e,h) for e in group];full=[x for x in outcomes if x is not None]
    r=dict(asset=asset_id,rule=rule,direction=side,horizon=h,formed=len(group),n=len(full),censored=len(group)-len(full))
    for key in ('edge','ce','far'):
     hits=[x for x in full if x[key+'_hit']]
     r[key+'_hits']=len(hits);r[key+'_rate']=len(hits)/len(full) if full else None
     r[key+'_range_touches']=sum(x[key+'_range_touch'] for x in full)
     r[key+'_open_passes']=sum(x[key+'_open_pass'] for x in full)
     r[key+'_open_known']=sum(x[key+'_open_known'] for x in full)
     r[key+'_median_wait']=float(np.median([x[key+'_wait'] for x in hits])) if hits else None
    rows.append(r)
    if h==13:
     for e,outcome in zip(group,outcomes):logs.append({**e,'asset':asset_id,'followup13':outcome})
 return rows,logs

def mechanical(d,events,asset_id):
 trades=[];summary=[]
 for rule in ('sweep_1','sweep_fvg'):
  group=[e for e in events if e['rule']==rule];last_exit=-1;selected=[];skipped_overlap=0;unavailable=0
  for e in group:
   i=e['i'];entry=i+1;end=i+4
   if entry<=last_exit:skipped_overlap+=1;continue
   if end>=len(d) or not d.valid_hlc.iloc[i:end+1].all() or not d.valid_ohlc.iloc[entry]:unavailable+=1;continue
   s=e['direction'];gross=float(s*(d.close.iloc[end]/d.open.iloc[entry]-1))
   # Price-return arithmetic only; no compounded capital or futures sizing assumptions.
   t=dict(asset=asset_id,rule=rule,direction=s,signal=e['date'],entry=str(d.index[entry].date()),
    exit=str(d.index[end].date()),entry_open=float(d.open.iloc[entry]),exit_close=float(d.close.iloc[end]),
    gross=gross,net10=gross-.001,net25=gross-.0025)
   selected.append(t);last_exit=end
  trades.extend(selected)
  for cost,key in [(0,'gross'),(10,'net10'),(25,'net25')]:
   r=np.array([t[key] for t in selected]);loss=-r[r<0].sum();profit=r[r>0].sum()
   summary.append(dict(asset=asset_id,rule=rule,cost_bps=cost,n=len(r),
    mean=float(r.mean()) if len(r) else None,median=float(np.median(r)) if len(r) else None,
    positive=float((r>0).mean()) if len(r) else None,profit_factor=float(profit/loss) if loss>0 else None,
    skipped_overlap=skipped_overlap,unavailable=unavailable))
 return summary,trades

def clean(value):
 if isinstance(value,dict):return {k:clean(v) for k,v in value.items()}
 if isinstance(value,list):return [clean(v) for v in value]
 if isinstance(value,(float,np.floating)):return float(value) if np.isfinite(value) else None
 if isinstance(value,(int,np.integer)):return int(value)
 return value

def main():
 metadata=json.loads((ROOT/'results'/'metadata.json').read_text())
 summary=[];eras=[];fills=[];trades=[];trade_summary=[];events_all=[];counts=[];examples={};price={}
 for m in metadata:
  key=m['id'];d=load_weekly(key);events,audit=detect(d)
  forward_returns={h:forward(d,h) for h in HORIZONS}
  for e in events:
   e['asset']=key
   e['signal_close']=float(d.close.iloc[e['i']])
   for h in HORIZONS:
    r=forward_returns[h][e['i']];e[f'return_{h}']=float(e['direction']*r) if np.isfinite(r) else None
  events_all.extend(events)
  ci=m['kind'] not in ('adjustment sensitivity',)
  rows,ee=summarize(d,events,key,ci);summary+=rows;eras+=ee
  ff,logs=revisits(d,events,key);fills+=ff
  mm,tt=mechanical(d,events,key);trade_summary+=mm;trades+=tt
  counts += [dict(asset=key,**a) for a in audit]
  # Deterministically select earliest fully observed bullish/bearish combination,
  # otherwise displacement, after 2000; selection is not based on the outcome.
  examples[key]=[]
  for side in (1,-1):
   candidates=[e for e in events if e['rule']=='sweep_fvg' and e['direction']==side and e['date']>='2000-01-01' and e['i']+13<len(d)]
   if not candidates:candidates=[e for e in events if e['rule']=='fvg_disp' and e['direction']==side and e['i']+13<len(d)]
   if candidates:
    e=candidates[0];window=d.iloc[max(0,e['i']-5):e['i']+14]
    examples[key].append(dict(event=e,candles=[[str(idx.date())]+[float(row[c]) for c in COLS]+[bool(row.valid_hlc)] for idx,row in window.iterrows()]))
  price[key]=[[str(idx.date()),float(row.close) if row.valid_hlc else None] for idx,row in d.iloc[::max(1,len(d)//480)].iterrows()]
  m['analysis_start']=str(d.index[0].date());m['split_date']=str(d.index[int(len(d)*.7)].date());m['formed_events']=len(events)
  print(key,'weeks',len(d),'events',len(events),flush=True)
 payload=clean(dict(metadata=metadata,summary=summary,eras=eras,fills=fills,trade_summary=trade_summary,
             breach_counts=counts,examples=examples,price=price,labels=LABELS))
 dump(ROOT/'results'/'study.json',payload)
 for name,rows in [('summary',summary),('era_results',eras),('fvg_revisits',fills),('mechanical_summary',trade_summary),
                   ('mechanical_trades',trades),('events',events_all),('breach_counts',counts)]:
  pd.DataFrame(rows).to_csv(ROOT/'results'/f'{name}.csv',index=False,float_format='%.17g')
 dump(ROOT/'results'/'run_checksums.json',{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'results').glob('*.csv')})

if __name__=='__main__':main()
