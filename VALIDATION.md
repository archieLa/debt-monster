# Validation

## Automated checks

From the repository folder:

```sh
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q
node --test tests/journey.test.cjs
node --check debtmonster/static/app.js
sh -n deploy/raspberry-pi/kiosk.sh
```

Latest results: **13 Python tests plus 14 subtests, and 9 JavaScript tests passed**. JavaScript and kiosk shell syntax checks passed. Node.js is needed only for the JavaScript checks.

Coverage includes integer money validation, atomic updates, debt growth/credit, corrections, chronological trends, payoff transitions, milestones, savings, restart persistence, backup/restore validation, schema migration, and host/origin/CSRF protections. Graph tests cover payments, charges, flat/empty histories, negative balances, source immutability, and savings watering/harvesting and first-crossing blooms.

Migration checks preserve both ledgers, historical source identifiers, events, and milestone state; create a safety backup; and import earlier financial backups without re-enabling removed email functionality.

## Manual browser checks

Performed with isolated artificial demo databases:

- Entry, CHOMP/countdown, charge expression/count-up, history and corrections without replaying payment celebrations.
- Payoff and explicit savings setup, retained debt history, deposits/planting, and withdrawals/fruit collection.
- Separate display panels, arrows/dots, automatic cycling, selected-panel persistence, and replayed graph with charge climbs and interactive point details.
- Savings Journey watering/harvesting, flowers, and unobstructed graph-point selection.
- Update/Display layouts at a 1280×720 browser viewport.

README screenshots use freshly seeded artificial data, separate from the active household database.

## Deployment checks and remaining verification

The documented LAN hostname/IP allowlist and same-origin requests were checked using an isolated Flask test client. The kiosk script passes shell syntax validation.

Still unverified on physical hardware:

- Raspberry Pi installation, boot/service recovery, and attached-screen kiosk startup.
- Access from separate household computers over an actual LAN.
- Physical touch-device swipes and keyboard point activation.
- OS reduced-motion toggling and long-duration unattended operation.

These limitations do not change the local browser checks above. Raspberry Pi setup instructions are in [the setup guide](docs/raspberry-pi.md).
