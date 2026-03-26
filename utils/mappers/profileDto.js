/**
 * ProfileDto — docs/TECHHOME_BACKEND_API_SPEC.md §5.4
 */

function toIsoDateOnly(value) {
    if (value == null || value === '') return null;
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
}

function toIsoInstant(value) {
    if (value == null || value === '') return null;
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
}

function toProfileDto(user) {
    if (!user) return null;
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone != null ? user.phone : null,
        gender: user.gender != null ? user.gender : null,
        dateOfBirth: toIsoDateOnly(user.date_of_birth),
        defaultAddress: user.default_address != null ? user.default_address : null,
        passwordChangedAt: toIsoInstant(user.password_changed_at),
        avatarUrl: user.avatar_url != null && user.avatar_url !== '' ? user.avatar_url : null
    };
}

module.exports = { toProfileDto };
