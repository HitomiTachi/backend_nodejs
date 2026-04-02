# MOMO Implementation Tasks (Dev-Ready Checklist)

Tai lieu checklist chi tiet de implement thanh toan MoMo theo `MOMO_INTEGRATION_PLAYBOOK.md`.

## Cach dung checklist

- Mỗi task nho, co output ro rang.
- Danh dau `[x]` khi xong + note PR/commit.
- Lam theo thu tu Phase de giam regression.

---

## Phase 0 - Setup va an toan

### 0.1 Env va config

- [x] Bo sung day du bien `MOMO_*` vao `backend_nodejs/.env.example`
  - [x] `MOMO_ENDPOINT`
  - [x] `MOMO_CREATE_PATH`
  - [x] `MOMO_PARTNER_CODE`
  - [x] `MOMO_ACCESS_KEY`
  - [x] `MOMO_SECRET_KEY`
  - [x] `MOMO_REDIRECT_URL`
  - [x] `MOMO_IPN_URL`
  - [x] `MOMO_REQUEST_TYPE`
  - [x] `MOMO_LANG`
  - [x] `MOMO_PARTNER_NAME`
  - [x] `MOMO_STORE_ID`
  - [x] `MOMO_AUTO_CAPTURE`
  - [x] `MOMO_EXPIRE_MINUTES`
- [ ] Kiem tra `backend_nodejs/.env` local da co gia tri sandbox hop le.
- [ ] Xac nhan `.env` duoc ignore boi git.

**Done when:**
- [ ] Chay app khong loi missing env.
- [ ] Team co the copy `.env.example` va chay local.

---

## Phase 1 - Data model payment tren Order

### 1.1 Schema update

- [x] Update `backend_nodejs/schemas/orders.js` them field:
  - [x] `paymentMethod`
  - [x] `paymentStatus` (default `UNPAID`)
  - [x] `paymentGatewayOrderId`
  - [x] `paymentRequestId`
  - [x] `paymentTransactionId`
  - [x] `paidAt`
  - [x] `paymentFailureReason`
  - [x] `paymentMeta`

### 1.2 Mapper/DTO

- [x] Update mapper order DTO (neu dang map rieng) de tra payment fields cho frontend.
- [x] Dam bao `GET /api/orders` va `GET /api/orders/:id` tra du lieu payment status.

**Done when:**
- [ ] Tao 1 order moi -> response co `paymentStatus = UNPAID`.
- [ ] API khong vo compatibility voi UI cu.

---

## Phase 2 - API tao payment link MoMo

### 2.1 Endpoint backend

- [x] Them route `POST /api/orders/:id/payments/momo` trong `backend_nodejs/routes/orders.js`.
- [x] Route yeu cau auth (`checkLogin`).
- [x] Validate owner cua order (chi user so huu moi tao payment link).
- [x] Chan truong hop:
  - [x] order khong ton tai -> 404
  - [x] da `PAID` -> 409
  - [x] order khong hop le de thanh toan -> 400

### 2.2 Goi helper MoMo

- [x] Dung `createMomoPayment(...)` tu `backend_nodejs/utils/payment/momo.js`.
- [x] Tao `gatewayOrderId` format on dinh (goi y: `TH_<orderId>_<ts>`).
- [x] Tao `requestId` unique.
- [x] `amount` phai map tu `order.totalPrice`.
- [x] `orderInfo` co y nghia (`Thanh toan don #<id>`).
- [x] `extraData` base64 json nho (`orderId`, `userId`, ...).

### 2.3 Persist state

- [x] Cap nhat order:
  - [x] `paymentMethod = MOMO`
  - [x] `paymentStatus = PENDING`
  - [x] `paymentGatewayOrderId`
  - [x] `paymentRequestId`
  - [x] `paymentMeta` (payUrl/deeplink/qrCodeUrl neu can)

### 2.4 Response contract

- [x] Response API tra:
  - [x] `orderId`
  - [x] `paymentMethod`
  - [x] `paymentStatus`
  - [x] `payUrl`
  - [x] `requestId`
  - [x] `gatewayOrderId`

**Done when:**
- [ ] Postman goi endpoint nhan `payUrl` hop le.
- [ ] DB order cap nhat `PENDING`.

---

## Phase 3 - IPN callback va verify chu ky

### 3.1 IPN route

- [x] Them route `POST /api/orders/payments/momo/ipn` (public, khong auth).
- [x] Parse body dung format MoMo gui.
- [x] Verify signature bang `verifyMomoIpnSignature(payload)`.

### 3.2 Business rules IPN

