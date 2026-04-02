# Codebase Deep Analysis — Nodejs Workspace

## 1. Tổng quan codebase

- Workspace có 2 dự án chính:
  - `backend_nodejs`: Express + Mongoose + MongoDB (CommonJS).
  - `techhome-e-commerce`: React + Vite + TypeScript.
- Backend chạy qua `bin/www` -> nạp `.env` -> tạo HTTP server.
- Frontend chạy qua `src/main.tsx` -> `src/App.tsx` -> `HashRouter`.
- Không thấy test file (`*.test.*`, `*.spec.*`) trong 2 dự án.

## 2. Kiến trúc và luồng chạy

- Backend bootstrap:
  - `backend_nodejs/bin/www`: `require('dotenv').config()`, listen `PORT` (default `8080`).
  - `backend_nodejs/app.js`: CORS -> parser middleware -> static -> route mount -> 404 -> error handler JSON.
  - DB kết nối ở `backend_nodejs/utils/data.js` qua `MONGODB_URI`.
- Route chain:
  - Mount song song cả `/api/*` và `/api/v1/*` cho nhiều module (`auth`, `users`, `orders`, `products`, `cart`, `checkout`, `admin`, ...).
  - Health endpoint tại `backend_nodejs/routes/api.js` (`GET /health`).
- Auth/authz:
  - `backend_nodejs/utils/authHandler.js`:
    - `checkLogin`: ưu tiên Bearer header, fallback cookie `token_login_tungNT`.
    - `CheckPermission`: kiểm role normalize uppercase.
- Frontend chain:
  - `techhome-e-commerce/src/App.tsx`: `HashRouter` + `AvatarProvider` -> `AuthProvider` -> `CartProvider` -> `CheckoutProvider`.
  - `techhome-e-commerce/src/routes/AppRoutes.tsx`: route map toàn app.

## 3. Logic nghiệp vụ chính

- Auth/User:
  - `routes/auth.js` -> `controllers/users.js` -> `schemas/users.js`.
  - Có login/register/me/change-password/forgot/reset.
- Catalog:
  - `routes/products.js`, `routes/categories.js`.
  - Product có soft-delete + SKU + slug + import Excel.
- Cart:
  - `routes/cart.js`, mapper tại `utils/mappers/cartDto.js`.
  - Có cả endpoint spec mới (`/cart/items`) và legacy (`/cart/:itemId`).
- Checkout/Pricing:
  - `routes/checkout.js` -> `services/orderPricing.js`.
  - Tính subtotal, VAT, discount, shipping.
- Orders:
  - `routes/orders.js`: create order, status history, shipment, return/refund, admin flow.
- Inventory:
  - `routes/inventories.js` + `schemas/inventories.js` + idempotency schema.
- Admin:
  - `routes/admin.js` aggregate dashboard summary.

## 4. Style/convention đang dùng

- Backend:
  - CommonJS, route-level async handler.
  - Dùng numeric `id` thay vì chỉ Mongo `_id`.
  - Soft-delete pattern lặp lại (`isDeleted`, `deletedAt`, `deletedBy`).
  - Chấp nhận cả camelCase và snake_case ở nhiều payload để tương thích ngược.
  - Error response đa dạng (`res.json`, `res.send`, text/plain).
- Frontend:
  - TypeScript + alias `@`.
  - API tách 2 lớp:
    - low-level: `src/services/api.ts`
    - domain adapter: `src/services/backend.ts`
  - State dùng React Context.

## 5. Điểm bất thường / lỗi nghi ngờ

### 5.1 Lỗi kiến trúc / runtime tiềm ẩn

- **Dual stock system**:
  - `orders/cart` dùng `Product.stock`.
  - `inventories` dùng `Inventory.stock/reserved/soldCount`.
  - Nguy cơ lệch số liệu tồn kho nếu flow chạy song song.
- **ID generation race**:
  - `backend_nodejs/utils/id.js` dùng `findOne().sort({id:-1}) + 1`.
  - Có khả năng trùng ID khi concurrent write.
- **Transaction fallback khác hành vi theo môi trường**:
  - `routes/orders.js` fallback không transaction nếu Mongo standalone không hỗ trợ.

### 5.2 Không đồng nhất contract/flow

- Route versioning mount kép (`/api` và `/api/v1`) dễ tạo split behavior khi rollback/partial deploy.
- Response shape chưa đồng nhất tuyệt đối (JSON object vs text ở vài endpoint auth/profile).

### 5.3 Dead/suspicious

- `techhome-e-commerce/src/routes/PrivateRoute.tsx` đang hardcode `isAuthenticated = true` và **không thấy được dùng** trong route tree.
- `techhome-e-commerce/s` là file artifact chứa log commit ANSI, không phải source/config chuẩn.

## 6. Các vùng rủi ro cao

- `backend_nodejs/routes/orders.js`
- `backend_nodejs/services/orderPricing.js`
- `backend_nodejs/routes/inventories.js`
- `backend_nodejs/schemas/inventories.js`
- `backend_nodejs/utils/id.js`
- `backend_nodejs/app.js` (mount route kép)
- `techhome-e-commerce/src/services/backend.ts` (adapter rộng, phụ thuộc shape backend)

## 7. Những chỗ cần bạn xác nhận thêm

- Có chủ đích duy trì 2 hệ tồn kho (`Product.stock` và `Inventory.*`) không?
- Có cần giữ đồng thời cả `/api` và `/api/v1` lâu dài không?
- File `techhome-e-commerce/s` là artifact cần giữ (audit) hay file rác?
- Chuẩn response cuối cùng muốn lock về JSON thống nhất hay cho phép text legacy?
- Có cần tiếp tục tương thích payload snake_case toàn bộ endpoint không?

## 8. Mức độ tin cậy của kết luận

- **Cao**: cấu trúc app, entrypoints, route chain, auth flow, vùng rủi ro chính.
- **Cao**: tồn tại dead code `PrivateRoute` (không reference), artifact file `s`.
- **Cao**: nguy cơ race của `nextSequentialId`.
- **Trung bình-Cao**: rủi ro rollback/merge do dual version mount và compatibility layer.
- **Chưa đủ bằng chứng**: xác định bug hiện tại cụ thể có phải do rollback/reset/merge hay không (cần diff commit/branch cụ thể).

## 9. Nếu phải sửa, hướng sửa an toàn nhất (đề xuất, chưa sửa)

- Chuẩn hóa source-of-truth cho tồn kho (hoặc thêm sync invariant rõ ràng).
- Chuyển ID tự tăng sang cơ chế atomic counter.
- Chuẩn hóa response contract (ưu tiên JSON thống nhất).
- Tách business logic nặng khỏi route theo bước nhỏ, có regression check.
- Dọn dead/artifact sau khi xác nhận không ảnh hưởng audit.
- Viết test cho order/checkout/inventory trước khi thay đổi logic.

## 10. Nếu chưa đủ dữ liệu, cần thêm file nào

- Backend:
  - `routes/categories.js`, `routes/coupons.js`, `routes/profile.js`, `routes/uploads.js`
  - `schemas/*` còn lại
  - `utils/mappers/*`, `utils/tax/*`
  - `scripts/migrate-legacy-data.js`, `scripts/backfill-product-sku.js`
- Frontend:
  - `src/context/CheckoutContext.tsx`, `src/pages/admin/*`, `src/types/api.ts`
- So sánh version/branch:
  - Cần 2 commit hash hoặc 2 branch cụ thể để đối chiếu runtime/logic drift chính xác.

