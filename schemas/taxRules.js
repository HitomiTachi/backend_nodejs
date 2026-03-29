const mongoose = require('mongoose');

const taxRuleSchema = new mongoose.Schema(
    {
        id: { type: Number, unique: true, index: true },
        /** Logical group, e.g. DEFAULT, ZERO, REDUCED_5 */
        taxGroup: { type: String, required: true, index: true },
        /** Decimal rate, e.g. 0.1 for 10% */
        rate: { type: Number, required: true },
        validFrom: { type: Date, required: true, index: true },
        validTo: { type: Date, default: null }
    },
    { timestamps: true }
);

taxRuleSchema.index({ taxGroup: 1, validFrom: -1 });

module.exports = mongoose.models.TaxRule || mongoose.model('TaxRule', taxRuleSchema);
