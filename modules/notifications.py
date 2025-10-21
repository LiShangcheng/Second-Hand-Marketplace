"""
通知系统模块
"""
from datetime import datetime
from modules import db


class NotificationType:
    """通知类型"""
    NEW_MESSAGE = 'new_message'
    LISTING_SOLD = 'listing_sold'
    LISTING_FLAGGED = 'listing_flagged'
    REVIEW_RECEIVED = 'review_received'
    PRICE_DROP = 'price_drop'
    SYSTEM = 'system'


def create_notification(user_id, type, title, content, link=None, data=None):
    """创建通知"""
    with db.get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO notifications (user_id, type, title, content, link, data, is_read)
            VALUES (?, ?, ?, ?, ?, ?, 0)
        ''', (user_id, type, title, content, link, str(data) if data else None))
        return cursor.lastrowid


def get_user_notifications(user_id, limit=20, unread_only=False):
    """获取用户通知"""
    with db.get_db() as conn:
        cursor = conn.cursor()
        
        query = 'SELECT * FROM notifications WHERE user_id = ?'
        params = [user_id]
        
        if unread_only:
            query += ' AND is_read = 0'
        
        query += ' ORDER BY created_at DESC LIMIT ?'
        params.append(limit)
        
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


def mark_notification_read(notification_id):
    """标记通知为已读"""
    with db.get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE notifications 
            SET is_read = 1, read_at = ? 
            WHERE id = ?
        ''', (datetime.now(), notification_id))


def mark_all_read(user_id):
    """标记所有通知为已读"""
    with db.get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE notifications 
            SET is_read = 1, read_at = ? 
            WHERE user_id = ? AND is_read = 0
        ''', (datetime.now(), user_id))


def get_unread_count(user_id):
    """获取未读通知数"""
    with db.get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT COUNT(*) 
            FROM notifications 
            WHERE user_id = ? AND is_read = 0
        ''', (user_id,))
        return cursor.fetchone()[0]


def delete_notification(notification_id):
    """删除通知"""
    with db.get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM notifications WHERE id = ?', (notification_id,))


# 通知模板
def notify_new_message(user_id, from_user, listing_title):
    """新消息通知"""
    return create_notification(
        user_id,
        NotificationType.NEW_MESSAGE,
        '新消息',
        f'{from_user} 向您发送了关于"{listing_title}"的消息',
        '/messages'
    )


def notify_listing_sold(user_id, listing_title):
    """商品已售通知"""
    return create_notification(
        user_id,
        NotificationType.LISTING_SOLD,
        '商品已售出',
        f'恭喜！您的商品"{listing_title}"已售出',
        '/profile/listings'
    )


def notify_review_received(user_id, reviewer_name, rating):
    """收到评价通知"""
    stars = '⭐' * rating
    return create_notification(
        user_id,
        NotificationType.REVIEW_RECEIVED,
        '收到新评价',
        f'{reviewer_name} 给您的评价：{stars}',
        '/profile/reviews'
    )


def init_notifications_table():
    """初始化通知表"""
    with db.get_db() as conn:
        cursor = conn.cursor()
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
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_notifications_user 
            ON notifications(user_id)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_notifications_unread 
            ON notifications(user_id, is_read)
        ''')
