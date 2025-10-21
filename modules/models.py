from datetime import datetime
from enum import Enum

class VerifyStatus(Enum):
    """认证状态枚举"""
    UNVERIFIED = "unverified"  # 未认证
    EMAIL_VERIFIED = "email_verified"  # 邮箱已认证
    PHONE_VERIFIED = "phone_verified"  # 手机号已认证
    PENDING = "pending"  # 审核中
    BANNED = "banned"  # 被封禁

class CommunityType(Enum):
    """社区类型枚举"""
    UNIVERSITY = "university"  # 学校
    RESIDENTIAL = "residential"  # 住宅小区

class ListingStatus(Enum):
    """物品状态枚举"""
    ACTIVE = "active"  # 在售
    SOLD = "sold"  # 已售
    HIDDEN = "hidden"  # 隐藏
    FLAGGED = "flagged"  # 违规

class Category(Enum):
    """物品类别枚举"""
    TEXTBOOK = "textbook"  # 教材
    FURNITURE = "furniture"  # 家具
    ELECTRONICS = "electronics"  # 电子产品
    DORM_SUPPLIES = "dorm_supplies"  # 宿舍用品
    OTHER = "other"  # 其他

class ThreadStatus(Enum):
    """会话状态枚举"""
    OPEN = "open"  # 进行中
    CLOSED = "closed"  # 已结束

class TargetType(Enum):
    """举报对象类型枚举"""
    LISTING = "listing"  # 物品
    USER = "user"  # 用户


class User:
    """用户模型"""
    def __init__(self, openid, email=None, phone=None, nickname=None, avatar=None):
        self.id = None  # 用户ID（由数据库生成）
        self.openid = openid  # 微信用户唯一标识
        self.email = email  # 邮箱（NYU学生）
        self.phone = phone  # 手机号（住户）
        self.nickname = nickname  # 昵称
        self.avatar = avatar  # 头像URL
        self.verify_status = VerifyStatus.UNVERIFIED  # 认证状态
        self.community_id = None  # 所属社区ID
        self.building_id = None  # 楼栋ID（可选）
        self.credit_score = 100  # 信用分（初始100）
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'openid': self.openid,
            'email': self.email,
            'phone': self.phone,
            'nickname': self.nickname,
            'avatar': self.avatar,
            'verify_status': self.verify_status.value,
            'community_id': self.community_id,
            'building_id': self.building_id,
            'credit_score': self.credit_score,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


class Community:
    """社区模型"""
    def __init__(self, name, type, latitude, longitude, radius=1.0):
        self.id = None
        self.name = name  # 社区名称
        self.type = type  # 类型（university/residential）
        self.latitude = latitude  # 纬度
        self.longitude = longitude  # 经度
        self.radius = radius  # 覆盖半径（公里）
        self.created_at = datetime.now()
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type.value if isinstance(self.type, CommunityType) else self.type,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'radius': self.radius,
            'created_at': self.created_at.isoformat()
        }


class Listing:
    """物品发布模型"""
    def __init__(self, user_id, title, price, category, community_id):
        self.id = None
        self.user_id = user_id  # 发布者ID
        self.title = title  # 标题
        self.description = ""  # 描述
        self.price = price  # 价格
        self.images = []  # 图片数组
        self.category = category  # 类别
        self.course_code = None  # 课程代码（教材类）
        self.isbn = None  # ISBN码（教材类）
        self.community_id = community_id  # 所属社区
        self.meetup_point = ""  # 面交地点
        self.status = ListingStatus.ACTIVE  # 状态
        self.view_count = 0  # 浏览次数
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'description': self.description,
            'price': self.price,
            'images': self.images,
            'category': self.category.value if isinstance(self.category, Category) else self.category,
            'course_code': self.course_code,
            'isbn': self.isbn,
            'community_id': self.community_id,
            'meetup_point': self.meetup_point,
            'status': self.status.value if isinstance(self.status, ListingStatus) else self.status,
            'view_count': self.view_count,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


class Message:
    """消息模型"""
    def __init__(self, thread_id, from_user_id, to_user_id, content):
        self.id = None
        self.thread_id = thread_id  # 会话ID
        self.from_user_id = from_user_id  # 发送者ID
        self.to_user_id = to_user_id  # 接收者ID
        self.content = content  # 消息内容
        self.is_read = False  # 是否已读
        self.created_at = datetime.now()
    
    def to_dict(self):
        return {
            'id': self.id,
            'thread_id': self.thread_id,
            'from_user_id': self.from_user_id,
            'to_user_id': self.to_user_id,
            'content': self.content,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat()
        }


