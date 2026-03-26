# TechHome backend — Hiện trạng & hướng đồng bộ Frontend

> **Mục đích:** Mô tả **thực tế** API backend repo này tại thời điểm cập nhật, để team frontend chỉnh `VITE_API_URL`, client HTTP và mapper cho khớp.  
> **Nguồn “mục tiêu” dài hạn:** `docs/TECHHOME_BACKEND_API_SPEC.md` (contract đầy đủ). Khi backend bổ sung endpoint, cập nhật **file này** cùng lúc.

**Cập nhật:** tự động theo snapshot code; khi merge thay đổi lớn vào auth/catalog/cart/profile hãy sửa mục tương ứng.

---

## 1. Chạy backend & biến môi trường

| Mục | Giá trị / ghi chú |
|-----|-------------------|
| Lệnh | `npm start` (nodemon `bin/www`) |
| Port mặc định | **8080** (`process.env.PORT`) |
| Base URL cho frontend | `http://<host>:8080/api` — biến **`VITE_API_URL`** **không** có `/` cuối (ví dụ `http://localhost:8080/api`) |
| MongoDB | `MONGODB_URI` hoặc mặc định `mongodb://127.0.0.1:27017/techhome` |
| JWT | `RS256`; ưu tiên `JWT_PRIVATE_KEY_PATH` + `JWT_PUBLIC_KEY_PATH` (prod), fallback `JWT_PRIVATE_KEY` + `JWT_PUBLIC_KEY` (PEM env; hỗ trợ `\n`) |

**CORS:** `http://localhost:3000`, `127.0.0.1:3000`, `3001` tương ứng; `credentials: true`; header `Authorization` được phép.

---

## 2. Tóm tắt: phần đã sẵn sàng vs chưa có

| Hạng mục | Trạng thái |
|----------|------------|
| Health, Catalog (categories / products / featured / fetch-specs) | **Đã triển khai** — response JSON DTO gần/khớp spec |
| Đăng ký / đăng nhập / `GET /auth/me` | **Đã triển khai** — `AuthResponse` `{ token, user }` |
| Middleware `checkLogin` | **Bearer trước**, cookie `token_login_tungNT` sau |
| Middleware `CheckPermission` | **Đã active** — kiểm tra role thực thi, trả 403 `ban khong co quyen` khi thiếu quyền |
| Profile `GET/PUT` + `POST /profile/avatar/presign` | **Đã triển khai** — avatar qua presigned S3 + URL trong DB (xem §7) |
| `POST /uploads/presign` | **Đã triển khai** — ảnh catalog (`scope`: `product` \| `category`), **ADMIN/MODERATOR**, cùng bucket/R2 với avatar |
| Giỏ hàng | **Đã triển khai theo spec chính**: `GET /cart`, `POST/PATCH/DELETE /cart/items`, `PUT /cart` (xem §6) |
| `POST /auth/change-password` (spec) | **Đã có** — hỗ trợ thêm legacy `/auth/changepassword` |
| Orders (`GET/POST /orders`, `GET /orders/:id`) | **Đã triển khai** — có ownership check theo user đăng nhập |
| Alias route | Mọi nhóm quan trọng mount **cả** `/api/...` **và** `/api/v1/...` (cùng handler) |

---

## 3. Xác thực (Bearer + cookie)

- Header: `Authorization: Bearer <token>` — **ưu tiên** so với cookie.
- Cookie (tuỳ chọn, trình duyệt): `token_login_tungNT` (httpOnly).
- Lỗi chưa đăng nhập: **403** + JSON `{ "message": "ban chua dang nhap" }`.

---

## 4. Auth — thực tế vs spec

**Khớp gần spec (`AuthResponse`):**

| Method | Path thực tế (`…/api` + path) | Body | Response |
|--------|-------------------------------|------|----------|
| POST | `/auth/register` | `name`, `email`, `password` (validator mật khẩu mạnh) | **201** `{ token, user }` — `user`: `{ id, name, email, role }` |
| POST | `/auth/login` | `email` hoặc `username`, `password` | **200** `{ token, user }` |

**Khớp spec chính:**

| Method | Path thực tế (`…/api` + path) | Body | Response |
|--------|-------------------------------|------|----------|
| POST | `/auth/change-password` | `currentPassword`, `newPassword` | `{ message, passwordChangedAt? }` |

**Khác spec / lưu ý tương thích:**

| Mô tả | Chi tiết |
|-------|----------|
| Đổi mật khẩu legacy | Vẫn giữ **`POST /auth/changepassword`** với body cũ `oldpassword` / `newpassword` để tương thích ngược. |
| Lỗi validation (register, …) | `handleResultValidator` có thể trả **mảng** chuỗi message (400), không chỉ `{ message: string }`. |

**Khác endpoint thêm (không trong bảng spec §4.1):**

- `GET /auth/me` — cần Bearer/cookie; trả `{ id, name, email, role }`.
- `POST /auth/logout`, `POST /auth/forgotpassword`, `POST /auth/resetpassword/:token` — hành vi tối thiểu / stub.

---

## 5. Catalog — đã khớp contract chủ đạo

Prefix: `/categories`, `/products` (dưới `/api` hoặc `/api/v1`).

