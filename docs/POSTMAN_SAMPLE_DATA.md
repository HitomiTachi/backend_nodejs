# Dữ liệu mẫu Postman — khớp `POSTMAN_MANUAL_TEST.md` (mục 4)

Base: `http://localhost:8080` — thay bằng `{{baseUrl}}` trong Postman.  
Header chung khi có body JSON: `Content-Type: application/json`.  
Khi cần đăng nhập: `Authorization: Bearer <token>` (sau `POST /api/auth/login`).

**Biến gợi ý:** `productId`, `categoryId`, `cartItemId` (từ GET cart), `orderId`, `userId`, `roleId`, `inventoryId`, `slug`, `parentSlug`, `idempotencyKey` (chuỗi unique mỗi lần gọi reservation/sold).

---

## #1–2 — Root & health

**#1 GET /**  
Không header, không body.

**#2 GET /api/health**  
Không header, không body.

---

## #3–10 — Auth

**#3 POST /api/auth/register**

```json
{
  "email": "demo.user@example.com",
  "name": "Người dùng demo",
  "password": "Aa1!aaaa"
}
```

**#4 POST /api/auth/login**

```json
{
  "email": "demo.user@example.com",
  "password": "Aa1!aaaa"
}
```

Hoặc: `"username": "demo.user@example.com"` thay cho `email`.

**#5 GET /api/auth/me**  
Bearer: `Authorization: Bearer {{token}}`

**#6 POST /api/auth/change-password**  
Bearer.

```json
{
  "currentPassword": "Aa1!aaaa",
  "newPassword": "Bb2@bbbb"
}
```

**#7 POST /api/auth/changepassword** (legacy)  
Bearer.

```json
{
  "oldpassword": "Bb2@bbbb",
  "newpassword": "Cc3@cccc"
}
```

**#8 POST /api/auth/logout**  
Bearer — không body.

**#9 POST /api/auth/forgotpassword**

```json
{
  "email": "demo.user@example.com"
}
```

**#10 POST /api/auth/resetpassword/any-token-here**  
Không body (hoặc tùy — server trả 501).

---

## #11–18 — Products

**#11 GET /api/products**  
Query mẫu:

```
/api/products?category=1&q=iphone&page=1&size=10
```

**#12 GET /api/products/featured** — không query.

**#13 GET /api/products/slug/dien-thoai-mau**  
Đổi `dien-thoai-mau` bằng slug thật trong DB.

**#14 POST /api/products/1/fetch-specs**

```json
{}
```

**#15 GET /api/products/1** — đổi `1` thành `productId`.

**#16 POST /api/products** (ADMIN)

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

**#17 PUT /api/products/1** (ADMIN)

```json
{
  "name": "Tên sản phẩm cập nhật",
  "price": 14990000,
  "stock": 40
}
```

**#18 DELETE /api/products/1** (ADMIN) — không body.

---

## #19–26 — Categories

**#19 GET /api/categories**  
Query mẫu:

```
/api/categories?parentId=null&includeDeleted=false&name=
```

Hoặc lọc con theo cha: `?parentId=1`

**#20 GET /api/categories/1/products**

**#21 GET /api/categories/slug/dien-thoai**

**#22 GET /api/categories/children/slug/dien-thoai**

**#23 GET /api/categories/1?includeDeleted=false**

**#24 POST /api/categories** (ADMIN)

```json
{
  "name": "Danh mục demo",
  "icon": "phone",
  "imageUrl": "https://example.com/cat.jpg",
  "parentId": null
}
```

**#25 PUT /api/categories/1** (ADMIN)

```json
{
  "name": "Tên danh mục mới",
  "imageUrl": null
}
```

**#26 DELETE /api/categories/1** (ADMIN) — không body.

---

## #27–34 — Cart (Bearer user)

**#27 GET /api/cart**

**#28 PUT /api/cart**

```json
{
  "items": [
    { "productId": 1, "quantity": 2, "variant": null }
  ]
}
```

**#29 POST /api/cart/items**

```json
{
  "productId": 1,
  "quantity": 1,
  "variant": null
}
```

**#30 PATCH /api/cart/items/:cartItemId**

```json
{
  "quantity": 3
}
```

**#31 DELETE /api/cart/items/:cartItemId** — không body.

