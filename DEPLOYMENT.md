# 部署指南

## 本地开发

### 1. 安装依赖

```bash
npm install --legacy-peer-deps
```

### 2. 配置环境变量

复制 `.env.local.example` 为 `.env.local` 并填写配置：

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`：

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_random_secret_key
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 3. 获取 MongoDB 连接字符串

1. 访问 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. 注册/登录账号
3. 创建免费集群（Free Tier）
4. 创建数据库用户
5. 获取连接字符串，格式如：
   ```
   mongodb+srv://username:password@cluster.mongodb.net/fincrm?retryWrites=true&w=majority
   ```

### 4. 初始化数据库

```bash
npm run seed
```

这会创建：
- 管理员账户：admin@fincrm.com / admin123
- 示例用户和潜在客户数据

### 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 部署到 Netlify

### 方式一：通过 Netlify CLI

1. 安装 Netlify CLI：
```bash
npm install -g netlify-cli
```

2. 登录 Netlify：
```bash
netlify login
```

3. 初始化项目：
```bash
netlify init
```

4. 设置环境变量：
```bash
netlify env:set MONGODB_URI "your_mongodb_uri"
netlify env:set JWT_SECRET "your_jwt_secret"
netlify env:set NEXT_PUBLIC_API_URL "https://your-site.netlify.app"
```

5. 部署：
```bash
netlify deploy --prod
```

### 方式二：通过 Netlify 网站

1. 将代码推送到 GitHub

2. 访问 [Netlify](https://app.netlify.com/)

3. 点击 "Add new site" > "Import an existing project"

4. 选择你的 GitHub 仓库

5. 配置构建设置：
   - Build command: `npm run build`
   - Publish directory: `.next`

6. 添加环境变量（在 Site settings > Environment variables）：
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `NEXT_PUBLIC_API_URL`

7. 点击 "Deploy site"

## 环境变量说明

| 变量名 | 说明 | 示例 |
|--------|------|------|
| MONGODB_URI | MongoDB 连接字符串 | mongodb+srv://... |
| JWT_SECRET | JWT 加密密钥（随机字符串） | your-secret-key-123 |
| NEXT_PUBLIC_API_URL | API 基础 URL | https://your-site.netlify.app |

## 生产环境注意事项

1. **安全性**
   - 使用强密码的 JWT_SECRET
   - 启用 MongoDB IP 白名单
   - 定期更新依赖包

2. **性能优化**
   - 启用 MongoDB 索引
   - 配置 CDN 缓存
   - 使用 Next.js 图片优化

3. **监控**
   - 配置 MongoDB Atlas 监控
   - 使用 Netlify Analytics
   - 设置错误日志收集

## 常见问题

### Q: 部署后 API 调用失败？
A: 检查环境变量是否正确设置，特别是 MONGODB_URI

### Q: 登录后刷新页面就退出了？
A: 检查 JWT_SECRET 是否在生产环境中设置

### Q: MongoDB 连接超时？
A: 检查 MongoDB Atlas 的 IP 白名单，添加 0.0.0.0/0 允许所有 IP（或使用 Netlify 的 IP 范围）

## 技术栈

- **前端**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **后端**: Next.js API Routes (Serverless Functions)
- **数据库**: MongoDB Atlas
- **认证**: JWT + bcrypt
- **部署**: Netlify

## 数据库结构

### Users Collection
```javascript
{
  _id: ObjectId,
  email: String,
  password: String (hashed),
  firstName: String,
  lastName: String,
  company: String,
  role: String,
  department: String,
  status: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Leads Collection
```javascript
{
  _id: ObjectId,
  name: String,
  contact: String,
  email: String,
  phone: String,
  source: String,
  status: String,
  priority: String,
  value: Number,
  assignedTo: String,
  notes: String,
  createdAt: Date,
  lastContact: Date,
  updatedAt: Date
}
```

## API 端点

### 认证
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/me` - 获取当前用户

### 用户管理
- `GET /api/users` - 获取用户列表
- `POST /api/users` - 创建用户（需要管理员权限）
- `GET /api/users/[id]` - 获取用户详情
- `PUT /api/users/[id]` - 更新用户（需要管理员权限）
- `DELETE /api/users/[id]` - 删除用户（需要管理员权限）

### 潜在客户
- `GET /api/leads` - 获取潜在客户列表
- `POST /api/leads` - 创建潜在客户
- `GET /api/leads/[id]` - 获取潜在客户详情
- `PUT /api/leads/[id]` - 更新潜在客户
- `DELETE /api/leads/[id]` - 删除潜在客户

## 后续扩展

可以继续添加的功能：
- 产品管理 API
- 订单管理 API
- 报表生成 API
- 文件上传功能
- 实时通知
- 邮件集成
- 数据导出功能
