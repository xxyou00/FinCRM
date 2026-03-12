# Netlify 部署检查清单

## 📋 部署前准备

### 1. 代码准备
- [x] 后端 API 已实现
- [x] 前端已连接 API
- [x] 环境变量配置完成
- [x] Netlify 配置文件已创建
- [ ] 代码已推送到 GitHub

### 2. MongoDB 设置
- [ ] 注册 MongoDB Atlas 账号
- [ ] 创建免费集群
- [ ] 创建数据库用户
- [ ] 配置 IP 白名单（0.0.0.0/0 或 Netlify IP）
- [ ] 获取连接字符串

### 3. 环境变量准备
准备以下环境变量的值：

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/fincrm
JWT_SECRET=生成一个随机字符串（至少32位）
NEXT_PUBLIC_API_URL=https://your-site.netlify.app
```

生成 JWT_SECRET：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🚀 Netlify 部署步骤

### 方式一：通过 Netlify 网站（推荐）

#### 步骤 1: 推送代码到 GitHub
```bash
git add .
git commit -m "Add backend functionality"
git push origin main
```

#### 步骤 2: 连接 Netlify
1. 访问 https://app.netlify.com/
2. 点击 "Add new site" > "Import an existing project"
3. 选择 GitHub 并授权
4. 选择你的仓库

#### 步骤 3: 配置构建设置
```
Build command: npm run build
Publish directory: .next
```

#### 步骤 4: 添加环境变量
在 "Site settings" > "Environment variables" 中添加：
- `MONGODB_URI`
- `JWT_SECRET`
- `NEXT_PUBLIC_API_URL`

#### 步骤 5: 部署
点击 "Deploy site" 按钮

#### 步骤 6: 初始化数据库
部署成功后，在本地运行：
```bash
# 设置环境变量指向生产数据库
export MONGODB_URI="your_production_mongodb_uri"
npm run seed
```

### 方式二：通过 Netlify CLI

#### 步骤 1: 安装 CLI
```bash
npm install -g netlify-cli
```

#### 步骤 2: 登录
```bash
netlify login
```

#### 步骤 3: 初始化项目
```bash
netlify init
```

#### 步骤 4: 设置环境变量
```bash
netlify env:set MONGODB_URI "your_mongodb_uri"
netlify env:set JWT_SECRET "your_jwt_secret"
netlify env:set NEXT_PUBLIC_API_URL "https://your-site.netlify.app"
```

#### 步骤 5: 部署
```bash
netlify deploy --prod
```

## ✅ 部署后验证

### 1. 检查网站访问
- [ ] 网站可以正常访问
- [ ] 样式加载正常
- [ ] 页面路由正常

### 2. 测试登录功能
- [ ] 可以访问登录页面
- [ ] 使用 admin@fincrm.com / admin123 登录
- [ ] 登录成功后跳转到仪表板

### 3. 测试 API 功能
```bash
# 替换为你的 Netlify 域名
SITE_URL="https://your-site.netlify.app"

# 测试登录
curl -X POST $SITE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fincrm.com","password":"admin123"}'
```

### 4. 检查数据持久化
- [ ] 创建新用户
- [ ] 刷新页面，数据仍然存在
- [ ] 创建潜在客户
- [ ] 数据正确保存到 MongoDB

### 5. 检查权限控制
- [ ] 非管理员无法访问用户管理
- [ ] 未登录用户被重定向到登录页
- [ ] API 权限验证正常

## 🔧 常见问题解决

### 问题 1: 部署失败
**症状**: 构建过程中出错

**解决方案**:
```bash
# 本地测试构建
npm run build

# 检查依赖
npm install --legacy-peer-deps

# 查看 Netlify 构建日志
```

### 问题 2: API 调用失败
**症状**: 登录或数据加载失败

**解决方案**:
1. 检查 Netlify Functions 日志
2. 确认环境变量设置正确
3. 检查 MongoDB 连接字符串
4. 验证 IP 白名单配置

### 问题 3: 数据库连接超时
**症状**: API 返回 500 错误

**解决方案**:
1. 检查 MongoDB Atlas 状态
2. 确认 IP 白名单包含 0.0.0.0/0
3. 测试连接字符串是否正确
4. 检查数据库用户权限

### 问题 4: 登录后刷新退出
**症状**: 刷新页面后需要重新登录

**解决方案**:
1. 检查 JWT_SECRET 是否设置
2. 确认 Cookie 设置正确
3. 查看浏览器 Cookie 是否被阻止

### 问题 5: 样式丢失
**症状**: 页面显示但没有样式

**解决方案**:
1. 清除浏览器缓存
2. 检查 Tailwind CSS 配置
3. 确认 PostCSS 配置正确
4. 重新部署

## 📊 性能优化建议

### 1. 启用 CDN 缓存
在 `netlify.toml` 中配置：
```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

### 2. 配置 MongoDB 索引
```javascript
// 在 MongoDB Atlas 中创建索引
db.users.createIndex({ email: 1 })
db.leads.createIndex({ status: 1 })
db.leads.createIndex({ createdAt: -1 })
```

### 3. 启用压缩
Netlify 自动启用 Gzip/Brotli 压缩

### 4. 图片优化
使用 Next.js Image 组件自动优化

## 🔒 安全加固

### 1. 环境变量安全
- [ ] 不要在代码中硬编码密钥
- [ ] 使用强随机 JWT_SECRET
- [ ] 定期轮换密钥

### 2. MongoDB 安全
- [ ] 使用强密码
- [ ] 限制 IP 访问
- [ ] 启用审计日志
- [ ] 定期备份数据

### 3. API 安全
- [ ] 启用 HTTPS（Netlify 自动）
- [ ] 配置 CORS 策略
- [ ] 实施速率限制
- [ ] 添加请求验证

### 4. 监控和日志
- [ ] 启用 Netlify Analytics
- [ ] 配置错误追踪（如 Sentry）
- [ ] 监控 API 性能
- [ ] 设置告警通知

## 📈 监控指标

部署后需要监控：
- [ ] 网站可用性（99.9%+）
- [ ] API 响应时间（<500ms）
- [ ] 错误率（<1%）
- [ ] 数据库连接数
- [ ] 内存使用情况

## 🎯 下一步

部署成功后：
1. [ ] 配置自定义域名
2. [ ] 设置 SSL 证书（Netlify 自动）
3. [ ] 配置邮件通知
4. [ ] 添加监控告警
5. [ ] 准备用户文档
6. [ ] 进行负载测试

## 📞 获取帮助

如遇到问题：
1. 查看 [Netlify 文档](https://docs.netlify.com/)
2. 查看 [MongoDB Atlas 文档](https://docs.atlas.mongodb.com/)
3. 检查项目的 [DEPLOYMENT.md](./DEPLOYMENT.md)
4. 联系技术支持

---

祝部署顺利！🚀
