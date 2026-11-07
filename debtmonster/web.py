"""Flask interface. All money changes go through the domain store."""
import csv
import io
import os
import secrets
from pathlib import Path
from urllib.parse import urlsplit
from flask import Flask, jsonify, request, render_template, session, Response
from .core import Store, parse_commands


def create_app(data_dir=None):
    app = Flask(__name__)
    root = Path(data_dir or os.environ.get('DEBT_MONSTER_DATA_DIR', Path.home() / '.local/share/debtmonster'))
    root.mkdir(parents=True, exist_ok=True)
    secret = root / 'session.key'
    if not secret.exists():
        try:
            with secret.open('x') as f:
                f.write(secrets.token_hex(32))
            secret.chmod(0o600)
        except FileExistsError:
            pass
    app.secret_key = secret.read_text()
    app.config.update(MAX_CONTENT_LENGTH=5 * 1024 * 1024, SESSION_COOKIE_SAMESITE='Strict', SESSION_COOKIE_HTTPONLY=True)
    store = Store(root)
    app.extensions.update(store=store)

    @app.before_request
    def protect():
        allowed = {'localhost', '127.0.0.1', '::1'} | set(os.environ.get('DEBT_MONSTER_ALLOWED_HOSTS', '').split(','))
        if urlsplit('http://' + request.host).hostname not in allowed:
            return jsonify(error='Unexpected host'), 403
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            origin = request.headers.get('Origin')
            if origin and urlsplit(origin).netloc != request.host:
                return jsonify(error='Unexpected origin'), 403
            if not session.get('csrf') or not secrets.compare_digest(session['csrf'], request.headers.get('X-CSRF-Token', '')):
                return jsonify(error='Refresh the page and try again (CSRF token required).'), 403

    @app.errorhandler(ValueError)
    def invalid(error):
        return jsonify(error=str(error)), 400

    @app.errorhandler(OSError)
    def unavailable(error):
        return jsonify(error='Local operation failed: ' + str(error)), 503

    @app.after_request
    def headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Cache-Control'] = 'no-store'
        return response

    @app.get('/')
    @app.get('/display')
    def index():
        session.setdefault('csrf', secrets.token_hex(24))
        return render_template('index.html', csrf_token=session['csrf'], display=request.path == '/display')

    def body():
        data = request.get_json()
        if not isinstance(data, dict):
            raise ValueError('Expected a JSON object')
        return data

    def monetary(data):
        from decimal import Decimal, InvalidOperation
        for field in ('starting_debt', 'starting_savings', 'savings_goal'):
            if field in data:
                value = data.pop(field)
                if value in ('', None) and field == 'savings_goal':
                    data[field + '_cents'] = None
                    continue
                try:
                    amount = Decimal(str(value)) * 100
                    if not amount.is_finite() or amount != amount.to_integral_value():
                        raise ValueError('Amounts require at most two decimal places')
                    data[field + '_cents'] = int(amount)
                except InvalidOperation:
                    raise ValueError('Invalid money amount')
        return data

    @app.get('/api/status')
    def status():
        result = store.status(request.args.get('mode'))
        return jsonify(result)

    @app.get('/api/settings')
    def settings():
        return jsonify(store.get_settings())

    @app.route('/api/settings', methods=['POST', 'PATCH'])
    def save_settings():
        store.update_settings(body())
        return jsonify(store.get_settings())

    @app.post('/api/setup')
    def setup():
        store.setup(**monetary(body()))
        return jsonify(store.status())

    @app.post('/api/transactions')
    def add():
        data = body()
        commands = parse_commands(data.get('commands', data.get('command', '')), store.get_settings()['mode'])
        store.apply_commands(commands, note=data.get('note', ''))
        return jsonify(store.status())

    @app.route('/api/transactions/<int:tid>', methods=['PUT', 'PATCH', 'DELETE'])
    def change(tid):
        if request.method == 'DELETE':
            store.delete_transaction(tid)
        else:
            data = body()
            if 'command' in data or 'commands' in data:
                commands = parse_commands(data.get('command', data.get('commands')), store.get_settings()['mode'])
                if len(commands) != 1 or commands[0][0] == 'N':
                    raise ValueError('Edit requires one financial command')
                data['kind'], data['amount_cents'] = commands[0]
                data.pop('command', None)
                data.pop('commands', None)
            store.edit_transaction(tid, **data)
        return jsonify(store.status())

    @app.post('/api/mode')
    def mode():
        store.switch_mode(**monetary(body()))
        return jsonify(store.status())

    @app.get('/api/events')
    def events():
        return jsonify(events=store.events(int(request.args.get('after', 0))))

    @app.get('/api/backup')
    def backup():
        return jsonify(store.export_backup())

    @app.post('/api/restore')
    def restore():
        data = body()
        store.restore_backup(data.get('backup'), confirmed=data.get('confirmed', data.get('confirm', False)))
        return jsonify(store.status())

    @app.get('/api/export.csv')
    def export_csv():
        output = io.StringIO()
        writer = csv.writer(output)
        rows = store.export_backup()['tables']['transactions']
        fields = ['id', 'effective_at', 'mode', 'kind', 'amount_cents', 'note']
        writer.writerow(fields)
        for row in rows:
            writer.writerow([row.get(k, '') for k in fields])
        return Response(output.getvalue(), mimetype='text/csv', headers={'Content-Disposition': 'attachment; filename=debtmonster.csv'})

    return app
