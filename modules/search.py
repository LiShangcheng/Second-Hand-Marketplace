"""
增强版搜索功能模块
支持全文搜索、智能推荐、搜索历史、热门搜索等
"""
from modules import db
import re
from datetime import datetime, timedelta
from collections import Counter


class SearchEngine:
    """搜索引擎类"""
    
    @staticmethod
    def normalize_query(query):
        """标准化搜索查询"""
        # 移除多余空格
        query = ' '.join(query.split())
        # 转换为小写
        query = query.lower()
        # 移除特殊字符（保留字母、数字、空格、连字符）
        query = re.sub(r'[^\w\s-]', '', query)
        return query.strip()
    
    @staticmethod
    def normalize_course_code(code):
        """标准化课程代码"""
        if not code:
            return ''
        # 统一格式: CS-UY 1134 或 CSUY1134 都转换为 CSUY1134
        code = re.sub(r'[^\w]', '', code.upper())
        return code
    
    @staticmethod
    def tokenize(text):
        """文本分词"""
        if not text:
            return []
        # 分割成单词
        tokens = re.findall(r'\w+', text.lower())
        return tokens
    
    @staticmethod
    def calculate_relevance_score(listing, query_tokens):
        """计算相关度评分"""
        score = 0
        
        # 标题匹配（权重最高）
        title_tokens = SearchEngine.tokenize(listing.get('title', ''))
        for token in query_tokens:
            if token in title_tokens:
                score += 10
            elif any(token in t for t in title_tokens):
                score += 5
        
        # 描述匹配
        desc_tokens = SearchEngine.tokenize(listing.get('description', ''))
        for token in query_tokens:
            if token in desc_tokens:
                score += 3
        
        # 课程代码精确匹配（权重很高）
        if listing.get('course_code'):
            course_code_normalized = SearchEngine.normalize_course_code(listing['course_code'])
            query_normalized = SearchEngine.normalize_course_code(' '.join(query_tokens))
            if query_normalized in course_code_normalized or course_code_normalized in query_normalized:
                score += 20
        
        # 分类匹配
        category = listing.get('category', '')
        for token in query_tokens:
            if token in category.lower():
                score += 5
        
        return score


def search_listings_advanced(query, filters=None):
    """
    高级搜索
    
    参数:
        query: 搜索关键词
        filters: 筛选条件字典
            - min_price: 最低价格
            - max_price: 最高价格
            - category: 分类
            - community_id: 社区ID
            - sort_by: 排序字段 (relevance/price/created_at/views)
            - sort_order: 排序方向 (ASC/DESC)
            - limit: 返回数量限制
            - offset: 偏移量
    """
    filters = filters or {}
    
    with db.get_db() as conn:
        cursor = conn.cursor()
        
        # 基础查询
        sql = '''
            SELECT l.*, 
                   u.nickname, u.verify_status, u.avatar,
                   (SELECT COUNT(*) FROM reviews WHERE listing_id = l.id) as review_count,
                   (SELECT AVG(rating) FROM reviews WHERE listing_id = l.id) as avg_rating
            FROM listings l
            JOIN users u ON l.user_id = u.id
            WHERE l.status = 'active'
        '''
        params = []
        
        # 搜索关键词
        if query:
            normalized_query = SearchEngine.normalize_query(query)
            sql += ''' AND (
                LOWER(l.title) LIKE ? OR 
                LOWER(l.description) LIKE ? OR 
                LOWER(l.course_code) LIKE ? OR
                LOWER(l.category) LIKE ?
            )'''
            search_term = f'%{normalized_query}%'
            params.extend([search_term, search_term, search_term, search_term])
        
        # 价格范围
        if filters.get('min_price') is not None:
            sql += ' AND l.price >= ?'
            params.append(filters['min_price'])
        
        if filters.get('max_price') is not None:
            sql += ' AND l.price <= ?'
            params.append(filters['max_price'])
        
        # 分类筛选
        if filters.get('category'):
            sql += ' AND l.category = ?'
            params.append(filters['category'])
        
        # 社区筛选
        if filters.get('community_id'):
            sql += ' AND l.community_id = ?'
            params.append(filters['community_id'])
        
        # 排序
        sort_by = filters.get('sort_by', 'relevance')
        sort_order = filters.get('sort_order', 'DESC')
        
        if sort_by == 'price':
            sql += f' ORDER BY l.price {sort_order}'
        elif sort_by == 'views':
            sql += f' ORDER BY l.view_count {sort_order}'
        elif sort_by == 'created_at':
            sql += f' ORDER BY l.created_at {sort_order}'
        else:
            # 默认按创建时间排序，稍后在Python中计算相关度
            sql += ' ORDER BY l.created_at DESC'
        
        # 限制和偏移
        limit = filters.get('limit', 50)
        offset = filters.get('offset', 0)
        sql += ' LIMIT ? OFFSET ?'
        params.extend([limit, offset])
        
        cursor.execute(sql, params)
        
        results = []
        for row in cursor.fetchall():
            listing = dict(row)
            
            # 解析 JSON 字段
            try:
                import json
                listing['images'] = json.loads(listing['images']) if listing['images'] else []
            except:
                listing['images'] = []
            
            # 构建用户信息
            listing['user'] = {
                'nickname': listing['nickname'],
                'verify_status': listing['verify_status'],
                'avatar': listing['avatar']
            }
            
            # 移除重复字段
            for key in ['nickname', 'verify_status', 'avatar']:
                listing.pop(key, None)
            
            # 计算相关度评分（如果有搜索词）
            if query and sort_by == 'relevance':
                query_tokens = SearchEngine.tokenize(query)
                listing['relevance_score'] = SearchEngine.calculate_relevance_score(listing, query_tokens)
            
            results.append(listing)
        
        # 如果按相关度排序，重新排序结果
        if query and sort_by == 'relevance':
            results.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
        
        return results


