# Checklist: đưa evolution B (SKU + import Excel) vào dự án C (TechHome backend)

**Mục tiêu:** siết **SKU** (bắt buộc + unique) + thêm **import sản phẩm từ Excel** (ADMIN).  
**Không làm:** thay presign R2/S3 bằng multer upload ảnh (giữ `routes/uploads.js` như hiện tại).

**Tham chiếu code:** `schemas/products.js`, `routes/products.js`, `controllers/` (nếu có), `utils/mappers/catalogDto.js`, FE `techhome-e-commerce/.../ProductFormPage.tsx`.

**Trạng thái triển khai:** A–F và H đã khớp code hiện tại; **B3, B4, G** là bước vận hành / kiểm thử thủ công (chưa đánh dấu trong checklist).

---

## Phần A — Quyết định trước khi code (**đã chốt** theo TechHome hiện tại)

Căn cứ: `schemas/products.js` (id số, `category_id` số), form admin đã có field `sku`, mock mẫu kiểu `TH-IP15P-256-NT`.

### Bảng tóm tắt

| Mã | Nội dung đã chốt |
|----|------------------|
| **A1** | **SKU:** luôn `trim()`; lưu **UPPERCASE**; ký tự cho phép chữ Latin, số, `-` và `_`; **tối đa 64 ký tự**. Không regex quá chặt ở v1 (có thể siết sau). |
| **A2** | **Backfill** bản ghi thiếu/rỗng SKU: **`TH-AUTO-{id}`** với `{id}` = `product.id` (số) — unique ổn định. Trước backfill: đếm trùng SKU thật (hiếm) và xử lý tay nếu có. |
| **A3** | **Excel:** **một sheet** — ưu tiên **sheet đầu** hoặc sheet tên `Products`. **Dòng 1 = header**. Cột tối thiểu: `sku`, `name`, `price`, `categoryId` (số, khớp `category_id` DB). Khuyến nghị thêm: `stock`, `description`. **Không** import ảnh/slug ở v1 (slug = `slugify(name)` như API hiện tại). |
| **A4** | Import v1: **chỉ tạo mới**. Nếu SKU đã tồn tại → **bỏ qua dòng** hoặc ghi vào `errors[]` (không upsert, không ghi đè). **Upsert theo SKU = phase 2** nếu sau này cần. |
| **A5** | **Giới hạn:** file tối đa **5 MB**; tối đa **500 dòng** dữ liệu (không tính header) mỗi lần import — có thể nâng sau khi ổn định (vd. 1000). |

### Checklist xác nhận (đánh dấu khi triển khai xong spec)

- [x] **A1** — Validator/persistence SKU khớp bảng trên. (`utils/sku.js`, schema + routes)
- [x] **A2** — Script backfill + verify không còn null/duplicate trước unique index. (`scripts/backfill-product-sku.js`, `npm run backfill:sku` — chạy trước deploy unique)
- [x] **A3** — Contract cột & tên sheet ghi trong README hoặc comment route import. (comment trên `POST /import` trong `routes/products.js`)
- [x] **A4** — Logic import chỉ insert; duplicate SKU → error row hoặc skip có log. (`utils/productImportExcel.js`)
- [x] **A5** — Middleware giới hạn size + parser giới hạn số dòng. (multer 5 MB; `MAX_ROWS` 500)

---

## Phần B — Migration dữ liệu SKU (chạy trước hoặc cùng deploy schema)

- [x] **B1.** Script one-off (ví dụ `scripts/backfill-product-sku.js` hoặc npm script): đếm doc `sku` null/rỗng/trùng.
- [x] **B2.** Gán SKU tạm cho từng doc thiếu; xử lý trùng (đổi tên SKU trùng cho đến khi unique).
- [ ] **B3.** Chạy trên **staging** trước; backup DB hoặc snapshot. *(vận hành — tự thực hiện theo môi trường)*
- [ ] **B4.** Sau backfill: xác nhận `db.products` không còn `sku` null và không trùng (query aggregate). *(vận hành)*

---

## Phần C — Schema & API SKU (backend)

- [x] **C1.** `schemas/products.js`: `sku` — `required: true`, `trim`, `unique: true` (hoặc unique index migration riêng nếu dùng sparse tạm thời).
- [x] **C2.** `routes/products.js` — `POST`: từ chối nếu thiếu `sku` (message rõ); xử lý lỗi duplicate Mongo `11000` → `409` + `{ message }`.
- [x] **C3.** `routes/products.js` — `PUT /:id`: nếu cho đổi SKU, validate unique (trừ chính id).
- [x] **C4.** `buildCreateUpdatePayload` / mapper: không ghi đè SKU bằng `undefined` khi omit (PATCH partial).
- [x] **C5.** Đồng bộ `Product.create` / seed nội bộ (nếu có) — mọi chỗ tạo product đều có SKU. *(chỉ `POST /products` + import; không có seed riêng trong repo)*

