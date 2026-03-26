# MongoDB Replica Set (rs) — khi nào cần và dùng như thế nào

## 1) Replica Set MongoDB là gì?
Replica Set (rs) là cụm MongoDB gồm nhiều node (Primary/Secondary) cùng đồng bộ dữ liệu.
Cụm có cơ chế bầu Primary tự động khi Primary gặp sự cố.

## 2) Tác dụng trong dự án TechHome
- Tăng độ sẵn sàng (high availability): giảm downtime khi một node lỗi.
- Hỗ trợ các tính năng dựa trên cluster/replication.
- Quan trọng: dự án có dùng transaction cho nghiệp vụ đơn hàng.

Tham chiếu trong repo:
- `backend_nodejs/routes/orders.js` dùng `mongoose.startSession()` và `session.withTransaction(...)`.
  Vì vậy khi nâng cấp/hardening cho môi trường production, nên chạy Mongo ở dạng Replica Set để transaction hoạt động ổn định.

## 3) Dấu hiệu cần bật Replica Set
Bạn nên cân nhắc bật Replica Set khi:
- Muốn đảm bảo các luồng có transaction (ví dụ `POST /orders`) chạy ổn định.
- Muốn giảm rủi ro downtime khi gặp lỗi DB instance.
- Chuẩn bị production/scale.

## 4) Yêu cầu kỹ thuật tối thiểu
- Khuyến nghị: 3 node (production) để có failover tốt.
- Dev có thể chạy replica set dạng 1 node (single-node rs) để vẫn dùng được cơ chế replication/transaction (tùy môi trường).

## 5) Cấu hình connection string (MONGODB_URI)
### Production (gợi ý dạng nhiều host)
- Ví dụ:
  `mongodb://host1:27017,host2:27017,host3:27017/techhome?replicaSet=rs0&directConnection=false`

### Dev local (gợi ý dạng replica set)
- Ví dụ:
  `mongodb://127.0.0.1:27017/techhome?replicaSet=rs0&directConnection=false`

> Ghi chú: format cụ thể còn tùy cách bạn khởi chạy `mongod` và tên replica set (`rs0` ở ví dụ).

## 6) Kiểm tra đã bật Replica Set đúng chưa
- Dùng Mongo shell / admin tool chạy:
  - `rs.status()`
  - kiểm tra có `stateStr` = `PRIMARY` ở ít nhất một node
- Kiểm tra end-to-end:
  - gọi `POST /orders` (đang dùng transaction) và đảm bảo không lỗi liên quan đến transaction/replica set.

## 7) Lưu ý khi dùng transaction với Mongoose
- Transaction cần `startSession()` và chạy qua `session.withTransaction(...)`.
- Một số cấu hình transaction có thể phụ thuộc write concern/replica set.