def get_search_suggestions(query, limit=5):
    """
    获取搜索建议
    
    参数:
        query: 搜索前缀
        limit: 返回数量
    """
    if not query or len(query) < 2:
        return []
    
    normalized_query = SearchEngine.normalize_query(query)
    
    with db.get_db() as conn:
        cursor = conn.cursor()
        
        suggestions = []
        
        # 1. 搜索课程代码
        cursor.execute('''
            SELECT DISTINCT course_code 
            FROM listings 
            WHERE course_code IS NOT NULL 
            AND LOWER(course_code) LIKE ?
            AND status = 'active'
            ORDER BY course_code
            LIMIT ?
        ''', (f'%{normalized_query}%', limit))
        
        for row in cursor.fetchall():
            suggestions.append({
                'type': 'course_code',
                'text': row[0],
                'display': f'📚 {row[0]}'
            })
        
        # 2. 搜索标题中的关键词
        remaining = limit - len(suggestions)
        if remaining > 0:
            cursor.execute('''
                SELECT DISTINCT title 
                FROM listings 
                WHERE LOWER(title) LIKE ?
                AND status = 'active'
                ORDER BY view_count DESC
                LIMIT ?
            ''', (f'%{normalized_query}%', remaining))
            
            for row in cursor.fetchall():
                suggestions.append({
                    'type': 'title',
                    'text': row[0],
                    'display': row[0]
                })
        
        return suggestions[:limit]


def get_popular_searches(limit=10, days=7):
    """
    获取热门搜索
    
    参数:
        limit: 返回数量
        days: 统计天数
    """
    with db.get_db() as conn:
        cursor = conn.cursor()
        
        # 获取最近N天的搜索历史
        since_date = datetime.now() - timedelta(days=days)
        cursor.execute('''
            SELECT query, COUNT(*) as count
            FROM search_history
            WHERE created_at >= ?
            GROUP BY LOWER(query)
            ORDER BY count DESC
            LIMIT ?
        ''', (since_date, limit))
        
        results = []
        for row in cursor.fetchall():
            results.append({
                'keyword': row[0],
                'count': row[1]
            })
        
        # 如果没有足够的搜索历史，返回默认热门搜索
        if len(results) < limit:
            default_searches = [
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
            ]
            results.extend(default_searches[len(results):limit])
        
        return results[:limit]


