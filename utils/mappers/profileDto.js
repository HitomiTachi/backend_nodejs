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

function trimOpt(v, max) {
    if (v == null || v === '') return undefined;
    const s = String(v).trim();
    if (!s) return undefined;
    return s.slice(0, max);
}

function mapSavedAddresses(raw) {
    if (!Array.isArray(raw) || raw.length === 0) return [];
    const out = [];
    for (const a of raw) {
        if (!a || typeof a !== 'object') continue;
        const id = a.id != null ? String(a.id).trim() : '';
        const line = a.line != null ? String(a.line).trim() : '';
        if (!id || !line) continue;
        const label = a.label != null ? String(a.label).trim().slice(0, 120) : '';
        const row = { id, label, line: line.slice(0, 800) };
        const rn = trimOpt(a.recipientName, 120);
        const rp = trimOpt(a.recipientPhone, 30);
        const st = trimOpt(a.street, 200);
        const w = trimOpt(a.ward, 80);
        const d = trimOpt(a.district, 80);
        const p = trimOpt(a.province, 80);
        const n = trimOpt(a.note, 300);
        if (rn) row.recipientName = rn;
        if (rp) row.recipientPhone = rp;
        if (st) row.street = st;
        if (w) row.ward = w;
        if (d) row.district = d;
        if (p) row.province = p;
        if (n) row.note = n;
        out.push(row);
    }
    return out;
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
        savedAddresses: mapSavedAddresses(user.saved_addresses),
        passwordChangedAt: toIsoInstant(user.password_changed_at),
        avatarUrl: user.avatar_url != null && user.avatar_url !== '' ? user.avatar_url : null
    };
}

module.exports = { toProfileDto };
