export const STATUS_THRESHOLDS = {
    Bahaya: 180,
    "Siaga 1": 120,
    "Siaga 2": 90,
    Waspada: 60,
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