class Thread:
    """会话模型"""
    def __init__(self, buyer_id, seller_id, listing_id):
        self.id = None
        self.buyer_id = buyer_id  # 买家ID
        self.seller_id = seller_id  # 卖家ID
        self.listing_id = listing_id  # 关联物品ID
        self.last_message_at = datetime.now()  # 最后消息时间
        self.status = ThreadStatus.OPEN  # 会话状态
        self.created_at = datetime.now()
    
    def to_dict(self):
        return {
            'id': self.id,
            'buyer_id': self.buyer_id,
            'seller_id': self.seller_id,
            'listing_id': self.listing_id,
            'last_message_at': self.last_message_at.isoformat(),
            'status': self.status.value if isinstance(self.status, ThreadStatus) else self.status,
            'created_at': self.created_at.isoformat()
        }


class Report:
    """举报模型"""
    def __init__(self, reporter_id, target_type, target_id, reason):
        self.id = None
        self.reporter_id = reporter_id  # 举报人ID
        self.target_type = target_type  # 举报对象类型
        self.target_id = target_id  # 被举报对象ID
        self.reason = reason  # 举报原因
        self.description = ""  # 详细描述
        self.handled = False  # 是否已处理
        self.handler_id = None  # 处理人ID
        self.created_at = datetime.now()
        self.handled_at = None  # 处理时间
    
    def to_dict(self):
        return {
            'id': self.id,
            'reporter_id': self.reporter_id,
            'target_type': self.target_type.value if isinstance(self.target_type, TargetType) else self.target_type,
            'target_id': self.target_id,
            'reason': self.reason,
            'description': self.description,
            'handled': self.handled,
            'handler_id': self.handler_id,
            'created_at': self.created_at.isoformat(),
            'handled_at': self.handled_at.isoformat() if self.handled_at else None
        }


class Review:
    """评价模型（扩展功能）"""
    def __init__(self, listing_id, reviewer_id, reviewee_id, rating):
        self.id = None
        self.listing_id = listing_id  # 关联物品ID
        self.reviewer_id = reviewer_id  # 评价者ID
        self.reviewee_id = reviewee_id  # 被评价者ID
        self.rating = rating  # 评分（1-5）
        self.comment = ""  # 评价内容
        self.tags = []  # 标签（如：准时、友好、商品如描述）
        self.created_at = datetime.now()
    
    def to_dict(self):
        return {
            'id': self.id,
            'listing_id': self.listing_id,
            'reviewer_id': self.reviewer_id,
            'reviewee_id': self.reviewee_id,
            'rating': self.rating,
            'comment': self.comment,
            'tags': self.tags,
            'created_at': self.created_at.isoformat()
        }


# 数据库初始化示例数据
def get_sample_data():
    """获取示例数据用于测试"""
    
    # 示例社区
    communities = [
        Community("NYU Tandon", CommunityType.UNIVERSITY, 40.6943, -73.9865, 1.0),
        Community("NYU Washington Square", CommunityType.UNIVERSITY, 40.7295, -73.9965, 1.5),
        Community("东村社区", CommunityType.RESIDENTIAL, 40.7265, -73.9815, 0.5)
    ]
    
    # 示例用户
    users = [
        User("wx_openid_001", email="student1@nyu.edu", nickname="学生A"),
        User("wx_openid_002", email="student2@nyu.edu", nickname="学生B"),
        User("wx_openid_003", phone="1234567890", nickname="住户C")
    ]
    users[0].verify_status = VerifyStatus.EMAIL_VERIFIED
    users[1].verify_status = VerifyStatus.EMAIL_VERIFIED
    users[2].verify_status = VerifyStatus.PHONE_VERIFIED
    
    # 示例物品
    listings = [
        Listing(1, "CS-UY 1134 Introduction to Programming", 45, Category.TEXTBOOK, 1),
        Listing(1, "宿舍椅子 九成新 可调节高度", 30, Category.FURNITURE, 1),
        Listing(2, "TI-84 Plus 计算器 工程课必备", 60, Category.ELECTRONICS, 1)
    ]
    listings[0].course_code = "CS-UY 1134"
    listings[0].meetup_point = "Dibner Library"
    listings[1].meetup_point = "Lipton Hall"
    listings[2].meetup_point = "MetroTech Center"
    
    return {
        'communities': communities,
        'users': users,
        'listings': listings
    }