**#32 POST /api/cart** (legacy)

```json
{
  "product_id": 1,
  "quantity": 1
}
```

**#33 PUT /api/cart/:cartItemId** (legacy)

```json
{
  "quantity": 2
}
```

**#34 DELETE /api/cart/:cartItemId** (legacy) — không body.

---

## #35–37 — Orders (Bearer user)

**#35 GET /api/orders**

**#36 GET /api/orders/1** — `1` = id đơn (số).

**#37 POST /api/orders**

```json
{
  "items": [
    { "productId": 1, "quantity": 1 }
  ]
}
```

---

## #38–40 — Profile (Bearer user)

**#38 POST /api/profile/avatar/presign**

```json
{
  "contentType": "image/jpeg",
  "fileSize": 204800
}
```

**#39 GET /api/profile**

**#40 PUT /api/profile**

```json
{
  "name": "Tên hiển thị",
  "phone": "0912345678",
  "gender": "male",
  "dateOfBirth": "1995-06-15",
  "defaultAddress": "123 Đường ABC, Quận 1, TP.HCM",
  "avatarUrl": "https://cdn.example.com/u/avatar.jpg"
}
```

---

## #41 — Uploads (ADMIN hoặc MODERATOR)

**POST /api/uploads/presign**

```json
{
  "scope": "product",
  "contentType": "image/png",
  "fileSize": 300000
}
```

`scope` còn có giá trị: `"category"`.

---

## #42–48 — Users (ADMIN)

**#42 GET /api/users?includeDeleted=false**

**#43 GET /api/users/1**

**#44 POST /api/users**

```json
{
  "name": "Nhân viên A",
  "email": "staff@example.com",
  "password": "Bb2@bbbb"
}
```

**#45 PUT /api/users/1**

```json
{
  "name": "Tên cập nhật",
  "email": "staff@example.com",
  "status": true,
  "loginCount": 0,
  "role": "USER"
}
```

**#46 POST /api/users/enable**

```json
{
  "email": "staff@example.com"
}
```

**#47 POST /api/users/disable**

```json
{
  "email": "staff@example.com"
}
```

**#48 DELETE /api/users/1** — không body.

---

## #49–53 — Roles (ADMIN)

**#49 GET /api/roles?includeDeleted=false**

**#50 GET /api/roles/1?includeDeleted=false**

**#51 POST /api/roles**

```json
{
  "name": "CUSTOM_ROLE",
  "description": "Vai trò demo"
}
```

**#52 PUT /api/roles/1**

```json
{
  "name": "CUSTOM_ROLE",
  "description": "Mô tả đã sửa"
}
```

**#53 DELETE /api/roles/1** — không body.

---

## #54–60 — Inventories (ADMIN)

**#54 GET /api/inventories**

**#55 GET /api/inventories/1** — `1` = id bản ghi inventory.

**#56 GET /api/inventories/idempotency/reservation/my-key-001**  
`action` = `reservation` hoặc `sold`; `key` = giá trị Idempotency-Key đã dùng.

**#57 POST /api/inventories/add-stock**

```json
{
  "product": 1,
  "quantity": 10
}
```

**#58 POST /api/inventories/remove-stock**

```json
{
  "product": 1,
  "quantity": 2
}
```

**#59 POST /api/inventories/reservation**  
Header bắt buộc: `Idempotency-Key: my-reservation-key-001` (unique mỗi lần gọi mới).

```json
{
  "product": 1,
  "quantity": 1
}
```

Có thể thêm trong body: `"idempotencyKey": "my-reservation-key-001"` (server cũng đọc).

**#60 POST /api/inventories/sold**  
Header: `Idempotency-Key: my-sold-key-001` (khác key với reservation).

```json
{
  "product": 1,
  "quantity": 1
}
```

---

## Ghi chú

- `productId` / `categoryId` / … phải **tồn tại trong MongoDB** của bạn; số `1` chỉ là ví dụ.
- Mật khẩu mẫu `Aa1!aaaa`, `Bb2@bbbb`… thỏa rule `isStrongPassword` của backend.
- File này bổ sung cho **mục 4 và 6** trong `POSTMAN_MANUAL_TEST.md`; import collection `TechHome_Backend.postman_collection.json` để có sẵn request.
