#!/bin/bash

echo "🚀 NYU 二手交易平台 - 自动配置脚本"
echo "===================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. 重命名文件
echo "📝 步骤 1: 重命名项目文件..."
if [ -f "nyu-marketplace-app.py" ]; then
    mv nyu-marketplace-app.py app.py
    echo -e "${GREEN}✓${NC} app.py"
fi

if [ -f "nyu-marketplace-db.py" ]; then
    mv nyu-marketplace-db.py db.py
    echo -e "${GREEN}✓${NC} db.py"
fi

if [ -f "nyu-marketplace-models.py" ]; then
    mv nyu-marketplace-models.py models.py
    echo -e "${GREEN}✓${NC} models.py"
fi

if [ -f "nyu-marketplace-requirements.txt" ]; then
    mv nyu-marketplace-requirements.txt requirements.txt
    echo -e "${GREEN}✓${NC} requirements.txt"
fi

# 2. 创建目录结构
echo ""
echo "📁 步骤 2: 创建目录结构..."
mkdir -p templates
mkdir -p static/images
mkdir -p static/css
mkdir -p static/js
echo -e "${GREEN}✓${NC} templates/"
echo -e "${GREEN}✓${NC} static/"

# 3. 移动 HTML 文件
echo ""
echo "📄 步骤 3: 移动前端文件..."
if [ -f "nyu-marketplace-ui.html" ]; then
    mv nyu-marketplace-ui.html templates/index.html
    echo -e "${GREEN}✓${NC} templates/index.html"
fi

# 4. 创建 .env 配置文件
echo ""
echo "⚙️  步骤 4: 创建配置文件..."
cat > .env << 'EOF'
FLASK_ENV=development
FLASK_HOST=0.0.0.0
FLASK_PORT=5000
EOF
echo -e "${GREEN}✓${NC} .env"

# 5. 创建 .gitignore
cat > .gitignore << 'EOF'
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
ENV/
.venv

# Flask
instance/
.webassets-cache

# Database
*.db
*.sqlite
*.sqlite3
marketplace.db

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local

# Logs
*.log
EOF
echo -e "${GREEN}✓${NC} .gitignore"

# 6. 创建启动脚本
echo ""
echo "🔧 步骤 5: 创建启动脚本..."
cat > run.sh << 'EOF'
#!/bin/bash

echo "🚀 启动 NYU 二手交易平台..."
echo ""

# 检查 Python 版本
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "Python 版本: $python_version"

# 安装依赖
echo ""
echo "📦 安装依赖包..."
pip3 install -r requirements.txt

# 初始化数据库
echo ""
echo "🗄️  初始化数据库..."
python3 db.py

# 启动应用
echo ""
echo "✨ 启动 Flask 应用..."
python3 app.py
EOF
chmod +x run.sh
echo -e "${GREEN}✓${NC} run.sh"

# 7. 创建 README
cat > README.md << 'EOF'
# NYU 二手交易平台

一个为 NYU 学生和周边社区设计的二手物品交易平台。

## 功能特性

- 🏫 **社区认证**: 支持 NYU 邮箱和手机号认证
- 📚 **分类浏览**: 教材、家具、电子产品、宿舍用品等
- 🔍 **智能搜索**: 按课程代码、物品名称快速搜索
- 💬 **站内消息**: 买卖双方实时沟通
- ⭐ **信用评价**: 交易后互评,建立信任体系
- 🚩 **举报机制**: 维护平台安全和秩序

## 技术栈

- **后端**: Flask 2.3.0 + SQLite
- **前端**: HTML5 + CSS3 + JavaScript (原生)
- **部署**: 支持本地开发和生产环境

## 快速开始

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd nyu-marketplace
```

### 2. 自动配置 (推荐)

```bash
chmod +x setup.sh
./setup.sh
```

### 3. 手动配置

```bash
# 安装依赖
pip install -r requirements.txt

# 初始化数据库
python db.py

# 启动应用
python app.py
```

## 项目结构

```
nyu-marketplace/
├── app.py              # Flask 主应用
├── db.py               # 数据库操作
├── models.py           # 数据模型
├── requirements.txt    # 依赖包
├── .env               # 环境配置
├── marketplace.db     # SQLite 数据库
├── templates/
│   └── index.html     # 前端页面
└── static/            # 静态资源
    ├── images/
    ├── css/
    └── js/
```

## API 接口

### 社区相关
- `GET /api/communities` - 获取社区列表
- `GET /api/communities/:id` - 获取社区详情

### 用户相关
- `POST /api/users` - 创建用户
- `GET /api/users/:id` - 获取用户信息
- `POST /api/users/:id/verify` - 验证用户

### 物品相关
- `GET /api/listings` - 获取物品列表
- `GET /api/listings/:id` - 获取物品详情
- `POST /api/listings` - 发布物品
- `PUT /api/listings/:id` - 更新物品
- `DELETE /api/listings/:id` - 删除物品
- `GET /api/listings/search?q=xxx` - 搜索物品

### 消息相关
- `POST /api/threads` - 创建会话
- `GET /api/threads/:user_id` - 获取用户会话列表
- `POST /api/messages` - 发送消息
- `GET /api/threads/:id/messages` - 获取会话消息

### 举报相关
- `POST /api/reports` - 提交举报
- `GET /api/reports` - 获取举报列表 (管理员)

### 评价相关
- `POST /api/reviews` - 创建评价
- `GET /api/users/:id/reviews` - 获取用户评价

## 配置说明

在 `.env` 文件中配置:

```bash
FLASK_ENV=development       # 环境: development/production
FLASK_HOST=0.0.0.0         # 主机地址
FLASK_PORT=5000            # 端口号
```

## 访问地址

启动后访问:
- 主页: http://localhost:5000
- API健康检查: http://localhost:5000/health

## 开发计划

- [ ] 图片上传功能
- [ ] JWT 用户认证
- [ ] WebSocket 实时消息
- [ ] 微信小程序集成
- [ ] 支付功能
- [ ] 管理后台

## License

MIT License
EOF
echo -e "${GREEN}✓${NC} README.md"

# 8. 显示项目结构
echo ""
echo "📊 项目结构:"
tree -L 2 -I '__pycache__|*.pyc' 2>/dev/null || ls -la

# 9. 完成
echo ""
echo "===================================="
echo -e "${GREEN}✅ 配置完成!${NC}"
echo ""
echo "下一步:"
echo -e "  1. 运行 ${YELLOW}./run.sh${NC} 启动应用"
echo -e "  2. 访问 ${YELLOW}http://localhost:5000${NC}"
echo ""
echo "或者手动执行:"
echo -e "  ${YELLOW}pip install -r requirements.txt${NC}"
echo -e "  ${YELLOW}python db.py${NC}"
echo -e "  ${YELLOW}python app.py${NC}"
echo ""