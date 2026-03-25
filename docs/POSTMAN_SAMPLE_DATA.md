# Dữ liệu mẫu test API (Postman) — TechHome Backend

Tài liệu này liệt kê **thứ tự gọi API hợp lý** và **body JSON mẫu** khớp backend hiện tại. Base URL mặc định: `http://localhost:8080/api`. Chi tiết chạy server và biến môi trường xem [RUN_AND_TEST_POSTMAN.md](./RUN_AND_TEST_POSTMAN.md).

---

## 0. Chuẩn bị Postman

Tạo Environment (ví dụ `TechHome Local`):

| Biến | Giá trị khởi tạo | Ghi chú |
|------|------------------|---------|
| `base_url` | `http://localhost:8080/api` | |
| `token` | *(để trống)* | Điền sau bước đăng nhập |
| `categoryId` | *(tuỳ chọn)* | Copy từ response sau khi tạo danh mục |
| `productId` | *(tuỳ chọn)* | Copy từ response sau khi tạo sản phẩm |
| `cartLineId` | *(tuỳ chọn)* | Copy từ `GET /cart` — `id` từng dòng |
| `orderId` | *(tuỳ chọn)* | Copy từ `POST /orders` hoặc `GET /orders` |

**Header dùng chung (request có body JSON):**

- `Content-Type: application/json`

**Request cần đăng nhập:**

- `Authorization: Bearer {{token}}`

---

## 1. Kiểm tra server đang chạy

| Bước | Method | URL | Body |
|------|--------|-----|------|
| 1.1 | GET | `{{base_url}}/health` | Không |

**Kỳ vọng:** `200`, ví dụ `{"status":"ok"}`.

---

## 2. Seed dữ liệu catalog (khi DB trống hoặc cần thêm mẫu)

Không cần token. Thực hiện **theo thứ tự**: tạo danh mục trước, lấy `id` → tạo sản phẩm với `categoryId` đúng.

### 2.1 Tạo danh mục

| Bước | Method | URL | Body |
|------|--------|-----|------|
| 2.1.1 | POST | `{{base_url}}/categories` | JSON bên dưới |

```json
{
  "name": "Điện thoại",
  "icon": "smartphone",
  "imageUrl": "https://picsum.photos/seed/cat-phone/96/96"
}
```

`imageUrl` là **tuỳ chọn** — URL ảnh đại diện cho menu storefront (header). Bỏ field hoặc để rỗng nếu chỉ dùng icon.

**Tuỳ chọn — danh mục thứ hai:**

```json
{
  "name": "Phụ kiện",
  "icon": "headphones",
  "imageUrl": "https://picsum.photos/seed/cat-acc/96/96"
}
```

Sau mỗi lần tạo, ghi **`id`** trong response (ví dụ `1`) — dùng cho bước sản phẩm.

**Trùng danh mục (slug):** `slug` được sinh từ `name` (chuẩn hoá, không dấu). Hai danh mục **không** được cùng `slug`. Nếu `POST /categories` hoặc `PUT /categories/:id` (khi đổi `name`) dẫn tới slug đã tồn tại ở bản ghi khác, API trả **`409`** với `{ "message": "DUPLICATE_SLUG" }`. Tên rỗng / không tạo được slug hợp lệ: **`400`** (`NAME_REQUIRED` hoặc `INVALID_SLUG`).

### 2.2 Tạo sản phẩm

Thay `categoryId` bằng `id` danh mục thực tế (ví dụ `1`).

