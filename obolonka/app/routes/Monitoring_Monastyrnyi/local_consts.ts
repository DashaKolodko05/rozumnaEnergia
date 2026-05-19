import {API_BASE_URL} from "../../../consts"

export const HISTORY_API_URL = `http://${API_BASE_URL}:6032/api/history`;
export const STATUS_API_URL = `http://${API_BASE_URL}:6032/api/status`;
export const MQTT_WEBSOCKETS_API_URL = `ws://${API_BASE_URL}:6031`


export const SENSOR_DATA_TOPIC = "sensor/data"
export const SIMULATOR_CONTROL_TOPIC = "simulator/control"
export const SIMULATOR_STATUS_TOPIC = "simulator/status"