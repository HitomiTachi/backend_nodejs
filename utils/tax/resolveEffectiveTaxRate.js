const TaxRuleModel = require('../../schemas/taxRules');
const TaxPolicyModel = require('../../schemas/taxPolicies');

/**
 * @param {import('mongoose').ClientSession|null} session
 */
async function resolveBaseRate(taxGroup, at, session) {
    const q = TaxRuleModel.findOne({
        taxGroup: String(taxGroup || 'DEFAULT'),
        validFrom: { $lte: at },
        $or: [{ validTo: null }, { validTo: { $gte: at } }]
    }).sort({ validFrom: -1 });
    const rule = session ? await q.session(session).lean() : await q.lean();
    if (!rule) {
        return 0.1;
    }
    return Number(rule.rate);
}

/**
 * Apply optional reduction policy (e.g. 10% -> 8%) when group and window match.
 * @param {import('mongoose').ClientSession|null} session
 */
async function resolveEffectiveTaxRate(taxGroup, at, session) {
    const group = String(taxGroup || 'DEFAULT');
    const base = await resolveBaseRate(group, at, session);
    const q = TaxPolicyModel.findOne({
        active: true,
        validFrom: { $lte: at },
        $or: [{ validTo: null }, { validTo: { $gte: at } }],
        eligibleTaxGroups: { $in: [group] },
        fromRate: base
    }).sort({ validFrom: -1 });
    const policy = session ? await q.session(session).lean() : await q.lean();
    if (!policy) {
        return base;
    }
    return Number(policy.toRate);
}

module.exports = {
    resolveBaseRate,
    resolveEffectiveTaxRate
};
