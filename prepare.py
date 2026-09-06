"""Build reproducible weekly research inputs without writing market storage."""
from pathlib import Path
import json, hashlib, sqlite3, platform
from datetime import datetime, timezone
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
CUTOFF = pd.Timestamp('2026-09-04')
FIXED_END = '2026-08-11T22:49:00Z'
COLS = ['open', 'high', 'low', 'close']
ASSETS = {
 'NQ_YAHOO': ('NQ futures · Yahoo continuation', 'futures', None),
 'NDX': ('Nasdaq-100 cash index', 'index', None),
 'SP500': ('S&P 500 · HLC from 1962', 'index', None),
 'STORA': ('Stora Enso', 'old-origin stock', 1288),
 'MPS': ('Monte dei Paschi di Siena', 'old-origin stock', 1472),
 'ORELL': ('Orell Füssli', 'old-origin stock', 1519),
 'MATSUI': ('Matsui Construction', 'old-origin stock', 1586),
 'SUMITOMO': ('Sumitomo Metal Mining', 'old-origin stock', 1590),
 'BNY': ('BNY · listing-history check', 'long-listing stock', 1784),
 'ED': ('Con Edison · listing-history check', 'long-listing stock', 1823),
}

def sha(path):
 return hashlib.sha256(path.read_bytes()).hexdigest()

def dump(path, value):
 path.write_text(json.dumps(value, indent=2, default=str, allow_nan=False))

def weekly(d, is_sp=False, is_stock=False):
 d = d.copy().sort_index()
 original_null = d[COLS].isna().all(axis=1)
 no_volume = d.volume.fillna(0).le(0) if is_stock else pd.Series(False,index=d.index)
 # No reported equity trades: do not turn vendor carried quotes into traded OHLC.
 d.loc[no_volume,COLS] = np.nan
 finite = np.isfinite(d[COLS]).all(axis=1)
 positive = d[COLS].gt(0).all(axis=1)
 tol = d.close.abs() * 1e-6
 hlc = np.isfinite(d[['high','low','close']]).all(axis=1) & d[['high','low','close']].gt(0).all(axis=1)
 hlc &= (d.high + tol >= d.close) & (d.low - tol <= d.close) & (d.high >= d.low)
 ohlc = hlc & finite & positive & (d.high + tol >= d.open) & (d.low - tol <= d.open)
 # Clamp only tiny floating point vendor inconsistencies; never substantive errors.
 near = hlc & ((d.high < d.close) | (d.low > d.close))
 d.loc[hlc,'high'] = d.loc[hlc,['high','close']].max(axis=1)
 d.loc[hlc,'low'] = d.loc[hlc,['low','close']].min(axis=1)
 d['valid_hlc'],d['valid_ohlc'] = hlc,ohlc
 if is_sp:
  d.loc[d.index < '1962-01-01', ['valid_hlc','valid_ohlc']] = False
  d.loc[d.index < '1982-04-26', 'valid_ohlc'] = False
 # Entirely null source rows are not treated as real session records.
 allnull = d[COLS].isna().all(axis=1)
 partialnull = d[COLS].isna().any(axis=1) & ~allnull
 d['allnull'] = allnull
 d['bad_hlc'] = ~d.valid_hlc & ~allnull
 d['bad_ohlc'] = ~d.valid_ohlc & ~allnull
 d['first_date'] = d.index
 g = d.resample('W-FRI')
 w = g.agg(open=('open','first'), high=('high','max'),low=('low','min'),close=('close','last'),
           source_rows=('close','count'),bad_hlc=('bad_hlc','sum'),bad_ohlc=('bad_ohlc','sum'),
           first_date=('first_date','min'),last_date=('first_date','max'),null_rows=('allnull','sum'))
 w['valid_hlc'] = (w.source_rows > 0) & (w.bad_hlc == 0)
 w['valid_ohlc'] = w.valid_hlc & (w.bad_ohlc == 0)
 # Drop first calendar bucket conservatively, even if first session was a holiday Tuesday.
 w.loc[w.index[0], ['valid_hlc','valid_ohlc']] = False
 w = w.loc[w.index <= CUTOFF]
 # Do not erase invalid prices from the evidence; feature engine uses validity masks.
 audit = dict(daily_rows=len(d), daily_start=str(d.index.min().date()),daily_end=str(d.index.max().date()),
  null_daily_rows=int(original_null.sum()),excluded_zero_volume_rows=int(no_volume.sum()),partial_null_daily_rows=int(partialnull.sum()),
  invalid_hlc_rows=int((~hlc&~allnull).sum()),invalid_ohlc_rows=int((~ohlc&~allnull).sum()),
  float_clamps=int(near.sum()),flat_daily_rows=int((d.high==d.low).sum()),
  calendar_weeks=len(w),valid_hlc_weeks=int(w.valid_hlc.sum()),valid_ohlc_weeks=int(w.valid_ohlc.sum()),
  missing_weeks=int((w.source_rows==0).sum()),short_weeks=int(((w.source_rows>0)&(w.source_rows<4)).sum()))
 return w,audit

