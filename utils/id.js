/**
 * Sequential numeric `id` for TechHome DTOs (spec uses number ids).
 */
async function nextSequentialId(Model) {
    const last = await Model.findOne().sort({ id: -1 }).select('id').lean();
    return last && last.id != null ? last.id + 1 : 1;
}

module.exports = { nextSequentialId };
