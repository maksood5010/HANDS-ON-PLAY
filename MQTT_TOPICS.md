# MQTT Topics Guide

Prefix: `hoi/v1` (override via backend `MQTT_TOPIC_PREFIX` env or app Settings → MQTT topic prefix).

Replace `{deviceKey}` with the 6-character device key. Do **not** register a real device with key `all` (reserved for fleet topics).

## Conventions

- **QoS:** 1 for commands and status
- **Retain:** `false` for all commands (never replay reboot/restart on reconnect)
- **Device subscribes to:**
  - `{prefix}/devices/{deviceKey}/status/request`
  - `{prefix}/devices/{deviceKey}/commands/#`
  - `{prefix}/devices/all/commands/#`
- **Backend subscribes to:**
  - `{prefix}/devices/+/heartbeat`
  - `{prefix}/devices/+/status/response`

---

## Topic reference

| Topic | Direction | Payload | Response |
|-------|-----------|---------|----------|
| `{prefix}/devices/{deviceKey}/heartbeat` | device → backend | (heartbeat) | — |
| `{prefix}/devices/{deviceKey}/status/request` | backend → device | `poll` | — |
| `{prefix}/devices/{deviceKey}/status/response` | device → backend | JSON status | — |
| `{prefix}/devices/{deviceKey}/commands` | backend → device | recovery command (see below) | `status` → `status/response` |
| `{prefix}/devices/{deviceKey}/commands/update` | backend → device | HTTPS APK URL (plain text) | `{prefix}/devices/{deviceKey}/commands/update/success` |
| `{prefix}/devices/all/commands/update` | backend → fleet | HTTPS APK URL (plain text) | per-device success topic |

---

## Recovery commands

**Topic:** `{prefix}/devices/{deviceKey}/commands`

| Payload | Action |
|---------|--------|
| `refresh-playlist` | Re-fetch playlist from API |
| `restart-playback` | Restart current slide/video |
| `status` | Publish JSON to `…/status/response` |
| `clear-cache` | Clear Exo stream cache + downloaded assets, then refresh playlist |
| `launch-app` | Bring MainActivity to foreground |
| `restart-app` | Kill and relaunch app process |
| `reboot-device` | Reboot device (device owner API or `su reboot`) |
| `set-device-owner` | `dpm set-device-owner` via root shell |
| `remove-device-owner` | Clear device owner |
| `run-adb-command` + newline + shell | Run shell command via `su`; output logged on device |

### `run-adb-command` (two-line payload)

Line 1: `run-adb-command`  
Line 2: shell command (not `adb shell …` — the device runs it directly as root)

```bash
mosquitto_pub -h BROKER -t "hoi/v1/devices/ABC123/commands" -q 1 \
  -m $'run-adb-command\nsettings get system font_scale'
```

### Examples

```bash
# Refresh playlist
mosquitto_pub -h BROKER -t "hoi/v1/devices/ABC123/commands" -m "refresh-playlist" -q 1

# Restart playback
mosquitto_pub -h BROKER -t "hoi/v1/devices/ABC123/commands" -m "restart-playback" -q 1

# Status (subscribe first)
mosquitto_sub -h BROKER -t "hoi/v1/devices/ABC123/status/response" -C 1
mosquitto_pub -h BROKER -t "hoi/v1/devices/ABC123/commands" -m "status" -q 1

# Clear cache
mosquitto_pub -h BROKER -t "hoi/v1/devices/ABC123/commands" -m "clear-cache" -q 1

# Launch / restart app
mosquitto_pub -h BROKER -t "hoi/v1/devices/ABC123/commands" -m "launch-app" -q 1
mosquitto_pub -h BROKER -t "hoi/v1/devices/ABC123/commands" -m "restart-app" -q 1

# Reboot / device owner (requires device owner or root)
mosquitto_pub -h BROKER -t "hoi/v1/devices/ABC123/commands" -m "reboot-device" -q 1
mosquitto_pub -h BROKER -t "hoi/v1/devices/ABC123/commands" -m "set-device-owner" -q 1
mosquitto_pub -h BROKER -t "hoi/v1/devices/ABC123/commands" -m "remove-device-owner" -q 1
```

Logcat tag for recovery commands: `DeviceRecoveryCmdHandler`

### Status response JSON

Published to `{prefix}/devices/{deviceKey}/status/response`:

```json
{
  "device_key": "ABC123",
  "playback_state": "playing",
  "health_status": "ok",
  "currently_playing": "https://example.com/video.mp4",
  "app_version": "1.3"
}
```

`playback_state` values: `playing`, `idle`, `not_playing`, `error`, `setup`, `app_closed`  
`health_status` values: `ok`, `warning`, `error`

---

## OTA (app update)

**Per device:** `{prefix}/devices/{deviceKey}/commands/update` — payload = APK URL  
**Fleet:** `{prefix}/devices/all/commands/update` — payload = APK URL  
**Success:** `{prefix}/devices/{deviceKey}/commands/update/success` — JSON with `device_key`, `status`, `app_version`, `version_code`

See [device-android/MQTT_OTA_TEST.md](device-android/MQTT_OTA_TEST.md) for OTA prerequisites and full test steps.

---

## Subscriptions cheat sheet

```bash
# All device heartbeats
mosquitto_sub -h BROKER -t "hoi/v1/devices/+/heartbeat" -v

# All status responses
mosquitto_sub -h BROKER -t "hoi/v1/devices/+/status/response" -v

# OTA install success
mosquitto_sub -h BROKER -t "hoi/v1/devices/+/commands/update/success" -v
```

---

## Live status from backend

The dashboard requests live status by publishing `poll` to `{prefix}/devices/{deviceKey}/status/request`. The device responds on `status/response` with the same JSON shape as the `status` recovery command.

Recovery command `status` on `{prefix}/devices/{deviceKey}/commands` triggers the same response path.
