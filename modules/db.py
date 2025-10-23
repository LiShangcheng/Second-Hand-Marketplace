"""
改进的数据库模块 - 修复消息系统相关的查询
Database Module - Improved
"""

import sqlite3
import json
from datetime import datetime
from contextlib import contextmanager

DATABASE_PATH = 'marketplace.db'


@contextmanager
def get_db():
    """获取数据库连接的上下文管理器"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row  # 允许通过列名访问
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


# ===== 用户相关 =====
def get_user_by_id(user_id):
    """根据ID获取用户 - 修复版"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_openid(openid):
    """根据openid获取用户"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE openid = ?', (openid,))
        row = cursor.fetchone()
        return dict(row) if row else None


def create_user(openid, email=None, phone=None, nickname=None):
    """创建用户"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO users (openid, email, phone, nickname) VALUES (?, ?, ?, ?)',
            (openid, email, phone, nickname)
        )
        return cursor.lastrowid


def update_user_verify_status(user_id, status):
    """更新用户验证状态"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE users SET verify_status = ?, updated_at = ? WHERE id = ?',
            (status, datetime.now(), user_id)
        )


# ===== 社区相关 =====
def get_all_communities():
    """获取所有社区"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM communities ORDER BY id')
        return [dict(row) for row in cursor.fetchall()]


def get_community_by_id(community_id):
    """根据ID获取社区"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM communities WHERE id = ?', (community_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


# ===== 物品相关 =====
def create_listing(user_id, title, price, category, community_id, **kwargs):
    """创建物品发布"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        description = kwargs.get('description', '')
        images = json.dumps(kwargs.get('images', []))
        course_code = kwargs.get('course_code')
        isbn = kwargs.get('isbn')
        meetup_point = kwargs.get('meetup_point', '')
        
        cursor.execute(
            '''INSERT INTO listings (user_id, title, description, price, images, category, 
               course_code, isbn, community_id, meetup_point) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (user_id, title, description, price, images, category, 
             course_code, isbn, community_id, meetup_point)
        )
        return cursor.lastrowid


def get_listings(community_id=None, category=None, status='active', limit=50, offset=0):
    """获取物品列表"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        query = '''
            SELECT l.*, u.nickname, u.verify_status, u.avatar, u.id as seller_id
            FROM listings l
            JOIN users u ON l.user_id = u.id
            WHERE l.status = ?
        '''
        params = [status]
        
        if community_id:
            query += ' AND l.community_id = ?'
            params.append(community_id)
        
        if category and category != 'all':
            query += ' AND l.category = ?'
            params.append(category)
        
        query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        results = []
        for row in cursor.fetchall():
            listing = dict(row)
            listing['images'] = json.loads(listing['images']) if listing['images'] else []
            listing['user'] = {
                'id': listing['seller_id'],
                'nickname': listing['nickname'],
                'verify_status': listing['verify_status'],
                'avatar': listing['avatar']
            }
            for key in ['nickname', 'verify_status', 'avatar', 'seller_id']:
                listing.pop(key, None)
            results.append(listing)
        
        return results


def get_listing_by_id(listing_id):
    """根据ID获取物品详情"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT l.*, u.nickname, u.verify_status, u.avatar, u.id as seller_id
            FROM listings l
            JOIN users u ON l.user_id = u.id
            WHERE l.id = ?
        ''', (listing_id,))
        
        row = cursor.fetchone()
        if not row:
            return None
        
        listing = dict(row)
        listing['images'] = json.loads(listing['images']) if listing['images'] else []
        listing['user'] = {
            'id': listing['seller_id'],
            'nickname': listing['nickname'],
            'verify_status': listing['verify_status'],
            'avatar': listing['avatar']
        }
        for key in ['nickname', 'verify_status', 'avatar', 'seller_id']:
            listing.pop(key, None)
        
        return listing


