const BUILDING_STATUSES = [
    { value: 'under_construction', label: 'Under Construction' },
    { value: 'pre_selling', label: 'Pre-Selling' },
    { value: 'rfo', label: 'RFO' },
];

const MIXED_PHASES = 'mixed_phases';

const STATUS_LABELS = BUILDING_STATUSES.reduce((acc, item) => {
    acc[item.value] = item.label;
    return acc;
}, { [MIXED_PHASES]: 'Multiple Phases' });

module.exports = {
    BUILDING_STATUSES,
    MIXED_PHASES,
    STATUS_LABELS,
};