---

## Phần D — Frontend (admin + types)

- [x] **D1.** `ProductFormPage.tsx`: field SKU **required** (client); disable submit nếu trống.
- [x] **D2.** Hiển thị lỗi API khi trùng SKU (409 / message từ server).
- [x] **D3.** `types/api.ts` / payload: `sku` có thể chuyển từ optional → required theo contract mới (hoặc giữ optional type nhưng validate form). (`AdminProductUpsertPayload.sku` bắt buộc; `ProductDto.sku` vẫn optional cho DTO đọc)

---

## Phần E — Import Excel (backend)

- [x] **E1.** `package.json`: thêm `exceljs`; thêm `multer` **chỉ** nếu nhận multipart (memoryStorage, giới hạn file size).
- [x] **E2.** Route mới — ví dụ `POST /api/products/import` (và mirror `/api/v1/...` nếu project vẫn mount đôi): `checkLogin` + `CheckPermission('ADMIN')`. *(cùng router → `/api/products/import` và `/api/v1/products/import`)*
- [x] **E3.** Chấp nhận `.xlsx`; từ chối loại file khác; giới hạn MB và số dòng.
- [x] **E4.** Service parse: đọc sheet → map cột → validate từng dòng (name, price, category_id, sku, …). (`utils/productImportExcel.js`)
- [x] **E5.** Tạo product + `Inventory.ensureForProduct` trong **transaction** (cùng pattern `POST` product hiện tại). Theo **A4**: ưu tiên **ghi nhận từng dòng** (import được dòng nào hay dòng đó; dòng lỗi vào `errors[]`) thay vì rollback cả file — trừ khi team chọn “all-or-nothing” sau. *(không dùng Mongo session transaction — giống `POST /products`: lần lượt `Product.create` + `ensureForProduct`; ghi nhận từng dòng + `errors[]`.)*
- [x] **E6.** Response: `{ imported: n, errors: [{ row, message }] }` hoặc chỉ 200 khi all success.
- [x] **E7.** Xóa file tạm sau xử lý nếu dùng disk (hoặc chỉ buffer memory). *(memory buffer — không ghi disk)*

---

## Phần F — Import Excel (frontend, tùy chọn nhưng nên có)

- [x] **F1.** Trang hoặc section admin: chọn file `.xlsx` → `POST` multipart hoặc đọc file client + gửi base64 (ưu tiên multipart + multer cho file lớn). (`ProductListPage.tsx` + `importAdminProductsExcel`)
- [x] **F2.** Hiển thị kết quả: số dòng thành công + danh sách lỗi theo dòng.

---

## Phần G — Kiểm thử & vận hành

- [ ] **G1.** Test thủ công: tạo SP không SKU → 400.
- [ ] **G2.** Test thủ công: tạo hai SP cùng SKU → 409.
- [ ] **G3.** File Excel mẫu hợp lệ → import thành công; file sai cột → lỗi rõ.
- [ ] **G4.** Regression: GET catalog, PDP, checkout vẫn chạy (SKU hiển thị đã có sẵn ở `ProductDetail`).
- [ ] **G5.** Ghi `CHANGELOG` hoặc ghi chú breaking: client cũ gọi `POST /products` thiếu SKU sẽ lỗi.

---

## Phần H — Không làm (để tránh trùng với C)

- [x] **H1.** Không thay `routes/uploads.js` (presign) bằng multer lưu ảnh local — trừ khi đổi chiến lược hosting. *(đã giữ nguyên — multer chỉ dùng cho import)*
- [x] **H2.** Không đổi global error handler `app.js` chỉ để “giống B” — C đã dùng JSON tốt hơn. *(chưa đổi `app.js` cho mục đích này)*

---

## Thứ tự thực hiện đề xuất

1. **B** (backfill) → **C** (schema + API) → **D** (FE) → **E** (import) → **F** (UI import) → **G** (test).

---

## Ghi chú cho agent / dev

- Luôn chạy `npm` install sau khi thêm `exceljs` / `multer`.
- Sau khi thêm unique index: lỗi duplicate là **expected** — map sang HTTP và message thân thiện.
- Nếu `categories` cần id số: file Excel phải có `categoryId` khớp DB hoặc map tên → id (phức tạp hơn — có thể phase 2).

*Phần A đã chốt (2026-03-30). Cập nhật tài liệu nếu thay đổi nghiệp vụ hoặc contract Excel.*
