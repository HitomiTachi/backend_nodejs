# Quy tắc thực thi khi sửa code (bắt buộc)

Tài liệu này là **rule thực thi bắt buộc** khi sửa code trong dự án.

**Áp dụng repo backend (Node/Express/Mongoose):** Các mục dưới đây dùng từ chung (*component, hook, UI…*); trong repo này hãy đọc tương đương với **route, middleware, schema (Mongoose), controller, mapper, util** — nguyên tắc vẫn giữ nguyên.

---

## 1) Tìm đúng code trước khi sửa

- Luôn xác định đúng file, component, hook, route liên quan trước khi chỉnh.
- Đọc code hiện tại để hiểu luồng render và dependency.
- Không sửa dựa trên giả định.

Checklist nhanh:

- [ ] Đã xác định đúng file cần sửa
- [ ] Đã đọc phần code liên quan trước khi edit

---

## 2) Kiểm tra dependencies

- Đảm bảo không phá vỡ import/export hiện có.
- Kiểm tra các component/hook/service đang phụ thuộc vào đoạn code sắp sửa.
- Nếu đổi tên symbol, phải cập nhật toàn bộ nơi sử dụng.

Checklist nhanh:

- [ ] Imports/exports hợp lệ
- [ ] Không tạo circular dependency
- [ ] Các nơi dùng chung đã được rà soát

---

## 3) Thay đổi từng bước

- Chia nhỏ thay đổi theo từng mục rõ ràng (UI shell -> page -> component -> style).
- Mỗi bước nên có mục tiêu cụ thể và có thể kiểm chứng độc lập.
- Tránh sửa quá nhiều phần không liên quan trong một lần.

Checklist nhanh:

- [ ] Mỗi commit/block sửa có phạm vi rõ ràng
- [ ] Không trộn nhiều mục tiêu trong một thay đổi

---

## 4) Test sau mỗi thay đổi

- Sau mỗi bước chỉnh sửa, chạy kiểm tra tối thiểu để tránh lỗi dây chuyền.
- Ưu tiên: build/type-check/lint (tùy script dự án đang có).
- Nếu có lỗi mới phát sinh, xử lý ngay trước khi sang bước tiếp theo.

Checklist nhanh:

- [ ] Đã chạy kiểm tra sau thay đổi
- [ ] Không còn lỗi mới do thay đổi vừa thực hiện

---

## 5) Giữ nguyên business logic

- Chỉ thay đổi UI/structure khi nhiệm vụ không yêu cầu sửa nghiệp vụ.
- Không tự ý đổi luồng xử lý dữ liệu, điều kiện nghiệp vụ, hoặc hành vi API.
- Nếu bắt buộc phải đụng logic, cần ghi rõ lý do và phạm vi.

Checklist nhanh:

- [ ] Chỉ thay UI/structure (trừ khi task yêu cầu khác)
- [ ] Không thay đổi business logic ngoài scope
- [ ] Đã ghi chú rõ nếu có thay đổi logic bắt buộc

---

## Áp dụng thực tế cho mọi task

Trước khi sửa:

- [ ] Đọc và hiểu code hiện tại
- [ ] Xác nhận dependency liên quan

Trong khi sửa:

- [ ] Chia nhỏ thay đổi theo từng bước
- [ ] Không làm lệch business logic

Sau khi sửa:

- [ ] Chạy kiểm tra kỹ thuật
- [ ] Rà lại phạm vi thay đổi đúng yêu cầu

---

## Quy tắc ưu tiên khi có xung đột

1. Không phá business logic hiện tại
2. Không phá dependency/import
3. Thay đổi nhỏ, có thể kiểm chứng
4. Luôn kiểm tra sau mỗi bước
