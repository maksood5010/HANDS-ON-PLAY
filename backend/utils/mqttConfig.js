function envTruthy(name) {
  const v = String(process.env[name] ?? "")
    .trim()
    .toLowerCase();
  return v === "true" || v === "1";
}

function envString(name) {
  const v = process.env[name];
  if (v == null) return "";
  return String(v).trim();
}

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function isMqttEnabled() {
  return envTruthy("MQTT_ENABLED") && envString("MQTT_BROKER_URL") !== "";
}

export function getMqttOptions() {
  const url = envString("MQTT_BROKER_URL");
  const clientId = envString("MQTT_CLIENT_ID") || "hoi-backend";
  const username = envString("MQTT_USERNAME");
  const password = envString("MQTT_PASSWORD");

  if (username && !password) {
    console.warn("MQTT_USERNAME is set but MQTT_PASSWORD is empty");
  } else if (password && !username) {
    console.warn("MQTT_PASSWORD is set but MQTT_USERNAME is empty");
  }

  const rejectUnauthorized = (() => {
    const raw = process.env.MQTT_REJECT_UNAUTHORIZED;
    if (raw == null || String(raw).trim() === "") return true;
    const v = String(raw).trim().toLowerCase();
    if (v === "false" || v === "0") return false;
    return v === "true" || v === "1";
  })();

  const options = {
    url,
    clientId,
    keepalive: envInt("MQTT_KEEPALIVE", 60),
    reconnectPeriod: envInt("MQTT_RECONNECT_PERIOD_MS", 5000),
    connectTimeout: envInt("MQTT_CONNECT_TIMEOUT_MS", 30000),
    clean: true,
  };

  if (username) options.username = username;
  if (password) options.password = password;

  if (url.startsWith("mqtts://")) {
    options.rejectUnauthorized = rejectUnauthorized;
  }

  return options;
}
