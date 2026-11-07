"""Local ledger. All money is integer cents; balances are derived, never stored."""
import json
from contextlib import closing
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

MAX_CENTS = 999_999_999_999
KINDS = {'P': 'debt', 'C': 'debt', 'S': 'savings', 'W': 'savings'}
DEFAULTS = dict(initialized=False, mode='debt', starting_debt_cents=0, starting_savings_cents=0,
                savings_goal_cents=None, currency='USD', rotate_display=False)
FINANCIAL_TABLES = {'settings', 'transactions', 'events', 'milestones'}
LEGACY_SETTINGS = {'email_enabled', 'recipient', 'daily_time', 'timezone', 'confirm_success',
                   'transport', 'smtp_host', 'smtp_port', 'smtp_username', 'smtp_security',
                   'smtp_user', 'imap_user', 'imap_mailbox', 'email_sender', 'imap_host', 'imap_port', 'imap_username', 'mailbox'}


def now():
    return datetime.now(timezone.utc).isoformat(timespec='microseconds')


def cents(value, allow_zero=False):
    if type(value) is not int or value < (0 if allow_zero else 1) or value > MAX_CENTS:
        raise ValueError('Amount must be an integer number of cents between %s and %s.' % (0 if allow_zero else 1, MAX_CENTS))
    return value


def parse_amount(value, allow_zero=False):
    value = str(value).strip()
    if not re.fullmatch(r'\d+(?:\.\d{1,2})?', value):
        raise ValueError('Use a positive amount with at most two decimal places, without commas.')
    whole, _, fraction = value.partition('.')
    return cents(int(whole) * 100 + int(fraction.ljust(2, '0') or '0'), allow_zero)


def parse_commands(text, mode='debt'):
    if not isinstance(text, str) or not text.strip():
        raise ValueError('Enter a transaction command.')
    comma_parts = text.strip().split(',')
    if any(not part.strip() for part in comma_parts):
        raise ValueError('Commas must separate complete commands.')
    parts = [line for part in comma_parts for line in part.splitlines() if line.strip()]
    if len(parts) == 1 and parts[0].strip().upper() == 'N':
        return []
    commands = []
    for part in parts:
        match = re.fullmatch(r'([PCSWpcsw])\s+(\d+(?:\.\d{1,2})?)', part.strip())
        if not match:
            raise ValueError('Use commands only; N must appear alone. Commas separate commands, not digits.')
        code = match[1].upper()
        if KINDS[code] != mode:
            raise ValueError('Command does not match the current %s mode.' % mode)
        commands.append((code, parse_amount(match[2])))
    return commands


def timestamp(value=None):
    if value is None or value == '':
        return now()
    try:
        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat(timespec='microseconds')
    except (ValueError, AttributeError):
        raise ValueError('Invalid transaction date.')


class ClosingConnection(sqlite3.Connection):
    def __exit__(self, *args):
        try:
            return super().__exit__(*args)
        finally:
            self.close()


