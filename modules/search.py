"""
搜索功能增强模块
"""
from modules import db
import re


def normalize_course_code(code):
    """标准化课程代码"""
    # 移除空格和特殊字符
    code = re.sub(r'[^\w-]', '', code.upper())
    return code


def search_listings_advanced(query, filters=None):
    """高级搜索"""
    filters = filters or {}
    
    with db.get_db() as conn:
        cursor = conn.cursor()
        
        # 基础查询
        sql = '''
            SELECT l.*, u.nickname, u.verify_status, u.avatar
            FROM listings l
            JOIN users u ON l.user_id = u.id
            WHERE l.status = 'active'
        '''
        params = []
        
        # 搜索关键词
        if query:
            sql += ''' AND (
                l.title LIKE ? OR 
                l.description LIKE ? OR 
                l.course_code LIKE ?
            )'''
            search_term = f'%{query}%'
            params.extend([search_term, search_term, search_term])
        
        # 价格范围
        if filters.get('min_price'):
            sql += ' AND l.price >= ?'
            params.append(filters['min_price'])
        
        if filters.get('max_price'):
            sql += ' AND l.price <= ?'
            params.append(filters['max_price'])
        
        # 分类
        if filters.get('category'):
            sql += ' AND l.category = ?'
            params.append(filters['category'])
        
        # 社区
        if filters.get('community_id'):
            sql += ' AND l.community_id = ?'
            params.append(filters['community_id'])
        
        # 排序
        sort_by = filters.get('sort_by', 'created_at')
        sort_order = filters.get('sort_order', 'DESC')
        
        if sort_by == 'price':
            sql += ' ORDER BY l.price ' + sort_order
        elif sort_by == 'views':
            sql += ' ORDER BY l.view_count ' + sort_order
        else:
            sql += ' ORDER BY l.created_at ' + sort_order
        
        # 限制
        limit = filters.get('limit', 50)
        offset = filters.get('offset', 0)
        sql += ' LIMIT ? OFFSET ?'
        params.extend([limit, offset])
        
        cursor.execute(sql, params)
        
        results = []
        for row in cursor.fetchall():
            listing = dict(row)
            listing['images'] = eval(listing['images']) if listing['images'] else []
            listing['user'] = {
                'nickname': listing['nickname'],
                'verify_status': listing['verify_status'],
                'avatar': listing['avatar']
            }
            del listing['nickname']
            del listing['verify_status']
            del listing['avatar']
            results.append(listing)
        
        return results


def get_popular_searches(limit=10):
    """获取热门搜索（模拟数据）"""
    return [
        {'keyword': 'CS-UY 1134', 'count': 45},
        {'keyword': 'MA-UY 1024', 'count': 38},
        {'keyword': '计算器', 'count': 32},
        {'keyword': '椅子', 'count': 28},
        {'keyword': 'Python', 'count': 25},
        {'keyword': '微波炉', 'count': 22},
        {'keyword': 'iPad', 'count': 20},
        {'keyword': '台灯', 'count': 18},
        {'keyword': '数据结构', 'count': 15},
        {'keyword': '显示器', 'count': 12}
    ][:limit]


def get_search_suggestions(query, limit=5):
    """搜索建议"""
    if not query or len(query) < 2:
        return []
    
    with db.get_db() as conn:
        cursor = conn.cursor()
        
        # 搜索课程代码
        cursor.execute('''
            SELECT DISTINCT course_code 
            FROM listings 
            WHERE course_code LIKE ? AND course_code IS NOT NULL
            LIMIT ?
        ''', (f'%{query}%', limit))
        
        course_codes = [row[0] for row in cursor.fetchall()]
        
        # 搜索标题
        cursor.execute('''
            SELECT DISTINCT title 
            FROM listings 
            WHERE title LIKE ? 
            LIMIT ?
        ''', (f'%{query}%', limit - len(course_codes)))
        
        titles = [row[0] for row in cursor.fetchall()]
        
        return course_codes + titles


def get_related_listings(listing_id, limit=4):
    """获取相关商品"""
    with db.get_db() as conn:
        cursor = conn.cursor()
        
        # 获取当前商品信息
        cursor.execute('SELECT category, price FROM listings WHERE id = ?', (listing_id,))
        row = cursor.fetchone()
        
        if not row:
            return []
        
        category, price = row
        
        # 查找同类别、相似价格的商品
        cursor.execute('''
            SELECT l.*, u.nickname, u.verify_status, u.avatar
            FROM listings l
            JOIN users u ON l.user_id = u.id
            WHERE l.category = ? 
            AND l.id != ?
            AND l.status = 'active'
            AND l.price BETWEEN ? AND ?
            ORDER BY RANDOM()
            LIMIT ?
        ''', (category, listing_id, price * 0.5, price * 1.5, limit))
        
        results = []
        for row in cursor.fetchall():
            listing = dict(row)
            listing['images'] = eval(listing['images']) if listing['images'] else []
            results.append(listing)
        
        return results


def save_search_history(user_id, query):
    """保存搜索历史"""
    with db.get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO search_history (user_id, query, created_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        ''', (user_id, query))


def get_search_history(user_id, limit=10):
    """获取搜索历史"""
    with db.get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT DISTINCT query 
            FROM search_history 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT ?
        ''', (user_id, limit))
        
        return [row[0] for row in cursor.fetchall()]


def init_search_tables():
    """初始化搜索相关表"""
    with db.get_db() as conn:
        cursor = conn.cursor()
        
        # 搜索历史表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS search_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                query TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_search_history_user 
            ON search_history(user_id, created_at)
        ''')
