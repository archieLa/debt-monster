import copy
import tempfile
import unittest
from debtmonster.core import Store, parse_amount, parse_commands


class CoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store = Store(self.tmp.name)

    def test_strict_money_and_atomic_parser(self):
        self.assertEqual(parse_amount('12.3'),1230)
        for bad in ('0','-1','nan','Infinity','12.345','1,200','1e2','+1'):
            with self.subTest(bad=bad), self.assertRaises(ValueError): parse_amount(bad)
        self.assertEqual(parse_commands(' c 42, P 200 ','debt'),[('C',4200),('P',20000)])
        self.assertEqual(parse_commands(' n '),[])
        for bad in ('P 1,200','P 10\nN','P 5, C 0','S 1','P 12,50','P 2\nThanks'):
            with self.subTest(bad=bad), self.assertRaises(ValueError): parse_commands(bad)

    def test_debt_growth_credit_and_restart(self):
        self.store.setup(starting_debt_cents=10000)
        self.store.apply_commands([('C',5000)])
        self.assertEqual(self.store.status()['balance_cents'],15000)
        self.assertEqual(self.store.status()['progress'],0)
        self.store.apply_commands([('P',18000)])
        status=Store(self.tmp.name).status()
        self.assertEqual(status['balance_cents'],-3000)
        self.assertEqual(status['credit_cents'],3000)
        self.assertEqual(status['remaining_cents'],0)
        self.assertEqual(status['progress'],100)
        self.assertEqual(status['net_reduction_cents'],13000)

    def test_zero_start_and_payoff_once_per_crossing(self):
        self.store.setup()
        self.assertIsNone(self.store.status()['progress'])
        self.assertEqual(self.store.events(),[])
        self.store.apply_commands([('C',100),('P',100),('P',100)])
        self.assertEqual(sum(e['kind']=='payoff' for e in self.store.events()),1)
        self.store.apply_commands([('C',200),('P',100)])
        self.assertEqual(sum(e['kind']=='payoff' for e in self.store.events()),2)

    def test_corrections_no_celebrations_and_trends(self):
        self.store.setup(starting_debt_cents=10000)
        ids=self.store.apply_commands([('P',3000),('C',1000)],effective_at='2026-10-03')
        cursor=self.store.status()['event_cursor']
        self.store.edit_transaction(ids[0],'P',2000,note='fixed')
        self.assertEqual(self.store.status()['balance_cents'],9000)
        self.assertEqual([e['kind'] for e in self.store.events(cursor)],['correction'])
        self.assertEqual(self.store.status()['monthly'],[{'month':'2026-10','net_cents':1000}])
        self.assertEqual([p['balance_cents'] for p in self.store.status()['trend']],[10000,8000,9000])
        self.store.delete_transaction(ids[1])
        self.assertEqual(self.store.status()['balance_cents'],8000)

    def test_savings_preserves_debt_history_and_mode(self):
        self.store.setup(starting_debt_cents=100)
        self.store.apply_commands([('P',200)])
        self.store.switch_mode('savings',starting_savings_cents=0,savings_goal_cents=1000)
        self.store.apply_commands([('W',200)])
        self.assertEqual(self.store.status()['balance_cents'],-200)
        self.assertEqual(self.store.status()['progress'],0)
        self.store.apply_commands([('S',1400)])
        self.assertEqual(self.store.status()['balance_cents'],1200)
        self.assertEqual(self.store.status()['progress'],100)
        self.assertEqual(self.store.status('debt')['balance_cents'],-100)
        with self.assertRaises(ValueError): self.store.apply_commands([('P',100)],mode='debt')
        self.assertEqual(len(self.store.status('debt')['transactions']),1)
        self.assertEqual(Store(self.tmp.name).get_settings()['mode'],'savings')

    def test_backup_round_trip_and_invalid_preserves_live_data(self):
        self.store.setup(starting_debt_cents=10000)
        self.store.apply_commands([('P',1000)])
        backup=self.store.export_backup()
        self.store.apply_commands([('C',200)])
        invalid=copy.deepcopy(backup)
        invalid['tables']['transactions'][0]['amount_cents']=-100
        with self.assertRaises(ValueError): self.store.restore_backup(invalid,True)
        self.assertEqual(self.store.status()['balance_cents'],9200)
        with self.assertRaises(ValueError): self.store.restore_backup(backup)
        path=self.store.restore_backup(backup,True)
        self.assertTrue(path.endswith('.sqlite3'))
        self.assertEqual(self.store.status()['balance_cents'],9000)
        self.assertEqual(self.store.export_backup()['tables'],backup['tables'])

    def test_atomic_validation_and_milestones(self):
        self.store.setup(starting_debt_cents=10000)
        with self.assertRaises(ValueError): self.store.apply_commands([('P',1000),('C',0)])
        self.assertEqual(self.store.status()['transactions'],[])
        self.store.apply_commands([('P',5000)])
        self.assertEqual(self.store.status()['milestones'],[10,25,50])
        cursor=self.store.status()['event_cursor']
        self.store.apply_commands([('C',100),('P',100)])
        self.assertFalse(any(e['kind']=='milestone' for e in self.store.events(cursor)))


if __name__=='__main__': unittest.main()


def test_event_balance_snapshots_for_chomp_counter(tmp_path):
    store = Store(tmp_path)
    store.setup(starting_debt_cents=10000)
    store.apply_commands([('P',5000),('C',5000),('P',12000)])
    changes = [event for event in store.events() if event['kind'] in ('payment','change')]
    assert [(event['payload']['before_balance_cents'],event['payload']['balance_cents']) for event in changes] == [(10000,5000),(5000,10000),(10000,-2000)]
    assert store.status()['credit_cents'] == 2000
