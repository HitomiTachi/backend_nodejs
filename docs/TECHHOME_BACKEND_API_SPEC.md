# TechHome — Backend API specification (for AI / implementers)

> **Mục đích:** Tài liệu neo để AI hoặc developer xây backend **khớp chính xác** với frontend `techhome-e-commerce`.  
> **Nguồn sự thật trong repo frontend:** `src/services/backend.ts`, `src/services/api.ts`, `src/types/api.ts`, `src/types/index.ts` (`CartItem`).

**Backend repo này (TechHome):** persistence **MongoDB + Mongoose** — xem `docs/MASTER_CODING_STANDARD.md` (cấu trúc, pattern) và `docs/TECHHOME_IMPLEMENTATION_ROADMAP.md` (lộ trình). JSON API trả field `id` / số theo DTO bên dưới: lớp mapper map từ document Mongoose (ví dụ `_id` hoặc field số tùy thiết kế schema).

---

## 1. Bối cảnh

| Hạng mục | Giá trị |
|----------|---------|
| Frontend | React + Vite, dev server **port 3000** |
| Base URL API | Biến **`VITE_API_URL`** — ví dụ `http://localhost:8080/api` (**không** có `/` ở cuối) |
| Mặc định nếu thiếu env | `http://localhost:8080/api` (xem `src/services/api.ts`) |
| Prefix route | Mọi path trong bảng §4 là **relative** sau base (đã bao gồm `/api`) |
| Persistence (backend repo) | **MongoDB** qua **Mongoose** (`schemas/`); không dùng SQL driver cho domain chính |

**CORS:** Cho phép origin dev: `http://localhost:3000`, `http://127.0.0.1:3000` (và có thể `3001` nếu đổi port frontend).  
**Content-Type:** `application/json` cho body có JSON.

---

## 2. Xác thực

- Header: **`Authorization: Bearer <token>`** cho mọi route đánh dấu *Requires auth* ở §4.
- Login / Register trả về **`token`** (chuỗi) + **`user`** — frontend lưu `localStorage` (không bắt buộc cookie).
- Backend dùng **JWT RS256**; ký bằng `JWT_PRIVATE_KEY`, xác thực bằng `JWT_PUBLIC_KEY`, token gửi qua header `Authorization: Bearer <token>`.

**Logout:** Frontend **không** gọi endpoint — chỉ xóa token client-side.

### 2.1 Phân quyền & vai trò (RBAC)

**Trạng thái code:** `utils/authHandler.js` đã có `checkLogin` (xác thực JWT) và `CheckPermission(...)` kiểm tra role thực thi (ví dụ `CheckPermission('ADMIN')`); message lỗi quyền thống nhất `ban khong co quyen`.

#### Khuyến nghị: **2 role** lưu trong DB (đủ cho hầu hết dự án)

| Giá trị `role` (string) | Mô tả |
|-------------------------|--------|
| `USER` | Người dùng đã đăng ký — **mặc định** sau `POST /auth/register`. Quyền khách hàng: profile, giỏ, đơn (theo §4.2), và khi có API: **yêu thích**, **bình luận** sản phẩm. |
| `ADMIN` | Quản trị — CRUD catalog / đơn / user (theo endpoint admin khi bổ sung), và các thao tác còn lại không dành cho khách. |

**Role thứ ba (tùy chọn):** `MODERATOR` — chỉ dùng nếu cần tách người **kiểm duyệt bình luận** mà không cấp full `ADMIN`. Nếu không có nhu cầu, **không** thêm role thứ ba.

#### Khách chưa đăng nhập (**anonymous** — không phải role trong DB)

