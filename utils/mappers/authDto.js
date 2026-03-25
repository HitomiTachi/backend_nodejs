/**
 * AuthUserDto — docs/TECHHOME_BACKEND_API_SPEC.md §5.3
 */
function toAuthUserDto(user) {
    if (!user) return null;
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'USER'
    };
}

module.exports = { toAuthUserDto };
