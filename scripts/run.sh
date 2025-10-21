#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}╔════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  NYU 二手交易平台 - 启动程序    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════╝${NC}"
echo ""

# 检查 Python 版本
echo -e "${YELLOW}⚙️  检查 Python 环境...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ 未找到 Python3, 请先安装 Python 3.7+${NC}"
    exit 1
fi

python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo -e "${GREEN}✓${NC} Python 版本: $python_version"

# 检查必要文件
echo ""
echo -e "${YELLOW}📋 检查项目文件...${NC}"
files=("app.py" "db.py" "models.py" "requirements.txt")
missing_files=()

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (缺失)"
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -ne 0 ]; then
    echo ""
    echo -e "${RED}❌ 缺少必要文件,请先运行 setup.sh 进行配置${NC}"
    exit 1
fi

# 安装依赖
echo ""
echo -e "${YELLOW}📦 安装 Python 依赖包...${NC}"
pip3 install -r requirements.txt --quiet

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} 依赖安装完成"
else
    echo -e "${RED}❌ 依赖安装失败${NC}"
    exit 1
fi

# 检查数据库
echo ""
echo -e "${YELLOW}🗄️  检查数据库...${NC}"
if [ -f "marketplace.db" ]; then
    echo -e "${GREEN}✓${NC} 数据库已存在"
    read -p "是否重新初始化数据库? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm marketplace.db
        echo -e "${YELLOW}正在初始化数据库...${NC}"
        python3 db.py
    fi
else
    echo -e "${YELLOW}初始化数据库...${NC}"
    python3 db.py
fi

# 检查端口占用
echo ""
echo -e "${YELLOW}🔍 检查端口占用...${NC}"
PORT=5000
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${RED}⚠️  端口 $PORT 已被占用${NC}"
    read -p "是否终止占用进程? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill -9 $(lsof -t -i:$PORT) 2>/dev/null
        echo -e "${GREEN}✓${NC} 端口已释放"
    else
        echo -e "${YELLOW}提示: 可以在 .env 中修改端口号${NC}"
    fi
else
    echo -e "${GREEN}✓${NC} 端口 $PORT 可用"
fi

# 启动应用
echo ""
echo -e "${BLUE}════════════════════════════════════${NC}"
echo -e "${GREEN}✨ 启动 Flask 应用...${NC}"
echo -e "${BLUE}════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}访问地址:${NC}"
echo -e "  主页: ${BLUE}http://localhost:5000${NC}"
echo -e "  API健康检查: ${BLUE}http://localhost:5000/health${NC}"
echo ""
echo -e "${YELLOW}按 Ctrl+C 停止服务${NC}"
echo ""

# 启动 Flask
python3 app.py