- Không có token hợp lệ → không gắn `req.user`.
- **Quy tắc sản phẩm (storefront):** vẫn **xem & mua hàng** (catalog, đặt hàng — chi tiết guest cart / guest checkout do từng phiên bản API + frontend quyết định; bảng §4 hiện mô tả nhiều thao tác *Requires auth* theo contract `backend.ts`).
- **Luôn cấm khi chưa đăng nhập:** **yêu thích sản phẩm**, **bình luận sản phẩm** — các route đó (khi có) bắt buộc `checkLogin` và role `USER` hoặc `ADMIN` (hoặc `MODERATOR` nếu chỉ kiểm duyệt).

#### Đã đăng nhập

- **`USER`:** toàn bộ quyền khách hàng trong contract (§4.2, §5), trừ route ghi rõ *admin only*.
- **`ADMIN`:** quyền `USER` trên luồng storefront (nếu có) **cộng** quyền quản trị; route admin chỉ `CheckPermission('ADMIN')` (hoặc danh sách role được phép).

#### JWT / DB

- Có thể embed `role` trong JWT **hoặc** đọc `role` từ DB sau `checkLogin` — **chọn một** và giữ nhất quán trong repo.

---

## 3. Định dạng lỗi

- HTTP status: 4xx / 5xx theo chuẩn.
- Body JSON nên có **`message`** (string) — frontend parse qua `ApiErrorBody` (`src/types/api.ts`).
- Có thể thêm field khác; frontend chủ yếu hiển thị `message`.
- **204 No Content:** Một số helper client coi 204 là thành công, không đọc JSON — tránh 204 nếu response cần body (hoặc đảm bảo client không expect JSON).

---

## 4. Bảng endpoint (bắt buộc khớp)

Path trong cột **Path** = nối sau base URL (vd. base `.../api` + path `/health` → `GET .../api/health`).

### 4.1 Public (không bắt buộc Bearer)

| Method | Path | Query / Body | Response JSON |
|--------|------|----------------|---------------|
| GET | `/health` | — | `{ "status": string }` |
| GET | `/categories` | Query: `parentId?` (number or `null`) để lấy danh mục con theo cha | `CategoryDto[]` |
| GET | `/categories/children/slug/:slug` | `slug` của danh mục cha | `CategoryDto[]` |
| GET | `/products` | Query: `category?` (number), `q?`, `page?`, `size?` — có thể rỗng | `ProductDto[]` |
| GET | `/products/:id` | `id` numeric | `ProductDto` |
| GET | `/products/featured` | — | `ProductDto[]` |
| POST | `/products/:id/fetch-specs` | Body: `{}` | `ProductDto` |
| POST | `/auth/login` | `AuthRequest` | `AuthResponse` |
| POST | `/auth/register` | `RegisterRequest` | `AuthResponse` |

**Ghi chú:** `GET /health` và `POST .../fetch-specs` có thể chưa được gọi từ UI nhưng **đã khai báo** trong `backend.ts` — nên implement để contract đầy đủ.

**Catalog — danh mục (CRUD trong code, dev):** `POST /categories` body `{ "name": string, "icon"?: string, "imageUrl"?: string }` (`imageUrl` = URL ảnh đại diện cho menu storefront, tuỳ chọn); `PUT /categories/:id` có thể cập nhật `name` / `icon` / `imageUrl` (gửi `imageUrl` rỗng hoặc `null` để xoá ảnh). Trường `slug` do server sinh từ `name` và **phải duy nhất** toàn collection. Trùng slug (so với bản ghi khác): **`409`**, `{ "message": "DUPLICATE_SLUG" }`. Tên rỗng hoặc không tạo được slug: **`400`**, `NAME_REQUIRED` / `INVALID_SLUG`. Unique index MongoDB trên `slug` — nếu dữ liệu cũ đã trùng slug, cần dọn DB trước khi index áp dụng.

### 4.2 Requires auth (Bearer)

