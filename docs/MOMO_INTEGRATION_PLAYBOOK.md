# MoMo Integration Playbook (fit TechHome)

Tai lieu nay giup bien source tham khao `@payment/nodejs` thanh luong thanh toan MoMo bam sat codebase `backend_nodejs` + `techhome-e-commerce`.

## 1) Muc tieu va pham vi

- Tich hop thanh toan online MoMo cho don hang da tao.
- Khong pha vo luong dat hang hien tai (`POST /api/orders`).
- Dam bao idempotent va an toan qua IPN (server-to-server callback).
- Frontend chi can goi endpoint backend, khong ky signature o client.

## 2) Hien trang codebase cua ban

### Da co san

- Da co helper MoMo o `backend_nodejs/utils/payment/momo.js`:
  - Doc env (`MOMO_*`)
  - Tao chu ky HMAC SHA256 cho create payment
  - Goi endpoint create payment (`/v2/gateway/api/create`)
  - Verify IPN signature
- Da co order flow tot:
  - `POST /api/orders` tao don + tru kho + coupon redemption
  - `GET /api/orders/:id` lay chi tiet don
  - Admin co luong status shipment/returns/refunds

### Chua co

- Chua co endpoint bat dau thanh toan MoMo tu order.
- Chua co endpoint `IPN` va `return` route de cap nhat trang thai thanh toan.
- Chua co truong payment trong schema order (paymentStatus, method, transId, paidAt...).
- Frontend checkout chua co buoc redirect den `payUrl`.

## 3) Mapping tu `@payment/nodejs` sang du an hien tai

## 3.1 Nhung gi can giu lai tu mau

- Cong thuc `rawSignature` cho create payment.
- Truong request body MoMo: `partnerCode`, `requestId`, `amount`, `orderId`, `orderInfo`, `redirectUrl`, `ipnUrl`, `requestType`, `extraData`, `signature`.
- Validate ket qua boi `resultCode` va `payUrl`.

## 3.2 Nhung gi phai doi de dung voi du an

- Khong hardcode key trong source (chi dung `.env`).
- Khong tao order tren MoMo truoc khi co order noi bo.
- `orderId` gui MoMo nen map theo format on dinh:
  - Goi y: `TH_${internalOrderId}_${timestamp}`
- `extraData` nen chua metadata da base64 (json nho):
  - orderId noi bo
  - userId
  - checksum noi bo (optional)
- Tat ca verify va update trang thai thanh toan phai o backend.

## 4) Thiet ke nghiep vu de bam sat

## 4.1 Luong de xuat (2 buoc)

1. User dat hang nhu hien tai (`POST /orders`) -> tao order `PENDING`.
2. Frontend goi endpoint moi `POST /orders/:id/payments/momo`:
   - Backend validate owner + status hop le.
   - Backend goi MoMo create payment.
   - Tra ve `payUrl` de frontend redirect.
3. Sau khi user thanh toan:
   - MoMo goi `IPN` -> backend verify signature -> cap nhat paymentStatus.
   - Browser quay ve `redirectUrl` -> frontend hien thi ket qua.

## 4.2 Trang thai payment nen co

- `UNPAID` (mac dinh khi tao order)
- `PENDING` (da tao session MoMo, cho ket qua)
- `PAID` (IPN success)
- `FAILED` (IPN fail)
- `CANCELLED` (nguoi dung huy)
- `EXPIRED` (qua han payment window)

> Luu y: `order.status` (van hanh don hang) va `paymentStatus` la 2 truc khac nhau.

## 5) File-level implementation plan

## 5.1 Backend (`backend_nodejs`)

1. `schemas/orders.js`
   - Bo sung field:
     - `paymentMethod` (VD: `MOMO`)
     - `paymentStatus` (enum nhu tren, default `UNPAID`)
     - `paymentGatewayOrderId`
     - `paymentRequestId`
     - `paymentTransactionId`
     - `paidAt`
     - `paymentFailureReason`
     - `paymentMeta` (object, optional)

2. `utils/mappers/orderDto` (neu co)
   - Expose payment fields can thiet cho frontend.

3. `routes/orders.js`
   - Them route:
     - `POST /:id/payments/momo` (checkLogin)
     - `POST /payments/momo/ipn` (public from MoMo)
     - `GET /payments/momo/return` (optional: frontend handoff)
   - Rule:
     - Chi owner cua order moi duoc tao payment link.
     - Khong tao link neu da `PAID`.
     - Idempotent: neu dang `PENDING` va link con han -> tra lai link.