def save_asset(key, w, info):
 w.index.name = 'week'
 w.to_csv(ROOT/'data'/f'{key}.csv',float_format='%.17g')
 # Summary uses first/last eligible HLC bars; invalid interior weeks remain in CSV.
 valid = w.index[w.valid_hlc]
 info.update(id=key,start=str(valid.min().date()),end=str(valid.max().date()),weeks=len(w),
             valid_weeks=int(w.valid_hlc.sum()),ohlc_weeks=int(w.valid_ohlc.sum()),
             weekly_sha256=sha(ROOT/'data'/f'{key}.csv'))
 return info

def local_weekly():
 db = ROOT.parents[1]/'nq_ohlc_data.db'
 conn = sqlite3.connect(f'file:{db}?mode=ro',uri=True)
 conn.execute('PRAGMA query_only=ON')
 sql = 'SELECT timestamp_utc,open,high,low,close FROM candles WHERE instrument=? AND timeframe=? ORDER BY timestamp_utc'
 buckets=[]; digest=hashlib.sha256(); total=0; outside=0; first=None;last=None
 for x in pd.read_sql_query(sql,conn,params=('NQ',1),chunksize=200000):
  digest.update(x.to_csv(index=False,header=False,float_format='%.10g').encode())
  total+=len(x);first=first or x.timestamp_utc.iloc[0];last=x.timestamp_utc.iloc[-1]
  t=pd.to_datetime(x.timestamp_utc,utc=True).dt.tz_convert('America/New_York')
  day=t.dt.dayofweek;hour=t.dt.hour
  inside=((day==6)&(hour>=18))|((day>=0)&(day<=3)&(hour!=17))|((day==4)&(hour<17))
  outside+=int((~inside).sum());x=x.loc[inside].copy();t=t.loc[inside]
  # Trading session date advances at 18:00 ET, including Sunday -> Monday.
  session=t.dt.tz_localize(None).dt.normalize()+pd.to_timedelta((t.dt.hour>=18).astype(int),unit='D')
  x['week']=session+pd.to_timedelta(4-session.dt.dayofweek,unit='D')
  x['session']=session
  x['bad']=~(np.isfinite(x[COLS]).all(axis=1)&x[COLS].gt(0).all(axis=1)&
             x.high.ge(x[['open','close']].max(axis=1))&x.low.le(x[['open','close']].min(axis=1)))
  a=x.groupby('week',sort=True).agg(open=('open','first'),high=('high','max'),low=('low','min'),close=('close','last'),
   source_rows=('close','size'),bad=('bad','sum'),first_date=('timestamp_utc','first'),last_date=('timestamp_utc','last'))
  buckets.append(a)
 conn.close()
 p=pd.concat(buckets)
 w=p.groupby(level=0,sort=True).agg(open=('open','first'),high=('high','max'),low=('low','min'),close=('close','last'),
   source_rows=('source_rows','sum'),bad=('bad','sum'),first_date=('first_date','first'),last_date=('last_date','last'))
 w=w.reindex(pd.date_range(w.index.min(),CUTOFF,freq='W-FRI'))
 w['valid_hlc']=(w.source_rows>=6000)&(w.bad==0)
 w['valid_ohlc']=w.valid_hlc
 w['segment']=np.where(w.last_date.fillna('')<=FIXED_END,'fixed','mutable-or-mixed')
 info=dict(name='NQ local · ≥6,000 minutes / week',kind='futures',symbol='NQ / 1-minute SQLite',currency='USD',
  source='NQ_DATABASE_INSTRUCTIONS.md',origin=None,raw_sha256=digest.hexdigest(),
  audit=dict(source_rows=total,source_first_utc=first,source_last_utc=last,outside_session_rows=outside,
             sparse_weeks=int((w.source_rows<6000).sum()),missing_weeks=int(w.source_rows.isna().sum()),
             coverage_rule='At least 6,000 observed minutes. Deliberately also excludes some holiday weeks. Not certified gap-free.',
             fixed_end_utc=FIXED_END))
 return w,info

