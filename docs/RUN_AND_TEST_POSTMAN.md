# Hướng dẫn chạy backend và test API (Postman)

Tài liệu này mô tả cách khởi động backend TechHome, biến môi trường, seed dữ liệu mẫu và gọi API qua Postman. Chi tiết contract API xem `TECHHOME_BACKEND_API_SPEC.md`; snapshot code thực tế xem `FRONTEND_BACKEND_STATUS.md`.

---

## 1. Điều kiện cần

| Thành phần | Ghi chú |
|------------|---------|
| Node.js | Trong thư mục `backend_nodejs` chạy `npm install`. |
| MongoDB | Local hoặc Atlas. Mặc định: `mongodb://127.0.0.1:27017/techhome` nếu không set `MONGODB_URI` (`utils/data.js`). |
| JWT RS256 | Bắt buộc có cặp khóa — xem mục 2. |

- **Port mặc định:** `8080` (`PORT` trong `.env` hoặc `bin/www`).
- **Base URL API:** `http://localhost:8080/api` — mọi path trong bảng endpoint là **sau** `/api`.
- **Alias:** Cùng handler mount tại `/api/...` và `/api/v1/...` (`app.js`).
- Backend đã cấu hình `dotenv` trong `bin/www`, nên file `.env` được nạp tự động khi chạy `npm start`.

---

## 2. Tạo khóa JWT (bắt buộc)

Backend dùng **JWT RS256** (`utils/authToken.js`). Không cấu hình khóa thì đăng ký/đăng nhập sẽ lỗi.

### Cách A — File PEM (khuyến nghị trên Windows)

Trong thư mục `backend_nodejs`, tạo thư mục `keys` và chạy (Git Bash hoặc OpenSSL đã cài):

```bash
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
```

Trong file `.env` (copy từ `.env.example`):

```env
PORT=8080
MONGODB_URI=mongodb://127.0.0.1:27017/techhome
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
```

### Cách B — Biến môi trường một dòng

Gán `JWT_PRIVATE_KEY` và `JWT_PUBLIC_KEY` là chuỗi PEM **một dòng**, dùng `\n` thay cho xuống dòng (xem `.env.example`).

---

## 3. Khởi động backend

1. Bật MongoDB (service hoặc URI `MONGODB_URI`).
2. Tạo file `.env` cạnh `package.json` (nội dung như mục 2).
3. PowerShell:

```powershell
Set-Location "e:\webbandienthoai\backend_nodejs"
npm install
npm start
```

`npm start` chạy nodemon và `bin/www`. Khi thấy log lắng nghe port và `MongoDB connected` là ổn.

---

## 4. Cấu hình Postman

1. Tạo **Environment** (ví dụ `TechHome Local`):
   - `base_url` = `http://localhost:8080/api`
   - `token` = để trống, cập nhật sau khi login.
2. Với các request cần đăng nhập, thêm header:
   - `Authorization`: `Bearer {{token}}`
   - `Content-Type`: `application/json`

---

## 5. Thứ tự test gợi ý

### 5.1 Health (không cần token)

| Method | URL | Kỳ vọng |
|--------|-----|--------|
| GET | `{{base_url}}/health` | 200, `{"status":"ok"}` |

### 5.2 Seed dữ liệu mẫu (khi MongoDB trống)

Nếu không seed, `GET /categories` và `GET /products` trả mảng rỗng.

**Tạo danh mục**

- **POST** `{{base_url}}/categories`

```json
{
  "name": "Điện thoại"
}
```

Ghi lại **`id`** trong response (ví dụ `1`) để dùng làm `categoryId`.

**Trùng slug:** Không tạo hai danh mục trùng `slug` (cùng tên sau khi chuẩn hoá). Response lỗi: **`409`**, `{"message":"DUPLICATE_SLUG"}`. Chi tiết mã lỗi và migration DB xem [POSTMAN_SAMPLE_DATA.md](./POSTMAN_SAMPLE_DATA.md) §2.1.

**Tạo sản phẩm**

- **POST** `{{base_url}}/products`

