# Hướng dẫn test Postman — backend `backend_nodejs`

Cập nhật: 2026-03-27

Tài liệu này kèm collection import: `TechHome_Backend.postman_collection.json` (cùng thư mục `docs/`) — **một request Postman cho mỗi API** trong bảng mục 4.

**Prefix mirror:** mọi đường dẫn dưới đây bắt đầu bằng `/api/…` còn có bản tương đương `/api/v1/…` (cùng method và body).

---

## 1. Chuẩn bị

1. Cài [Postman](https://www.postman.com/downloads/) (desktop hoặc web).
2. Chạy backend (trong thư mục `backend_nodejs`): `npm start` (hoặc lệnh tương đương).
3. Mặc định API: `http://localhost:8080` (đổi nếu biến môi trường `PORT` khác).
4. Kiểm tra: `GET http://localhost:8080/api/health` → `{ "status": "ok" }`.

---

## 2. Import collection

1. Postman → **Import** → **Upload Files**.
2. Chọn file: `backend_nodejs/docs/TechHome_Backend.postman_collection.json`.
3. Collection: **TechHome backend_nodejs — full API**.

---

## 3. Biến collection (Variables)

Vào collection → tab **Variables**:

| Variable   | Giá trị gợi ý |
|------------|----------------|
| `baseUrl`  | `http://localhost:8080` |
| `token`    | *(để trống, dán sau bước login)* |
| `productId` | `1` *(đổi theo ID thật từ GET products)* |
| `categoryId`| `1` |
| `cartItemId`| *(copy từ GET cart → field `id` của từng dòng)* |
| `slug` / `parentSlug` | slug thật trong DB |

Lưu collection sau khi sửa.

---

## 4. Danh sách đầy đủ từng API (checklist)

Gốc URL: `{{baseUrl}}` (ví dụ `http://localhost:8080`). Cột **Auth:** `—` = không cần token; `Bearer` = header `Authorization: Bearer {{token}}`; `ADMIN` / `MODERATOR` = role (upload presign nhận ADMIN hoặc MODERATOR).

### 4.1 Root & health

| # | Method | Path | Auth | Query / Body (tóm tắt) |
|---|--------|------|------|------------------------|
| 1 | GET | `/` | — | — → `{ success, message }` |
| 2 | GET | `/api/health` | — | — → `{ status: "ok" }` |

### 4.2 Auth (`/api/auth`)

| # | Method | Path | Auth | Query / Body |
|---|--------|------|------|--------------|
| 3 | POST | `/api/auth/register` | — | `{ email, name, password }` (password mạnh) |
| 4 | POST | `/api/auth/login` | — | `{ email` hoặc `username, password }` |
| 5 | GET | `/api/auth/me` | Bearer | — |
| 6 | POST | `/api/auth/change-password` | Bearer | `{ currentPassword, newPassword }` |
| 7 | POST | `/api/auth/changepassword` | Bearer | Legacy: `{ oldpassword, newpassword }` |
| 8 | POST | `/api/auth/logout` | Bearer | — (trả text `logout`) |
| 9 | POST | `/api/auth/forgotpassword` | — | `{ email }` |
| 10 | POST | `/api/auth/resetpassword/:token` | — | Hiện **501** |

### 4.3 Products (`/api/products`)

| # | Method | Path | Auth | Query / Body |
|---|--------|------|------|--------------|
| 11 | GET | `/api/products` | — | `?category=&q=&page=&size=` |
| 12 | GET | `/api/products/featured` | — | — |
| 13 | GET | `/api/products/slug/:slug` | — | `:slug` trong DB |
| 14 | POST | `/api/products/:id/fetch-specs` | — | `{}` |
| 15 | GET | `/api/products/:id` | — | `:id` số |
| 16 | POST | `/api/products` | ADMIN | `name`, `categoryId`/`category_id`, `price`, … |
| 17 | PUT | `/api/products/:id` | ADMIN | Partial update |
| 18 | DELETE | `/api/products/:id` | ADMIN | — |

### 4.4 Categories (`/api/categories`)

| # | Method | Path | Auth | Query / Body |
|---|--------|------|------|--------------|
| 19 | GET | `/api/categories` | — | `?parentId=&includeDeleted=&name=` |
| 20 | GET | `/api/categories/:id/products` | — | — |
| 21 | GET | `/api/categories/slug/:slug` | — | — |
| 22 | GET | `/api/categories/children/slug/:slug` | — | slug danh mục cha |
| 23 | GET | `/api/categories/:id` | — | `?includeDeleted=` |
| 24 | POST | `/api/categories` | ADMIN | `name`, tùy `icon`, `imageUrl`, `parentId` |
| 25 | PUT | `/api/categories/:id` | ADMIN | Partial |
| 26 | DELETE | `/api/categories/:id` | ADMIN | — |

### 4.5 Cart (`/api/cart`)

| # | Method | Path | Auth | Query / Body |
|---|--------|------|------|--------------|
| 27 | GET | `/api/cart` | Bearer | — |
| 28 | PUT | `/api/cart` | Bearer | `{ items: [{ productId, quantity, variant? }] }` |
| 29 | POST | `/api/cart/items` | Bearer | `{ productId, quantity?, variant? }` |
| 30 | PATCH | `/api/cart/items/:id` | Bearer | `{ quantity }` — `:id` = id dòng từ GET cart |
| 31 | DELETE | `/api/cart/items/:id` | Bearer | — |
| 32 | POST | `/api/cart` | Bearer | Legacy — cùng kiểu thêm dòng |
| 33 | PUT | `/api/cart/:itemId` | Bearer | Legacy `{ quantity }` |
| 34 | DELETE | `/api/cart/:itemId` | Bearer | Legacy |

### 4.6 Orders (`/api/orders`)

| # | Method | Path | Auth | Query / Body |
|---|--------|------|------|--------------|
| 35 | GET | `/api/orders` | Bearer | — |
| 36 | GET | `/api/orders/:id` | Bearer | `:id` = id đơn (số) |
| 37 | POST | `/api/orders` | Bearer | `{ items: [{ productId, quantity }] }` |

### 4.7 Profile (`/api/profile`)

| # | Method | Path | Auth | Query / Body |
|---|--------|------|------|--------------|
| 38 | POST | `/api/profile/avatar/presign` | Bearer | `{ contentType, fileSize? }` |
| 39 | GET | `/api/profile` | Bearer | — |
| 40 | PUT | `/api/profile` | Bearer | `name`, `phone`, `gender`, `dateOfBirth`, `defaultAddress`, `avatarUrl`, … |

### 4.8 Uploads (`/api/uploads`)

| # | Method | Path | Auth | Query / Body |
|---|--------|------|------|--------------|
| 41 | POST | `/api/uploads/presign` | ADMIN hoặc MODERATOR | `{ scope: "product"\|"category", contentType, fileSize? }` |

### 4.9 Users (`/api/users`) — ADMIN

| # | Method | Path | Auth | Query / Body |
|---|--------|------|------|--------------|
| 42 | GET | `/api/users` | ADMIN | `?includeDeleted=` |
| 43 | GET | `/api/users/:id` | ADMIN | — |
| 44 | POST | `/api/users` | ADMIN | `{ name, email, password }` |
| 45 | PUT | `/api/users/:id` | ADMIN | `name`, `email`, `status`, `role`, … |
| 46 | POST | `/api/users/enable` | ADMIN | `{ email` hoặc `username }` |
| 47 | POST | `/api/users/disable` | ADMIN | `{ email` hoặc `username }` |
| 48 | DELETE | `/api/users/:id` | ADMIN | — |

### 4.10 Roles (`/api/roles`) — ADMIN

| # | Method | Path | Auth | Query / Body |
|---|--------|------|------|--------------|
| 49 | GET | `/api/roles` | ADMIN | `?includeDeleted=` |
| 50 | GET | `/api/roles/:id` | ADMIN | `?includeDeleted=` |
| 51 | POST | `/api/roles` | ADMIN | `{ name, description? }` |
| 52 | PUT | `/api/roles/:id` | ADMIN | Partial |
| 53 | DELETE | `/api/roles/:id` | ADMIN | — |

### 4.11 Inventories (`/api/inventories`) — ADMIN

| # | Method | Path | Auth | Query / Body |
|---|--------|------|------|--------------|
| 54 | GET | `/api/inventories` | ADMIN | — |
| 55 | GET | `/api/inventories/:id` | ADMIN | — |
| 56 | GET | `/api/inventories/idempotency/:action/:key` | ADMIN | `action` = `reservation` \| `sold` |
| 57 | POST | `/api/inventories/add-stock` | ADMIN | `{ product, quantity }` |
| 58 | POST | `/api/inventories/remove-stock` | ADMIN | `{ product, quantity }` |
| 59 | POST | `/api/inventories/reservation` | ADMIN | `{ product, quantity }` + header **`Idempotency-Key`** (bắt buộc) |
| 60 | POST | `/api/inventories/sold` | ADMIN | `{ product, quantity }` + **`Idempotency-Key`** (bắt buộc) |

**Tổng cộng: 60 API** (đếm từng dòng trong bảng). Không có endpoint HTTP nào khác trong `backend_nodejs/routes` ngoài các nhóm trên và bản mirror `/api/v1/...`.

---

## 5. Luồng cơ bản (token)

### 5.1 Đăng ký

**POST** `{{baseUrl}}/api/auth/register`  
Header: `Content-Type: application/json`

```json
{
  "email": "demo.user@example.com",
  "name": "Người dùng demo",
  "password": "Aa1!aaaa"
}
```

Mật khẩu phải **mạnh**: ≥8 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt.

### 5.2 Đăng nhập

**POST** `{{baseUrl}}/api/auth/login`

```json
{
  "email": "demo.user@example.com",
  "password": "Aa1!aaaa"
}
```

- Copy **`token`** trong response → dán vào biến **`token`** của collection.
- Các request cần auth dùng **Bearer** (`Authorization: Bearer {{token}}`).

### 5.3 Xác nhận session

**GET** `{{baseUrl}}/api/auth/me` — không body.

---

## 6. Dữ liệu mẫu theo nhóm

### 6.1 Catalog (public, không cần token)

| Mục | Method + URL |
|-----|----------------|
| Danh sách SP | `GET /api/products?category=&q=&page=1&size=10` |
| Featured | `GET /api/products/featured` |
| Chi tiết theo id | `GET /api/products/1` |
| Theo slug | `GET /api/products/slug/<slug-thật>` |
| Danh mục | `GET /api/categories` |
| Danh mục theo slug | `GET /api/categories/slug/<slug>` |
| Con theo slug cha | `GET /api/categories/children/slug/<parent-slug>` |
| SP theo danh mục | `GET /api/categories/1/products` |

**POST /api/products/:id/fetch-specs** — body:

```json
{}
```

---

### 6.2 Giỏ hàng (cần token user)

**GET** `/api/cart`

**POST** `/api/cart/items`

```json
{
  "productId": 1,
  "quantity": 2,
  "variant": null
}
```

**PATCH** `/api/cart/items/:id` — `:id` = `id` từng dòng trong response GET cart:

```json
{
  "quantity": 3
}
```

**PUT** `/api/cart` (thay toàn bộ)

```json
{
  "items": [
    { "productId": 1, "quantity": 1, "variant": null }
  ]
}
```

---

### 6.3 Đơn hàng (cần token)

**POST** `/api/orders`

```json
{
  "items": [
    { "productId": 1, "quantity": 1 }
  ]
}
```

**GET** `/api/orders`  
**GET** `/api/orders/1` — đổi `1` thành `id` đơn thật.

---

### 6.4 Profile (cần token)

**GET** `/api/profile`

**PUT** `/api/profile`

```json
{
  "name": "Tên hiển thị",
  "phone": "0912345678",
  "gender": "male",
  "dateOfBirth": "1995-06-15",
  "defaultAddress": "123 Đường ABC, Quận 1, TP.HCM"
}
```

**POST** `/api/profile/avatar/presign` (cần cấu hình storage)

```json
{
  "contentType": "image/jpeg",
  "fileSize": 204800
}
```

---

### 6.5 Đổi mật khẩu (cần token)

**POST** `/api/auth/change-password`

```json
{
  "currentPassword": "Aa1!aaaa",
  "newPassword": "Bb2@bbbb"
}
```

---

### 6.6 Admin (cần role ADMIN / MODERATOR cho upload)

**POST** `/api/categories`

```json
{
  "name": "Điện thoại",
  "icon": "phone",
  "imageUrl": "https://example.com/cat.jpg",
  "parentId": null
}
```

**POST** `/api/products`

```json
{
  "name": "Điện thoại mẫu X",
  "categoryId": 1,
  "price": 15990000,
  "description": "Mô tả ngắn",
  "image": "https://example.com/p.jpg",
  "sku": "SKU-DEMO-001",
  "stock": 50
}
```

**POST** `/api/uploads/presign` — ADMIN hoặc MODERATOR

```json
{
  "scope": "product",
  "contentType": "image/png",
  "fileSize": 300000
}
```

**POST** `/api/users`

```json
{
  "name": "Nhân viên A",
  "email": "staff@example.com",
  "password": "Bb2@bbbb"
}
```

**POST** `/api/inventories/add-stock`

```json
{
  "product": 1,
  "quantity": 10
}
```

**POST** `/api/inventories/reservation` và **POST** `/api/inventories/sold`: bắt buộc header **`Idempotency-Key`** (chuỗi unique), body:

```json
{
  "product": 1,
  "quantity": 1
}
```

---

## 7. Prefix `/api/v1`

Cùng route với **thay** `/api` → `/api/v1` (ví dụ `POST /api/v1/auth/login`).

---

## 8. Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|------------|------------|
| `403` "ban chua dang nhap" | Login lại, cập nhật `token`, hoặc gửi `Authorization: Bearer <token>`. |
| `403` "ban khong co quyen" | Dùng tài khoản **ADMIN** (hoặc **MODERATOR** cho uploads). |
| `400` khi register | Password chưa đủ độ phức tạp (ví dụ `Aa1!aaaa`). |
| PATCH cart 404 | Sai `id` dòng giỏ — lấy từ **GET /api/cart**. |

---

## 9. Liên kết nhanh

- Collection full endpoint: `TechHome_Backend.postman_collection.json`
- **Dữ liệu mẫu copy-paste theo đủ 60 API:** `POSTMAN_SAMPLE_DATA.md` (cùng thư mục `docs/`)
- Tổng quan API / spec: `TECHHOME_BACKEND_API_SPEC.md` (nếu có trong repo)