| Method | Path | Query / ghi chú | Response |
|--------|------|-----------------|----------|
| GET | `/categories` | — | `CategoryDto[]` `{ id, name, slug }` |
| GET | `/products` | `category`, `q`, `page`, `size` (optional; `size` tối đa 200 khi phân trang) | `ProductDto[]` |
| GET | `/products/featured` | — | `ProductDto[]` |
| GET | `/products/:id` | `id` số | `ProductDto` hoặc 404 `{ message }` |
| POST | `/products/:id/fetch-specs` | `{}` | `ProductDto` (stub — trả sản phẩm hiện có) |

**Thêm (không trong bảng tối thiểu spec storefront):** `GET /products/slug/:slug`, CRUD admin `POST/PUT/DELETE /products`… — dùng khi cần; response create/update là `ProductDto`.

**Lưu ý dữ liệu:** Nếu MongoDB trống, `GET /categories` / `/products` trả `[]` — cần seed hoặc tạo qua API admin.

---

## 6. Giỏ hàng — trạng thái hiện tại (đã có path spec + legacy)

Backend mount router tại **`/cart`** và đã có đủ endpoint theo spec:
- `GET /cart`
- `POST /cart/items`
- `PATCH /cart/items/:id`
- `DELETE /cart/items/:id`
- `PUT /cart`

| Nhóm endpoint | Trạng thái |
|----------------|-----------|
| Path theo spec (`/cart/items`, `PUT /cart`) | **Đã có** |
| Legacy (`POST /cart`, `PUT /cart/:itemId`, `DELETE /cart/:itemId`) | **Vẫn giữ** để tương thích client cũ |

**Response chính:** trả `CartItem[]` cho GET và sau mọi thao tác mutation.  
Server lấy `name/price/image` từ DB sản phẩm (không tin mù dữ liệu giá từ client).

→ Frontend mới nên ưu tiên gọi nhóm path theo spec; legacy dành cho tương thích ngược.

---

## 7. Profile — khớp `ProfileDto` (camelCase)

Mount: `GET /api/profile`, `PUT /api/profile` (và `/api/v1/profile`).

Response map theo camelCase qua DTO:
- `dateOfBirth`
- `defaultAddress`
- `passwordChangedAt`
- `avatarUrl` — URL `http(s)` tới file trên CDN/S3 (DB `avatar_url`); **không** chấp nhận data URL khi `PUT` (chỉ URL sau upload presigned)

**Upload avatar (Cloudflare R2 / S3-compatible):**

1. `POST /profile/avatar/presign` (Bearer) — body `{ "contentType": "image/jpeg", "fileSize": <bytes> }`  
   → `{ uploadUrl, publicUrl, method, headers, expiresIn }` (503 `AVATAR_STORAGE_NOT_CONFIGURED` nếu thiếu biến môi trường).
2. Browser `PUT uploadUrl` thẳng lên R2/S3, header `Content-Type` đúng `headers`.
3. `PUT /profile` — `{ "avatarUrl": "<publicUrl>" }` (HTTP(S) only; tùy chọn `AVATAR_STRICT_PUBLIC_PREFIX=1` để chỉ URL cùng prefix `PUBLIC_ASSET_BASE_URL`).

Cấu hình: `.env.example`, `utils/r2Env.js`, `utils/objectStoragePresign.js`, `utils/avatarStorage.js` (avatar), `routes/uploads.js` (ảnh sản phẩm/danh mục). **R2:** `docs/R2_CLOUDFLARE_SETUP.md`.

**Upload ảnh admin (sản phẩm):** `POST /uploads/presign` với `{ scope: "product", contentType, fileSize }` → `PUT` lên presigned URL → dùng `publicUrl` trong UI (xem `uploadImageFileToR2` trong `techhome-e-commerce`).

→ Frontend không cần adapter snake_case cho endpoint profile hiện tại.

---

## 8. Orders

**Đã implement**:
- `GET /orders` — danh sách đơn của user đăng nhập
- `GET /orders/:id` — chi tiết đơn thuộc user
- `POST /orders` — tạo đơn, kiểm tra tồn kho/giá phía server

Response trả theo `OrderDto`; route đã mount ở cả `/api/orders` và `/api/v1/orders`.

---

## 9. Lỗi JSON (chung)

- Hầu hết lỗi API: object `{ "message": string }`; một số endpoint vẫn `res.send` string thuần (vd. đổi mật khẩu thành công).
- HTTP status: 4xx/5xx theo từng route; 403 auth; 404 not found (slug/id).

---

## 10. Tài liệu liên quan trong repo

| File | Nội dung |
|------|----------|
| `docs/TECHHOME_BACKEND_API_SPEC.md` | Contract đích (frontend `techhome-e-commerce`) |
| `docs/TECHHOME_IMPLEMENTATION_ROADMAP.md` | Lộ trình giai đoạn A–I |
| `docs/MASTER_CODING_STANDARD.md` | Pattern Express/Mongoose |
| `docs/CODE_CHANGE_RULES.md` | Quy tắc khi sửa code |

---

*File này là “snapshot” để frontend không phải đọc hết source. Khi backend sửa route/DTO, cập nhật các mục §2 và §4–§8 cho khớp.*
