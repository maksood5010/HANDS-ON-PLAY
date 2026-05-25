import mqtt from "mqtt";
import { BACKEND_SUBSCRIPTIONS } from "../mqtt/topics.js";
import { getMqttOptions, isMqttEnabled } from "./mqttConfig.js";

let client = null;
let connected = false;
const messageHandlers = [];

function attachClientEvents(mqttClient) {
  mqttClient.on("connect", () => {
    connected = true;
    console.log("MQTT connected");
    mqttClient.subscribe(BACKEND_SUBSCRIPTIONS, (err) => {
      if (err) {
        console.warn("MQTT subscribe failed", err?.message ?? err);
        return;
      }
      console.log(`MQTT subscribed to ${BACKEND_SUBSCRIPTIONS.join(", ")}`);
    });
  });

  mqttClient.on("reconnect", () => {
    console.log("MQTT reconnecting");
  });

  mqttClient.on("error", (err) => {
    console.warn("MQTT error", err?.message ?? err);
  });

  mqttClient.on("close", () => {
    connected = false;
    console.log("MQTT connection closed");
  });

  mqttClient.on("offline", () => {
    connected = false;
    console.log("MQTT offline");
  });

  mqttClient.on("message", (topic, payload) => {
    for (const handler of messageHandlers) {
      try {
        handler(topic, payload);
      } catch (e) {
        console.warn("MQTT message handler failed", e?.message ?? e);
      }
    }
  });
}

export function registerMqttMessageHandler(fn) {
  if (typeof fn !== "function") return;
  messageHandlers.push(fn);
}

export function isMqttConnected() {
  return connected && client?.connected === true;
}

export function getMqttClient() {
  if (!isMqttConnected()) return null;
  return client;
}

export function publishMqtt(topic, payload, options = {}) {
  const mqttClient = getMqttClient();
  if (!mqttClient) {
    return Promise.reject(new Error("MQTT not connected"));
  }
  return new Promise((resolve, reject) => {
    mqttClient.publish(topic, payload, options, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function startMqttClient() {
  if (!isMqttEnabled()) {
    console.log("MQTT disabled (MQTT_ENABLED=false or MQTT_BROKER_URL unset)");
    return;
  }

  if (client) {
    return;
  }

  const { url, ...options } = getMqttOptions();
  client = mqtt.connect(url, options);
  attachClientEvents(client);
  console.log(`MQTT client starting url=${url} clientId=${options.clientId}`);
}

export function stopMqttClient() {
  if (!client) return;

  const toEnd = client;
  client = null;
  connected = false;

  return new Promise((resolve) => {
    toEnd.end(true, {}, () => {
      console.log("MQTT client stopped");
      resolve();
    });
  });
}
