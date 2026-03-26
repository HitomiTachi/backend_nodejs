# TechHome backend — Lộ trình & hướng triển khai

Tài liệu tham chiếu khi implement: bám **`TECHHOME_BACKEND_API_SPEC.md`** (contract frontend) và **`MASTER_CODING_STANDARD.md`** (cấu trúc Express, middleware, quy ước repo). Cập nhật file này khi thay đổi quyết định kiến trúc hoặc thứ tự ưu tiên.

**Greenfield / tái xây:** Dự án backend được xây (hoặc làm lại) **chỉ với MongoDB + Mongoose** — không còn SQL driver (`mysql2`, …) cho persistence nghiệp vụ. Code cũ không còn là nguồn sự thật; triển khai bám ba tài liệu trong `docs/` đã đồng bộ.

---

## 1. Ưu tiên giữa spec, Master và repo

| Nguồn | Vai trò |
|--------|--------|
| **TechHome API spec** | **Bắt buộc** khớp URL, HTTP method, JSON DTO, Bearer, CORS dev, nghiệp vụ đặt hàng/giỏ. Tiêu chí “done” với frontend `techhome-e-commerce`. |
| **Master Coding Standard** | **Cách tổ chức:** `routes/` → middleware (validator, `checkLogin`) → logic/controller/schema; quy ước tên file; JWT + cookie/header; thông điệp lỗi. |
| **Repo (mục tiêu)** | **DB:** **MongoDB + Mongoose** — `mongoose.connect` trong `app.js`, model trong `schemas/`, persist qua document; mapper **document → DTO** JSON (spec dùng `id` số / chuỗi theo từng DTO — thiết kế schema + mapper cho khớp). |

**Nguyên tắc:** API theo **spec**; cấu trúc code và middleware theo **Master**; response lỗi JSON có **`message`** (string) để frontend parse (`ApiErrorBody`).

### 1.1 Phân quyền (RBAC) — TechHome

**Hiện trạng:** `checkLogin` đã có; `CheckPermission` trong `utils/authHandler.js` đã gắn logic kiểm tra role thật cho route bảo vệ.

**Mô hình khuyến nghị:**

| Role | Ghi chú |
|------|---------|
| `USER` | Mặc định sau đăng ký. Khách hàng: giỏ, đơn, profile; khi có API: **yêu thích**, **bình luận**. |
| `ADMIN` | Quản trị + phần còn lại (catalog, user, đơn toàn hệ thống… tùy endpoint). |
| *(tùy chọn)* `MODERATOR` | Chỉ khi cần tách người duyệt bình luận, không cần full quyền admin. |

**Khách (không đăng nhập):** không có `role` — vẫn **mua hàng / xem catalog** theo quy tắc sản phẩm; **không** được **yêu thích** hay **bình luận** (các API đó bắt buộc đăng nhập + `USER`/`ADMIN`/`MODERATOR` tùy thiết kế).

**Đã triển khai cốt lõi:** field `role` trong schema `User` (default `USER`), `CheckPermission('ADMIN')` cho route admin, frontend có `AdminRoute` để chặn truy cập UI `/admin/*`.

---

## 2. Hướng giải quyết tổng thể

1. **Một cây route dưới `/api`** trùng bảng endpoint trong spec (có thể giữ alias `/api/v1/...` tạm cho tương thích cũ).
2. **Lớp mapper:** Document Mongoose / field lưu trong DB → `toProductDto`, `toProfileDto`, `toCartItem`, `toOrderDto` — response luôn đúng contract TypeScript.
3. **Auth:** JWT; **register** trả `{ token, user }`; **change-password** đúng path/body spec (`POST /auth/change-password`, `currentPassword` / `newPassword`).
4. **Orders:** module mới + schema Mongoose (ví dụ `Order`, embedded hoặc ref `orderItems`); `startSession()` / transaction khi cần; **tính lại giá/tồn server-side**, không tin mù `totalPrice` / `items[].price` từ client.
5. **Cart:** đủ path `GET/POST/PATCH/DELETE/PUT` theo spec; mọi mutation trả **`CartItem[]`** đầy đủ sau thao tác.
6. **Products:** `GET /products` với `category`, `q`, `page`, `size`; thống nhất với frontend: mảng `ProductDto[]` hay object phân trang — **đối chiếu `src/services/backend.ts`**.
7. **Global:** CORS whitelist theo spec; error handler cho `/api/**` trả JSON `{ message }` (không render view cho API).

---

## 3. Lộ trình theo giai đoạn

| Giai đoạn | Nội dung | Ghi chú |
|-----------|----------|---------|
| **A — Nền** | `GET /health`; CORS; `express.json()`; lỗi JSON cho API | Thứ tự middleware như Master §1.2 |
| **B — Catalog** | Categories; products list/detail/featured; mapper `ProductDto` | Thứ tự route: `/featured` trước `/:id` |
| **C — Auth** | Register/login → `AuthResponse`; Bearer-first cho SPA | `checkLogin` ưu tiên `Authorization: Bearer` |
| **D — Profile & password** | `GET /profile` → `ProfileDto`; `POST /auth/change-password` | Validator/cập nhật field camelCase trong body |
| **E — Cart** | Đủ 5 endpoint cart; `CartItem[]` sau mọi thay đổi | `routes/cart.js` hoặc `carts.js` theo convention repo |
| **F — Orders** | Mongoose: list/detail/create; ownership `userId` | Transaction + §6.1 spec |
| **G — fetch-specs** | `POST /products/:id/fetch-specs` — stub hoặc enrich | Có thể trả `ProductDto` hiện tại nếu chưa có pipeline |
| **H — Mở rộng** | Upload file, socket (Master §0.6–0.7) | Sau khi storefront API ổn định |
| **I — RBAC** | Field `role` trên User; `CheckPermission` thật; route admin / yêu thích / bình luận | Bám §2.1 spec + §1.1 roadmap |

