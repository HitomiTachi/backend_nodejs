# TechHome E-Commerce - Quick Start
## 1) Tong quan
TechHome E-Commerce là dự án web thương mại điện tử xây dựng theo mô hình frontend-backend tách rời, tập trung vào trải nghiệm mua sắm trực tuyến và quản trị hệ thống. Mục tiêu của dự án là triển khai đầy đủ luồng người dùng từ duyệt sản phẩm, đăng ký/đăng nhập, quản lý giỏ hàng, đặt hàng đến theo dõi thông tin tài khoản, đồng thời mở rộng dần các chức năng quản trị cho admin.


## 2. Kiến trúc
Frontend: Ứng dụng web xây bằng React + TypeScript + Vite, đảm nhiệm giao diện người dùng (storefront), điều hướng trang, gọi API và quản lý state phía client.
Backend: API server đặt ở khối backend_nodejs (REST API), xử lý nghiệp vụ auth, sản phẩm, danh mục, hồ sơ người dùng, giỏ hàng, đơn hàng và phân quyền theo vai trò.
API Base URL: 
http://localhost:8080

## 3. Yêu cầu môi trường
- Node.js: >= 20 
- npm: >= 10
- Backend runtime: Node.js

## 4. Chay frontend

```bash
npm install
npm run dev
```

Frontend chay tai: `http://localhost:3000`

## 5. Chay backend

```bash
cd backend
# chay lenh backend theo stack cua ban
```

Backend API du kien chay tai: `http://localhost:8080/api`

## 5) Ket noi frontend-backend

- Dat bien moi truong frontend (vi du `VITE_API_URL`) trung voi dia chi backend.
- Dam bao backend cho phep CORS cho origin frontend.
- Neu login/cart/order loi, kiem tra URL API va token auth.
