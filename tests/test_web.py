import pytest
from debtmonster.web import create_app

@pytest.fixture
def client(tmp_path):
    app = create_app(tmp_path)
    app.config['TESTING'] = True
    client = app.test_client()
    client.get('/')
    with client.session_transaction() as session:
        token = session['csrf']
    client.token = {'X-CSRF-Token': token}
    return client

def post(client, url, data):
    return client.post(url, json=data, headers=client.token)

def test_csrf_and_origin(client):
    assert client.post('/api/setup', json={}).status_code == 403
    assert client.post('/api/setup', json={}, headers={**client.token, 'Origin':'https://evil.example'}).status_code == 403
    assert client.get('/api/status', headers={'Host':'evil.example'}).status_code == 403

def test_full_local_flow(client):
    assert post(client, '/api/setup', {'starting_debt_cents':100000}).status_code == 200
    assert post(client, '/api/transactions', {'command':'C 42.18, P 500','note':'demo'}).status_code == 200
    backup = client.get('/api/backup').json
    assert post(client, '/api/restore', {'backup':backup,'confirmed':True}).status_code == 200
    assert client.get('/api/export.csv').status_code == 200
    assert post(client, '/api/mode', {'mode':'savings','starting_savings_cents':20000,'savings_goal_cents':100000}).status_code == 200
    assert post(client, '/api/transactions', {'command':'S 100, W 25'}).status_code == 200
    assert post(client, '/api/transactions', {'command':'P 10'}).status_code == 400
    assert client.get('/display').status_code == 200

def test_removed_email_endpoints_and_settings(client):
    assert post(client, '/api/email/test', {}).status_code == 404
    assert post(client, '/api/email/simulate', {'text':'P 1'}).status_code == 404
    assert post(client, '/api/settings', {'email_enabled':True}).status_code == 400
    assert 'email_enabled' not in client.get('/api/settings').json

def test_invalid_restore_preserves_ledger(client):
    post(client, '/api/setup', {'starting_debt_cents':100000})
    post(client, '/api/transactions', {'command':'P 1'})
    backup = client.get('/api/backup').json
    backup['tables']['transactions'][0]['amount_cents'] = -1
    assert post(client, '/api/restore', {'backup':backup,'confirmed':True}).status_code == 400
    assert client.get('/api/status').json['balance_cents'] == 99900
