"""
NYU 二手交易平台 - 改进版 app.py
包含完善的消息系统API
"""
from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from datetime import datetime
import os
import socket

# 导入所有模块 - 注意这里使用改进后的db
try:
    from modules import auth, notifications, search
    from modules.db import *
except ImportError:
    from modules import db, auth, notifications, search
    from modules.models import *

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

app.config['JSON_AS_ASCII'] = False
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024


# ===== 首页路由 =====
@app.route('/')
def index():
    return render_template('index.html')


# ===== 用户认证相关API =====
@app.route('/api/auth/login', methods=['POST'])
def login():
    """用户登录"""
    try:
        data = request.get_json()
        openid = data.get('openid')
        email = data.get('email')
        phone = data.get('phone')
        nickname = data.get('nickname', '匿名用户')
        
        if not openid:
            return jsonify({'error': '缺少openid'}), 400
        
        # 查找或创建用户
        user = get_user_by_openid(openid)
        
        if not user:
            user_id = create_user(openid, email, phone, nickname)
            user = get_user_by_id(user_id)
        
        # 生成token
        token = auth.generate_token(user['id'])
        
        return jsonify({
            'token': token,
            'user': dict(user)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== 社区相关API =====
@app.route('/api/communities', methods=['GET'])
def get_communities():
    """获取社区列表"""
    communities = get_all_communities()
    return jsonify(communities), 200


@app.route('/api/communities/<int:community_id>', methods=['GET'])
def get_community(community_id):
    """获取社区详情"""
    community = get_community_by_id(community_id)
    if community:
        return jsonify(community), 200
    return jsonify({'error': '社区不存在'}), 404


# ===== 商品相关API =====
@app.route('/api/listings', methods=['GET'])
def get_listings_api():
    """获取商品列表"""
    community_id = request.args.get('community_id', type=int)
    category = request.args.get('category')
    status = request.args.get('status', 'active')
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    listings = get_listings(community_id, category, status, limit, offset)
    return jsonify(listings), 200


@app.route('/api/listings/<int:listing_id>', methods=['GET'])
def get_listing(listing_id):
    """获取商品详情"""
    increment_view_count(listing_id)
    listing = get_listing_by_id(listing_id)
    if listing:
        return jsonify(listing), 200
    return jsonify({'error': '物品不存在'}), 404


@app.route('/api/listings', methods=['POST'])
def create_listing_api():
    """发布商品"""
    try:
        data = request.get_json()
        required = ['user_id', 'title', 'price', 'category', 'community_id']
        
        for field in required:
            if field not in data:
                return jsonify({'error': f'缺少必要字段: {field}'}), 400
        
        user = get_user_by_id(data['user_id'])
        if not user or user['verify_status'] == 'unverified':
            return jsonify({'error': '用户未认证，无法发布'}), 403
        
        listing_id = create_listing(
            user_id=data['user_id'],
            title=data['title'],
            price=float(data['price']),
            category=data['category'],
            community_id=data['community_id'],
            description=data.get('description', ''),
            course_code=data.get('course_code'),
            isbn=data.get('isbn'),
            meetup_point=data.get('meetup_point', ''),
            images=data.get('images', [])
        )
        
        listing = get_listing_by_id(listing_id)
        return jsonify(listing), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/listings/search', methods=['GET'])
def search_listings_api():
    """搜索商品"""
    try:
        query = request.args.get('q', '').strip()
        community_id = request.args.get('community_id', type=int)
        limit = request.args.get('limit', 50, type=int)
        
        if not query:
            return jsonify({'error': '搜索关键词不能为空'}), 400
        
        listings = search_listings(query, community_id, limit)
        return jsonify(listings), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== 消息相关API - 关键功能 =====
@app.route('/api/threads', methods=['POST'])
def create_thread_api():
    """创建会话 - 联系卖家的核心功能"""
    try:
        data = request.get_json()
        buyer_id = data.get('buyer_id')
        seller_id = data.get('seller_id')
        listing_id = data.get('listing_id')
        
        # 验证必要字段
        if not all([buyer_id, seller_id, listing_id]):
            return jsonify({'error': '缺少必要参数'}), 400
        
        # 验证用户存在
        buyer = get_user_by_id(buyer_id)
        seller = get_user_by_id(seller_id)
        
        if not buyer or not seller:
            return jsonify({'error': '用户不存在'}), 404
        
        # 防止自己和自己联系
        if buyer_id == seller_id:
            return jsonify({'error': '不能和自己联系'}), 400
        
        # 创建或获取会话
        thread_id = create_thread(buyer_id, seller_id, listing_id)
        
        # 返回完整的会话信息
        thread = get_thread_by_id(thread_id)
        
        return jsonify({
            'id': thread_id,
            'thread': dict(thread) if thread else {
                'id': thread_id,
                'buyer_id': buyer_id,
                'seller_id': seller_id,
                'listing_id': listing_id
            }
        }), 201
        
    except Exception as e:
        print(f'创建会话错误: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/threads/<int:user_id>', methods=['GET'])
def get_user_threads_api(user_id):
    """获取用户的会话列表"""
    try:
        limit = request.args.get('limit', 50, type=int)
        threads = get_user_threads(user_id, limit)
        return jsonify(threads), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/threads/<int:thread_id>', methods=['GET'])
def get_thread_api(thread_id):
    """获取会话详情"""
    try:
        thread = get_thread_by_id(thread_id)
        if thread:
            return jsonify(dict(thread)), 200
        return jsonify({'error': '会话不存在'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/messages', methods=['POST'])
def create_message_api():
    """发送消息"""
    try:
        data = request.get_json()
        thread_id = data.get('thread_id')
        from_user_id = data.get('from_user_id')
        to_user_id = data.get('to_user_id')
        content = data.get('content', '').strip()
        
        # 验证必要字段
        if not all([thread_id, from_user_id, to_user_id, content]):
            return jsonify({'error': '缺少必要参数'}), 400
        
        if len(content) == 0 or len(content) > 1000:
            return jsonify({'error': '消息长度不合法'}), 400
        
        # 验证用户存在
        from_user = get_user_by_id(from_user_id)
        to_user = get_user_by_id(to_user_id)
        
        if not from_user or not to_user:
            return jsonify({'error': '用户不存在'}), 404
        
        # 创建消息
        message_id = create_message(thread_id, from_user_id, to_user_id, content)
        
        return jsonify({
            'id': message_id,
            'thread_id': thread_id,
            'from_user_id': from_user_id,
            'to_user_id': to_user_id,
            'content': content,
            'created_at': datetime.now().isoformat()
        }), 201
        
    except Exception as e:
        print(f'发送消息错误: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/threads/<int:thread_id>/messages', methods=['GET'])
def get_messages_api(thread_id):
    """获取会话的消息列表"""
    try:
        limit = request.args.get('limit', 100, type=int)
        messages = get_thread_messages(thread_id, limit)
        return jsonify(messages), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/messages/<int:message_id>/read', methods=['POST'])
def mark_message_read_api(message_id):
    """标记消息为已读"""
    try:
        mark_message_as_read(message_id)
        return jsonify({'message': '标记成功'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/<int:user_id>/unread-count', methods=['GET'])
def get_unread_count_api(user_id):
    """获取用户未读消息数"""
    try:
        count = get_unread_count(user_id)
        return jsonify({'count': count}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== 举报相关API =====
@app.route('/api/reports', methods=['POST'])
def create_report_api():
    """提交举报"""
    try:
        data = request.get_json()
        reporter_id = data.get('reporter_id')
        target_type = data.get('target_type')
        target_id = data.get('target_id')
        reason = data.get('reason')
        
        if not all([reporter_id, target_type, target_id, reason]):
            return jsonify({'error': '缺少必要参数'}), 400
        
        report_id = create_report(
            reporter_id=reporter_id,
            target_type=target_type,
            target_id=target_id,
            reason=reason,
            description=data.get('description', '')
        )
        
        return jsonify({
            'id': report_id,
            'message': '举报提交成功'
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/reports', methods=['GET'])
def get_reports_api():
    """获取待处理的举报 - 管理员接口"""
    try:
        limit = request.args.get('limit', 50, type=int)
        reports = get_pending_reports(limit)
        return jsonify(reports), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== 评价相关API =====
@app.route('/api/reviews', methods=['POST'])
def create_review_api():
    """创建评价"""
    try:
        data = request.get_json()
        listing_id = data.get('listing_id')
        reviewer_id = data.get('reviewer_id')
        reviewee_id = data.get('reviewee_id')
        rating = data.get('rating')
        
        if not all([listing_id, reviewer_id, reviewee_id, rating]):
            return jsonify({'error': '缺少必要参数'}), 400
        
        if not (1 <= rating <= 5):
            return jsonify({'error': '评分必须在1-5之间'}), 400
        
        review_id = create_review(
            listing_id=listing_id,
            reviewer_id=reviewer_id,
            reviewee_id=reviewee_id,
            rating=rating,
            comment=data.get('comment', ''),
            tags=data.get('tags', [])
        )
        
        return jsonify({
            'id': review_id,
            'message': '评价成功'
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/<int:user_id>/reviews', methods=['GET'])
def get_user_reviews_api(user_id):
    """获取用户的评价"""
    try:
        limit = request.args.get('limit', 20, type=int)
        reviews = get_user_reviews(user_id, limit)
        return jsonify(reviews), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== 统计相关API =====
@app.route('/api/stats/dashboard', methods=['GET'])
def get_dashboard_stats_api():
    """获取仪表盘统计数据"""
    try:
        stats = get_dashboard_stats()
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/stats/categories', methods=['GET'])
def get_category_stats_api():
    """获取分类统计"""
    try:
        stats = get_category_stats()
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== 健康检查 =====
@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '2.0.0'
    }), 200


# ===== 初始化 =====
def init_app():
    """初始化应用"""
    os.makedirs('static', exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    
    print("正在初始化数据库...")
    try:
        # 使用改进的db模块初始化
        from modules.db import init_database, insert_sample_data
        init_database()
        if os.getenv('FLASK_ENV') != 'production':
            print("正在插入示例数据...")
            insert_sample_data()
    except Exception as e:
        print(f"初始化数据库出错: {e}")
    
    print("应用初始化完成！")


def find_free_port(start=5000, limit=20):
    """查找可用端口"""
    for p in range(start, start + limit):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('', p))
                return p
            except OSError:
                continue
    raise RuntimeError("No free port found")


if __name__ == '__main__':
    init_app()
    
    host = os.getenv('FLASK_HOST', '0.0.0.0')
    env_port = os.getenv('FLASK_PORT')
    debug = os.getenv('FLASK_ENV') != 'production'
    
    if env_port:
        port = int(env_port)
    else:
        port = find_free_port(5000)
    
    print(f"\n{'='*50}")
    print("NYU 二手交易平台启动中...")
    print(f"访问地址: http://{host}:{port}")
    print(f"调试模式: {'开启' if debug else '关闭'}")
    print(f"{'='*50}\n")
    
    app.run(host=host, port=port, debug=debug)