def main():
 metadata=[]
 for key,(name,kind,origin) in ASSETS.items():
  p=ROOT/'raw'/f'{key}.json';r=json.loads(p.read_text())['chart']['result'][0]
  d=pd.DataFrame(r['indicators']['quote'][0])
  # NQ daily timestamps encode session dates at midnight New York; use vendor timezone.
  dates=pd.to_datetime(r['timestamp'],unit='s',utc=True).tz_convert(r['meta']['exchangeTimezoneName']).tz_localize(None).normalize()
  d.index=dates
  assert not d.index.duplicated().any(),key
  w,audit=weekly(d,is_sp=key=='SP500',is_stock='stock' in kind)
  info=dict(name=name,kind=kind,origin=origin,symbol=r['meta']['symbol'],currency=r['meta']['currency'],
   source=(ROOT/'raw'/f'{key}.url.txt').read_text(),raw_sha256=sha(p),audit=audit,
   timezone=r['meta']['exchangeTimezoneName'])
  if key=='SP500':
   audit['excluded_close_copy_rows']=int((dates<'1962-01-01').sum())
   audit['early_open_note']='Before 1982-04-26, opening-price provenance is insufficient. HLC-only events allowed; displacement and next-open tests disabled.'
   early=d.loc[(d.index>='1962-01-01')&(d.index<'1982-04-26')]
   audit['early_open_equals_previous_close_fraction']=float((early.open.iloc[1:].values==early.close.iloc[:-1].values).mean())
  metadata.append(save_asset(key,w,info))
  if 'stock' in kind:
   adjusted=d.copy();factor=np.array(r['indicators']['adjclose'][0]['adjclose'],dtype=float)/d.close.values
   adjusted[COLS]=adjusted[COLS].multiply(factor,axis=0)
   aw,aa=weekly(adjusted,is_stock=True)
   adjinfo={**info,'name':name+' · dividend-adjusted','kind':'adjustment sensitivity','audit':aa,'base_id':key}
   metadata.append(save_asset(key+'_ADJ',aw,adjinfo))
  if key=='SP500':
   mw=w.loc[w.index>='1982-04-30'].copy()
   metadata.append(save_asset('SP500_MODERN',mw,{**info,'name':'S&P 500 · 1982+ OHLC check','kind':'era sensitivity','base_id':key}))
 lw,li=local_weekly()
 metadata.append(save_asset('NQ_LOCAL_SNAPSHOT',lw,li))
 fw=lw.loc[lw.index<='2026-08-07'].copy()
 metadata.append(save_asset('NQ_LOCAL_FIXED',fw,{**li,'name':'NQ local · fixed segment / coverage filter','kind':'futures verification'}))
 dump(ROOT/'results'/'metadata.json',metadata)
 dump(ROOT/'results'/'manifest.json',dict(created_utc=datetime.now(timezone.utc).isoformat(),cutoff='2026-09-04',
  protocol_sha256=sha(ROOT/'PROTOCOL.md'),python=platform.python_version(),numpy=np.__version__,pandas=pd.__version__,
  raw_files={p.name:sha(p) for p in (ROOT/'raw').glob('*.json')},
  db_access='mode=ro; PRAGMA query_only=ON; SELECT only; no source copying',selected_assets=list(ASSETS),
  stock_selection='Five very old documented operating origins; not certified exhaustive worldwide top-five. BNY and ED are listing-history checks.'))
 for m in metadata:
  print(m['id'],m['start'],m['end'],m['valid_weeks'],'HLC;',m['ohlc_weeks'],'OHLC')

if __name__=='__main__':main()
