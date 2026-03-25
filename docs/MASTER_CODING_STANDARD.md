# Master Coding Standard (Tổng hợp Technical Profile)

Tài liệu này là **nguồn chuẩn** để tái tạo cấu trúc, phong cách và tư duy lập trình (Node/Express + Mongoose) khi refactor hoặc generate code cho dự án khác — bám **100%** wiring Express, naming, boilerplate CRUD, auth/permission, validator, slugify, soft-delete (`isDeleted`), và quy ước lỗi/phản hồi.

**Nguồn hợp nhất:** các Technical Profile trong cùng repo (nhánh hiện tại).

**Đồng bộ tài liệu TechHome (repo backend này):**

| Tài liệu | Nội dung |
|----------|----------|
| `docs/TECHHOME_BACKEND_API_SPEC.md` | Contract REST + JSON DTO cho frontend `techhome-e-commerce` |
| `docs/TECHHOME_IMPLEMENTATION_ROADMAP.md` | Lộ trình triển khai theo spec + pattern dưới đây |
| `docs/FRONTEND_BACKEND_STATUS.md` | **Snapshot hiện trạng API** để frontend đồng bộ với backend thực tế |

**Stack persistence (bắt buộc):** **MongoDB + Mongoose** — không dùng `mysql2`, PostgreSQL driver, hay ORM SQL cho entity nghiệp vụ (user, product, category, cart, order, …). Mọi CRUD đi qua `schemas/` (Mongoose model).

---

## Mục lục

