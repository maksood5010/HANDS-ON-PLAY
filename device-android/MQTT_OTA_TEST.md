# MQTT OTA manual test

The app subscribes to:

- `{prefix}/devices/{deviceKey}/commands/#` — per-device commands
- `{prefix}/devices/all/commands/#` — fleet-wide commands

Add new controls by implementing [DeviceMqttCommandHandler](app/src/main/java/com/hoi/player/mqtt/DeviceMqttCommandHandler.kt) and registering it on [DeviceMqttCommandDispatcher](app/src/main/java/com/hoi/player/mqtt/DeviceMqttCommandDispatcher.kt) (no new MQTT subscribe needed).

Prerequisites:

- Device is **Device Owner** (`adb shell dpm set-device-owner com.hoi.player/.utils.MyDeviceAdminReceiver`)
- App configured with `device_key` and MQTT broker
- APK URL is HTTPS (or HTTP if broker allows) and signed with the **same key** as the installed app

## Update one device

```bash
mosquitto_pub -h YOUR_BROKER -p 1883 \
  -t "hoi/v1/devices/YOUR_DEVICE_KEY/commands/update" \
  -m "https://your-cdn.example.com/hoi-player.apk" \
  -q 1
```

## Update all devices

```bash
mosquitto_pub -h YOUR_BROKER -p 1883 \
  -t "hoi/v1/devices/all/commands/update" \
  -m "https://your-cdn.example.com/hoi-player.apk" \
  -q 1
```

## Listen for install success

```bash
mosquitto_sub -h YOUR_BROKER -p 1883 \
  -t "hoi/v1/devices/+/commands/update/success" -v
```

Expected JSON payload:

```json
{
  "device_key": "YOUR_DEVICE_KEY",
  "status": "success",
  "app_version": "1.3",
  "version_code": 3
}
```

After install, the app relies on **Android to kill and relaunch** the updated package (no manual `restartApp()`).

Do not register a real device with `device_key` = `all` (reserved for fleet topic).
