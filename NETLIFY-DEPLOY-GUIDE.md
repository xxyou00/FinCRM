# Netlify 部署指南（使用 CLI）

## 🚀 快速部署步骤

你的项目已经准备好部署到 Netlify！按照以下步骤操作：

### 步骤 1: 登录 Netlify

在终端运行：
```bash
npx netlify-cli login
```

这会打开浏览器，让你登录 Netlify 账号。登录后，CLI 会自动获得授权。

### 步骤 2: 初始化项目

```bash
npx netlify-cli init
```

CLI 会引导你完成以下步骤：
1. 选择 "Create & configure a new site"
2. 选择你的团队
3. 输入站点名称（或留空自动生成）
4. 确认构建设置：
   - Build command: `npm run build`
   - Publish directory: `.next`

### 步骤 3: 配置环境变量

在部署前，需要设置环境变量。你有两个选择：

#### 选项 A: 使用 Netlify CLI（推荐）

```bash
# 设置 MongoDB URI（如果你有 MongoDB Atlas）
npx netlify-cli env:set MONGODB_URI "your_mongodb_connection_string"

# 设置 JWT Secret
npx netlify-cli env:set JWT_SECRET "$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"

# 设置 API URL（部署后会知道）
npx netlify-cli env:set NEXT_PUBLIC_API_URL "https://your-site.netlify.app"
```

#### 选项 B: 使用 Netlify 网站界面

1. 访问 https://app.netlify.com/
2. 找到你的站点
3. 进入 Site settings > Environment variables
4. 添加以下变量：
   - `MONGODB_URI`: 你的 MongoDB 连接字符串
   - `JWT_SECRET`: 随机生成的密钥
   - `NEXT_PUBLIC_API_URL`: 你的 Netlify 站点 URL

### 步骤 4: 部署到生产环境

```bash
npx netlify-cli deploy --prod
```

CLI 会：
1. 构建你的项目
2. 上传文件到 Netlify
3. 返回部署 URL

## 📝 重要说明

### 关于数据库

当前项目使用内存数据库作为后备方案，这意味着：
- ✅ 可以立即部署，无需配置数据库
- ⚠️ 数据不会持久化（重启后丢失）
- 💡 建议配置 MongoDB Atlas 实现数据持久化

### 配置 MongoDB Atlas（推荐）

1. 访问 https://www.mongodb.com/cloud/atlas
2. 注册/登录账号
3. 创建免费集群（Free Tier）
4. 创建数据库用户
5. 配置网络访问（添加 0.0.0.0/0 允许所有 IP）
6. 获取连接字符串
7. 在 Netlify 设置环境变量 `MONGODB_URI`

### 初始化数据库数据

部署后，在本地运行：
```bash
# 设置环境变量指向生产数据库
export MONGODB_URI="your_production_mongodb_uri"

# 运行初始化脚本
npm run seed
```

这会创建管理员账户和示例数据。

## 🔧 常用命令

### 查看部署状态
```bash
npx netlify-cli status
```

### 查看站点信息
```bash
npx netlify-cli sites:list
```

### 查看环境变量
```bash
npx netlify-cli env:list
```

### 查看部署日志
```bash
npx netlify-cli deploy:list
```

### 打开站点
```bash
npx netlify-cli open:site
```

### 打开管理界面
```bash
npx netlify-cli open:admin
```

## 🎯 部署后验证

部署完成后，访问你的站点 URL 并测试：

1. ✅ 网站可以访问
2. ✅ 样式正常加载
3. ✅ 可以登录（admin@fincrm.com / admin123）
4. ✅ 可以访问仪表板
5. ✅ 可以添加用户（如果是管理员）
6. ✅ 可以添加潜在客户
7. ✅ 数据可以保存（如果配置了 MongoDB）

## 🐛 故障排除

### 问题 1: 构建失败
**解决方案**:
```bash
# 本地测试构建
npm run build

# 检查构建日志
npx netlify-cli deploy --build
```

### 问题 2: 环境变量未生效
**解决方案**:
```bash
# 检查环境变量
npx netlify-cli env:list

# 重新设置
npx netlify-cli env:set VARIABLE_NAME "value"

# 重新部署
npx netlify-cli deploy --prod
```

### 问题 3: API 调用失败
**解决方案**:
1. 检查 Netlify Functions 日志
2. 确认环境变量设置正确
3. 检查 MongoDB 连接（如果使用）

### 问题 4: 登录后刷新退出
**解决方案**:
1. 确认 JWT_SECRET 已设置
2. 检查 Cookie 设置
3. 查看浏览器控制台错误

## 📊 部署配置文件

你的项目已经包含了 `netlify.toml` 配置文件：

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[build.environment]
  NODE_VERSION = "18"
```

这个配置会：
- 使用 npm run build 构建项目
- 发布 .next 目录
- 使用 Next.js 插件
- 使用 Node.js 18

## 🎉 完成！

部署完成后，你会得到：
- 🌐 一个公开的 URL（如 https://your-site.netlify.app）
- 🔄 自动部署（每次推送到 GitHub 都会自动部署）
- 📊 部署历史和回滚功能
- 🔒 免费的 HTTPS 证书
- 🚀 全球 CDN 加速

## 📞 需要帮助？

- Netlify 文档: https://docs.netlify.com/
- Netlify CLI 文档: https://cli.netlify.com/
- 项目文档: 查看 DEPLOYMENT-CHECKLIST.md

---

祝部署顺利！🚀