| Bước | Method | URL | Body |
|------|--------|-----|------|
| 2.2.1 | POST | `{{base_url}}/products` | JSON bên dưới |

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
  "colors": [{ "name": "Titan tự nhiên", "hex": "#3d3d3d" }],
  "storageOptions": ["128GB", "256GB"]
}
```

**Sản phẩm mẫu thứ hai (tuỳ chọn):**

```json
{
  "name": "Samsung Galaxy S24",
  "categoryId": 1,
  "price": 18990000,
  "salePrice": 17990000,
  "stock": 30,
  "featured": false,
  "description": "Mẫu test thứ hai",
  "image": "https://picsum.photos/seed/s24/400/400",
  "colors": [{ "name": "Đen", "hex": "#111111" }],
  "storageOptions": ["256GB"]
}
```

Ghi **`id`** sản phẩm để dùng cho giỏ hàng và đơn hàng.

### 2.3 Đọc catalog (public, không token)

| Bước | Method | URL |
|------|--------|-----|
| 2.3.1 | GET | `{{base_url}}/categories` |
| 2.3.2 | GET | `{{base_url}}/products?page=0&size=20` |
| 2.3.3 | GET | `{{base_url}}/products/featured` |
| 2.3.4 | GET | `{{base_url}}/products/1` |

Ở bước 2.3.4, thay `1` bằng `id` sản phẩm thật từ DB.

---

## 3. Đăng ký và đăng nhập

Mật khẩu phải **mạnh**: tối thiểu 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.

### 3.1 Đăng ký

| Bước | Method | URL | Body |
|------|--------|-----|------|
| 3.1.1 | POST | `{{base_url}}/auth/register` | JSON bên dưới |

```json
{
  "name": "Nguyen Van Test",
  "email": "testuser@local.dev",
  "password": "Demo@1234"
}
```

Nếu email đã tồn tại, dùng email khác hoặc chuyển sang đăng nhập.

### 3.2 Đăng nhập

| Bước | Method | URL | Body |
|------|--------|-----|------|
| 3.2.1 | POST | `{{base_url}}/auth/login` | JSON bên dưới |

```json
{
  "email": "testuser@local.dev",
  "password": "Demo@1234"
}
```

Copy giá trị **`token`** từ response vào biến môi trường Postman `{{token}}`.

### 3.3 Xác nhận phiên (Bearer)

| Bước | Method | URL | Header |
|------|--------|-----|--------|
| 3.3.1 | GET | `{{base_url}}/auth/me` | `Authorization: Bearer {{token}}` |

---

## 4. Profile (Bearer)

### 4.1 Lấy profile

| Bước | Method | URL |
|------|--------|-----|
| 4.1.1 | GET | `{{base_url}}/profile` |

### 4.2 Cập nhật profile

Chỉ gửi các field cần sửa. Backend chấp nhận camelCase hoặc snake_case tương đương (`dateOfBirth` / `date_of_birth`, v.v.).

| Bước | Method | URL | Body |
|------|--------|-----|------|
| 4.2.1 | PUT | `{{base_url}}/profile` | JSON bên dưới |

```json
{
  "name": "Nguyen Van Test",
  "phone": "0909123456",
  "gender": "male",
  "dateOfBirth": "1995-06-15",
  "defaultAddress": "123 Đường ABC, Quận 1, TP.HCM",
  "avatarUrl": "https://picsum.photos/seed/avatar/200/200"
}
```

---

## 5. Giỏ hàng (Bearer)

`productId` phải trùng **id số** sản phẩm trong DB. Có thể gửi dạng số hoặc chuỗi số.

### 5.1 Thêm sản phẩm vào giỏ

| Bước | Method | URL | Body |
|------|--------|-----|------|
| 5.1.1 | POST | `{{base_url}}/cart/items` | JSON bên dưới |

```json
{
  "productId": 1,
  "quantity": 2
}
```

**Có variant (tuỳ chọn):**

```json
{
  "productId": 1,
  "quantity": 1,
  "variant": "256GB"
}
```

### 5.2 Xem giỏ

| Bước | Method | URL |
|------|--------|-----|
| 5.2.1 | GET | `{{base_url}}/cart` |

Ghi **`id`** của từng dòng để dùng cho PATCH/DELETE.

### 5.3 Thay toàn bộ giỏ (tuỳ chọn)

| Bước | Method | URL | Body |
|------|--------|-----|------|
| 5.3.1 | PUT | `{{base_url}}/cart` | JSON bên dưới |

```json
{
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 2, "quantity": 1 }
  ]
}
```

### 5.4 Sửa số lượng một dòng

| Bước | Method | URL | Body |
|------|--------|-----|------|
| 5.4.1 | PATCH | `{{base_url}}/cart/items/{{cartLineId}}` | JSON bên dưới |

```json
{
  "quantity": 3
}
```

### 5.5 Xóa một dòng

| Bước | Method | URL |
|------|--------|-----|
| 5.5.1 | DELETE | `{{base_url}}/cart/items/{{cartLineId}}` |

---

## 6. Đơn hàng (Bearer)

Server **tự tính giá và tổng** từ DB; body chỉ cần mảng `items` với `productId` và `quantity` hợp lệ.

### 6.1 Tạo đơn

| Bước | Method | URL | Body |
|------|--------|-----|------|
| 6.1.1 | POST | `{{base_url}}/orders` | JSON bên dưới |

```json
{
  "items": [
    { "productId": 1, "quantity": 1 },
    { "productId": 2, "quantity": 2 }
  ]
}
```

**Một dòng tối thiểu:**

```json
{
  "items": [{ "productId": 1, "quantity": 1 }]
}
```

### 6.2 Danh sách đơn và chi tiết

| Bước | Method | URL |
|------|--------|-----|
| 6.2.1 | GET | `{{base_url}}/orders` |
| 6.2.2 | GET | `{{base_url}}/orders/{{orderId}}` |

---

## 7. Đổi mật khẩu (Bearer)

Thực hiện **sau** khi đã login; `newPassword` cũng phải đạt chuẩn mật khẩu mạnh như đăng ký.

| Bước | Method | URL | Body |
|------|--------|-----|------|
| 7.1 | POST | `{{base_url}}/auth/change-password` | JSON bên dưới |

```json
{
  "currentPassword": "Demo@1234",
  "newPassword": "NewDemo@5678"
}
```

Sau khi đổi thành công, các request tiếp theo cần đăng nhập lại với `newPassword`.

**Lưu ý:** Còn route legacy `POST /auth/changepassword` với body `oldpassword` / `newpassword` nếu cần tương thích cũ.

---

## Tóm tắt thứ tự gợi ý

1. **Health** → 2. **Categories + Products** (seed) → đọc **GET** catalog  
3. **Register** → **Login** → lưu **token** → **GET /auth/me**  
4. **GET/PUT profile**  
5. **POST cart/items** → **GET cart** → (tuỳ chọn) **PATCH/DELETE** dòng  
6. **POST orders** → **GET orders** / **GET orders/:id**  
7. **POST change-password** (và login lại nếu cần tiếp tục test)

---

## Lưu ý

- `id` category/product phụ thuộc DB; luôn lấy từ **response** hoặc **GET** list, không giả định cố định là `1` nếu đã có dữ liệu cũ.
- Đặt hàng sẽ **trừ tồn kho**; lỗi thường gặp: `productId` sai, không đủ `stock`.
- `POST /products` và `POST /categories` trong môi trường dev có thể không bắt admin — production nên bảo vệ.
- **Danh mục:** MongoDB có **unique index** trên `slug`. Nếu DB cũ đã có nhiều document trùng `slug`, cần gộp/xoá trùng hoặc đổi slug thủ công trước khi tạo index (hoặc drop collection trong dev).

---

## Tài liệu liên quan

| File | Nội dung |
|------|----------|
| [RUN_AND_TEST_POSTMAN.md](./RUN_AND_TEST_POSTMAN.md) | Chạy backend, JWT, Postman cơ bản |
| [TECHHOME_BACKEND_API_SPEC.md](./TECHHOME_BACKEND_API_SPEC.md) | Contract API đầy đủ |
