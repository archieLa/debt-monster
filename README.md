# Debt Monster

Watch debt disappear. Then watch savings grow.

Debt Monster is a local motivational display for debt payoff and savings. A daily email check-in lets you record payments or charges by replying with a short command. The display updates automatically; later tiers add a monster that eats debt and celebrates progress.

The software is intended to run on a PC or Raspberry Pi. A physical display in a wooden frame is a possible future product.

## Project status

Repository initialized; application implementation has not started.

Read [the product spec](debt_monster_product_spec.md) before implementing. Start with **Tier 0 only**, including email replies, and validate it before moving to the next tier.

## Planned stack

- Python Flask
- SQLite, with money stored as integer cents
- Vanilla HTML, CSS, and JavaScript
- SMTP sending and IMAP polling for optional daily email check-ins

No bank integrations, cloud financial database, or generic goal tracking.

## Licensing

The intent is to release the source openly. A license has not yet been selected; no open-source license is granted by this repository yet.
