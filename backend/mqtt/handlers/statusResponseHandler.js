import {
  isStatusResponseTopic,
  parseDeviceKeyFromStatusResponseTopic,
} from "../topics.js";
import { parseStatusResponsePayload } from "../schemas/heartbeat.js";
import { fulfillDeviceStatusRequest } from "../deviceStatusRequest.js";

export function matchesStatusResponseTopic(topic) {
  return isStatusResponseTopic(topic);
}

export function handleStatusResponseMessage(topic, payload) {
  const topicDeviceKey = parseDeviceKeyFromStatusResponseTopic(topic);
  if (!topicDeviceKey) return;

  const parsed = parseStatusResponsePayload(payload);
  if (!parsed) {
    console.warn(`Invalid status response payload topic=${topic}`);
    return;
  }

  if (parsed.device_key !== topicDeviceKey) {
    console.warn(
      `Status response device_key mismatch topic=${topicDeviceKey} payload=${parsed.device_key}`
    );
    return;
  }

  fulfillDeviceStatusRequest(topicDeviceKey, parsed);
}