| Method | Path | Body | Response JSON |
|--------|------|------|---------------|
| POST | `/auth/change-password` | `{ "currentPassword": string, "newPassword": string }` | `{ "message": string, "passwordChangedAt"?: string }` |
| GET | `/profile` | — | `ProfileDto` |
| GET | `/orders` | — | `OrderDto[]` — **chỉ đơn của user đang đăng nhập** |
| GET | `/orders/:id` | — | `OrderDto` — **chỉ nếu đơn thuộc user** |
| POST | `/orders` | `CreateOrderRequest` | `OrderDto` |
| GET | `/cart` | — | `CartItem[]` |
| POST | `/cart/items` | Xem §5.1 | `CartItem[]` (**toàn bộ giỏ sau thao tác**) |
| PATCH | `/cart/items/:id` | `{ "quantity": number }` | `CartItem[]` |
| DELETE | `/cart/items/:id` | — | `CartItem[]` |
| PUT | `/cart` | `{ "items": CartItem[] }` | `CartItem[]` |

---

## 5. Schema JSON (TypeScript = contract)

### 5.1 CategoryDto

```ts
{
  id: number;
  name: string;
  slug: string;
  parentId?: number | null; // null => danh mục cha (top-level)
  icon?: string | null;
  imageUrl?: string | null;
}
```

`icon`: tên icon (ví dụ Material Icons) — tuỳ chọn. `imageUrl`: URL ảnh đại diện danh mục — tuỳ chọn; storefront ưu tiên ảnh khi có, fallback icon.

### 5.2 ProductDto

```ts
{
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  images?: string[] | null;  // gallery; UI ưu tiên images[0] nếu có
  price: number;
  salePrice?: number | null; // khi có và < price → hiển thị giảm giá
  categoryId: number;
  categoryName: string;
  stock: number;
  featured: boolean;
  specifications: string | null; // thường là JSON string specs
  colors?: { name: string; hex: string }[];
  storageOptions?: string[];
}
```

### 5.3 Auth

```ts
// POST /auth/login
type AuthRequest = { email: string; password: string };

// POST /auth/register
type RegisterRequest = { name: string; email: string; password: string };

type AuthUserDto = { id: number; name: string; email: string; role: 'USER' | 'ADMIN' | 'MODERATOR' };

// Response login + register
type AuthResponse = { token: string; user: AuthUserDto };
```

### 5.4 ProfileDto

```ts
{
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  defaultAddress?: string | null;
  passwordChangedAt?: string | null;
}
```

### 5.5 Orders

```ts
type CreateOrderItemRequest = {
  productId: number;
  quantity: number;
  price: number; // đơn giá tại thời điểm đặt (client gửi — server phải validate)
};

type CreateOrderRequest = {
  totalPrice: number;
  items: CreateOrderItemRequest[];
};

type OrderItemDto = {
  productId: number;
  productName: string;
  productImage?: string | null;
  quantity: number;
  priceAtOrder: number;
};

type OrderDto = {
  id: number;
  userId: number;
  totalPrice: number;
  status: string;
  createdAt: string; // ISO 8601 khuyến nghị
  items: OrderItemDto[];
};
```

### 5.6 CartItem (mỗi dòng giỏ)

```ts
{
  id: string;           // id dòng giỏ (server-generated hoặc stable)
  productId: string;    // frontend dùng string; map sang product DB
  name: string;
  price: number;
  quantity: number;
  image: string;
  variant?: string;
}
```

**POST `/cart/items` — body frontend gửi:**

```ts
{
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity?: number;
  variant?: string;
}
```

Mọi response **POST/PATCH/DELETE/PUT** trên cart phải trả **`CartItem[]`** = trạng thái giỏ đầy đủ sau thao tác.

---

## 6. Quy tắc nghiệp vụ (bắt buộc đọc khi implement)

### 6.1 Đặt hàng `POST /orders`

- Frontend chỉ gọi khi user đã đăng nhập và `productId` mỗi dòng parse được thành **số**.
- Body có **`totalPrice`** và **`items[].price`** từ client — **không được tin mù**: backend phải:
  - Tra giá/tồn từ DB tại thời điểm đặt;
  - Tính lại tổng (và thuế/phí nếu có) theo quy tắc server;
  - Từ chối nếu không đủ hàng hoặc giá lệch.
