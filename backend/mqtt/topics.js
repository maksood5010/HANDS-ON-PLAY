/**
 * MQTT topic registry (backend). Android follow-up should mirror these paths.
 *
 * Env: MQTT_TOPIC_PREFIX (default "hoi/v1")
 */

function envString(name, fallback) {
  const v = process.env[name];
  if (v == null || String(v).trim() === "") return fallback;
  return String(v).trim().replace(/\/+$/, "");
}

export function topicPrefix() {
  return envString("MQTT_TOPIC_PREFIX", "hoi/v1");
}

/** Device publishes heartbeat (QoS 1; retain optional). */
export function deviceHeartbeatTopic(deviceKey) {
  return `${topicPrefix()}/devices/${deviceKey}/heartbeat`;
}

/** Backend subscribes on connect (receives retained replay). */
export function deviceHeartbeatSubscription() {
  return `${topicPrefix()}/devices/+/heartbeat`;
}

/** Backend publishes to request live status; device subscribes. */
export function deviceStatusRequestTopic(deviceKey) {
  return `${topicPrefix()}/devices/${deviceKey}/status/request`;
}

/** Device publishes full status JSON; backend subscribes. */
export function deviceStatusResponseTopic(deviceKey) {
  return `${topicPrefix()}/devices/${deviceKey}/status/response`;
}

export function deviceStatusResponseSubscription() {
  return `${topicPrefix()}/devices/+/status/response`;
}

/** Reserved: backend → device commands (wildcard). */
export function deviceCommandsTopic(deviceKey) {
  return `${topicPrefix()}/devices/${deviceKey}/commands/#`;
}

/** Same filter the Android device subscribes to for inbound commands. */
export function deviceCommandsSubscriptionFilter(deviceKey) {
  return deviceCommandsTopic(deviceKey);
}

/** Backend/operator publishes APK URL (plain text) to one device. */
export function deviceCommandsUpdateTopic(deviceKey) {
  return `${topicPrefix()}/devices/${deviceKey}/commands/update`;
}

/** Device subscribes to all fleet commands (OTA, future controls). */
export function fleetCommandsSubscriptionFilter() {
  return `${topicPrefix()}/devices/all/commands/#`;
}

/** Fleet-wide OTA command (literal segment "all", not a device_key). */
export function fleetCommandsUpdateTopic() {
  return `${topicPrefix()}/devices/all/commands/update`;
}

/** Device publishes after successful silent install (JSON). */
export function deviceCommandsUpdateSuccessTopic(deviceKey) {
  return `${topicPrefix()}/devices/${deviceKey}/commands/update/success`;
}

/** Optional backend subscribe for install outcomes. */
export function deviceCommandsUpdateSuccessSubscription() {
  return `${topicPrefix()}/devices/+/commands/update/success`;
}

export const BACKEND_SUBSCRIPTIONS = [
  deviceHeartbeatSubscription(),
  deviceStatusResponseSubscription(),
];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const heartbeatTopicRe = () =>
  new RegExp(`^${escapeRegExp(topicPrefix())}/devices/([^/]+)/heartbeat$`);

export function parseDeviceKeyFromHeartbeatTopic(topic) {
  const m = String(topic || "").match(heartbeatTopicRe());
  return m ? m[1] : null;
}

export function isHeartbeatTopic(topic) {
  return heartbeatTopicRe().test(String(topic || ""));
}

const statusResponseTopicRe = () =>
  new RegExp(
    `^${escapeRegExp(topicPrefix())}/devices/([^/]+)/status/response$`
  );

export function parseDeviceKeyFromStatusResponseTopic(topic) {
  const m = String(topic || "").match(statusResponseTopicRe());
  return m ? m[1] : null;
}

export function isStatusResponseTopic(topic) {
  return statusResponseTopicRe().test(String(topic || ""));
}
