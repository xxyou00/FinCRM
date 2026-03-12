# 🚀 立即部署到 Netlify

## 快速开始（3 步）

### 方式一：使用自动化脚本（推荐）

```bash
# 1. 登录 Netlify（会打开浏览器）
npx netlify-cli login

# 2. 运行部署脚本
./deploy-to-netlify.sh
```

脚本会自动：
- ✅ 检查登录状态
- ✅ 创建/链接站点
- ✅ 设置环境变量
- ✅ 构建项目
- ✅ 部署到 Netlify

### 方式二：手动部署

```bash
# 1. 登录
npx netlify-cli login

# 2. 初始化站点
npx netlify-cli init

# 3. 设置环境变量
npx netlify-cli env:set JWT_SECRET "$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"

# 4. 部署
npx netlify-cli deploy --prod
```

## 📝 环境变量说明

### 必需的环境变量

1. **JWT_SECRET** (必需)
   - 用于 JWT Token 加密
   - 自动生成：`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

2. **NEXT_PUBLIC_API_URL** (必需)
   - 你的 Netlify 站点 URL
   - 首次部署后设置：`npx netlify-cli env:set NEXT_PUBLIC_API_URL "https://your-site.netlify.app"`

### 可选的环境变量

3. **MONGODB_URI** (可选)
   - MongoDB 连接字符串
   - 不设置将使用内存数据库（数据不持久化）
   - 推荐配置 MongoDB Atlas

## 🎯 部署后检查清单

- [ ] 网站可以访问
- [ ] 样式正常显示
- [ ] 可以登录（admin@fincrm.com / admin123）
- [ ] 可以访问仪表板
- [ ] 可以添加用户
- [ ] 可以添加潜在客户
- [ ] 数据可以保存（如果配置了 MongoDB）

## 💡 关于数据库

### 当前状态（内存数据库）
- ✅ 可以立即部署，无需配置
- ⚠️ 数据不会持久化
- ⚠️ 服务器重启后数据丢失

### 推荐配置（MongoDB Atlas）
1. 访问 https://www.mongodb.com/cloud/atlas
2. 创建免费集群
3. 获取连接字符串
4. 设置环境变量：
   ```bash
   npx netlify-cli env:set MONGODB_URI "your_connection_string"
   ```
5. 重新部署：
   ```bash
   npx netlify-cli deploy --prod
   ```

## 🔧 常见问题

### Q: 部署失败怎么办？
A: 检查构建日志，确保本地可以成功构建：
```bash
npm run build
```

### Q: 登录后刷新页面就退出了？
A: 确保设置了 JWT_SECRET 环境变量

### Q: API 调用失败？
A: 检查环境变量是否正确设置：
```bash
npx netlify-cli env:list
```

### Q: 如何查看部署日志？
A: 使用以下命令：
```bash
npx netlify-cli deploy:list
npx netlify-cli open:admin
```

## 📚 更多信息

- 详细部署指南：`NETLIFY-DEPLOY-GUIDE.md`
- 部署检查清单：`DEPLOYMENT-CHECKLIST.md`
- 后端功能说明：`BACKEND-FEATURES.md`

## 🎉 准备好了吗？

运行以下命令开始部署：

```bash
# 登录 Netlify
npx netlify-cli login

# 运行部署脚本
./deploy-to-netlify.sh
```

或者查看详细指南：
```bash
cat NETLIFY-DEPLOY-GUIDE.md
```

祝部署顺利！🚀
