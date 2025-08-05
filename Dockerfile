# Sử dụng image Node.js chính thức (dựa trên Debian)
FROM node:22.11

# Chạy với quyền root để cài đặt các gói hệ thống
USER root

# Cài đặt các gói phụ thuộc cần thiết cho node-canvas
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    pkg-config \
  && rm -rf /var/lib/apt/lists/*

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Sao chép tệp package.json và package-lock.json vào container
COPY package*.json ./

# Cài đặt các dependencies (chỉ dependencies cần thiết cho production)
RUN npm ci --omit=dev

# Sao chép toàn bộ mã nguồn của bạn vào container
COPY . .

# Tạo một người dùng không phải root vì lý do bảo mật
RUN groupadd appgroup && useradd -m -g appgroup appuser

# Thay đổi quyền sở hữu của thư mục làm việc
RUN chown -R appuser:appgroup /app

# Chuyển sang người dùng không phải root
USER appuser

# Mở cổng mà ứng dụng của bạn sử dụng (ví dụ: 8080)
EXPOSE 8080

# Lệnh để khởi chạy ứng dụng
CMD ["node", "server.js"]