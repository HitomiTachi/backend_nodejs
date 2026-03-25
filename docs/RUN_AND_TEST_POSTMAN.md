# Chạy backend và test API (Postman)

Hướng dẫn khởi động backend Node.js (`backend_nodejs`), cấu hình biến môi trường, JWT RS256 và gọi API qua Postman. **Contract chi tiết:** [TECHHOME_BACKEND_API_SPEC.md](./TECHHOME_BACKEND_API_SPEC.md). **Body mẫu đồng bộ với storefront:** [POSTMAN_SAMPLE_DATA.md](./POSTMAN_SAMPLE_DATA.md).

---

## 1. Điều kiện

| Thành phần | Ghi chú |
|------------|---------|
| Node.js | Trong `backend_nodejs`: `npm install`. |
| MongoDB | Local hoặc Atlas. Mặc định: `mongodb://127.0.0.1:27017/techhome` nếu không set `MONGODB_URI` (`utils/data.js`). |
| JWT RS256 | Bắt buộc — xem mục 2. |

- **Port:** `8080` (`PORT` trong `.env` hoặc mặc định trong `bin/www`).
- **Base URL API:** `http://localhost:8080/api` — mọi path trong tài liệu là **sau** `/api`.
- **Bản song song:** Cùng handler gắn tại `/api/...` và `/api/v1/...` (`app.js`). Postman có thể dùng `{{base_url}}` = `http://localhost:8080/api` hoặc `http://localhost:8080/api/v1` — hành vi giống nhau cho auth, products, categories, cart, profile, orders.
- **dotenv:** `require('dotenv').config()` trong `bin/www` — chạy `npm start` sẽ nạp `.env` cạnh `package.json`.

---

## 2. JWT RS256 (bắt buộc)

Backend ký JWT bằng **RS256** (`utils/authToken.js`). Thiếu khóa hợp lệ thì đăng ký/đăng nhập sẽ lỗi khi ký token.

### Cách A — File PEM (khuyến nghị)

Tạo thư mục `keys` trong `backend_nodejs`, sinh cặp khóa (Git Bash, OpenSSL, v.v.):

```bash
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
```

Trong `.env`:

```env
PORT=8080
MONGODB_URI=mongodb://127.0.0.1:27017/techhome
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
```

Có thể đặt tên file khác miễn trỏ đúng `JWT_*_KEY_PATH`. Mẫu đầy đủ (kèm PEM một dòng): [`.env.example`](../.env.example).

### Cách B — Biến môi trường một dòng

Gán `JWT_PRIVATE_KEY` và `JWT_PUBLIC_KEY` là chuỗi PEM **một dòng**, dùng `\n` thay cho xuống dòng (xem `.env.example`).

---

## 3. Khởi động

1. Bật MongoDB (hoặc URI Atlas trong `MONGODB_URI`).
2. Tạo `.env` (mục 2).
3. PowerShell:

```powershell
Set-Location "e:\webbandienthoai\backend_nodejs"
npm install
npm start
```

`npm start` chạy `nodemon ./bin/www`. Log `MongoDB connected` và server lắng nghe port là ổn.

---

## 4. Postman

1. Tạo **Environment** (ví dụ `TechHome Local`):
   - `base_url` = `http://localhost:8080/api`
   - `token` = để trống, gán sau khi login.
2. Request có body JSON: `Content-Type: application/json`.
3. Route cần đăng nhập: `Authorization: Bearer {{token}}`.

---

## 5. Thứ tự test gợi ý

### 5.1 Health (public)

| Method | URL | Kỳ vọng |
|--------|-----|--------|
| GET | `{{base_url}}/health` | `200`, ví dụ `{"status":"ok"}` |

### 5.2 Seed catalog (khi DB trống hoặc cần mẫu)

Không cần token. Thứ tự và JSON **khớp mock storefront** `techhome-e-commerce/src/data/index.ts` (mảng `products`) — chi tiết [POSTMAN_SAMPLE_DATA.md](./POSTMAN_SAMPLE_DATA.md) §2.

Tóm tắt:

- **POST** `{{base_url}}/categories` — tạo bốn danh mục (Smartphones, Tablets, Audio, Accessories), ghi **`id`** trả về.
- **POST** `{{base_url}}/products` — `categoryId` = `id` danh mục vừa tạo; bắt buộc `name`, `categoryId` (hoặc `category_id`), `price`.

**Lưu ý:** `POST /products` và `POST /categories` hiện **không** bắt `checkLogin` — chỉ dùng môi trường dev; production nên bảo vệ admin.

**Đọc catalog (public)**

| Method | URL | Ghi chú |
|--------|-----|--------|
| GET | `{{base_url}}/categories` | Toàn bộ; hoặc `?parentId=<số>` / `parentId=null` để lọc theo cha |
| GET | `{{base_url}}/categories/slug/<slug>` | Chi tiết theo slug |
| GET | `{{base_url}}/categories/children/slug/<slug>` | Danh mục con theo slug cha |
| GET | `{{base_url}}/products?page=0&size=20` | Query **`category`** = id danh mục (số), không phải tên field body `categoryId` |
| GET | `{{base_url}}/products?q=iPhone` | Tìm theo tên |
| GET | `{{base_url}}/products/featured` | Sản phẩm `featured: true` |
| GET | `{{base_url}}/products/<id>` | `id` số |
| GET | `{{base_url}}/products/slug/<slug>` | Theo slug sản phẩm |

