const mongoose = require('mongoose');

/**
 * Optional VAT reduction layer: e.g. eligible groups from 10% -> 8% for a date range.
 */
const taxPolicySchema = new mongoose.Schema(
    {
        id: { type: Number, unique: true, index: true },
        fromRate: { type: Number, required: true },
        toRate: { type: Number, required: true },
        eligibleTaxGroups: { type: [String], default: [] },
        validFrom: { type: Date, required: true, index: true },
        validTo: { type: Date, default: null },
        active: { type: Boolean, default: true, index: true }
    },
    { timestamps: true }
);

module.exports = mongoose.models.TaxPolicy || mongoose.model('TaxPolicy', taxPolicySchema);