```json
{
  "name": "iPhone 15 Pro",
  "categoryId": 1,
  "price": 25990000,
  "salePrice": 24990000,
  "stock": 50,
  "featured": true,
  "description": "Điện thoại mẫu test",
  "image": "https://picsum.photos/seed/iphone15/400/400",
  "images": ["https://picsum.photos/seed/iphone15a/400/400"],
  "colors": [{ "name": "Titan", "hex": "#3d3d3d" }],
  "storageOptions": ["128GB", "256GB"]
}
```

Thay `categoryId` bằng id danh mục thực tế. Ghi lại **`id`** sản phẩm để dùng cho giỏ/đơn.

**Lưu ý:** `POST /products` trong code hiện không bắt `checkLogin` — chỉ nên dùng trong môi trường dev; production cần bảo vệ admin.

**Đọc catalog (public)**

- GET `{{base_url}}/categories`
- GET `{{base_url}}/products?page=0&size=20`
- GET `{{base_url}}/products/featured`
- GET `{{base_url}}/products/<id>` (thay `<id>` bằng id số)

### 5.3 Đăng ký / đăng nhập

Mật khẩu đăng ký phải **mạnh**: tối thiểu 8 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt (`utils/validatorHandler.js`).

**POST** `{{base_url}}/auth/register`

```json
{
  "name": "Nguyen Van Test",
  "email": "testuser@local.dev",
  "password": "Demo@1234"
}
```

**POST** `{{base_url}}/auth/login`

```json
{
  "email": "testuser@local.dev",
  "password": "Demo@1234"
}
```

Copy `token` từ response vào biến Postman `{{token}}`.

**GET** `{{base_url}}/auth/me` (Bearer) — kiểm tra user hiện tại.

### 5.4 Profile (Bearer)

- **GET** `{{base_url}}/profile`
- **PUT** `{{base_url}}/profile` — body theo field backend cho phép (xem `routes/profile.js` nếu cần).

### 5.5 Giỏ hàng (Bearer)

- **POST** `{{base_url}}/cart/items` — `productId` là id số sản phẩm trong DB:

```json
{
  "productId": "1",
  "quantity": 2
}
```

- **GET** `{{base_url}}/cart`
- **PATCH** `{{base_url}}/cart/items/<cartLineId>` — body `{ "quantity": <số> }`; `cartLineId` lấy từ mảng giỏ (field `id` của từng dòng).
- **DELETE** `{{base_url}}/cart/items/<cartLineId>`

### 5.6 Đơn hàng (Bearer)

Server **tự tính tổng và giá** từ DB; body `items` cần `productId` + `quantity` hợp lệ.

**POST** `{{base_url}}/orders`

```json
{
  "totalPrice": 0,
  "items": [
    { "productId": 1, "quantity": 1, "price": 0 }
  ]
}
```

- **GET** `{{base_url}}/orders`
- **GET** `{{base_url}}/orders/<id>`

### 5.7 Đổi mật khẩu (Bearer)

**POST** `{{base_url}}/auth/change-password`

```json
{
  "currentPassword": "Demo@1234",
  "newPassword": "Demo@5678"
}
```

---

## 6. Đồng bộ với frontend

Trong project `techhome-e-commerce`, đặt:

`VITE_API_URL=http://localhost:8080/api` (không có `/` ở cuối).

---

## 7. Xử lý lỗi thường gặp

| Hiện tượng | Hướng xử lý |
|------------|-------------|
| Không kết nối MongoDB | Kiểm tra MongoDB chạy, `MONGODB_URI` đúng. |
| Lỗi khi register/login về JWT | Kiểm tra `.env` khóa hoặc `JWT_*_KEY_PATH`. |
| Register 400 (password) | Dùng mật khẩu đủ mạnh (ví dụ `Demo@1234`). |
| `GET /products` rỗng | Chưa seed — làm mục 5.2. |
| Cart / Orders lỗi sản phẩm | `productId` phải trùng id trong DB; đủ `stock`. |

---

## 8. Tài liệu liên quan

| File | Nội dung |
|------|----------|
| `TECHHOME_BACKEND_API_SPEC.md` | Contract API đầy đủ |
| `FRONTEND_BACKEND_STATUS.md` | Hiện trạng backend vs frontend |
| `../.env.example` | Mẫu biến môi trường |
