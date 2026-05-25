import { parseDeviceKeyFromHeartbeatTopic, isHeartbeatTopic } from "../topics.js";
import { parsePresencePayload } from "../schemas/heartbeat.js";
import { touchDeviceLastSeen } from "../../models/deviceModel.js";

export function matchesHeartbeatTopic(topic) {
  return isHeartbeatTopic(topic);
}

export async function handleHeartbeatMessage(topic, payload) {
  const topicDeviceKey = parseDeviceKeyFromHeartbeatTopic(topic);
  if (!topicDeviceKey) return;

  const presence = parsePresencePayload(payload);
  if (!presence) {
    console.warn(`Invalid heartbeat presence topic=${topic}`);
    return;
  }

  const updated = await touchDeviceLastSeen(topicDeviceKey);
  if (!updated) {
    console.warn(`Heartbeat for unknown device_key=${topicDeviceKey}`);
  }
}
