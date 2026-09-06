"""Independent sampled aggregation directly from read-only local SQLite."""
import sqlite3,json,math
from datetime import datetime,date,time,timedelta,timezone
from zoneinfo import ZoneInfo
import pandas as pd
from prepare import ROOT

def run():
 d=pd.read_csv(ROOT/'data/NQ_LOCAL_FIXED.csv',float_precision='round_trip')
 sample=d[d.valid_hlc].sample(5,random_state=20260906)
 c=sqlite3.connect(f'file:{ROOT.parents[1]/"nq_ohlc_data.db"}?mode=ro',uri=True,timeout=30)
 c.execute('PRAGMA query_only=ON');checks=[]
 for _,b in sample.iterrows():
  day=date.fromisoformat(b.week);ny=ZoneInfo('America/New_York')
  start=datetime.combine(day-timedelta(days=5),time(18),ny).astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
  end=datetime.combine(day,time(17),ny).astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
  raw=c.execute('SELECT timestamp_utc,open,high,low,close FROM candles WHERE instrument=? AND timeframe=? AND timestamp_utc>=? AND timestamp_utc<? ORDER BY timestamp_utc',('NQ',1,start,end)).fetchall()
  rows=[r for r in raw if datetime.fromisoformat(r[0].replace('Z','+00:00')).astimezone(ny).hour!=17]
  ref=[rows[0][1],max(r[2] for r in rows),min(r[3] for r in rows),rows[-1][4]]
  assert all(math.isclose(a,v,rel_tol=1e-12) for a,v in zip(ref,[b.open,b.high,b.low,b.close]))
  assert len(rows)==b.source_rows
  checks.append(dict(week=b.week,minutes=len(rows),ohlc=ref))
 c.close()
 result={'status':'PASS','independent_sql_weeks':checks}
 (ROOT/'results/local_aggregation_verification.json').write_text(json.dumps(result,indent=2))
 print(json.dumps(result,indent=2))

if __name__=='__main__':run()
