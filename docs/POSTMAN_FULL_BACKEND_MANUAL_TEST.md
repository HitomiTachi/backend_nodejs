# Postman Manual Test - Full Backend (TechHome)

Tai lieu nay tong hop toan bo endpoint backend hien co de ban test thu cong bang Postman.

- Base URL khuyen nghi: `http://localhost:8080/api`
- Ban mirror: `http://localhost:8080/api/v1` (hanh vi tuong duong cho nhom API da map)
- Content-Type: `application/json` cho request co body JSON

---

## 1) Chuan bi

### 1.1 Chay backend

```powershell
Set-Location "e:\webbandienthoai\backend_nodejs"
npm install
npm start
```

### 1.2 Tao Postman Environment

Dat ten: `TechHome Local`.

| Variable | Value khoi tao |
|---|---|
| `base_url` | `http://localhost:8080/api` |
| `token` | *(de trong)* |
| `adminToken` | *(de trong, tuy chon)* |
| `idemKey` | *(de trong, dung cho inventory idempotency)* |
| `userId` | *(de trong)* |
| `categoryId` | *(de trong)* |
| `productId` | *(de trong)* |
| `cartLineId` | *(de trong)* |
| `orderId` | *(de trong)* |

### 1.3 Header dung chung

- Request co auth:
  - `Authorization: Bearer {{token}}`
- Request co body JSON:
  - `Content-Type: application/json`

---

## 2) Thu tu test de xuyen suot

1. Health check  
2. Auth (register/login) lay token  
3. Categories + Products (admin)  
4. Profile  
5. Cart  
6. Orders  
7. Upload presign (avatar/admin asset)  
8. Users (admin CRUD)  
9. Inventories (admin + idempotency)  
10. Roles (admin CRUD)  
11. Logout + forgot password

---

## 3) Health / Root

### 3.1 Health

- **GET** `{{base_url}}/health`
- Ky vong: `200` + `{"status":"ok"}`

### 3.2 Root (khong thuoc /api, tuy chon)

- **GET** `http://localhost:8080/`
- Ky vong: `{"success":true,"message":"HELLO WORLD"}`

---

## 4) Auth

### 4.1 Register

- **POST** `{{base_url}}/auth/register`

```json
{
  "name": "Admin Demo",
  "email": "admin.local@techhome.dev",
  "password": "Demo@1234"
}
```

Ky vong: `201`, tra `token`, `user`, `postLoginRedirect`.

### 4.2 Login

- **POST** `{{base_url}}/auth/login`

```json
{
  "email": "admin.local@techhome.dev",
  "password": "Demo@1234"
}
```

Ky vong: `200`, copy `token` vao `{{token}}`.

### 4.3 Me

- **GET** `{{base_url}}/auth/me` (Bearer)

### 4.4 Change password

- **POST** `{{base_url}}/auth/change-password` (Bearer)

```json
{
  "currentPassword": "Demo@1234",
  "newPassword": "NewDemo@5678"
}
```

Legacy:

- **POST** `{{base_url}}/auth/changepassword` (Bearer)

```json
{
  "oldpassword": "NewDemo@5678",
  "newpassword": "Demo@1234"
}
```

### 4.5 Logout

- **POST** `{{base_url}}/auth/logout` (Bearer)

### 4.6 Forgot password (placeholder)

- **POST** `{{base_url}}/auth/forgotpassword`

```json
{
  "email": "admin.local@techhome.dev"
}
```

### 4.7 Reset password (chua ho tro)

- **POST** `{{base_url}}/auth/resetpassword/any-token`
- Ky vong: `501`

---

## 5) Categories

Luu y: create/update/delete yeu cau role `ADMIN`.

### 5.1 List all

- **GET** `{{base_url}}/categories`

### 5.2 List by parentId

- **GET** `{{base_url}}/categories?parentId=null`
- **GET** `{{base_url}}/categories?parentId=1`

### 5.3 Get by slug

- **GET** `{{base_url}}/categories/slug/dien-thoai`

### 5.4 Get children by parent slug

- **GET** `{{base_url}}/categories/children/slug/dien-thoai`

### 5.5 Get by id

- **GET** `{{base_url}}/categories/1`

### 5.6 Create (ADMIN)

- **POST** `{{base_url}}/categories` (Bearer)

```json
{
  "name": "Dien thoai",
  "icon": "smartphone",
  "imageUrl": "https://picsum.photos/seed/cat-phone/400/400"
}
```

Luu `id` vao `{{categoryId}}`.