def search_listings(query, community_id=None, limit=50):
    """搜索物品"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        sql = '''
            SELECT l.*, u.nickname, u.verify_status, u.avatar, u.id as seller_id
            FROM listings l
            JOIN users u ON l.user_id = u.id
            WHERE l.status = 'active' 
            AND (l.title LIKE ? OR l.description LIKE ? OR l.course_code LIKE ?)
        '''
        search_term = f'%{query}%'
        params = [search_term, search_term, search_term]
        
        if community_id:
            sql += ' AND l.community_id = ?'
            params.append(community_id)
        
        sql += ' ORDER BY l.created_at DESC LIMIT ?'
        params.append(limit)
        
        cursor.execute(sql, params)
        results = []
        for row in cursor.fetchall():
            listing = dict(row)
            listing['images'] = json.loads(listing['images']) if listing['images'] else []
            listing['user'] = {
                'id': listing['seller_id'],
                'nickname': listing['nickname'],
                'verify_status': listing['verify_status'],
                'avatar': listing['avatar']
            }
            for key in ['nickname', 'verify_status', 'avatar', 'seller_id']:
                listing.pop(key, None)
            results.append(listing)
        
        return results


def update_listing_status(listing_id, status):
    """更新物品状态"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE listings SET status = ?, updated_at = ? WHERE id = ?',
            (status, datetime.now(), listing_id)
        )


def increment_view_count(listing_id):
    """增加浏览次数"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE listings SET view_count = view_count + 1 WHERE id = ?',
            (listing_id,)
        )


def delete_listing(listing_id):
    """删除物品"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM listings WHERE id = ?', (listing_id,))


# ===== 消息相关 - 关键改进 =====
def create_thread(buyer_id, seller_id, listing_id):
    """创建或获取会话"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 检查是否已存在会话
        cursor.execute(
            '''SELECT id FROM threads 
               WHERE (buyer_id = ? AND seller_id = ?) OR (buyer_id = ? AND seller_id = ?)
               AND listing_id = ?''',
            (buyer_id, seller_id, seller_id, buyer_id, listing_id)
        )
        existing = cursor.fetchone()
        
        if existing:
            return existing[0]
        
        # 创建新会话
        cursor.execute(
            'INSERT INTO threads (buyer_id, seller_id, listing_id) VALUES (?, ?, ?)',
            (buyer_id, seller_id, listing_id)
        )
        return cursor.lastrowid


def create_message(thread_id, from_user_id, to_user_id, content):
    """创建消息"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO messages (thread_id, from_user_id, to_user_id, content) VALUES (?, ?, ?, ?)',
            (thread_id, from_user_id, to_user_id, content)
        )
        
        # 更新会话的最后消息时间
        cursor.execute(
            'UPDATE threads SET last_message_at = ? WHERE id = ?',
            (datetime.now(), thread_id)
        )
        
        return cursor.lastrowid


def get_user_threads(user_id, limit=50):
    """获取用户的会话列表 - 改进版"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT t.*, 
                   l.title as listing_title, l.price as listing_price,
                   u1.nickname as buyer_nickname, u1.id as buyer_id,
                   u2.nickname as seller_nickname, u2.id as seller_id
            FROM threads t
            JOIN listings l ON t.listing_id = l.id
            JOIN users u1 ON t.buyer_id = u1.id
            JOIN users u2 ON t.seller_id = u2.id
            WHERE t.buyer_id = ? OR t.seller_id = ?
            ORDER BY t.last_message_at DESC
            LIMIT ?
        ''', (user_id, user_id, limit))
        
        return [dict(row) for row in cursor.fetchall()]


def get_thread_messages(thread_id, limit=100):
    """获取会话的消息列表 - 改进版"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT m.*, 
                   u1.nickname as from_nickname,
                   u2.nickname as to_nickname
            FROM messages m
            JOIN users u1 ON m.from_user_id = u1.id
            JOIN users u2 ON m.to_user_id = u2.id
            WHERE m.thread_id = ?
            ORDER BY m.created_at ASC
            LIMIT ?
        ''', (thread_id, limit))
        
        return [dict(row) for row in cursor.fetchall()]


def mark_message_as_read(message_id):
    """标记消息为已读"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE messages SET is_read = 1 WHERE id = ?',
            (message_id,)
        )


def get_unread_count(user_id):
    """获取未读消息数"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'SELECT COUNT(*) FROM messages WHERE to_user_id = ? AND is_read = 0',
            (user_id,)
        )
        return cursor.fetchone()[0]


def get_thread_by_id(thread_id):
    """根据ID获取会话"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT t.*, 
                   l.title as listing_title, l.price as listing_price,
                   u1.nickname as buyer_nickname, u1.id as buyer_id,
                   u2.nickname as seller_nickname, u2.id as seller_id
            FROM threads t
            JOIN listings l ON t.listing_id = l.id
            JOIN users u1 ON t.buyer_id = u1.id
            JOIN users u2 ON t.seller_id = u2.id
            WHERE t.id = ?
        ''', (thread_id,))
        
        row = cursor.fetchone()
        return dict(row) if row else None


