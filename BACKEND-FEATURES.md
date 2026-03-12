# 后端功能说明

## ✅ 已实现的功能

### 1. 认证系统
- ✅ 用户登录（JWT Token）
- ✅ 用户注册
- ✅ 用户登出
- ✅ 会话管理（Cookie-based）
- ✅ 密码加密（bcrypt）
- ✅ 权限验证

### 2. 用户管理 API
- ✅ 获取用户列表（支持搜索、筛选）
- ✅ 创建用户（管理员权限）
- ✅ 获取用户详情
- ✅ 更新用户信息（管理员权限）
- ✅ 删除用户（管理员权限）

### 3. 潜在客户管理 API
- ✅ 获取潜在客户列表（支持搜索、筛选）
- ✅ 创建潜在客户
- ✅ 获取潜在客户详情
- ✅ 更新潜在客户信息
- ✅ 删除潜在客户

### 4. 数据库支持
- ✅ MongoDB 集成（生产环境）
- ✅ 内存数据库（开发/演示）
- ✅ 自动切换机制
- ✅ 数据初始化脚本

### 5. 部署支持
- ✅ Netlify 配置
- ✅ Serverless Functions
- ✅ 环境变量管理
- ✅ 生产环境优化

## 📋 API 端点列表

### 认证相关
```
POST   /api/auth/login      - 用户登录
POST   /api/auth/register   - 用户注册
POST   /api/auth/logout     - 用户登出
GET    /api/auth/me         - 获取当前用户信息
```

### 用户管理
```
GET    /api/users           - 获取用户列表
POST   /api/users           - 创建用户（需要管理员权限）
GET    /api/users/[id]      - 获取用户详情
PUT    /api/users/[id]      - 更新用户（需要管理员权限）
DELETE /api/users/[id]      - 删除用户（需要管理员权限）
```

### 潜在客户管理
```
GET    /api/leads           - 获取潜在客户列表
POST   /api/leads           - 创建潜在客户
GET    /api/leads/[id]      - 获取潜在客户详情
PUT    /api/leads/[id]      - 更新潜在客户
DELETE /api/leads/[id]      - 删除潜在客户
```

## 🔒 安全特性

1. **密码安全**
   - bcrypt 哈希加密
   - 10 轮加盐

2. **JWT 认证**
   - 7 天有效期
   - HttpOnly Cookie
   - CSRF 保护

3. **权限控制**
   - 基于角色的访问控制（RBAC）
   - 管理员权限验证
   - API 级别的权限检查

4. **数据验证**
   - 输入验证
   - 类型检查
   - 错误处理

## 🗄️ 数据模型

### User（用户）
```typescript
{
  _id: string
  email: string
  password: string (hashed)
  firstName: string
  lastName: string
  company?: string
  role: string (Admin | User | Manager | Analyst)
  department: string
  status: string (Active | Inactive)
  createdAt: Date
  updatedAt: Date
  lastLogin?: Date
}
```

### Lead（潜在客户）
```typescript
{
  _id: string
  name: string
  contact: string
  email: string
  phone: string
  source: string (Website | Referral | Cold Call | Social Media | Event)
  status: string (New | Qualified | Proposal | Negotiation | Closed Won | Closed Lost)
  priority: string (High | Medium | Low)
  value: number
  assignedTo: string
  notes: string
  createdAt: Date
  lastContact: Date
  updatedAt: Date
}
```

## 🚀 使用示例

### 登录
```javascript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@fincrm.com',
    password: 'admin123'
  })
})

const { user, token } = await response.json()
```

### 获取用户列表
```javascript
const response = await fetch('/api/users?search=alice&role=Admin')
const { users } = await response.json()
```

### 创建潜在客户
```javascript
const response = await fetch('/api/leads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'TechCorp Inc.',
    contact: 'John Smith',
    email: 'john@techcorp.com',
    phone: '+1 (555) 123-4567',
    source: 'Website',
    priority: 'High',
    value: 250000,
    notes: 'Interested in enterprise solution'
  })
})

const { lead } = await response.json()
```

## 🔄 数据库切换

### 开发模式（内存数据库）
```env
# .env.local
MONGODB_URI=mongodb://localhost:27017/fincrm
```
系统会自动检测并使用内存数据库

### 生产模式（MongoDB Atlas）
```env
# .env.local
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/fincrm
JWT_SECRET=your-secret-key
```

## 📊 性能优化

1. **数据库索引**
   - email 字段索引（用户查询）
   - status 字段索引（状态筛选）
   - createdAt 字段索引（排序）

2. **查询优化**
   - 投影查询（排除敏感字段）
   - 分页支持（待实现）
   - 缓存机制（待实现）

3. **Serverless 优化**
   - 连接池复用
   - 冷启动优化
   - 环境变量缓存

## 🔮 待扩展功能

### 短期计划
- [ ] 产品管理 API
- [ ] 订单管理 API
- [ ] 交易记录 API
- [ ] 报表生成 API

### 中期计划
- [ ] 文件上传功能
- [ ] 邮件通知集成
- [ ] 数据导出（CSV/Excel）
- [ ] 审计日志

### 长期计划
- [ ] 实时通知（WebSocket）
- [ ] 数据分析引擎
- [ ] AI 助手集成
- [ ] 第三方集成（Salesforce、HubSpot）

## 🧪 测试

### 运行 API 测试
```bash
./test-api.sh
```

### 手动测试
```bash
# 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fincrm.com","password":"admin123"}'

# 获取用户列表
curl http://localhost:3000/api/users \
  -H "Cookie: token=YOUR_TOKEN"
```

## 📝 注意事项

1. **内存数据库限制**
   - 数据不持久化
   - 仅用于开发/演示
   - 生产环境必须使用 MongoDB

2. **环境变量**
   - 生产环境必须设置 JWT_SECRET
   - MongoDB URI 必须正确配置
   - 不要提交 .env.local 到版本控制

3. **安全建议**
   - 定期更新依赖包
   - 使用强密码策略
   - 启用 HTTPS
   - 配置 CORS 策略

## 🆘 故障排除

### 问题：登录失败
- 检查密码是否正确
- 查看服务器日志
- 确认数据库连接

### 问题：API 返回 401
- 检查 Token 是否有效
- 确认 Cookie 设置正确
- 验证权限配置

### 问题：数据库连接失败
- 检查 MONGODB_URI 配置
- 确认网络连接
- 查看 MongoDB Atlas IP 白名单

## 📞 技术支持

如有问题，请查看：
- [部署指南](./DEPLOYMENT.md)
- [快速开始](./QUICKSTART.md)
- [主文档](./readme.md)
