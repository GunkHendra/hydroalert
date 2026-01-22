export const getWaterStatus = (waterLevel) => {
    if (waterLevel >= 180) return 'Bahaya';
    if (waterLevel >= 120) return 'Waspada';
    if (waterLevel >= 60) return 'Siaga';
    return 'Normal';
};