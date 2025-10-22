#!/bin/bash

echo "🚀 NYU 二手交易平台 - 完整部署脚本"
echo "=========================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. 检查 Python
echo -e "${BLUE}Step 1: 检查 Python 环境${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ 未找到 Python3${NC}"
    exit 1
fi
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo -e "${GREEN}✓${NC} Python 版本: $python_version"

# 2. 创建项目结构
echo ""
echo -e "${BLUE}Step 2: 创建项目结构${NC}"
mkdir -p templates static/images static/css static/js
echo -e "${GREEN}✓${NC} 目录结构已创建"

# 3. 复制文件
echo ""
echo -e "${BLUE}Step 3: 放置项目文件${NC}"
echo -e "${YELLOW}请确保以下文件已放置在正确位置:${NC}"
echo "  - app.py 或 app_enhanced.py"
echo "  - db.py"
echo "  - models.py"
echo "  - auth.py"
echo "  - notifications.py"
echo "  - search.py"
echo "  - requirements.txt"
echo "  - templates/index.html 或 templates/index_complete.html"

# 4. 安装依赖
echo ""
echo -e "${BLUE}Step 4: 安装 Python 依赖${NC}"
if [ -f "requirements.txt" ]; then
    pip3 install -r requirements.txt
    echo -e "${GREEN}✓${NC} 依赖安装完成"
else
    echo -e "${RED}❌ 未找到 requirements.txt${NC}"
    exit 1
fi

# 5. 初始化数据库
echo ""
echo -e "${BLUE}Step 5: 初始化数据库${NC}"
python3 << EOF
import db
import notifications
import search

print("初始化主数据库...")
db.init_database()

print("初始化通知表...")
notifications.init_notifications_table()

print("初始化搜索表...")
search.init_search_tables()

print("插入示例数据...")
db.insert_sample_data()

print("数据库初始化完成！")
EOF
echo -e "${GREEN}✓${NC} 数据库初始化完成"

# 6. 创建环境配置
echo ""
echo -e "${BLUE}Step 6: 创建环境配置${NC}"
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
FLASK_ENV=development
FLASK_HOST=0.0.0.0
FLASK_PORT=5001
SECRET_KEY=your-secret-key-here-change-in-production
EOF
    echo -e "${GREEN}✓${NC} .env 文件已创建"
else
    echo -e "${YELLOW}⚠${NC} .env 文件已存在"
fi

# 7. 创建启动脚本
echo ""
echo -e "${BLUE}Step 7: 创建启动脚本${NC}"
cat > start.sh << 'EOF'
#!/bin/bash
echo "🚀 启动 NYU 二手交易平台..."
python3 app_enhanced.py 2>/dev/null || python3 app.py
EOF
chmod +x start.sh
echo -e "${GREEN}✓${NC} start.sh 已创建"

# 8. 验证文件
echo ""
echo -e "${BLUE}Step 8: 验证项目文件${NC}"
required_files=(
    "db.py"
    "models.py"
    "auth.py"
    "notifications.py"
    "search.py"
)

all_ok=true
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (缺失)"
        all_ok=false
    fi
done

# 检查至少有一个主程序文件
if [ -f "app_enhanced.py" ] || [ -f "app.py" ]; then
    echo -e "${GREEN}✓${NC} 主程序文件存在"
else
    echo -e "${RED}✗${NC} 未找到 app.py 或 app_enhanced.py"
    all_ok=false
fi

# 检查模板文件
if [ -f "templates/index.html" ] || [ -f "templates/index_complete.html" ]; then
    echo -e "${GREEN}✓${NC} 前端模板存在"
else
    echo -e "${RED}✗${NC} 未找到前端模板文件"
    all_ok=false
fi

# 9. 完成
echo ""
echo "=========================================="
if [ "$all_ok" = true ]; then
    echo -e "${GREEN}✅ 部署完成！${NC}"
    echo ""
    echo "启动应用:"
    echo -e "  ${YELLOW}./start.sh${NC}"
    echo ""
    echo "或者直接运行:"
    echo -e "  ${YELLOW}python3 app_enhanced.py${NC}"
    echo -e "  或 ${YELLOW}python3 app.py${NC}"
    echo ""
    echo "访问地址:"
    echo -e "  ${BLUE}http://localhost:5001${NC}"
else
    echo -e "${RED}❌ 部署失败 - 缺少必要文件${NC}"
    echo ""
    echo "请确保所有必要文件都已创建并放置在正确位置"
fi
echo "=========================================="
echo ""