const STATUS_THRESHOLDS = {
    BAHAYA: 180,
    SIAGA_2: 120,
    SIAGA_1: 90,
    WASPADA: 60,
}

export const getWaterStatus = (waterLevel) => {
    if (waterLevel >= STATUS_THRESHOLDS.BAHAYA) {
        return 'Bahaya';
    } else if (waterLevel >= STATUS_THRESHOLDS.SIAGA_2) {
        return 'Siaga 2';
    }
    else if (waterLevel >= STATUS_THRESHOLDS.SIAGA_1) {
        return 'Siaga 1';
    }
    else if (waterLevel >= STATUS_THRESHOLDS.WASPADA) {
        return 'Waspada';
    }
    return 'Normal';
};