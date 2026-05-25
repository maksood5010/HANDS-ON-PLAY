import { deviceStatusRequestTopic } from "./topics.js";
import { isMqttConnected, publishMqtt } from "../utils/mqttClient.js";

const pendingByDeviceKey = new Map();

/**
 * @param {string} deviceKey
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<object>}
 */
export function requestDeviceStatus(deviceKey, { timeoutMs = 5000 } = {}) {
  const key = String(deviceKey || "").trim();
  if (!key) {
    return Promise.reject(new Error("device_key is required"));
  }
  if (!isMqttConnected()) {
    return Promise.reject(new Error("MQTT not connected"));
  }

  const existing = pendingByDeviceKey.get(key);
  if (existing) {
    return existing.promise;
  }

  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const entry = {
    promise,
    resolve,
    reject,
    timeout: setTimeout(() => {
      pendingByDeviceKey.delete(key);
      reject(new Error("Device status request timed out"));
    }, timeoutMs),
  };

  pendingByDeviceKey.set(key, entry);

  const topic = deviceStatusRequestTopic(key);
  publishMqtt(topic, "poll", { qos: 1 }).catch((err) => {
    clearTimeout(entry.timeout);
    pendingByDeviceKey.delete(key);
    reject(err);
  });

  return promise;
}

/**
 * Called when a status/response message is parsed successfully.
 * @param {string} deviceKey
 * @param {object} status
 */
export function fulfillDeviceStatusRequest(deviceKey, status) {
  const key = String(deviceKey || "").trim();
  const entry = pendingByDeviceKey.get(key);
  if (!entry) return false;

  clearTimeout(entry.timeout);
  pendingByDeviceKey.delete(key);
  entry.resolve(status);
  return true;
}
