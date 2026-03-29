const TaxRuleModel = require('../../schemas/taxRules');
const { nextSequentialId } = require('../id');

/**
 * Idempotent seed: ensures at least DEFAULT 10% rule exists so tax resolver never falls back silently.
 */
async function ensureDefaultTaxData() {
    const count = await TaxRuleModel.countDocuments();
    if (count > 0) {
        return;
    }
    const id = await nextSequentialId(TaxRuleModel);
    await TaxRuleModel.create({
        id,
        taxGroup: 'DEFAULT',
        rate: 0.1,
        validFrom: new Date(0),
        validTo: null
    });
}

module.exports = { ensureDefaultTaxData };
