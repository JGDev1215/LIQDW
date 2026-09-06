"""Package an offline interactive research report with all numeric evidence."""
from pathlib import Path
import json, csv, html
from prepare import ROOT

def compact(value):return json.dumps(value,separators=(',',':'),ensure_ascii=False,allow_nan=False).replace('</','<\\/')

def build():
 study=json.loads((ROOT/'results/study.json').read_text())
 sources=json.loads((ROOT/'SOURCES.json').read_text())
 evfields=['asset','date','rule','direction','signal_close','reference','lower','upper','ce','return_1','return_4','return_13']
 events=[]
 with (ROOT/'results/events.csv').open() as f:
  for row in csv.DictReader(f):
   events.append([row[x] if i<3 else (float(row[x]) if row[x] else None) for i,x in enumerate(evfields)])
 data_csv={m['id']:(ROOT/'data'/f"{m['id']}.csv").read_text() for m in study['metadata']}
 trades=(ROOT/'results/mechanical_trades.csv').read_text()
 template=(ROOT/'report_template.html').read_text()
 out=template.replace('__CHARTJS__',(ROOT/'chart.umd.min.js').read_text())
 out=out.replace('__STUDY__',compact(study)).replace('__SOURCES__',compact(sources))
 out=out.replace('__EVENTS__',compact(events)).replace('__EVFIELDS__',compact(evfields))
 out=out.replace('__WEEKLY_CSV__',compact(data_csv)).replace('__TRADES_CSV__',compact(trades))
 out=out.replace('__PROTOCOL__',html.escape((ROOT/'PROTOCOL.md').read_text()))
 out=out.replace('__AUDIT_LOG__',html.escape((ROOT/'AUDIT_LOG.md').read_text()))
 out=out.replace('__MANIFEST__',html.escape((ROOT/'results/manifest.json').read_text()))
 (ROOT/'weekly_liquidity_backtest.html').write_text(out)
 print('HTML bytes',len(out.encode()),'embedded events',len(events),'series',len(study['metadata']))

if __name__=='__main__':build()