- [x] Neu invalid signature -> 400.
- [x] Tim order bang `paymentGatewayOrderId` (uu tien) hoac metadata mapping.
- [x] Validate amount IPN == `order.totalPrice`.
- [x] Xu ly theo `resultCode`:
  - [x] success -> `paymentStatus = PAID`, set `paidAt`, `paymentTransactionId`
  - [x] fail/cancel -> `paymentStatus = FAILED` hoac `CANCELLED`, set reason

### 3.3 Idempotency

- [x] Neu order da `PAID` va IPN duplicate -> return success som, khong update lai.
- [x] Luu trace ngan gon trong `paymentMeta.lastIpn` (optional).

### 3.4 Ack cho MoMo

- [x] Tra response nhanh dung format MoMo mong doi.
- [ ] Khong de IPN timeout vi xu ly qua lau.

**Done when:**
- [ ] Replay 1 IPN payload 2 lan khong gay sai state.
- [ ] Signature sai bi reject.

---

## Phase 4 - Return URL va UX sau thanh toan

### 4.1 Return endpoint (backend optional)

- [x] Them `GET /api/orders/payments/momo/return` neu can backend handoff.
- [x] Khong trust return query de set `PAID` (chi de redirect/hien thi).

### 4.2 Frontend redirect flow

- [x] Update `techhome-e-commerce/src/services/backend.ts` them `createMomoPayment(orderId)`.
- [x] Update `CheckoutStep3.tsx`:
  - [x] Sau `createOrder` thanh cong + method MoMo -> goi `createMomoPayment`
  - [x] redirect `window.location.href = payUrl`
- [x] Neu tao payment link that bai -> show error ro rang cho user.

**Done when:**
- [ ] User bam thanh toan MoMo -> bi redirect dung `payUrl`.

---

## Phase 5 - Hien payment status tren UI

### 5.1 Order confirmation/details

- [x] Update `OrderConfirmationPage.tsx` hien badge payment status.
- [x] Update `OrderDetailsPage.tsx` hien:
  - [x] `paymentMethod`
  - [x] `paymentStatus`
  - [x] `paidAt` (neu co)
  - [x] `transactionId` mask ngan gon (neu can)

### 5.2 Order history

- [x] Update `OrderHistoryPage.tsx` hien status thanh toan toi thieu (chip/text).

**Done when:**
- [ ] User phan biet ro don da thanh toan hay chua.

---

## Phase 6 - Admin visibility (khuyen nghi)

- [x] Admin order detail hien payment block.
- [x] Co filter co ban theo paymentStatus (optional phase 2).
- [x] Khong cho mark delivered neu payment policy yeu cau da paid (neu co rule).

**Done when:**
- [x] Admin theo doi duoc payment state moi.

---

## Phase 7 - Test cases bat buoc

### 7.1 Unit/integration (backend)

- [ ] Tao MoMo payment success.
- [ ] MoMo payment fail (gateway loi) -> api tra error hop le.
- [ ] IPN invalid signature.
- [ ] IPN amount mismatch.
- [ ] IPN success set `PAID`.
- [ ] IPN duplicate khong update trung.

### 7.2 E2E (manual)

- [ ] Place order -> create payment -> redirect MoMo sandbox.
- [ ] Thanh toan thanh cong -> order doi `PAID`.
- [ ] Huy/that bai -> order doi `FAILED`/`CANCELLED`.
- [ ] UI orders/confirmation/details hien dung status.

---

## Phase 8 - Observability va van hanh

- [x] Them log key events:
  - [x] create payment request/response (khong log secret)
  - [x] ipn received
  - [x] ipn verify pass/fail
  - [x] payment status transition
- [x] Tao dashboard query nhanh (Mongo) cho don `PENDING` qua han.
- [ ] Co script/manual retry reconcilation cho don `PENDING` (phase sau).

---

## Phase 9 - Definition of Done (tong)

- [ ] Checkout MoMo hoat dong end-to-end tren sandbox.
- [ ] Khong co regression flow dat hang cu.
- [ ] Payment status dong bo dung qua IPN.
- [ ] Frontend hien trang thai payment ro rang.
- [ ] Tai lieu cap nhat:
  - [ ] `MOMO_INTEGRATION_PLAYBOOK.md`
  - [ ] API docs internal (neu co)
  - [ ] `.env.example`

---

## Ghi chu phan cong goi y

- Backend dev A: Phase 1-3
- Frontend dev B: Phase 4-5
- QA dev C: Phase 7
- Lead/Reviewer: Phase 0 + Phase 9

---

## Backlog (sau khi MVP on dinh)

- [ ] Refund qua MoMo (neu business can).
- [ ] Auto-expire payment session.
- [ ] Reconciliation job (pull status from gateway).
- [ ] Ho tro them cong thanh toan (VNPay/ZaloPay) theo chung abstraction.
