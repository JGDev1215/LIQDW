import unittest
import numpy as np
import pandas as pd
from analyze import detect,forward,revisit_one,mechanical,period_masks
from prepare import weekly

def frame(rows):
 d=pd.DataFrame(rows,columns=['open','high','low','close'],index=pd.date_range('2000-01-07',periods=len(rows),freq='W-FRI'))
 d['valid_hlc']=True;d['valid_ohlc']=True
 return d

class PatternTests(unittest.TestCase):
 def test_strict_prior_extreme_and_both_sides(self):
  d=frame([[10,12,8,10],[10,12,8,10],[10,11,7,9],[9,13,6,10],[10,14,8,12]])
  e,c=detect(d)
  sweeps=[(x['i'],x['direction']) for x in e if x['rule']=='sweep_1']
  self.assertEqual(sweeps,[(2,1),(4,-1)])
  self.assertEqual(c[0]['both_sides'],1)
  self.assertFalse(any(x['i']==1 for x in e if x['rule']=='sweep_1'))
  self.assertEqual(next(x for x in e if x['i']==2 and x['rule']=='sweep_1')['reference'],8)
  d.iloc[4,d.columns.get_loc('close')]=13
  self.assertFalse(any(x['i']==4 and x['rule']=='sweep_1' for x in detect(d)[0]))

 def test_gap_and_no_formation_revisit(self):
  d=frame([[9,10,8,9],[10,15,9,14],[14,16,12,15],[15,17,13,16],[16,18,10,17]])
  e,_=detect(d);gap=next(x for x in e if x['rule']=='fvg_raw' and x['i']==2)
  self.assertEqual((gap['lower'],gap['ce'],gap['upper']),(10,11,12))
  one=revisit_one(d,gap,1);two=revisit_one(d,gap,2)
  self.assertFalse(one['edge_hit']);self.assertTrue(two['far_hit']);self.assertEqual(two['ce_wait'],2)
  d.loc[d.index[3],'valid_hlc']=False
  self.assertIsNone(revisit_one(d,gap,2))

 def test_bearish_fvg_and_open_pass(self):
  d=frame([[15,17,14,16],[15,16,9,10],[10,12,8,9],[16,18,15,17]])
  e,_=detect(d);gap=next(x for x in e if x['rule']=='fvg_raw' and x['i']==2)
  self.assertEqual(gap['direction'],-1)
  r=revisit_one(d,gap,1)
  self.assertTrue(r['ce_hit']);self.assertTrue(r['ce_open_pass']);self.assertFalse(r['ce_range_touch'])

 def test_displacement_sequence_and_known_information(self):
  rows=[[10,12,8,10] for _ in range(20)]+[[10,11,7,9],[9,17,9,16],[16,18,13,17],[17,18,14,16]]
  d=frame(rows);e,_=detect(d)
  combo=[x for x in e if x['rule']=='sweep_fvg']
  self.assertEqual([(x['i'],x['direction']) for x in combo],[(22,1)])
  self.assertFalse(any(x['i']<=21 for x in e if x['rule']=='sweep_fvg'))
  self.assertEqual(detect(d.iloc[:23])[0],[x for x in e if x['i']<23])
  altered=d.copy();altered.iloc[23,:4]=[100,200,50,150]
  self.assertEqual([x for x in detect(altered)[0] if x['i']<23],[x for x in e if x['i']<23])
  d.loc[d.index[21],'valid_ohlc']=False
  self.assertFalse(any(x['rule']=='fvg_disp' and x['i']==22 for x in detect(d)[0]))

 def test_next_open_and_nonoverlap(self):
  d=frame([[10+i,12+i,9+i,11+i] for i in range(14)])
  events=[dict(i=i,date=str(d.index[i].date()),rule='sweep_1',direction=1) for i in range(8)]
  s,t=mechanical(d,events,'TEST')
  self.assertEqual([x['entry'] for x in t],[str(d.index[1].date()),str(d.index[5].date())])
  self.assertAlmostEqual(t[0]['gross'],d.close.iloc[4]/d.open.iloc[1]-1)
  self.assertAlmostEqual(t[0]['net10'],t[0]['gross']-.001)
  self.assertAlmostEqual(forward(d,4)[0],d.close.iloc[4]/d.close.iloc[0]-1)
  d.loc[d.index[2],'valid_hlc']=False
  self.assertTrue(np.isnan(forward(d,4)[0]))

 def test_split_purges_cross_boundary(self):
  masks=period_masks(100,4)
  self.assertTrue(masks['early'][65]);self.assertFalse(masks['early'][66])
  self.assertFalse(masks['late'][69]);self.assertTrue(masks['late'][70])

 def test_zero_volume_weeks_are_not_bridged(self):
  d=frame([[10,12,8,10] for _ in range(25)])
  d.index=pd.bdate_range('2000-01-03',periods=25)
  d['volume']=100
  d.loc[d.index[10:15],'volume']=0
  w,a=weekly(d,is_stock=True)
  self.assertFalse(w.valid_hlc.iloc[2])
  self.assertEqual(a['excluded_zero_volume_rows'],5)
  self.assertEqual(w.source_rows.iloc[2],0)

if __name__=='__main__':unittest.main(verbosity=2)