# ===== 举报相关 =====
def create_report(reporter_id, target_type, target_id, reason, description=''):
    """创建举报"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            '''INSERT INTO reports (reporter_id, target_type, target_id, reason, description) 
               VALUES (?, ?, ?, ?, ?)''',
            (reporter_id, target_type, target_id, reason, description)
        )
        return cursor.lastrowid


def get_pending_reports(limit=50):
    """获取待处理的举报"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT r.*, 
                   u.nickname as reporter_nickname
            FROM reports r
            JOIN users u ON r.reporter_id = u.id
            WHERE r.handled = 0
            ORDER BY r.created_at DESC
            LIMIT ?
        ''', (limit,))
        
        return [dict(row) for row in cursor.fetchall()]


def handle_report(report_id, handler_id):
    """处理举报"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            '''UPDATE reports 
               SET handled = 1, handler_id = ?, handled_at = ? 
               WHERE id = ?''',
            (handler_id, datetime.now(), report_id)
        )


# ===== 评价相关 =====
def create_review(listing_id, reviewer_id, reviewee_id, rating, comment='', tags=None):
    """创建评价"""
    with get_db() as conn:
        cursor = conn.cursor()
        tags_json = json.dumps(tags or [])
        cursor.execute(
            '''INSERT INTO reviews (listing_id, reviewer_id, reviewee_id, rating, comment, tags) 
               VALUES (?, ?, ?, ?, ?, ?)''',
            (listing_id, reviewer_id, reviewee_id, rating, comment, tags_json)
        )
        return cursor.lastrowid


def get_user_reviews(user_id, limit=20):
    """获取用户的评价"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT r.*, 
                   u.nickname as reviewer_nickname,
                   l.title as listing_title
            FROM reviews r
            JOIN users u ON r.reviewer_id = u.id
            JOIN listings l ON r.listing_id = l.id
            WHERE r.reviewee_id = ?
            ORDER BY r.created_at DESC
            LIMIT ?
        ''', (user_id, limit))
        
        results = []
        for row in cursor.fetchall():
            review = dict(row)
            review['tags'] = json.loads(review['tags']) if review['tags'] else []
            results.append(review)
        
        return results


def get_user_rating_stats(user_id):
    """获取用户评分统计"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT 
                COUNT(*) as total_reviews,
                AVG(rating) as avg_rating,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
            FROM reviews
            WHERE reviewee_id = ?
        ''', (user_id,))
        
        row = cursor.fetchone()
        return dict(row) if row else None


# ===== 统计相关 =====
def get_dashboard_stats():
    """获取仪表盘统计数据"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM users')
        total_users = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM users WHERE verify_status IN ('email_verified', 'phone_verified')")
        verified_users = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM listings')
        total_listings = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM listings WHERE status = 'active'")
        active_listings = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM listings WHERE status = 'sold'")
        sold_listings = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM reports WHERE handled = 0')
        pending_reports = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM users WHERE DATE(created_at) = DATE('now')")
        today_new_users = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM listings WHERE DATE(created_at) = DATE('now')")
        today_new_listings = cursor.fetchone()[0]
        
        return {
            'total_users': total_users,
            'verified_users': verified_users,
            'total_listings': total_listings,
            'active_listings': active_listings,
            'sold_listings': sold_listings,
            'pending_reports': pending_reports,
            'today_new_users': today_new_users,
            'today_new_listings': today_new_listings
        }


def get_category_stats():
    """获取分类统计"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT category, COUNT(*) as count
            FROM listings
            WHERE status = 'active'
            GROUP BY category
            ORDER BY count DESC
        ''')
        
        return [dict(row) for row in cursor.fetchall()]


# 初始化函数保持不变
def init_database():
    """初始化数据库表结构 - 使用原始版本"""
    from modules.db import init_database as original_init
    original_init()


def insert_sample_data():
    """插入示例数据 - 使用原始版本"""
    from modules.db import insert_sample_data as original_insert
    original_insert()