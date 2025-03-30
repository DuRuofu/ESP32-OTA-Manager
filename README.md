# ESP32-OTA-Manager

这是一个用于管理和分发ESP32固件的Web服务器系统。它提供了一个简单的Web界面，允许用户上传、管理和分发ESP32固件文件，支持版本控制和OTA更新功能。

## 主要功能

- 固件文件上传和管理
- 版本控制和版本信息管理
- 文件拖拽上传支持
- 安全认证机制
- 固件文件在线预览和下载
- 支持ESP32 OTA更新

## 安装和运行

### 环境要求

- Node.js (建议版本 >= 14)
- pnpm 包管理器

### 安装步骤

1. 克隆或下载项目代码
2. 进入项目目录，安装依赖：
   ```bash
   pnpm install
   ```
3. 创建配置文件 `config.json`，设置访问密码：
   ```json
   {
     "password": "your-password"
   }
   ```
4. 启动服务器：
   ```bash
   pnpm start
   ```
5. 开发模式（支持热重载）：
   ```bash
   pnpm dev
   ```

服务器启动后，将自动显示访问地址，默认端口为3000。

## 使用说明

### Web界面操作

1. 访问服务器地址（例如：`http://localhost:3000`）
2. 输入配置的访问密码进行认证
3. 认证成功后可以：
   - 上传新的固件文件（支持拖拽上传）
   - 查看已上传的固件列表
   - 管理固件版本信息
   - 删除不需要的固件

### 固件管理

- 支持的固件格式：`.bin`文件
- 版本号格式：`x.x.x`（例如：1.0.0）
- 每个固件文件都会记录：
  - 版本号
  - 上传时间
  - 文件大小
  - 下载地址

## API接口说明

### 认证相关

- `POST /auth`
  - 功能：用户认证
  - 参数：`{"password": "your-password"}`

- `GET /check-auth`
  - 功能：检查认证状态

### 固件管理

- `POST /upload`
  - 功能：上传固件
  - 参数：
    - `firmware`：固件文件（.bin）
    - `version`：版本号
    - `description`：描述（可选）

- `GET /list`
  - 功能：获取固件列表

- `GET /firmware/:filename`
  - 功能：下载固件文件

- `GET /firmware/:filename/version`
  - 功能：获取固件版本信息

- `POST /firmware/:filename/update`
  - 功能：更新固件信息
  - 参数：
    - `version`：新版本号
    - `newFilename`：新文件名（可选）

- `DELETE /firmware/:filename`
  - 功能：删除固件

### ESP32 访问接口

 ESP32设备可以通过以下方式访问固件：

1. 获取固件列表：
   ```
   GET http://<server-ip>:3000/list
   ```

2. 下载固件文件：
   ```
   GET http://<server-ip>:3000/firmware/<filename>
   ```

3. 获取特定固件版本信息：
   ```
   GET http://<server-ip>:3000/firmware/<filename>/version
   ```

其中 `<server-ip>` 为服务器IP地址，`<filename>` 为固件文件名。