0. [Yêu cầu dự án: REST, CSDL, auth, CRUD, file, socket](#0-yêu-cầu-dự-án-rest-csdl-auth-crud-file-socket)
1. [Kiến trúc tổng thể](#1-kiến-trúc-tổng-thể-architecture-layers)
2. [Quy tắc định danh](#2-bộ-quy-tắc-định-danh-final-naming-convention)
3. [Pattern boilerplate](#3-pattern-boilerplates-chuẩn-code-mẫu)
4. [Error & response mapping](#4-error--response-mapping-chuỗi-message--status)
5. [Anomaly (không nhất quán)](#5-anomaly-điểm-không-nhất-quán-cần-ghi-nhớ-khi-giống-hệt)
6. [Ghi chú sử dụng](#ghi-chú-sử-dụng)

---

## 0) Yêu cầu dự án: REST, CSDL, auth, CRUD, file, socket

Phần này **bắt buộc** khi phát triển/giữ backend trong dự án (bổ sung — bám sát **CRUD** và **RESTful**): định hướng **CRUD** trên **API RESTful**, có **CSDL**, **xác thực & phân quyền**, **xử lý file**, **socket** — code Node.js và extension theo **cấu trúc thư mục/tên file** đã quy ước trong tài liệu (và phần *mở rộng do chủ dự án bổ sung sau*).

### 0.1 Mô hình: RESTful API — không làm MVC

- **Bắt buộc:** thiết kế theo **REST** — tài nguyên (resource) gắn với URL dạng danh từ số nhiều, dùng đúng **HTTP verbs** (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) và **mã trạng thái HTTP** có ý nghĩa; payload/response ưu tiên **JSON** (trừ upload file/stream đặc thù).
- **Tuyệt đối không** tổ chức backend theo **MVC truyền thống** (Model–View–Controller với **View** render HTML server-side làm trung tâm, hay pattern full MVC kiểu ứng dụng web “trang + controller + view template” cho toàn bộ luồng nghiệp vụ).
- **Cho phép / khuyến nghị trong repo này:** tách theo lớp **routes → (middleware: validator, auth, permission) → controller logic / schema (model)** — **không** đặt tên hay cấu trúc theo kiểu `IRepository`, `*Controller` class MVC framework; **không** dùng View engine làm lớp chính của API (nếu có `views/` chỉ phục vụ trang lỗi tối thiểu theo [mục 1.2 mục 9](#12-luồng-dữ-liệu-data-flow-end-to-end), không dùng để render UI nghiệp vụ).

**Ánh xạ CRUD → HTTP (chuẩn hóa hành vi):**

| Hành vi | Method | Đường dẫn ví dụ | Ghi chú |
|--------|--------|------------------|--------|
| Liệt kê / lọc | `GET` | `/api/v1/<resources>` | Query string cho filter/pagination |
| Chi tiết | `GET` | `/api/v1/<resources>/:id` | |
| Tạo | `POST` | `/api/v1/<resources>` | Body JSON (+ validator) |
| Cập nhật | `PUT` hoặc `PATCH` | `/api/v1/<resources>/:id` | Theo convention file route trong repo |
| Xóa (soft-delete) | `DELETE` | `/api/v1/<resources>/:id` | `isDeleted: true` theo profile |
| Slug (nếu có) | `GET` | `/api/v1/<resources>/slug/:slug` | Theo [3.1.2](#312-get-slugslug) |

### 0.2 Stack & extension

- **Runtime:** Node.js.
- **Framework / thư viện:** Express (và các package đã/kế hoạch dùng trong `package.json`: ví dụ `mongoose`, `jsonwebtoken`, `express-validator`, `bcrypt`, `slugify`, `multer` hoặc tương đương cho file, `socket.io` hoặc `ws` cho socket — **bám theo lựa chọn thực tế của repo**).
- Mọi dependency mới phải **phục vụ** REST API, CSDL, auth, CRUD, file hoặc socket; tránh thêm lớp “MVC framework” thay thế kiến trúc đã quy ước.

### 0.3 Cơ sở dữ liệu (CSDL)

- **Bắt buộc** có CSDL: **MongoDB + Mongoose** — `mongoose.connect(...)` trong `app.js`, model/schema trong `schemas/`.
- Mọi entity CRUD phải **persist** qua Mongoose; không thay bằng mock cứng trong production path.
- **Loại trừ:** không dùng driver/ORM SQL (`mysql2`, `pg`, Sequelize kết nối MySQL/Postgres, …) cho dữ liệu domain chính. (Repo TechHome: greenfield Mongoose-only; xem bảng đồng bộ tài liệu ở đầu file.)

### 0.3.1 Quy tắc thực thi khi sửa code (bắt buộc)

Mọi chỉnh sửa trong repo phải bám **`docs/CODE_CHANGE_RULES.md`** (tìm đúng file, không phá dependency, chia nhỏ thay đổi, kiểm tra sau mỗi bước, không đổi business logic ngoài scope).

### 0.4 Authentication & Authorization

- **Authentication:** đăng ký/đăng nhập, JWT **RS256** (cookie `token_login_tungNT` + header `Bearer`), luồng như [mục 3.2](#32-auth-boilerplate-jwt-cookieheader).
- **Authorization:** phân quyền theo role/permission — middleware `CheckPermission(...)` và chuỗi message `ban khong co quyen` theo [mục 1.2](#12-luồng-dữ-liệu-data-flow-end-to-end) và [4.1](#41-danh-sách-chuỗi-message-lỗi-quan-sát-được).
- Route cần bảo vệ: gắn `checkLogin` và `CheckPermission` đúng thứ tự với validator (theo từng endpoint).

**TechHome (repo này):** vai trò & quy tắc khách / `USER` / `ADMIN` (và role tùy chọn) được **định nghĩa** trong `docs/TECHHOME_BACKEND_API_SPEC.md` §2.1 và `docs/TECHHOME_IMPLEMENTATION_ROADMAP.md` §1.1. Khi implement endpoint cần phân quyền (admin, yêu thích, bình luận, …), **không** để `CheckPermission` no-op; map `req.user.role` (hoặc claim JWT) với tên role trong spec.

### 0.5 CRUD cho các entity

- Mỗi entity chính: **route file** tương ứng trong `routes/`, **schema** trong `schemas/`, logic tái sử dụng trong `controllers/` khi có pattern chung.
- Tuân thủ boilerplate [mục 3.1](#31-crud-boilerplates-routes): list có `.filter(!isDeleted)`, slug, detail, create, update, soft-delete.

### 0.6 Xử lý file (upload / static)

- **Bắt buộc** có khả năng xử lý file phía server: upload (multipart), lưu trữ an toàn (thư mục `public/` hoặc storage quy ước), trả về URL/path trong JSON response khi cần.
- Dùng middleware phù hợp (vd `multer` + `express.static`); **không** chuyển sang mô hình MVC chỉ để phục vụ upload.

### 0.7 Socket (realtime)

- **Bắt buộc** tích hợp **socket** cho realtime (thông báo, trạng thái đơn, chat, v.v. — theo nghiệp vụ).
- Khởi tạo trong entry (`bin/www` + `app.js` hoặc module riêng, ví dụ `socket/` hoặc `utils/socketHandler.js` — **tên file/thư mục cụ thể do chủ dự án bổ sung vào bảng dưới**).
- Auth socket (nếu có): thống nhất với JWT/session đã quy định, tránh lộ kênh không kiểm soát.

### 0.8 Cấu trúc folder & file — mở rộng (bạn bổ sung sau)

Các đường dẫn sau là **khung** đã nêu trong tài liệu; thêm cột **ghi chú / file mới** khi bạn mở rộng dự án:

| Khu vực | Đường dẫn / pattern | Ghi chú (bổ sung sau) |
|---------|---------------------|------------------------|
| Entry | `app.js`, `bin/www` | |
| Routes | `routes/<resource>.js` | |
| Controllers | `controllers/<resource>.js` | |
| Schemas | `schemas/<resource>.js` | |
| Utils | `utils/authHandler.js`, `validatorHandler.js`, … | |
| File upload | *(định nghĩa sau, vd `middlewares/upload.js`, `public/uploads/`)* | |
| Socket | *(định nghĩa sau)* | |

---

## 1) Kiến trúc Tổng thể (Architecture Layers)

### 1.1 Cấu trúc thư mục chuẩn cuối cùng

- `app.js`
- `routes/`
  - `index.js`
  - `users.js`
  - `auth.js`
  - `roles.js`
  - `products.js`
  - `categories.js`
  - `carts.js`
  - `orders.js` — theo `TECHHOME_BACKEND_API_SPEC.md` (đơn hàng storefront)
  - `profile.js` hoặc gộp trong `users` — tùy cách mount; spec dùng `GET /profile`
- `controllers/`
  - `users.js` (export object logic functions)
- `schemas/` (Mongoose model/schemas)
  - `users.js`, `roles.js`, `products.js`, `categories.js`, `carts.js`, `orders.js`, `inventories.js`, `reservations.js`…
- `utils/`
  - `authHandler.js` — JWT auth + permission middleware factory
  - `validatorHandler.js` — express-validator rule arrays + `handleResultValidator`
  - `senMailHandler.js` — sendMail helper
  - `GenToken.js` — token helper
  - `IncrementalIdHandler.js` — incremental id helper

**Entry point** (`package.json`):

```json
"start": "nodemon ./bin/www"
```

### 1.2 Luồng dữ liệu (Data Flow) end-to-end

1. **Request vào `app.js`**
   - Middleware theo thứ tự:
     - `morgan('dev')`
     - `express.json()`
     - `express.urlencoded({ extended: false })`
     - `cookieParser()`
     - `express.static(path.join(__dirname, 'public'))`

2. **DB bootstrap trong `app.js`**
   - `mongoose.connect('mongodb://localhost:27017/NNPTUD-C6')`
   - Listener `connected` / `disconnected` chỉ `console.log`

3. **Router mount**
   - `/` → `./routes/index`
   - `/api/v1/users` → `./routes/users`
   - `/api/v1/auth` → `./routes/auth`
   - `/api/v1/roles` → `./routes/roles`
   - `/api/v1/products` → `./routes/products`
   - `/api/v1/categories` → `./routes/categories`
   - `/api/v1/carts` → `./routes/carts`
   - `/api/v1/orders` → `./routes/orders` (khi implement TechHome spec)
   - `/api/v1/profile` hoặc `/api/profile` — khớp contract frontend

4. **Validator (nếu endpoint có)**
   - Rule arrays từ `utils/validatorHandler.js`
   - `handleResultValidator` dùng `validationResult(req)`:
     - nếu lỗi: `res.status(404).send(result.errors.map(e => e.msg)); return;`
     - nếu OK: `next()`

5. **Auth/Permission (nếu endpoint có)**
   - `checkLogin`:
     - token ưu tiên cookie `req.cookies.token_login_tungNT`
     - fallback header `req.headers.authorization` dạng `Bearer <token>`
   - `jwt.verify(token, JWT_PUBLIC_KEY, { algorithms: ['RS256'] })` + check exp (key có thể nạp từ `JWT_PUBLIC_KEY_PATH` hoặc `JWT_PUBLIC_KEY`)
     - load user: `req.user = userController.FindById(result.id)`
     - not valid: `res.status(403).send("ban chua dang nhap")`
   - `CheckPermission(...requiredRole)`:
     - `role = req.user.role`
     - ok: `next()`
     - fail: `res.status(403).send("ban khong co quyen")`

6. **Controller / handler logic**
   - Route handler gọi trực tiếp model/schema hoặc controller object

7. **Schema/Mongoose layer**
   - Schema field có hook (ví dụ hash password bằng `bcrypt` trong `pre('save')`)
   - CRUD có thể dùng:
     - `populate()`
     - `startSession()` / `session.startTransaction()` khi create sản phẩm (transaction)

8. **Response**
   - Thành công: `res.send(...)` hoặc `res.status(200).send(...)`
   - Lỗi: dùng mapping ở [mục (4)](#4-error--response-mapping-chuỗi-message--status)

9. **404 + Error middleware**
   - 404 unhandled: `next(createError(404))`
   - Error handler trong `app.js`:
     - với **API** (`/api`, `/api/v1`): trả **JSON** `{ message: string }` (và `status` nếu cần) để khớp `TECHHOME_BACKEND_API_SPEC.md` §3 và frontend `ApiErrorBody`.
     - với route không phải API (nếu còn): có thể render view `error` như mô tả cũ (`res.locals.message`, …).

---

## 2) Bộ Quy tắc Định danh (Final Naming Convention)

### 2.1 Quy tắc tên file (bắt buộc)

- `routes/`: `routes/<resource>.js` (plural theo repo hiện hữu; không suffix/prefix)
  - `users.js`, `auth.js`, `roles.js`, `products.js`, `categories.js`, `carts.js`, `index.js`
- `controllers/`: `controllers/<resource>.js`
  - hiện hữu: `controllers/users.js`
- `schemas/`: `schemas/<resource>.js`
  - plural: `users`, `roles`, `products`, `categories`, `carts`, `inventories`, `reservations`…
- `utils/`: `utils/<name>.js` theo pattern repo:
  - `authHandler.js`
  - `validatorHandler.js`
  - `senMailHandler.js`
  - `GenToken.js`
  - `IncrementalIdHandler.js`

Không áp dụng convention kiểu `I[Name]Repository` hoặc `[Name]Controller`.

### 2.2 Naming biến/parameter

- Parameter bắt buộc trong mọi handler/middleware: `req`, `res`, `next`
- Local variables (camelCase):
  - Auth/token/user: `token`, `user`, `getUser`, `newUser`
  - CRUD results: `data`, `result`, `users`, `newObj`, `newItem`, `updatedItem`, `saved`
  - Product query: `titleQ`, `maxPrice`, `minPrice`, `slug`
  - Index khi dùng `findIndex`: `index`
  - Transaction: `session`, `newInventory`

### 2.3 Naming function/object export

- `controllers/*`: export object với **PascalCase** function keys  
  - `CreateAnUser`, `FindByUsername`, `FindByEmail`, `FindByToken`, `FailLogin`, `SuccessLogin`, `GetAllUser`, `FindById`
- `utils/authHandler.js`:
  - middleware function: `checkLogin`
  - middleware factory: `CheckPermission`
- `utils/validatorHandler.js`:
  - validators: `userCreateValidator`, `userUpdateValidator`, `RegisterValidator`, `ChangPasswordValidator`
  - middleware: `handleResultValidator`
- Helpers token/ID (PascalCase export keys): `RandomToken`, `IncrementalId`

### 2.4 Prefix/Suffix bắt buộc cho đối tượng “schema”

- Schema object pattern: `<name>Schema` (vd `productSchema`, `categorySchema`)
- Soft-delete flag: `isDeleted`

---

## 3) Pattern Boilerplates (Chuẩn code mẫu)

### 3.1 CRUD boilerplates (routes)

#### 3.1.1 `GET /` (collection + filter `.filter()` soft-delete)

1. Đọc query params (default bằng `?:`)
2. `await <Model>.find({}).populate(...)` (products có populate category)
3. `result = data.filter(function (e) { return (!e.isDeleted) && ... })`
4. `res.send(result)`

Predicate hay dùng (products):

- `e.title.toLowerCase().includes(titleQ.toLowerCase())`
- `e.price > minPrice && e.price < maxPrice`

#### 3.1.2 `GET /slug/:slug`

1. `let slug = req.params.slug`
2. `let result = await <Model>.findOne({ slug: slug })`
3. nếu có: `res.status(200).send(result)`
4. else: `res.status(404).send({ message: "SLUG NOT FOUND" })`

#### 3.1.3 `GET /:id` (detail + try/catch + not-found)

1. `try { let result = await <Model>.findOne({ _id: req.params.id, isDeleted: false }); ... } catch (error) { ... }`
2. Nếu tìm thấy: `res.status(200).send(result)` hoặc `res.send(result)`
3. Else/catch: `res.status(404).send({ message: "ID NOT FOUND" })` hoặc `{ message: "id not found" }`

#### 3.1.4 `POST /` (create + validator + try/catch)

1. `router.post('/', <ValidatorArray>, handleResultValidator, async function(req,res,next){ ... })`
2. Tạo slug (bắt buộc trong products/categories):

   ```js
   slugify(req.body.title, { replacement:'-', lower:true, locale:'vi' })
   ```

3. `let newObj = new <Model>({ ... })`
4. `await newObj.save()`
5. Success: `res.send(newObj)` hoặc `res.send(saved/populated)`
6. Error: thường `res.status(404).send(error.message)` hoặc `res.status(400).send({ message: err.message })` (xem anomaly)

#### 3.1.5 `PUT /:id` (update)

1. `try/catch`
2. `let result = await <Model>.findByIdAndUpdate(req.params.id, req.body, { new: true })`
3. Success: `res.status(200).send(result)`
4. Fail/catch: `res.status(404).send({ message: "ID NOT FOUND" })`

#### 3.1.6 `DELETE /:id` (soft-delete)

1. `try/catch`
2. `findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true })`
3. Success: `res.status(200).send(result)`
4. Fail/catch: `res.status(404).send({ message: "ID NOT FOUND" })`

### 3.2 Auth boilerplate (JWT cookie/header)

**`checkLogin`:**

1. `token = req.cookies.token_login_tungNT` nếu có
2. Nếu không:
   - `token = req.headers.authorization`
   - nếu không có hoặc không bắt đầu bằng `"Bearer"`: `res.status(403).send("ban chua dang nhap")`
   - `token = token.split(" ")[1]`
3. `jwt.verify(token, JWT_PUBLIC_KEY, { algorithms: ['RS256'] })` trong try/catch
4. Check exp: `result.exp * 1000 > Date.now()`
5. Load user: `req.user = await userController.FindById(result.id)`
6. user null hoặc exp fail: `res.status(403).send("ban chua dang nhap")`
7. OK: `next()`

**`CheckPermission(...requiredRole)`:**

- `role = req.user.role`
- nếu `requiredRole.includes(role)` → `next()`
- else: `res.status(403).send("ban khong co quyen")`

### 3.3 Validator boilerplate (express-validator)

- Rule arrays: `RegisterValidator`, `userCreateValidator`, `userUpdateValidator`, `ChangPasswordValidator`
- `handleResultValidator(req,res,next)`:
  - `let result = validationResult(req)`
  - nếu lỗi: `res.status(404).send(result.errors.map(e => e.msg)); return;`
  - nếu OK: `next()`

---

## 4) Error & Response Mapping (chuỗi message + status)

### 4.1 Danh sách chuỗi message lỗi quan sát được

| Ngữ cảnh | Message / hình thức | Status (thói quen) |
|----------|---------------------|--------------------|
| Auth | `ban chua dang nhap` | 403 |
| Auth | `ban khong co quyen` | 403 |
| Login | `tai khoan khong ton tai` | 403 |
| Login | `tai khoan dang bi ban` | 403 |
| Login | `thong tin dang nhap khong dung` | 403 |
| Slug/id | `SLUG NOT FOUND` | 404 |
| ID | `ID NOT FOUND` | 404 |
| ID | `{ message: "id not found" }` | 404 |
| express-validator | mảng `e.msg` | 404 (theo profile) |
| Một số chỗ | `res.status(400).send({ message: err.message })` | 400 |
| Create catch | `res.status(404).send(error.message)` | 404 |

### 4.2 Quy tắc status theo thói quen quan sát

- **403:** auth fail / JWT fail / missing token; permission fail; lockTime login fail
- **404:** not found slug/id/resource; validator errors; một số catch create dùng 404 + string message
- **400:** một số catch create/update trả `{ message: err.message }`

### 4.3 Response body shape

- `{ message: "<text>" }` hoặc string `"..."` (không quá chuẩn hóa JSON schema)
- Validator: `string[]` (map `e.msg`)
- App error middleware: render view `error` (không trả JSON)

---

## 5) Anomaly (điểm không nhất quán cần ghi nhớ khi “giống hệt”)

1. **`GET /:id` soft-delete filter:** có route detail dùng điều kiện chưa đồng nhất với list (vd products/categories detail không filter `isDeleted` rõ ràng). Khi generate 100%, **giữ behavior theo file nguồn** đang dùng.
2. **Casing message not found:** lúc `"ID NOT FOUND"` (uppercase), lúc `{ message: "id not found" }` (lowercase).
3. **`routes/users.js`:** có đoạn dùng `userModel` / `userController` — đảm bảo import đúng khi refactor/generate.
4. **`routes/auth.js`:** reset password / changepassword có chỗ không trả response thành công rõ ràng (hoặc thiếu `await` khi `user.save()`).
5. **`==` vs `===`:** dùng `==` trong một vài chỗ (vd `findIndex` với `e.product == product`).
6. **Status create error:** có nơi trả `404` + `error.message` thay vì `400/500`.

---

## Ghi chú sử dụng

Khi code generation cho project khác (ví dụ `Cyber E-Store` / `WebBanSachC2`), bám đúng:

- **[Mục 0](#0-yêu-cầu-dự-án-rest-csdl-auth-crud-file-socket):** RESTful (không MVC), CSDL, auth/author, CRUD entity, file, socket — và bảng cấu trúc folder khi đã bổ sung.
- Chuỗi middleware: **validator** rồi handler; **auth/permission** trước handler (theo endpoint)
- Cách response message / casing
- Tham số `slugify` và soft-delete `isDeleted`
- Pattern `.filter()` (đặc biệt list endpoint)

---

*Cập nhật: Master Coding Standard cho repo TechHome — persistence **Mongoose-only**; contract API chi tiết trong `TECHHOME_BACKEND_API_SPEC.md`. Khi mâu thuẫn giữa ví dụ cũ trong tài liệu và spec/roadmap, ưu tiên các file **TECHHOME_*.md** trong `docs/` và code greenfield đã refactor.*
