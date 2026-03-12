#!/bin/bash

echo "🚀 FinCRM Netlify 部署脚本"
echo "=========================="
echo ""

# 检查是否已登录
echo "📋 步骤 1: 检查 Netlify 登录状态..."
npx netlify-cli status

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ 未登录 Netlify"
    echo "请运行以下命令登录："
    echo "  npx netlify-cli login"
    echo ""
    exit 1
fi

echo ""
echo "✅ 已登录 Netlify"
echo ""

# 检查是否已链接站点
echo "📋 步骤 2: 检查站点链接状态..."
SITE_ID=$(npx netlify-cli status | grep "Site Id" | awk '{print $3}')

if [ -z "$SITE_ID" ]; then
    echo ""
    echo "⚠️  站点未链接"
    echo ""
    echo "请选择操作："
    echo "1) 创建新站点"
    echo "2) 链接现有站点"
    read -p "请输入选项 (1 或 2): " choice
    
    if [ "$choice" = "1" ]; then
        echo ""
        echo "🆕 创建新站点..."
        npx netlify-cli init
    elif [ "$choice" = "2" ]; then
        echo ""
        echo "🔗 链接现有站点..."
        npx netlify-cli link --git-remote-url https://github.com/xxyou00/FinCRM
    else
        echo "❌ 无效选项"
        exit 1
    fi
else
    echo "✅ 站点已链接: $SITE_ID"
fi

echo ""
echo "📋 步骤 3: 检查环境变量..."
echo ""
echo "⚠️  重要：请确保已设置以下环境变量："
echo "  - MONGODB_URI (可选，不设置将使用内存数据库)"
echo "  - JWT_SECRET (必需)"
echo "  - NEXT_PUBLIC_API_URL (必需)"
echo ""
read -p "是否需要设置环境变量？(y/n): " setup_env

if [ "$setup_env" = "y" ]; then
    echo ""
    echo "设置 JWT_SECRET..."
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    npx netlify-cli env:set JWT_SECRET "$JWT_SECRET"
    
    echo ""
    read -p "是否有 MongoDB URI？(y/n): " has_mongo
    if [ "$has_mongo" = "y" ]; then
        read -p "请输入 MongoDB URI: " mongo_uri
        npx netlify-cli env:set MONGODB_URI "$mongo_uri"
    fi
    
    echo ""
    echo "✅ 环境变量设置完成"
    echo "⚠️  注意：NEXT_PUBLIC_API_URL 需要在首次部署后设置"
fi

echo ""
echo "📋 步骤 4: 构建项目..."
npm run build

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ 构建失败"
    echo "请检查错误信息并修复后重试"
    exit 1
fi

echo ""
echo "✅ 构建成功"
echo ""

echo "📋 步骤 5: 部署到 Netlify..."
echo ""
read -p "是否部署到生产环境？(y/n): " deploy_prod

if [ "$deploy_prod" = "y" ]; then
    echo ""
    echo "🚀 部署到生产环境..."
    npx netlify-cli deploy --prod
else
    echo ""
    echo "🔍 创建预览部署..."
    npx netlify-cli deploy
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 部署成功！"
    echo ""
    echo "📝 后续步骤："
    echo "1. 访问你的站点 URL"
    echo "2. 使用 admin@fincrm.com / admin123 登录"
    echo "3. 测试所有功能"
    echo ""
    echo "💡 提示："
    echo "- 如果使用内存数据库，数据不会持久化"
    echo "- 建议配置 MongoDB Atlas 实现数据持久化"
    echo "- 查看 NETLIFY-DEPLOY-GUIDE.md 了解更多信息"
    echo ""
    
    # 打开站点
    read -p "是否在浏览器中打开站点？(y/n): " open_site
    if [ "$open_site" = "y" ]; then
        npx netlify-cli open:site
    fi
else
    echo ""
    echo "❌ 部署失败"
    echo "请检查错误信息"
fi