- Client hiện tại có thể gửi total gồm subtotal − voucher (mock) + ship + tax 8% — server không bắt buộc khớp công thức đó nhưng **phải có nguồn sự thật phía server**.

### 6.2 Query `GET /products`

- Tham số: `category`, `q`, `page`, `size` — tất cả optional.
- Frontend có thể gọi với `page=0`, `size=100` — backend nên hỗ trợ phân trang hoặc trả mảng rút gọn hợp lý.

### 6.3 Trạng thái đơn (`OrderDto.status`)

- Kiểu **string**. UI có badge cho các nhãn gần giống: `Processing`, `Delivered`, `Shipping`, `Shipped`, `Cancelled`, `PENDING`.
- Nên thống nhất một bộ enum server-side và map/alias nếu cần.

### 6.4 Giỏ hàng

- Giỏ gắn với **user đã đăng nhập** (theo token).
- `PUT /cart` có thể ít được gọi từ UI hiện tại nhưng **đã có trong client** — implement để replace toàn bộ giỏ khi cần.

---

## 7. Phạm vi ngoài contract hiện tại

Các phần sau **chưa** có trong `src/services/backend.ts` — không bắt buộc cho MVP storefront, nhưng sản phẩm đầy đủ có thể cần sau:

- CRUD sản phẩm / upload ảnh **admin** (UI nhiều chỗ vẫn mock).
- Voucher / thanh toán cổng thật.
- `PATCH /profile` hoặc upload avatar (profile hiện mix API + local).

Khi thêm endpoint mới, cập nhật **`backend.ts`** + **`types/api.ts`** phía frontend và đồng bộ tài liệu này.

---

## 8. Thứ tự triển khai gợi ý

1. `GET /health` + CORS + JSON middleware.  
2. `GET /categories`, `GET /products`, `GET /products/:id`, `GET /products/featured`.  
3. `POST /auth/register`, `POST /auth/login` + JWT.  
4. `GET /profile`, `POST /auth/change-password`.  
5. Cart: `GET/POST/PATCH/DELETE` + `PUT /cart`.  
6. `POST /orders`, `GET /orders`, `GET /orders/:id` với kiểm tra ownership.  
7. `POST /products/:id/fetch-specs` (nếu có pipeline enrich specs).

---

## 9. Kiểm tra khớp với frontend

Sau khi backend chạy:

1. Đặt `.env` frontend: `VITE_API_URL=http://<host>:<port>/api`.  
2. Chạy `npm run dev` (port 3000).  
3. Kiểm tra: đăng ký/đăng nhập, danh mục/sản phẩm, giỏ (khi login), đặt hàng, lịch sử đơn.

**File tham chiếu nhanh trong monorepo frontend:**

- `src/services/backend.ts` — danh sách hàm ↔ endpoint  
- `src/types/api.ts` — DTO  
- `src/services/api.ts` — Bearer, base URL, parse lỗi  

---

## 10. Tài liệu liên quan (repo backend Node)

| File | Vai trò |
|------|---------|
| `docs/MASTER_CODING_STANDARD.md` | Kiến trúc Express + **Mongoose**, quy ước file, auth, CRUD pattern |
| `docs/TECHHOME_IMPLEMENTATION_ROADMAP.md` | Lộ trình triển khai, mapper DTO, thứ tự giai đoạn |
| `docs/FRONTEND_BACKEND_STATUS.md` | Hiện trạng backend thực tế vs contract — hướng dẫn frontend |

---

*Tài liệu này phục vụ implementation backend (MongoDB/Mongoose). Khi đổi contract trong code frontend, cập nhật file này cùng lúc; khi đổi stack hoặc cấu trúc folder, cập nhật Master + Roadmap cho khớp.*