4. `utils/payment/momo.js`
   - Giu nguyen logic ky/verify.
   - Co the them helper parse result an toan + timeout/retry nhe.

5. `app.js`
   - Khong can mount route moi neu dat trong `routes/orders.js`.
   - Dam bao IPN endpoint khong bi auth middleware chan.

6. `.env.example`
   - Bo sung day du `MOMO_*` va mo ta ro test/prod.

## 5.2 Frontend (`techhome-e-commerce`)

1. `src/services/backend.ts`
   - Them API call:
     - `createMomoPayment(orderId)` -> `{ payUrl, requestId, gatewayOrderId, ... }`

2. `src/components/checkout/CheckoutStep3.tsx`
   - Sau khi `createOrder` thanh cong:
     - Neu user chon MoMo -> goi `createMomoPayment(order.id)`, redirect `window.location.href = payUrl`.
     - Neu COD (neu bo sung sau) -> di thang trang confirmation.

3. `src/pages/checkout/OrderConfirmationPage.tsx` va/hoac `OrderDetailsPage.tsx`
   - Hien payment badge: `Chua thanh toan / Dang xu ly / Da thanh toan / That bai`.

## 6) API contract de frontend bam vao

## 6.1 Tao payment link MoMo

- `POST /api/orders/:id/payments/momo`
- Auth: Bearer
- Response thanh cong:

```json
{
  "orderId": 123,
  "paymentMethod": "MOMO",
  "paymentStatus": "PENDING",
  "payUrl": "https://test-payment.momo.vn/...",
  "deeplink": "...",
  "qrCodeUrl": "...",
  "requestId": "TH_REQ_...",
  "gatewayOrderId": "TH_123_..."
}
```

## 6.2 IPN callback

- `POST /api/orders/payments/momo/ipn`
- Auth: none (verify by signature)
- Xu ly:
  - Invalid signature -> 400
  - Valid + result success -> set `PAID`, set `paidAt`, set `paymentTransactionId`
  - Valid + fail/cancel -> set `FAILED`/`CANCELLED`, luu reason
- Response cho MoMo: theo format MoMo yeu cau (khuyen nghi tra nhanh 200).

## 7) Quy tac an toan bat buoc

- Khong log `MOMO_SECRET_KEY`.
- Khong trust query params tu frontend de ket luan da thanh toan.
- Chi IPN hop le moi duoc set `PAID`.
- Neu nhan IPN lap lai -> idempotent (neu da `PAID` thi return success som).
- Validate amount IPN phai khop `order.totalPrice`.

## 8) Checklist thuc thi (theo thu tu)

1. Chuan hoa env `MOMO_*` trong `.env` + `.env.example`.
2. Bo sung payment fields vao order schema + DTO.
3. Implement `POST /orders/:id/payments/momo`.
4. Implement `POST /orders/payments/momo/ipn` + verify signature.
5. Test local voi MoMo sandbox + tunnel (ngrok/cloudflared) cho IPN.
6. Noi frontend checkout voi endpoint moi.
7. Hien payment status o order confirmation/details.
8. Viet test cases regression:
   - create payment success
   - IPN success -> PAID
   - IPN invalid signature
   - IPN duplicate
   - amount mismatch

## 9) Testing guide nhanh

- Tao order bang flow hien tai.
- Goi `POST /orders/:id/payments/momo` xem co `payUrl`.
- Mo `payUrl` thanh toan tren sandbox.
- Kiem tra:
  - Order paymentStatus doi theo IPN.
  - `GET /orders/:id` tra dung payment fields.
  - Frontend hien dung trang thai.

## 10) Ghi chu quan trong cho repo nay

- Ban da co file tham khao `@payment/nodejs` de hoc, nhung khong dung nguyen xi:
  - File mau dung script 1 lan, hardcode key, khong co ownership/idempotency.
  - Du an cua ban can route API + schema + state machine payment.
- `backend_nodejs/utils/payment/momo.js` hien la diem bam chuan nhat de mo rong.

---

Neu muon, buoc tiep theo co the tao them 1 file `MOMO_IMPLEMENTATION_TASKS.md` dang checklist card-by-card (backend + frontend + QA) de ban giao cho team lam truc tiep.
