const RIVER_DEPTHS_FROM_SENSOR = 435; // in cm

export const getWaterLevel = (waterLevelFromSensor) => {
    return RIVER_DEPTHS_FROM_SENSOR - waterLevelFromSensor;
}