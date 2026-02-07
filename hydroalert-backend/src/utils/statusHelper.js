export const STATUS_THRESHOLDS = {
    Bahaya: 400,
    "Siaga 1": 310,
    "Siaga 2": 270,
    Waspada: 235,
}

export const getWaterStatus = (waterLevel) => {
    if (waterLevel >= STATUS_THRESHOLDS.Bahaya) {
        return 'Bahaya';
    } else if (waterLevel >= STATUS_THRESHOLDS["Siaga 2"]) {
        return 'Siaga 2';
    }
    else if (waterLevel >= STATUS_THRESHOLDS["Siaga 1"]) {
        return 'Siaga 1';
    }
    else if (waterLevel >= STATUS_THRESHOLDS.Waspada) {
        return 'Waspada';
    }
    return 'Normal';
};