### 5.7 Update (ADMIN)

- **PUT** `{{base_url}}/categories/{{categoryId}}` (Bearer)

```json
{
  "name": "Dien thoai cao cap",
  "icon": "smartphone",
  "parentId": null
}
```

### 5.8 Delete (ADMIN)

- **DELETE** `{{base_url}}/categories/{{categoryId}}` (Bearer)

---

## 6) Products

Luu y: create/update/delete yeu cau role `ADMIN`.

### 6.1 List

- **GET** `{{base_url}}/products?page=0&size=20`
- **GET** `{{base_url}}/products?q=iphone`
- **GET** `{{base_url}}/products?category={{categoryId}}`

### 6.2 Featured

- **GET** `{{base_url}}/products/featured`

### 6.3 Get by id

- **GET** `{{base_url}}/products/1`

### 6.4 Get by slug

- **GET** `{{base_url}}/products/slug/iphone-15-pro`

### 6.5 Create (ADMIN)

- **POST** `{{base_url}}/products` (Bearer)

```json
{
  "name": "iPhone 15 Pro",
  "categoryId": {{categoryId}},
  "price": 25990000,
  "salePrice": 24990000,
  "stock": 50,
  "featured": true,
  "description": "San pham test",
  "image": "https://picsum.photos/seed/iphone15/400/400",
  "images": ["https://picsum.photos/seed/iphone15a/400/400"],
  "colors": [{ "name": "Titan", "hex": "#3d3d3d" }],
  "storageOptions": ["128GB", "256GB"]
}
```

Luu `id` vao `{{productId}}`.

### 6.6 Update (ADMIN)

- **PUT** `{{base_url}}/products/{{productId}}` (Bearer)

```json
{
  "name": "iPhone 15 Pro Updated",
  "price": 25500000,
  "stock": 45,
  "featured": false
}
```

### 6.7 Delete (ADMIN)

- **DELETE** `{{base_url}}/products/{{productId}}` (Bearer)

### 6.8 Fetch specs (public)

- **POST** `{{base_url}}/products/{{productId}}/fetch-specs`

---

## 7) Profile

Tat ca endpoint duoi day yeu cau Bearer token.

### 7.1 Get profile

- **GET** `{{base_url}}/profile`

### 7.2 Update profile

- **PUT** `{{base_url}}/profile`

```json
{
  "name": "Admin Demo Updated",
  "phone": "0909123456",
  "gender": "male",
  "dateOfBirth": "1995-06-15",
  "defaultAddress": "123 ABC, Q1, HCM"
}
```

### 7.3 Presign avatar upload

- **POST** `{{base_url}}/profile/avatar/presign`

```json
{
  "contentType": "image/jpeg",
  "fileSize": 45000
}
```

Neu storage chua cau hinh, ky vong `503` + code `AVATAR_STORAGE_NOT_CONFIGURED`.

---

## 8) Uploads (admin assets)

Yeu cau Bearer role `ADMIN` hoac `MODERATOR`.

### 8.1 Presign product image

- **POST** `{{base_url}}/uploads/presign`

```json
{
  "scope": "product",
  "contentType": "image/jpeg",
  "fileSize": 45000
}
```

### 8.2 Presign category image

- **POST** `{{base_url}}/uploads/presign`

```json
{
  "scope": "category",
  "contentType": "image/png",
  "fileSize": 32000
}
```

---

## 9) Cart

Tat ca endpoint duoi day yeu cau Bearer token.

### 9.1 Get cart

- **GET** `{{base_url}}/cart`

### 9.2 Add item (spec route)

- **POST** `{{base_url}}/cart/items`

```json
{
  "productId": {{productId}},
  "quantity": 2,
  "variant": "256GB"
}
```

### 9.3 Replace full cart

- **PUT** `{{base_url}}/cart`

```json
{
  "items": [
    { "productId": {{productId}}, "quantity": 1 }
  ]
}
```

### 9.4 Patch cart line

- **PATCH** `{{base_url}}/cart/items/{{cartLineId}}`

```json
{
  "quantity": 3
}
```

### 9.5 Delete cart line

- **DELETE** `{{base_url}}/cart/items/{{cartLineId}}`

### 9.6 Legacy cart routes

- **POST** `{{base_url}}/cart`
- **PUT** `{{base_url}}/cart/{{cartLineId}}`
- **DELETE** `{{base_url}}/cart/{{cartLineId}}`

---

## 10) Orders

Tat ca endpoint duoi day yeu cau Bearer token.

