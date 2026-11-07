# Raspberry Pi setup

These instructions run Debt Monster on the Pi, make it accessible on your home network, and optionally open Display automatically on an attached monitor.

## 1. Prepare the Pi

Install Raspberry Pi OS with Desktop if you want an attached screen; a server-only Pi can use Raspberry Pi OS Lite. Use Python 3.11 or newer. Connect the Pi to your home network. Set its hostname to `debtmonster` in Raspberry Pi Imager and note your chosen username. Enable SSH if you want to set it up from another computer.

Run the following commands **on the Pi**, as your normal user, not root:

```sh
sudo apt update
sudo apt install -y git python3-venv python3-pip curl
```

Find its network address:

```sh
hostname -I
```

Note the home-network IPv4 address, for example `192.168.1.50`. A DHCP reservation in your router keeps this address stable.

## 2. Clone from GitHub and install

First make sure the application changes have been committed and pushed to GitHub from your development computer. Then run these commands **on the Pi**:

```sh
git clone https://github.com/archieLa/debt-monster.git "$HOME/debt-monster"
cd "$HOME/debt-monster"
python3 -m venv .venv
.venv/bin/pip install -r requirements-pi.txt
mkdir -p "$HOME/.config/debtmonster" "$HOME/.local/share/debtmonster"
chmod 700 "$HOME/.config/debtmonster" "$HOME/.local/share/debtmonster"
nano "$HOME/.config/debtmonster/server.env"
```

Put this in `server.env`, replacing the example IP with the Pi's actual address. Values have no spaces around commas:

```ini
DEBT_MONSTER_ALLOWED_HOSTS=debtmonster,debtmonster.local,192.168.1.50
```

Save and exit. Data will use `~/.local/share/debtmonster`. To use another absolute data folder, add `DEBT_MONSTER_DATA_DIR=/your/data/folder` to that file.

## 3. Start the server automatically

On the Pi:

```sh
mkdir -p "$HOME/.config/systemd/user"
cp deploy/raspberry-pi/debtmonster.service "$HOME/.config/systemd/user/"
systemctl --user daemon-reload
systemctl --user enable --now debtmonster.service
sudo loginctl enable-linger "$USER"
```

Check it:

```sh
systemctl --user status debtmonster.service
curl --fail http://127.0.0.1:5050/api/status
```

Open `http://debtmonster.local:5050/` from another computer on the same home network. Use `http://<PI-IP>:5050/` if hostname lookup is unavailable. These addresses reach the same ledger as the Pi's own display. Updates appear on other screens within about five seconds.

Useful service commands:

```sh
systemctl --user restart debtmonster.service
systemctl --user stop debtmonster.service
systemctl --user start debtmonster.service
journalctl --user -u debtmonster.service -n 50 --no-pager
```

Do not also run `run.py` on port 5050 while the service is running. To undo automatic startup, use `systemctl --user disable --now debtmonster.service`.

## 4. Transfer your existing data

On the current computer, open Settings and download a JSON backup. Then open the Pi's address on that computer and use **Settings → Restore backup** to upload it. Confirm replacement, then verify balances, notes, and both histories. Keep the downloaded backup somewhere safe.

After the transfer, use the Pi's URL for updates. Stop the old computer server when you are finished checking the transfer; entries made there will not appear on the Pi.

## 5. Optional attached screen

These steps target Raspberry Pi OS Desktop using labwc. A Lite installation needs a desktop before it can show a browser.

Connect the screen and install Chromium **on the Pi**:

```sh
sudo apt install -y chromium
sudo raspi-config
```

In `raspi-config`, enable desktop auto-login for your user and disable screen blanking if you want the screen to stay on. Exit the configuration tool.

From the application folder on the Pi:

```sh
cd "$HOME/debt-monster"
mkdir -p "$HOME/.config/labwc"
nano "$HOME/.config/labwc/autostart"
```

Append this line; keep any existing contents:

```sh
"$HOME/debt-monster/deploy/raspberry-pi/kiosk.sh" &
```

The script waits for the server, opens Chromium at `http://127.0.0.1:5050/display`, and relaunches Chromium if it exits. It uses a separate, persistent browser profile so panel selection and Auto-cycle remain saved.

Reboot:

```sh
sudo reboot
```

The monitor should open Display automatically. Enable **Auto-cycle panels** on that screen if desired. Other household computers continue to use the normal Pi URL for updates.

To leave kiosk mode, first comment out its autostart line over SSH (or from a terminal), then reboot or terminate Chromium. To stop the kiosk without rebooting, find the script with `pgrep -af kiosk.sh`, terminate its listed PID with `kill PID`, then close Chromium. Stop the script first or it will relaunch the browser.

## Updates and shutdown

Run updates **on the Pi**. Keep local configuration and data outside the cloned repository.

```sh
cd "$HOME/debt-monster"
systemctl --user stop debtmonster.service
git rev-parse HEAD
cp -a "$HOME/.local/share/debtmonster" "$HOME/.local/share/debtmonster-backup-$(date +%Y%m%d-%H%M%S)"
cp -a "$HOME/.config/debtmonster/server.env" "$HOME/.config/debtmonster/server.env.backup"
git pull --ff-only
.venv/bin/pip install -r requirements-pi.txt
cp deploy/raspberry-pi/debtmonster.service "$HOME/.config/systemd/user/"
systemctl --user daemon-reload
systemctl --user start debtmonster.service
systemctl --user status debtmonster.service
```

Record the revision printed before the pull and keep the backup. If you configured a different data directory, substitute that path in the backup command. If the pull or dependency installation fails, resolve it before starting the updated app. Check balances/history before making new entries. Git pulls update application files; they do not update or synchronize your ledger.

If verification fails, stop the service, check out the recorded previous revision, and restore its compatible data backup before restarting. Restoring a backup discards later entries. Preserve any newer database separately before replacing it.

For shutdown, run `sudo shutdown -h now` and wait for shutdown to complete before removing power.

If the Pi's IP changes, update `server.env` and restart the service. If another computer cannot connect, check that it is not on guest Wi-Fi and that the network/firewall allows port 5050. No router port forwarding is needed.

## Verification status

The configuration and startup script are supplied for setup. A physical Pi, boot-time startup, attached display, and household-network access have not yet been tested on your hardware.

References: [Flask: Waitress](https://flask.palletsprojects.com/en/stable/deploying/waitress/) and [Raspberry Pi: kiosk setup](https://www.raspberrypi.com/tutorials/how-to-use-a-raspberry-pi-in-kiosk-mode/).