Thứ tự gợi ý trong spec §8 tương đương: health → catalog → auth → profile/password → cart → orders → fetch-specs.

---

## 4. Cách thực hiện theo khối

### 4.1 CSDL (Mongoose)

- Collection/schema: `orders` (và line items theo thiết kế model), `products`, `categories`, `carts` / line cart — bám `schemas/` và Master §0.3 / §1.1.
- Bổ sung field schema nếu thiếu (`salePrice`, `images`, `stock`, …) để khớp `ProductDto`.
- Cart: subdocument hoặc collection riêng; lưu snapshot dòng (`name`, `price`, `image`) nếu cần khi giá sản phẩm thay đổi.

### 4.2 Products & categories

- `populate('category')` hoặc query + join thủ công → `categoryName`, `categoryId` trong DTO.
- List: lọc `category`, tìm `q`, phân trang `page`/`size` (`.skip()` / `.limit()` hoặc aggregation).
- **CategoryDto:** `icon` và `imageUrl` (ảnh đại diện menu) tuỳ chọn — mapper `toCategoryDto` trong `utils/mappers/catalogDto.js`; schema `schemas/categories.js` lưu `imageUrl`.

### 4.3 Auth

- Sau register: ký JWT giống login.
- Đổi mật khẩu: bcrypt; cập nhật hash + `password_changed_at` / `passwordChangedAt` trong response khi có.

### 4.4 Cart

- Hàm nội bộ `getCartItemsForUser(userId)` → `CartItem[]` dùng lại cho GET và sau POST/PATCH/DELETE/PUT.
- `id` dòng giỏ / `productId`: stringify nếu spec yêu cầu string.
- `PUT /cart`: replace toàn bộ trong transaction.

### 4.5 Orders

- **POST:** mỗi dòng — load sản phẩm, kiểm tra tồn, giá server; tổng server là nguồn sự thật; từ chối khi lệch giá/tồn.
- **GET:** chỉ đơn của `req.user.id`; `:id` kiểm tra ownership.

### 4.6 Lỗi & validator

- Ưu tiên body `{ message: string }` cho API.
- Validator: có thể dùng 400 thay vì 404 cho lỗi validation nếu muốn rõ nghĩa — **khớp cách parse trong `api.ts` frontend**.

### 4.7 Khi cần cập nhật frontend để khai thác G (fetch-specs)

- Bạn muốn dùng thật tính năng G (không chỉ để backend “có endpoint”).
- Team cần workflow admin làm giàu specs cho sản phẩm mới/import hàng loạt.
- Trang chi tiết cần hiển thị thông số chuẩn hóa (chip, pin, màn hình, storage...) thay vì dữ liệu rời rạc.
- Bạn muốn QA/UAT kiểm chứng end-to-end “bấm enrich -> dữ liệu đổi ngay trên UI”.
- Bạn cần giảm thao tác thủ công nhập specs trong CMS/admin.

---

## 5. Rủi ro / điểm cần thống nhất sớm

1. **`GET /products`:** response chỉ `ProductDto[]` hay kèm meta phân trang — phải khớp `backend.ts`.
2. **`id` trong JSON vs Mongo:** DTO frontend dùng `number` cho nhiều field (`productId`, `id` đơn hàng, …). Cần quy ước schema (field số tăng, hoặc map `_id` → id hiển thị) và **một** mapper thống nhất — tránh lệch kiểu giữa các route.
3. **Socket / file:** không chặn MVP storefront; lên kế hoạch sau (Master §0.6–0.7).

---

## 6. Định nghĩa hoàn thành (MVP khớp frontend)

- Toàn bộ endpoint trong **TechHome spec §4** hoạt động với schema **§5**.
- Frontend: `VITE_API_URL=http://<host>:<port>/api` — kiểm tra luồng §9 spec.
- Code tách route / middleware / mapper rõ; không dùng view engine cho JSON API.

---

## 7. File & dependency trong repo

| File / mục | Mục đích |
|------|----------|
| `docs/TECHHOME_BACKEND_API_SPEC.md` | Contract API & DTO |
| `docs/MASTER_CODING_STANDARD.md` | Chuẩn cấu trúc & pattern repo |
| `docs/TECHHOME_IMPLEMENTATION_ROADMAP.md` | **File này** — lộ trình và cách làm |
| `docs/FRONTEND_BACKEND_STATUS.md` | Hiện trạng endpoint/DTO thực tế cho team frontend |
| `package.json` | **`mongoose`** cho persistence; **không** dùng `mysql2` — code cũ phụ thuộc SQL cần xóa/refactor khi làm lại app |

Frontend (monorepo khác): `src/services/backend.ts`, `src/services/api.ts`, `src/types/api.ts`.

---

*Cập nhật khi đổi thứ tự ưu tiên hoặc sau khi đồng bộ contract với frontend. Stack persistence: chỉ Mongoose — xem `MASTER_CODING_STANDARD.md` §0.3.*