### 10.1 Create order

- **POST** `{{base_url}}/orders`

```json
{
  "items": [
    { "productId": {{productId}}, "quantity": 1 }
  ]
}
```

Luu `id` vao `{{orderId}}`.

### 10.2 List my orders

- **GET** `{{base_url}}/orders`

### 10.3 Get order by id (ownership check)

- **GET** `{{base_url}}/orders/{{orderId}}`

---

## 11) Users (ADMIN)

Tat ca endpoint duoi day yeu cau role `ADMIN`.

### 11.1 List users

- **GET** `{{base_url}}/users`

### 11.2 Get user by id

- **GET** `{{base_url}}/users/1`

### 11.3 Create user

- **POST** `{{base_url}}/users`

```json
{
  "name": "User Test",
  "email": "user.test@techhome.dev",
  "password": "Demo@1234"
}
```

### 11.4 Update user

- **PUT** `{{base_url}}/users/1`

```json
{
  "name": "User Test Updated",
  "email": "user.updated@techhome.dev"
}
```

### 11.5 Delete user

- **DELETE** `{{base_url}}/users/1`

---

## 12) Inventories (ADMIN + Idempotency)

Tat ca endpoint duoi day yeu cau role `ADMIN`.

### 12.1 List inventories

- **GET** `{{base_url}}/inventories`

### 12.2 Get inventory by id

- **GET** `{{base_url}}/inventories/1`

### 12.3 Add stock

- **POST** `{{base_url}}/inventories/add-stock`

```json
{
  "product": {{productId}},
  "quantity": 20
}
```

### 12.4 Reservation (idempotent)

- **POST** `{{base_url}}/inventories/reservation`
- Header bat buoc: `Idempotency-Key: {{idemKey}}`

```json
{
  "product": {{productId}},
  "quantity": 2
}
```

Ky vong:

- Lan 1: tru `stock`, tang `reserved`
- Lan 2 (cung key + cung payload): tra ket qua cu + `idempotentReplay: true`
- Cung key, khac payload: `409`

### 12.5 Sold (idempotent)

- **POST** `{{base_url}}/inventories/sold`
- Header bat buoc: `Idempotency-Key: {{idemKey}}`

```json
{
  "product": {{productId}},
  "quantity": 1
}
```

Ky vong:

- Lan 1: giam `reserved`, tang `soldCount`
- Lan 2 (cung key + cung payload): replay response cu

### 12.6 Check idempotency record

- **GET** `{{base_url}}/inventories/idempotency/reservation/{{idemKey}}`
- **GET** `{{base_url}}/inventories/idempotency/sold/{{idemKey}}`

Ky vong: tra record gom `status`, `product`, `quantity`, `response`.

---

## 13) Roles (ADMIN)

Tat ca endpoint duoi day yeu cau role `ADMIN`.

- **GET** `{{base_url}}/roles`
- **GET** `{{base_url}}/roles/1`
- **POST** `{{base_url}}/roles`

```json
{
  "name": "MODERATOR",
  "description": "Role test tu Postman"
}
```

- **PUT** `{{base_url}}/roles/1`

```json
{
  "description": "Role test updated"
}
```

- **DELETE** `{{base_url}}/roles/1`

---

## 14) Test nhanh qua /api/v1

Co the doi `base_url` thanh `http://localhost:8080/api/v1` va retest nhanh:

- `/auth/login`
- `/categories`
- `/products`
- `/cart`
- `/profile`
- `/orders`
- `/uploads/presign`
- `/users`
- `/inventories`
- `/roles`

Luu y:

- Health chi co o `GET /api/health` (khong co route `GET /api/v1/health` trong `app.js` hien tai).

---

## 15) Bang loi thuong gap

| Status | Tinh huong |
|---|---|
| `400` | Body sai schema, `productId` khong hop le, mat khau yeu |
| `401` | Thieu token / token sai |
| `403` | Token khong du quyen (khong phai ADMIN/MODERATOR) |
| `404` | Id/slug khong ton tai |
| `409` | Duplicate category slug (`DUPLICATE_SLUG`) |
| `501` | Endpoint chua ho tro (reset password) |
| `503` | Storage presign chua cau hinh (`AVATAR_STORAGE_NOT_CONFIGURED`) |

---

## 16) Tai lieu lien quan

- `docs/RUN_AND_TEST_POSTMAN.md`
- `docs/POSTMAN_SAMPLE_DATA.md`
- `docs/TECHHOME_BACKEND_API_SPEC.md`

