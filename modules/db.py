"""
数据库模块 - 修复版
Database Module - Fixed Version
解决了递归深度问题
"""

import sqlite3
import json
from pathlib import Path
from datetime import datetime
from contextlib import contextmanager

BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = str((BASE_DIR.parent / 'marketplace.db').resolve())


@contextmanager
def get_db():
    """获取数据库连接的上下文管理器"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


# ===== 数据库初始化 =====
def init_database():
    """初始化数据库表结构"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        print("创建用户表...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                openid TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE,
                phone TEXT,
                nickname TEXT NOT NULL,
                avatar TEXT,
                verify_status TEXT DEFAULT 'unverified',
                community_id INTEGER,
                building_id INTEGER,
                credit_score INTEGER DEFAULT 100,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        print("创建用户密码表...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_passwords (
                user_id INTEGER PRIMARY KEY,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
        
        print("创建社区表...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS communities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                latitude REAL,
                longitude REAL,
                radius REAL DEFAULT 1.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        print("创建物品表...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS listings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                price REAL NOT NULL,
                images TEXT,
                category TEXT NOT NULL,
                course_code TEXT,
                isbn TEXT,
                community_id INTEGER NOT NULL,
                meetup_point TEXT,
                status TEXT DEFAULT 'active',
                view_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (community_id) REFERENCES communities(id)
            )
        ''')
        
        print("创建会话表...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS threads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                buyer_id INTEGER NOT NULL,
                seller_id INTEGER NOT NULL,
                listing_id INTEGER NOT NULL,
                last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (buyer_id) REFERENCES users(id),
                FOREIGN KEY (seller_id) REFERENCES users(id),
                FOREIGN KEY (listing_id) REFERENCES listings(id)
            )
        ''')
        
        print("创建消息表...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                thread_id INTEGER NOT NULL,
                from_user_id INTEGER NOT NULL,
                to_user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                is_read BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (thread_id) REFERENCES threads(id),
                FOREIGN KEY (from_user_id) REFERENCES users(id),
                FOREIGN KEY (to_user_id) REFERENCES users(id)
            )
        ''')
        
        print("创建举报表...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reporter_id INTEGER NOT NULL,
                target_type TEXT NOT NULL,
                target_id INTEGER NOT NULL,
                reason TEXT NOT NULL,
                description TEXT,
                handled BOOLEAN DEFAULT 0,
                handler_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                handled_at TIMESTAMP,
                FOREIGN KEY (reporter_id) REFERENCES users(id),
                FOREIGN KEY (handler_id) REFERENCES users(id)
            )
        ''')
        
        print("创建评价表...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                listing_id INTEGER NOT NULL,
                reviewer_id INTEGER NOT NULL,
                reviewee_id INTEGER NOT NULL,
                rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
                comment TEXT,
                tags TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (listing_id) REFERENCES listings(id),
                FOREIGN KEY (reviewer_id) REFERENCES users(id),
                FOREIGN KEY (reviewee_id) REFERENCES users(id)
            )
        ''')
        
        print("创建收藏表...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                listing_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (user_id, listing_id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (listing_id) REFERENCES listings(id)
            )
        ''')
        
        print("创建通知表...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                link TEXT,
                data TEXT,
                is_read BOOLEAN DEFAULT 0,
                read_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
        
        print("创建搜索历史表...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS search_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                query TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
        
        print("创建索引...")
        # 用户表索引
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_openid ON users(openid)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)')
        
        # 物品表索引
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_listings_user ON listings(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_listings_community ON listings(community_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_listings_search ON listings(status, category, community_id)')
        
        # 会话表索引
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_threads_buyer ON threads(buyer_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_threads_seller ON threads(seller_id)')
        
        # 消息表索引
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_messages_to_user ON messages(to_user_id, is_read)')
        
        # 通知表索引
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read)')
        
        # 搜索历史索引
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id, created_at DESC)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_search_history_query ON search_history(query)')
        
        print("✓ 数据库表创建完成")


def insert_sample_data():
    """插入示例数据"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 检查是否已有数据
        cursor.execute('SELECT COUNT(*) FROM users')
        if cursor.fetchone()[0] > 0:
            print("✓ 数据库已有数据，跳过示例数据插入")
            return
        
        print("插入示例社区...")
        communities = [
            ('NYU Tandon', 'university', 40.6943, -73.9865, 1.0),
            ('NYU Washington Square', 'university', 40.7295, -73.9965, 1.5),
            ('附近3km', 'nearby', 40.7295, -73.9965, 3.0)
        ]
        cursor.executemany(
            'INSERT INTO communities (name, type, latitude, longitude, radius) VALUES (?, ?, ?, ?, ?)',
            communities
        )
        
        print("插入示例用户...")
        users = [
            ('wx_001', 'student1@nyu.edu', None, '学生A', None, 'email_verified', 1),
            ('wx_002', 'student2@nyu.edu', None, '学生B', None, 'email_verified', 1),
            ('wx_003', None, '1234567890', '住户C', None, 'phone_verified', 3)
        ]
        cursor.executemany(
            'INSERT INTO users (openid, email, phone, nickname, avatar, verify_status, community_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            users
        )
        
        print("插入示例物品...")
        listings = [
            (1, 'CS-UY 1134 Introduction to Programming', '九成新，仅使用一学期，无划痕和笔记。', 45.0, '[]', 'textbook', 'CS-UY 1134', None, 1, 'Dibner Library', 'active'),
            (1, '宿舍椅子 九成新 可调节高度', '使用半年，功能完好，高度可调节，适合长时间学习。', 30.0, '[]', 'furniture', None, None, 1, 'Lipton Hall', 'active'),
            (2, 'TI-84 Plus 计算器 工程课必备', '几乎全新，只用过几次，功能完好。', 60.0, '[]', 'electronics', None, None, 1, 'MetroTech Center', 'active'),
            (2, '护眼小灯 三档调光', '宿舍搬家处理，功能正常，三档可调。', 15.0, '[]', 'dorm_supplies', None, None, 1, 'Clark Street', 'active'),
            (3, 'MA-UY 1024 历年试卷合集', '包含5年试卷和答案，复习必备。', 10.0, '[]', 'textbook', 'MA-UY 1024', None, 1, 'Rogers Hall', 'active'),
            (3, '小型微波炉 700W 适合宿舍', '使用一年，功能完好，适合宿舍使用。', 25.0, '[]', 'electronics', None, None, 3, '3rd Ave', 'active'),
            (3, '转租：市中心 Studio 公寓', '拎包入住，包含基本家具与高速网络，步行 5 分钟到地铁。', 2200.0, '[]', 'rental', None, None, 2, 'Washington Square', 'active')
        ]
        cursor.executemany(
            '''INSERT INTO listings (user_id, title, description, price, images, category, course_code, isbn, 
               community_id, meetup_point, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            listings
        )
        
        print("✓ 示例数据插入完成")


# ===== 用户相关 =====
def get_user_by_id(user_id):
    """根据ID获取用户"""
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
    email = (email or '').strip().lower() if email else None
    nickname = (nickname or '').strip() if nickname else None
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


def update_user_avatar(user_id, avatar_path):
    """更新用户头像"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE users SET avatar = ?, updated_at = ? WHERE id = ?',
            (avatar_path, datetime.now(), user_id)
        )
        return cursor.rowcount > 0


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


def get_listings(community_id=None, category=None, status='active', limit=50, offset=0, user_id=None):
    """获取物品列表，可按社区、分类或用户筛选"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        query = '''
            SELECT l.*, u.nickname, u.verify_status, u.avatar, u.id as seller_id
            FROM listings l
            JOIN users u ON l.user_id = u.id
            WHERE 1=1
        '''
        params = []

        if status and status != 'all':
            query += ' AND l.status = ?'
            params.append(status)
        
        if user_id:
            query += ' AND l.user_id = ?'
            params.append(user_id)
        
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


# ===== 收藏相关 =====
def add_favorite(user_id, listing_id):
    """收藏物品"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR IGNORE INTO favorites (user_id, listing_id)
            VALUES (?, ?)
        ''', (user_id, listing_id))
        return cursor.lastrowid if cursor.rowcount else None


def remove_favorite(user_id, listing_id):
    """取消收藏物品"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'DELETE FROM favorites WHERE user_id = ? AND listing_id = ?',
            (user_id, listing_id)
        )
        return cursor.rowcount > 0


def get_user_favorites(user_id, limit=100, offset=0):
    """获取用户收藏列表"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT f.created_at as favorite_created_at, l.*, u.nickname, u.verify_status, u.avatar, u.id as seller_id
            FROM favorites f
            JOIN listings l ON f.listing_id = l.id
            JOIN users u ON l.user_id = u.id
            WHERE f.user_id = ?
            ORDER BY f.created_at DESC
            LIMIT ? OFFSET ?
        ''', (user_id, limit, offset))
        
        favorites = []
        for row in cursor.fetchall():
            listing = dict(row)
            listing['images'] = json.loads(listing['images']) if listing['images'] else []
            listing['user'] = {
                'id': listing['seller_id'],
                'nickname': listing['nickname'],
                'verify_status': listing['verify_status'],
                'avatar': listing['avatar']
            }
            listing['favorite_created_at'] = listing.pop('favorite_created_at', None)
            for key in ['nickname', 'verify_status', 'avatar', 'seller_id']:
                listing.pop(key, None)
            favorites.append(listing)
        
        return favorites