### 5.3 Đăng ký / đăng nhập

Mật khẩu mạnh: tối thiểu 8 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt (`utils/validatorHandler.js` — `isStrongPassword`).

**POST** `{{base_url}}/auth/register` — `201`, body có `token` + `user`.

**POST** `{{base_url}}/auth/login`

**GET** `{{base_url}}/auth/me` (Bearer) — user hiện tại.

### 5.4 Profile (Bearer)

- **GET** `{{base_url}}/profile`
- **PUT** `{{base_url}}/profile` — field được phép: xem `routes/profile.js` và spec.

### 5.5 Giỏ hàng (Bearer)

- **POST** `{{base_url}}/cart/items` — `productId` (số hoặc chuỗi số), `quantity`, tuỳ chọn `variant` (ví dụ `256GB` hoặc `Natural Titanium, 256GB`).
- **GET** `{{base_url}}/cart`
- **PUT** `{{base_url}}/cart` — thay toàn bộ: `{ "items": [ { "productId", "quantity", "variant"? }, ... ] }`
- **PATCH** `{{base_url}}/cart/items/<cartLineId>` — `{ "quantity": <số> }`; `cartLineId` là `_id` dòng trong giỏ (chuỗi), lấy từ `GET /cart` field `id`.
- **DELETE** `{{base_url}}/cart/items/<cartLineId>`

Legacy (vẫn hoạt động): `POST /cart`, `PUT /cart/:itemId`, `DELETE /cart/:itemId` — xem `routes/cart.js`.

### 5.6 Đơn hàng (Bearer)

Server **chỉ** dùng mảng `items` (`productId` + `quantity`); **tự** tính giá và tổng, **tự** trừ tồn kho trong transaction.

**POST** `{{base_url}}/orders`

```json
{
  "items": [
    { "productId": 1, "quantity": 1 }
  ]
}
```

Không cần gửi `totalPrice` / `price` trong từng dòng — gửi sẽ bị bỏ qua khi tính đơn.

- **GET** `{{base_url}}/orders`
- **GET** `{{base_url}}/orders/<id>` — `id` số của đơn

### 5.7 Đổi mật khẩu (Bearer)

**POST** `{{base_url}}/auth/change-password`

```json
{
  "currentPassword": "Demo@1234",
  "newPassword": "NewDemo@5678"
}
```

Sau khi đổi, đăng nhập lại với mật khẩu mới. Có route legacy `POST /auth/changepassword` (body `oldpassword` / `newpassword`).

---

## 6. Đồng bộ với frontend `techhome-e-commerce`

| Mục | Giá trị |
|-----|---------|
| Biến env | `VITE_API_URL=http://localhost:8080/api` (**không** có `/` ở cuối) — xem `techhome-e-commerce/.env.example` nếu có |
| Dev server Vite | Port **3000** (`vite.config.ts`) |
| CORS backend | `http://localhost:3000`, `127.0.0.1:3000`, `3001` (`app.js`) |

Dữ liệu seed trong Postman nên **trùng tên danh mục / tên sản phẩm / giá hiệu lực** với mock trong `src/data/index.ts` để kiểm tra UI và API cùng lúc — chi tiết [POSTMAN_SAMPLE_DATA.md](./POSTMAN_SAMPLE_DATA.md) §2.

**Lưu ý giá:** API lưu `price`/`salePrice`/`old_price` theo schema; DTO và giỏ hàng dùng `effectiveUnitPrice` (`utils/mappers/cartDto.js`) — giá trả khách = giá sale nếu nhỏ hơn `price`, xem [POSTMAN_SAMPLE_DATA.md](./POSTMAN_SAMPLE_DATA.md) §2.0.

---

## 7. Lỗi thường gặp

| Hiện tượng | Hướng xử lý |
|------------|------------|
| Không kết nối MongoDB | Kiểm tra service / `MONGODB_URI`. |
| Lỗi JWT khi register/login | Kiểm tra `JWT_*_KEY_PATH` hoặc PEM trong `.env`. |
| Register 400 (password) | Dùng mật khẩu đủ mạnh (ví dụ `Demo@1234`). |
| `GET /products` rỗng | Chưa seed — làm [POSTMAN_SAMPLE_DATA.md](./POSTMAN_SAMPLE_DATA.md) §2. |
| Lọc sai danh mục | Dùng query `?category=<id_số>`, không nhầm với tên field body `categoryId`. |
| Cart / Orders lỗi sản phẩm | `productId` khớp `id` trong DB; đủ `stock`. |
| Trùng slug danh mục | `409` `DUPLICATE_SLUG` — đổi `name` hoặc xóa bản ghi cũ (dev). |

---

## 8. Tài liệu liên quan

| File | Nội dung |
|------|----------|
| [TECHHOME_BACKEND_API_SPEC.md](./TECHHOME_BACKEND_API_SPEC.md) | Contract API đầy đủ |
| [POSTMAN_SAMPLE_DATA.md](./POSTMAN_SAMPLE_DATA.md) | JSON mẫu đồng bộ hệ thống |
| [FRONTEND_BACKEND_STATUS.md](./FRONTEND_BACKEND_STATUS.md) | Hiện trạng backend vs frontend |
| [../.env.example](../.env.example) | Mẫu biến môi trường |
