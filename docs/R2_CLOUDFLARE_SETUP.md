# Cloudflare R2 — thiết lập cho avatar (presigned)

Tài liệu bám `utils/avatarStorage.js` (S3-compatible). **Không đổi business logic** — chỉ hướng dẫn hạ tầng.

---

## Bắt buộc trước khi gọi API / MCP

**Bật R2 trên tài khoản Cloudflare:** Dashboard → **R2** → làm theo hướng dẫn (Purchase / Enable).  
Nếu chưa bật, API trả **`10042: Please enable R2 through the Cloudflare Dashboard`** — không tạo bucket được.

---

## 1) Account ID

- Dashboard: **R2** → Overview (hoặc URL có `account_id`).
- Hoặc API: `GET https://api.cloudflare.com/client/v4/accounts` (Bearer token).

Ghi lại `account_id` để dùng cho endpoint S3 và API v4.

---

## 2) Tạo bucket `student-project-assets`

Sau khi R2 đã bật:

`POST /accounts/{account_id}/r2/buckets`

```json
{ "name": "student-project-assets", "locationHint": "apac" }
```

Hoặc Dashboard → **R2** → **Create bucket** → tên `student-project-assets`.

---

## 3) Xác nhận bucket

`GET /accounts/{account_id}/r2/buckets`

---

## 4) Bật public **r2.dev** cho bucket

`PUT /accounts/{account_id}/r2/buckets/student-project-assets/domains/managed`

```json
{ "enabled": true }
```

Hoặc Dashboard → bucket → **Settings** → **Public access** → bật **R2.dev subdomain**.

---

## 5) URL public để ghép với `PUBLIC_ASSET_BASE_URL`

Backend tạo `publicUrl = PUBLIC_ASSET_BASE_URL + '/' + key` (key dạng `avatars/{userId}/{uuid}.ext`).

Với R2 r2.dev, thường dùng **một trong hai** (tùy giao diện Dashboard / response `GET .../domains/managed`):

- `https://pub-<hash>.r2.dev/student-project-assets`  
  → object: `https://pub-<hash>.r2.dev/student-project-assets/avatars/...`

Hoặc domain mà API **Get r2.dev Domain** trả về + path bucket nếu cần.

**Quan trọng:** `PUBLIC_ASSET_BASE_URL` **không có dấu `/` cuối**, và phải khớp cách trình duyệt mở được file sau khi upload.

---

## 6) CORS (localhost:3000)

`PUT /accounts/{account_id}/r2/buckets/student-project-assets/cors`

```json
{
  "rules": [
    {
      "id": "local-dev",
      "allowed": {
        "origins": ["http://localhost:3000"],
        "methods": ["GET", "PUT", "POST"],
        "headers": ["*"]
      }
    }
  ]
}
```

Hoặc cấu hình CORS tương đương trong Dashboard (bucket → **CORS**).

---

## 7) API token (S3 credentials cho backend)

Dashboard → **R2** → **Manage R2 API Tokens** → tạo token có quyền **Object Read & Write** (và scope bucket nếu có).

- **Access Key Id** → `AWS_ACCESS_KEY_ID`
- **Secret Access Key** → `AWS_SECRET_ACCESS_KEY`

---

## 8) Biến môi trường backend (`.env`)

Khớp `avatarStorage.js`:

| Biến | R2 (gợi ý) |
|------|------------|
| `S3_BUCKET` | `student-project-assets` |
| `S3_REGION` | `auto` |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_FORCE_PATH_STYLE` | *(để trống hoặc `false`)* |
| `AWS_ACCESS_KEY_ID` | R2 API token access key |
| `AWS_SECRET_ACCESS_KEY` | R2 API token secret |
| `PUBLIC_ASSET_BASE_URL` | URL bước 5 (prefix public, không `/` cuối) |

Khởi động lại `npm start` sau khi sửa `.env`.

---

## Tóm tắt lỗi đã gặp khi tự động hoá (MCP)

- **List accounts:** OK — có thể lấy `account_id`.
- **Create bucket / List buckets:** **lỗi `10042`** vì **R2 chưa enable** trên tài khoản.  
  → Cần bật R2 trong Dashboard trước, sau đó lặp lại các bước 2–7 (API, Wrangler, hoặc Dashboard).

---

## Snapshot triển khai (đã thực hiện qua Cloudflare API)

| Mục | Giá trị |
|-----|---------|
| Account ID | `a0fbfef35f171fc3bd858423bf5cafed` |
| Bucket | `student-project-assets` (location APAC) |
| r2.dev public | **bật** — domain `pub-2388d4dd6b344edd8bb1ea8a27399754.r2.dev` |
| `PUBLIC_ASSET_BASE_URL` (backend) | `https://pub-2388d4dd6b344edd8bb1ea8a27399754.r2.dev` (không `/` cuối) |
| `S3_ENDPOINT` | `https://a0fbfef35f171fc3bd858423bf5cafed.r2.cloudflarestorage.com` |
| CORS | `http://localhost:3000` — `GET`, `PUT`, `POST` — `headers: *` — rule id `local-dev-storefront` |

**Còn lại (bắt buộc để presign chạy):** tạo **R2 API Token** (Object Read & Write) trên Dashboard → điền `AWS_ACCESS_KEY_ID` và `AWS_SECRET_ACCESS_KEY` trong `.env` → restart backend.

**Tùy chọn:** `AVATAR_STRICT_PUBLIC_PREFIX=1` — `PUT /profile` chỉ chấp nhận `avatarUrl` bắt đầu bằng `PUBLIC_ASSET_BASE_URL` (chặn URL ảnh ngoài bucket/CDN). Mặc định tắt để tương thích URL https bất kỳ.

---

## Tham chiếu nội bộ

- `docs/CODE_CHANGE_RULES.md` — khi sửa code/route, chia bước và kiểm tra.
- `docs/FRONTEND_BACKEND_STATUS.md` §7 — contract profile / presign.
- `.env.example` — placeholder biến S3/R2.