def get_user_favorite_ids(user_id):
    """获取用户收藏的物品ID列表"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'SELECT listing_id FROM favorites WHERE user_id = ?',
            (user_id,)
        )
        return [row['listing_id'] for row in cursor.fetchall()]


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


# ===== 消息相关 =====
def create_thread(buyer_id, seller_id, listing_id):
    """创建或获取会话"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute(
            '''SELECT id FROM threads 
               WHERE ((buyer_id = ? AND seller_id = ?) OR (buyer_id = ? AND seller_id = ?))
               AND listing_id = ?''',
            (buyer_id, seller_id, seller_id, buyer_id, listing_id)
        )
        existing = cursor.fetchone()
        
        if existing:
            return existing[0]
        
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
        
        cursor.execute(
            'UPDATE threads SET last_message_at = ? WHERE id = ?',
            (datetime.now(), thread_id)
        )
        
        return cursor.lastrowid


def get_user_threads(user_id, limit=50):
    """获取用户的会话列表"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT t.*, 
                   l.title as listing_title, l.price as listing_price,
                   l.meetup_point as listing_meetup_point,
                   l.category as listing_category,
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
    """获取会话的消息列表"""
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
                   l.meetup_point as listing_meetup_point,
                   l.category as listing_category,
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


# 主程序 - 用于直接运行此文件时初始化数据库
if __name__ == '__main__':
    print("开始初始化数据库...")
    init_database()
    print("\n开始插入示例数据...")
    insert_sample_data()
    print("\n数据库初始化完成！")
