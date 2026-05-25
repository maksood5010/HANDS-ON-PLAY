import { registerMqttMessageHandler } from "../../utils/mqttClient.js";
import {
  handleHeartbeatMessage,
  matchesHeartbeatTopic,
} from "./heartbeatHandler.js";
import {
  handleStatusResponseMessage,
  matchesStatusResponseTopic,
} from "./statusResponseHandler.js";

export function registerMqttHandlers() {
  registerMqttMessageHandler((topic, payload) => {
    if (matchesHeartbeatTopic(topic)) {
      void handleHeartbeatMessage(topic, payload);
      return;
    }
    if (matchesStatusResponseTopic(topic)) {
      handleStatusResponseMessage(topic, payload);
    }
  });
  console.log("MQTT handlers registered");
}
