import copy
import json
import sqlite3
from debtmonster.core import Store


def test_ui_only_upgrade_and_legacy_backup(tmp_path):
    store = Store(tmp_path / 'original')
    store.setup(starting_debt_cents=100000)
    store.apply_commands([('P',10000)], inbound_id='historical-message')
    store.switch_mode('savings', starting_savings_cents=20000, savings_goal_cents=100000)
    store.apply_commands([('S',1000)])
    old = copy.deepcopy(store.export_backup())
    old['version'] = 1
    old['tables']['settings'].append({'key':'email_enabled','value':'true'})
    old['tables']['checkins'] = []
    old['tables']['inbound'] = []
    with store.connect() as db:
        db.execute('PRAGMA user_version=1')
        db.execute('INSERT INTO settings VALUES (?,?)', ('email_enabled',json.dumps(True)))
        db.execute('CREATE TABLE checkins (id TEXT PRIMARY KEY)')
        db.execute('INSERT INTO checkins VALUES (?)', ('legacy-checkin',))
    before = store.status()
    upgraded = Store(tmp_path / 'original')
    assert upgraded.status()['transactions'] == before['transactions']
    assert upgraded.status()['balance_cents'] == 21000
    assert upgraded.status()['event_cursor'] == before['event_cursor']
    assert upgraded.status('debt')['balance_cents'] == 90000
    assert 'email_enabled' not in upgraded.get_settings()
    paths = list((tmp_path / 'original' / 'backups').glob('*.sqlite3'))
    assert len(paths) == 1
    with sqlite3.connect(paths[0]) as backup:
        assert backup.execute('SELECT value FROM settings WHERE key="email_enabled"').fetchone()[0] == 'true'
    Store(tmp_path / 'original')
    assert len(list((tmp_path / 'original' / 'backups').glob('*.sqlite3'))) == 1
    target = Store(tmp_path / 'restored')
    target.restore_backup(old, confirmed=True)
    assert target.status()['balance_cents'] == 21000
    assert target.status('debt')['transactions'][0]['inbound_id'] == 'historical-message'
    assert set(target.export_backup()['tables']) == {'settings','transactions','events','milestones'}
    assert 'email_enabled' not in target.get_settings()
