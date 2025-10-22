#!/bin/bash

echo "🔧 NYU Marketplace - Fixing Naming Issues"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. Remove duplicate files with 'nyu-marketplace-' prefix
echo -e "${BLUE}Step 1: Removing duplicate prefixed files...${NC}"

files_to_remove=(
    "nyu-marketplace-requirements.txt"
    "nyu-marketplace-ui.html"
    "nyu-marketplace-app.py"
    "nyu-marketplace-db.py"
    "nyu-marketplace-models.py"
)

for file in "${files_to_remove[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo -e "${GREEN}✓${NC} Removed: $file"
    fi
done

# 2. Rename scripts to match README references
echo ""
echo -e "${BLUE}Step 2: Renaming scripts...${NC}"

if [ -f "setup_script.sh" ]; then
    mv setup_script.sh setup.sh
    chmod +x setup.sh
    echo -e "${GREEN}✓${NC} Renamed: setup_script.sh → setup.sh"
fi

if [ -f "run_script.sh" ]; then
    mv run_script.sh run.sh
    chmod +x run.sh
    echo -e "${GREEN}✓${NC} Renamed: run_script.sh → run.sh"
fi

# 3. Clean up virtual environment with problematic paths
echo ""
echo -e "${BLUE}Step 3: Cleaning virtual environment...${NC}"

if [ -d "venv" ]; then
    echo -e "${YELLOW}Found existing venv directory${NC}"
    read -p "Remove and recreate virtual environment? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf venv
        echo -e "${GREEN}✓${NC} Removed old venv"
        
        echo -e "${YELLOW}Creating new virtual environment...${NC}"
        python3 -m venv venv
        echo -e "${GREEN}✓${NC} Created new venv"
        
        echo -e "${YELLOW}Installing dependencies...${NC}"
        source venv/bin/activate
        pip install -r requirements.txt --quiet
        echo -e "${GREEN}✓${NC} Dependencies installed"
    fi
fi

# 4. Verify core files exist
echo ""
echo -e "${BLUE}Step 4: Verifying core files...${NC}"

required_files=(
    "app.py"
    "db.py"
    "models.py"
    "requirements.txt"
    "setup.sh"
    "run.sh"
    "test_api.py"
)

all_present=true
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (missing)"
        all_present=false
    fi
done

# 5. Check directory structure
echo ""
echo -e "${BLUE}Step 5: Checking directory structure...${NC}"

directories=("templates" "static")
for dir in "${directories[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $dir/"
    else
        mkdir -p "$dir"
        echo -e "${YELLOW}➜${NC} Created $dir/"
    fi
done

# Check if index.html is in templates
if [ -f "nyu-marketplace-ui.html" ] && [ ! -f "templates/index.html" ]; then
    mv nyu-marketplace-ui.html templates/index.html
    echo -e "${GREEN}✓${NC} Moved UI to templates/index.html"
elif [ ! -f "templates/index.html" ]; then
    echo -e "${RED}✗${NC} templates/index.html (missing)"
fi

# 6. Create a proper .gitignore
echo ""
echo -e "${BLUE}Step 6: Updating .gitignore...${NC}"

cat > .gitignore << 'EOF'
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# Virtual Environment
venv/
env/
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
.DS_Store

# Environment
.env
.env.local

# Logs
*.log

# Backup files
*~
*.bak
*.tmp

# OS
Thumbs.db
.DS_Store
EOF

echo -e "${GREEN}✓${NC} Updated .gitignore"

# 7. Summary
echo ""
echo "=========================================="
echo -e "${GREEN}✅ Cleanup Complete!${NC}"
echo ""

if [ "$all_present" = true ]; then
    echo -e "${GREEN}All core files are present.${NC}"
    echo ""
    echo "Next steps:"
    echo -e "  1. Run ${YELLOW}./setup.sh${NC} to configure the project"
    echo -e "  2. Run ${YELLOW}./run.sh${NC} to start the application"
else
    echo -e "${RED}Some core files are missing.${NC}"
    echo "Please ensure all required files are present before proceeding."
fi

echo ""