def get_related_listings(listing_id, limit=4):
    """
    获取相关商品
    
    算法:
    1. 同类别商品
    2. 相似价格范围（±50%）
    3. 相同社区
    4. 按浏览量和创建时间综合排序
    """
    with db.get_db() as conn:
        cursor = conn.cursor()
        
        # 获取当前商品信息
        cursor.execute('''
            SELECT category, price, community_id, title 
            FROM listings 
            WHERE id = ?
        ''', (listing_id,))
        
        row = cursor.fetchone()
        if not row:
            return []
        
        category, price, community_id, title = row
        
        # 提取关键词
        title_tokens = SearchEngine.tokenize(title)
        
        # 查找相关商品
        cursor.execute('''
            SELECT l.*, 
                   u.nickname, u.verify_status, u.avatar,
                   (l.view_count + 1) as popularity_score
            FROM listings l
            JOIN users u ON l.user_id = u.id
            WHERE l.id != ?
            AND l.status = 'active'
            AND (
                (l.category = ? AND l.price BETWEEN ? AND ?) OR
                (l.community_id = ?) OR
                (l.category = ?)
            )
            ORDER BY 
                CASE 
                    WHEN l.category = ? AND l.price BETWEEN ? AND ? THEN 3
                    WHEN l.category = ? THEN 2
                    WHEN l.community_id = ? THEN 1
                    ELSE 0
                END DESC,
                l.view_count DESC,
                l.created_at DESC
            LIMIT ?
        ''', (
            listing_id,
            category, price * 0.5, price * 1.5,
            community_id,
            category,
            category, price * 0.5, price * 1.5,
            category,
            community_id,
            limit * 2  # 获取更多结果用于过滤
        ))
        
        results = []
        for row in cursor.fetchall():
            listing = dict(row)
            
            # 解析图片
            try:
                import json
                listing['images'] = json.loads(listing['images']) if listing['images'] else []
            except:
                listing['images'] = []
            
            # 构建用户信息
            listing['user'] = {
                'nickname': listing['nickname'],
                'verify_status': listing['verify_status'],
                'avatar': listing['avatar']
            }
            
            # 计算相关度
            listing_tokens = SearchEngine.tokenize(listing['title'])
            common_tokens = set(title_tokens) & set(listing_tokens)
            listing['similarity_score'] = len(common_tokens)
            
            results.append(listing)
        
        # 按相似度重新排序
        results.sort(key=lambda x: (x.get('similarity_score', 0), x.get('popularity_score', 0)), reverse=True)
        
        return results[:limit]


def save_search_history(user_id, query):
    """
    保存搜索历史
    
    参数:
        user_id: 用户ID
        query: 搜索关键词
    """
    if not query or len(query.strip()) < 2:
        return
    
    normalized_query = SearchEngine.normalize_query(query)
    
    with db.get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO search_history (user_id, query, created_at)
            VALUES (?, ?, ?)
        ''', (user_id, normalized_query, datetime.now()))


def get_search_history(user_id, limit=10):
    """
    获取用户搜索历史
    
    参数:
        user_id: 用户ID
        limit: 返回数量
    """
    with db.get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT DISTINCT query, MAX(created_at) as last_searched
            FROM search_history 
            WHERE user_id = ? 
            GROUP BY LOWER(query)
            ORDER BY last_searched DESC 
            LIMIT ?
        ''', (user_id, limit))
        
        return [row[0] for row in cursor.fetchall()]


def clear_search_history(user_id):
    """
    清除用户搜索历史
    
    参数:
        user_id: 用户ID
    """
    with db.get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM search_history WHERE user_id = ?', (user_id,))


def get_trending_items(limit=10, hours=24):
    """
    获取热门商品（基于浏览量增长）
    
    参数:
        limit: 返回数量
        hours: 统计时间范围（小时）
    """
    with db.get_db() as conn:
        cursor = conn.cursor()
        
        since_time = datetime.now() - timedelta(hours=hours)
        
        cursor.execute('''
            SELECT l.*, 
                   u.nickname, u.verify_status, u.avatar,
                   l.view_count as trend_score
            FROM listings l
            JOIN users u ON l.user_id = u.id
            WHERE l.status = 'active'
            AND l.created_at >= ?
            ORDER BY l.view_count DESC, l.created_at DESC
            LIMIT ?
        ''', (since_time, limit))
        
        results = []
        for row in cursor.fetchall():
            listing = dict(row)
            
            try:
                import json
                listing['images'] = json.loads(listing['images']) if listing['images'] else []
            except:
                listing['images'] = []
            
            listing['user'] = {
                'nickname': listing['nickname'],
                'verify_status': listing['verify_status'],
                'avatar': listing['avatar']
            }
            
            results.append(listing)
        
        return results


def search_by_category_stats():
    """获取各分类的商品统计"""
    with db.get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT 
                category,
                COUNT(*) as count,
                AVG(price) as avg_price,
                MIN(price) as min_price,
                MAX(price) as max_price
            FROM listings
            WHERE status = 'active'
            GROUP BY category
            ORDER BY count DESC
        ''')
        
        results = []
        for row in cursor.fetchall():
            results.append({
                'category': row[0],
                'count': row[1],
                'avg_price': round(row[2], 2) if row[2] else 0,
                'min_price': row[3] if row[3] else 0,
                'max_price': row[4] if row[4] else 0
            })
        
        return results


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
        
        # 创建索引以提高查询性能
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_search_history_user 
            ON search_history(user_id, created_at DESC)
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_search_history_query
            ON search_history(query)
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_listings_search
            ON listings(status, category, community_id)
        ''')
        
        print("✓ 搜索表初始化完成")