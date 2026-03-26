/**
 * AuthUserDto — docs/TECHHOME_BACKEND_API_SPEC.md §5.3
 */
function toAuthUserDto(user) {
    if (!user) return null;
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'USER',
        avatarUrl: user.avatar_url != null && user.avatar_url !== '' ? user.avatar_url : null
    };
}

/** Đường dẫn storefront sau đăng nhập (đồng bộ frontend HashRouter), ví dụ `/admin` cho ADMIN. */
function postLoginRedirectPath(userDto) {
    if (!userDto || userDto.role == null) return null;
    return String(userDto.role).trim().toUpperCase() === 'ADMIN' ? '/admin' : null;
}

module.exports = { toAuthUserDto, postLoginRedirectPath };
