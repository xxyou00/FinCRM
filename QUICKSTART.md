# 快速开始指南

## 🚀 本地运行（5分钟）

### 1. 安装依赖
```bash
npm install --legacy-peer-deps
```

### 2. 启动项目
```bash
npm run dev
```

### 3. 访问应用
打开浏览器访问: http://localhost:3000

### 4. 登录系统
- 邮箱: `admin@fincrm.com`
- 密码: `admin123`

## ✅ 完成！

项目现在使用内存数据库运行，所有功能都可以正常使用：
- ✅ 用户登录/注册
- ✅ 用户管理（需要管理员权限）
- ✅ 潜在客户管理
- ✅ 数据持久化（会话期间）

## 📝 注意事项

当前使用内存数据库，数据在服务器重启后会重置。

## 🌐 部署到生产环境

### 使用 MongoDB Atlas（推荐）

1. 注册 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) 免费账号

2. 创建免费集群并获取连接字符串

3. 更新 `.env.local` 文件：
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/fincrm
JWT_SECRET=your-random-secret-key-here
```

4. 初始化数据库：
```bash
npm run seed
```

5. 重启服务器：
```bash
npm run dev
```

### 部署到 Netlify

1. 推送代码到 GitHub

2. 在 [Netlify](https://app.netlify.com/) 导入项目

3. 配置环境变量：
   - `MONGODB_URI`: 你的 MongoDB 连接字符串
   - `JWT_SECRET`: 随机生成的密钥
   - `NEXT_PUBLIC_API_URL`: 你的 Netlify 域名

4. 部署完成！

## 📚 更多文档

- [完整部署指南](./DEPLOYMENT.md)
- [API 文档](./DEPLOYMENT.md#api-端点)
- [数据库结构](./DEPLOYMENT.md#数据库结构)

## 🆘 常见问题

**Q: 登录后刷新页面就退出了？**
A: 这是正常的，因为使用的是内存数据库。配置 MongoDB 后会解决。

**Q: 如何添加新用户？**
A: 使用管理员账号登录后，访问"用户管理"页面即可添加。

**Q: 数据会保存吗？**
A: 内存模式下数据不会保存。配置 MongoDB 后数据会持久化。

## 🎯 下一步

1. 配置 MongoDB Atlas 实现数据持久化
2. 自定义品牌和样式
3. 添加更多业务功能
4. 部署到生产环境

祝使用愉快！🎉