class Store:
    def __init__(self, data_dir):
        self.data_dir = Path(data_dir).expanduser()
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.path = self.data_dir / 'debtmonster.sqlite3'
        with self.connect() as db:
            previous_version = db.execute('PRAGMA user_version').fetchone()[0]
        if previous_version == 1:
            self.sqlite_backup()
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS transactions(id INTEGER PRIMARY KEY AUTOINCREMENT,
                  effective_at TEXT NOT NULL, created_at TEXT NOT NULL, kind TEXT NOT NULL,
                  amount_cents INTEGER NOT NULL CHECK(amount_cents>0), note TEXT NOT NULL DEFAULT '',
                  mode TEXT NOT NULL, inbound_id TEXT);
                CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,
                  kind TEXT NOT NULL, mode TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS milestones(mode TEXT NOT NULL, threshold INTEGER NOT NULL,
                  PRIMARY KEY(mode,threshold));
                PRAGMA user_version=2;
            ''')
            for key in LEGACY_SETTINGS:
                db.execute('DELETE FROM settings WHERE key=?', (key,))
            for key, value in DEFAULTS.items():
                db.execute('INSERT OR IGNORE INTO settings VALUES (?,?)', (key, json.dumps(value)))

    def connect(self):
        db = sqlite3.connect(self.path, timeout=30, factory=ClosingConnection)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('PRAGMA journal_mode=WAL')
        return db

    def get_settings(self, conn=None):
        if conn is None:
            with self.connect() as db:
                return self.get_settings(db)
        return {row['key']: json.loads(row['value']) for row in conn.execute('SELECT * FROM settings')}

    def _set(self, db, values):
        for key, value in values.items():
            db.execute('INSERT OR REPLACE INTO settings VALUES (?,?)', (key,json.dumps(value)))

    def update_settings(self, values):
        protected = {'initialized','mode','starting_debt_cents','starting_savings_cents','savings_goal_cents'}
        if protected & values.keys():
            raise ValueError('Use setup or mode switching to change starting balances.')
        if set(values) - {'currency', 'rotate_display'}:
            raise ValueError('Unknown setting.')
        if 'currency' in values and not re.fullmatch(r'[A-Z]{3}', str(values['currency'])):
            raise ValueError('Currency must be a three-letter code.')
        if 'rotate_display' in values and type(values['rotate_display']) is not bool:
            raise ValueError('Invalid boolean setting.')
        with self.connect() as db:
            self._set(db, values)
        return self.get_settings()

    def setup(self, starting_debt_cents=0, mode='debt', starting_savings_cents=0, savings_goal_cents=None, demo=False):
        if demo:
            starting_debt_cents = 1800000
            mode = 'debt'
        cents(starting_debt_cents, True); cents(starting_savings_cents, True)
        if savings_goal_cents is not None: cents(savings_goal_cents)
        if mode not in ('debt','savings'): raise ValueError('Invalid mode.')
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if self.get_settings(db)['initialized']: raise ValueError('Already initialized; existing history is preserved.')
            self._set(db, dict(initialized=True,mode=mode,starting_debt_cents=starting_debt_cents,
                               starting_savings_cents=starting_savings_cents,savings_goal_cents=savings_goal_cents,savings_started=(mode=='savings')))
            if demo:
                for date, commands, note in [
                    ('2026-08-01T12:00:00+00:00',[('P',65000)],'Demo: first steady step'),
                    ('2026-09-01T12:00:00+00:00',[('P',95000),('C',18000)],'Demo: household update'),
                    ('2026-10-01T12:00:00+00:00',[('P',120000)],'Demo: keeping momentum')]:
                    self.apply_commands(commands,note=note,effective_at=date,conn=db)

        return self.status()

    def _balance(self, db, mode):
        s = self.get_settings(db)
        starting = s['starting_debt_cents' if mode == 'debt' else 'starting_savings_cents']
        delta = sum((r['amount_cents'] if r['kind'] in ('C','S') else -r['amount_cents']) for r in db.execute('SELECT kind,amount_cents FROM transactions WHERE mode=?',(mode,)))
        return starting + delta

    def _event(self, db, kind, mode, payload):
        db.execute('INSERT INTO events(kind,mode,payload,created_at) VALUES (?,?,?,?)', (kind,mode,json.dumps(payload),now()))

    def _awards(self, db, mode, before):
        s = self.get_settings(db); after = self._balance(db,mode)
        if mode == 'debt' and before > 0 and after <= 0:
            self._event(db,'payoff',mode,{'balance_cents':after})
        denominator = s['starting_debt_cents'] if mode == 'debt' else s['savings_goal_cents']
        numerator = denominator - after if mode == 'debt' and denominator else after
        if denominator:
            for threshold in (10,25,50,75,90,100) if mode == 'savings' else (10,25,50,75,90):
                if numerator * 100 >= denominator * threshold:
                    cur = db.execute('INSERT OR IGNORE INTO milestones VALUES (?,?)',(mode,threshold))
                    if cur.rowcount: self._event(db,'milestone',mode,{'threshold':threshold})

    def apply_commands(self, commands, mode=None, note='', effective_at=None, inbound_id=None, conn=None):
        if conn is None:
            with self.connect() as db:
                db.execute('BEGIN IMMEDIATE')
                return self.apply_commands(commands,mode,note,effective_at,inbound_id,db)
        s = self.get_settings(conn); mode = mode or s['mode']
        if not s['initialized']: raise ValueError('Complete setup first.')
        if mode != s['mode']: raise ValueError('Use the active mode to record changes.')
        if not isinstance(note,str) or len(note)>2000: raise ValueError('Note must be at most 2000 characters.')
        normalized = []
        for code, amount in commands:
            code = code.upper()
            if KINDS.get(code) != mode: raise ValueError('Wrong-mode command.')
            normalized.append((code,cents(amount)))
        effective_at = timestamp(effective_at)
        ids=[]
        for code,amount in normalized:
            before=self._balance(conn,mode)
            cur=conn.execute('INSERT INTO transactions(effective_at,created_at,kind,amount_cents,note,mode,inbound_id) VALUES (?,?,?,?,?,?,?)', (effective_at,now(),code,amount,note,mode,inbound_id))
            ids.append(cur.lastrowid)
            self._event(conn,'payment' if code=='P' else 'deposit' if code=='S' else 'change',mode,{'amount_cents':amount,'kind':code,'transaction_id':cur.lastrowid,'before_balance_cents':before,'balance_cents':self._balance(conn,mode)})
            self._awards(conn,mode,before)
        return ids

    def edit_transaction(self, transaction_id, kind, amount_cents, note='', effective_at=None):
        cents(amount_cents)
        if not isinstance(note,str) or len(note)>2000: raise ValueError('Note must be at most 2000 characters.')
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row=db.execute('SELECT * FROM transactions WHERE id=?',(transaction_id,)).fetchone()
            if not row: raise ValueError('Transaction not found.')
            if KINDS.get(kind) != row['mode']: raise ValueError('Wrong-mode command.')
            db.execute('UPDATE transactions SET kind=?,amount_cents=?,note=?,effective_at=? WHERE id=?',(kind,amount_cents,note,timestamp(effective_at or row['effective_at']),transaction_id))
            self._event(db,'correction',row['mode'],{'transaction_id':transaction_id})
        return self.status()

    def delete_transaction(self, transaction_id):
        with self.connect() as db:
            row=db.execute('SELECT mode FROM transactions WHERE id=?',(transaction_id,)).fetchone()
            if not row: raise ValueError('Transaction not found.')
            db.execute('DELETE FROM transactions WHERE id=?',(transaction_id,))
            self._event(db,'correction',row['mode'],{'transaction_id':transaction_id})
        return self.status()

    def switch_mode(self, mode, starting_savings_cents=None, savings_goal_cents=None):
        if mode not in ('debt','savings'): raise ValueError('Invalid mode.')
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            s=self.get_settings(db)
            if not s['initialized']: raise ValueError('Complete setup first.')
            values={'mode':mode}
            if starting_savings_cents is not None:
                cents(starting_savings_cents,True)
                if db.execute("SELECT 1 FROM transactions WHERE mode='savings'").fetchone() or s.get('savings_started'):
                    raise ValueError('Savings already initialized; its starting balance is preserved.')
                values.update(starting_savings_cents=starting_savings_cents,savings_started=True)
            if savings_goal_cents is not None: cents(savings_goal_cents); values['savings_goal_cents']=savings_goal_cents
            self._set(db,values)
            self._event(db,'mode',mode,{})
        return self.status()

    def status(self, mode=None):
        with self.connect() as db:
            s=self.get_settings(db); mode=mode or s['mode']
            if mode not in ('debt','savings'): raise ValueError('Invalid mode.')
            rows=[dict(r) for r in db.execute('SELECT * FROM transactions WHERE mode=? ORDER BY effective_at,id',(mode,))]
            starting=s['starting_debt_cents' if mode=='debt' else 'starting_savings_cents']; balance=starting
            trend=[{'date':'Starting balance','balance_cents':starting}]; monthly={}
            for row in rows:
                delta=row['amount_cents'] if row['kind'] in ('C','S') else -row['amount_cents']
                balance+=delta
                trend.append({'date':row['effective_at'],'balance_cents':balance,'id':row['id']})
                month=row['effective_at'][:7]; monthly[month]=monthly.get(month,0)+(delta if mode=='savings' else -delta)
            denominator=s['starting_debt_cents'] if mode=='debt' else s['savings_goal_cents']
            numerator=starting-balance if mode=='debt' else balance
            progress=max(0,min(100,numerator*100//denominator)) if denominator else None
            return dict(settings=s,initialized=s['initialized'],mode=mode,active_mode=s['mode'],balance_cents=balance,
                        remaining_cents=max(balance,0) if mode=='debt' else balance,credit_cents=max(-balance,0) if mode=='debt' else 0,
                        starting_cents=starting,net_reduction_cents=starting-balance,progress=progress,
                        total_payments_cents=sum(r['amount_cents'] for r in rows if r['kind']=='P'),
                        transactions=rows,trend=trend,monthly=[{'month':m,'net_cents':v} for m,v in sorted(monthly.items())],
                        event_cursor=db.execute('SELECT COALESCE(MAX(id),0) FROM events').fetchone()[0],
                        milestones=[r[0] for r in db.execute('SELECT threshold FROM milestones WHERE mode=? ORDER BY threshold',(mode,))])

    def events(self, after=0):
        with self.connect() as db:
            return [dict(id=r['id'],kind=r['kind'],mode=r['mode'],payload=json.loads(r['payload']),created_at=r['created_at']) for r in db.execute('SELECT * FROM events WHERE id>? ORDER BY id',(int(after),))]

    def sqlite_backup(self):
        folder=self.data_dir/'backups'; folder.mkdir(exist_ok=True)
        path=folder/('debtmonster-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f')+'.sqlite3')
        with self.connect() as source, closing(sqlite3.connect(path)) as target:
            source.backup(target)
        return str(path)

    def export_backup(self):
        with self.connect() as db:
            tables=[r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
            tables=[table for table in tables if table in FINANCIAL_TABLES]
            data={table:[dict(row) for row in db.execute('SELECT * FROM "'+table+'"')] for table in tables}
            data['settings']=[r for r in data['settings'] if not any(word in r['key'].lower() for word in ('password','secret'))]
            return {'version':2,'exported_at':now(),'tables':data}

    def restore_backup(self, payload, confirmed=False):
        try:
            return self._restore_backup(payload, confirmed)
        except (sqlite3.Error, KeyError, TypeError, OverflowError) as error:
            raise ValueError('Invalid backup: ' + str(error)) from error

    def _restore_backup(self, payload, confirmed=False):
        if not confirmed: raise ValueError('Confirm replacement before restoring.')
        if not isinstance(payload,dict) or payload.get('version') not in (1,2) or not isinstance(payload.get('tables'),dict): raise ValueError('Unsupported backup format.')
        tables={key: value for key, value in payload['tables'].items() if key not in ('checkins', 'inbound')}
        rows = tables.get('settings')
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise ValueError('Invalid backup settings.')
        tables['settings']=[row for row in rows if row.get('key') not in LEGACY_SETTINGS]
        with self.connect() as db:
            known={r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
            known &= FINANCIAL_TABLES
            if set(tables)!=known: raise ValueError('Backup tables do not match this application.')
            for table,rows in tables.items():
                columns={r[1] for r in db.execute('PRAGMA table_info("'+table+'")')}
                if not isinstance(rows,list) or len(rows)>100000: raise ValueError('Invalid backup rows.')
                for row in rows:
                    if not isinstance(row,dict) or set(row)!=columns: raise ValueError('Invalid backup columns.')
            settings={r['key']:json.loads(r['value']) for r in tables['settings']}
            if not set(DEFAULTS)<=settings.keys(): raise ValueError('Missing settings.')
            if settings['mode'] not in ('debt','savings'): raise ValueError('Invalid mode.')
            cents(settings['starting_debt_cents'],True); cents(settings['starting_savings_cents'],True)
            if settings['savings_goal_cents'] is not None: cents(settings['savings_goal_cents'])
            if type(settings['initialized']) is not bool or type(settings['rotate_display']) is not bool:
                raise ValueError('Invalid boolean setting.')
            if not re.fullmatch(r'[A-Z]{3}', str(settings['currency'])): raise ValueError('Invalid currency.')
            if set(settings) - (set(DEFAULTS) | {'savings_started'}): raise ValueError('Unknown backup setting.')
            for row in tables['transactions']:
                cents(row['amount_cents'])
                if KINDS.get(row['kind'])!=row['mode'] or type(row['id']) is not int or row['id']<1: raise ValueError('Invalid transaction.')
                timestamp(row['effective_at']); timestamp(row['created_at'])
                if not isinstance(row['note'],str) or len(row['note'])>2000: raise ValueError('Invalid note.')
            for row in tables['events']: json.loads(row['payload']); timestamp(row['created_at'])
            # Validate SQLite constraints in a private temporary database before touching the live ledger.
            scratch=sqlite3.connect(':memory:')
            try:
                for row in db.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"): scratch.execute(row[0])
                for table,rows in tables.items():
                    for row in rows:
                        keys=list(row)
                        scratch.execute('INSERT INTO "'+table+'" ('+','.join('"'+k+'"' for k in keys)+') VALUES ('+','.join('?' for _ in keys)+')',[row[k] for k in keys])
                scratch.commit()
            finally: scratch.close()
            backup_path=self.sqlite_backup()
            db.execute('BEGIN IMMEDIATE')
            for table in reversed(list(tables)): db.execute('DELETE FROM "'+table+'"')
            for table,rows in tables.items():
                for row in rows:
                    keys=list(row)
                    db.execute('INSERT INTO "'+table+'" ('+','.join('"'+k+'"' for k in keys)+') VALUES ('+','.join('?' for _ in keys)+')',[row[k] for k in keys])
            # Keep monotonic cursors even if the restored history is older.
        return backup_path
