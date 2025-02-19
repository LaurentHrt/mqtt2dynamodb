import { initializeMQTTClient } from "./mqtt.js";
import { connect } from "mqtt";
import { appConfig } from "./config.js";
import { logStrategy } from "./onMessageStrategies/logStrategy/logStrategy.js";
import { dynamoDBStrategy } from "./onMessageStrategies/dynamoDBStrategy/dynamoDBStrategy.js";
import { fileSystemStrategy } from "./onMessageStrategies/fileSystemStrategy/fileSystemStrategy.js";
import { reactorStrategy } from "./onMessageStrategies/reactorStrategy/reactorStrategy.js";

console.log("Starting service...");

const mqttClient = initializeMQTTClient(connect);

const topics = appConfig.mqttBaseTopics;
mqttClient.subscribe(topics, (err) => {
  if (err) {
    console.error("Failed to subscribe to MQTT topics:", err);
    return;
  }
  console.log(`Subscribed to MQTT topics: ${topics}`);
});

const availableStrategies = {
  logStrategy,
  dynamoDBStrategy,
  fileSystemStrategy,
  reactorStrategy: reactorStrategy(mqttClient),
};

const strategyNames = appConfig.onMessageStrategies;
const onMessageStrategies = strategyNames
  .map((name) => availableStrategies[name])
  .filter(Boolean);

if (onMessageStrategies.length === 0) {
  console.log("No available strategies");
  process.exit(0);
}

for (const strategy of onMessageStrategies) {
  strategy.init();
  mqttClient.on("message", strategy.onMessage);
}

function shutDown() {
  console.log("Service shutting down...");
  for (const strategy of onMessageStrategies) {
    strategy.end();
  }
  mqttClient.end();
  process.exit(0);
}

process.on("SIGTERM", shutDown);
process.on("SIGINT", shutDown);
