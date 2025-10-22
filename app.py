"""
NYU 二手交易平台 - 完整版
包含所有功能模块的集成
"""
from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from datetime import datetime
import os
import socket

# 导入所有模块
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


# ===== 认证相关API =====
@app.route('/api/auth/send-code', methods=['POST'])
def send_verification_code():
    """发送验证码"""
    try:
        data = request.get_json()
        identifier = data.get('identifier')  # 邮箱或手机号
        type = data.get('type', 'email')  # email or phone
        
        if not identifier:
            return jsonify({'error': '缺少邮箱或手机号'}), 400
        
        # 验证邮箱格式
        if type == 'email' and not auth.verify_email(identifier):
            return jsonify({'error': '请使用NYU邮箱'}), 400
        
        # 生成并发送验证码
        code = auth.create_verification_code(identifier, type)
        
        if type == 'email':
            auth.send_verification_email(identifier, code)
        else:
            auth.send_verification_sms(identifier, code)
        
        return jsonify({'message': '验证码已发送'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/verify', methods=['POST'])
def verify_code():
    """验证验证码"""
    try:
        data = request.get_json()
        identifier = data.get('identifier')
        code = data.get('code')
        
        if not identifier or not code:
            return jsonify({'error': '缺少必要参数'}), 400
        
        if auth.verify_code(identifier, code):
            return jsonify({'message': '验证成功', 'verified': True}), 200
        else:
            return jsonify({'error': '验证码错误或已过期'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


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
        user = db.get_user_by_openid(openid)
        
        if not user:
            user_id = db.create_user(openid, email, phone, nickname)
            user = db.get_user_by_id(user_id)
        
        # 生成token
        token = auth.generate_token(user['id'])
        
        return jsonify({
            'token': token,
            'user': user
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== 通知相关API =====
@app.route('/api/notifications', methods=['GET'])
@auth.token_required
def get_notifications():
    """获取用户通知"""
    try:
        user_id = request.current_user_id
        unread_only = request.args.get('unread_only', 'false').lower() == 'true'
        limit = request.args.get('limit', 20, type=int)
        
        notifs = notifications.get_user_notifications(user_id, limit, unread_only)
        return jsonify(notifs), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/notifications/unread-count', methods=['GET'])
@auth.token_required
def get_notification_count():
    """获取未读通知数"""
    try:
        user_id = request.current_user_id
        count = notifications.get_unread_count(user_id)
        return jsonify({'count': count}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/notifications/<int:notification_id>/read', methods=['POST'])
@auth.token_required
def mark_notification_read(notification_id):
    """标记通知为已读"""
    try:
        notifications.mark_notification_read(notification_id)
        return jsonify({'message': '标记成功'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/notifications/mark-all-read', methods=['POST'])
@auth.token_required
def mark_all_notifications_read():
    """标记所有通知为已读"""
    try:
        user_id = request.current_user_id
        notifications.mark_all_read(user_id)
        return jsonify({'message': '全部标记为已读'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== 搜索相关API =====
@app.route('/api/search/advanced', methods=['GET'])
def search_advanced():
    """高级搜索"""
    try:
        query = request.args.get('q', '').strip()
        
        filters = {
            'min_price': request.args.get('min_price', type=float),
            'max_price': request.args.get('max_price', type=float),
            'category': request.args.get('category'),
            'community_id': request.args.get('community_id', type=int),
            'sort_by': request.args.get('sort_by', 'created_at'),
            'sort_order': request.args.get('sort_order', 'DESC'),
            'limit': request.args.get('limit', 50, type=int),
            'offset': request.args.get('offset', 0, type=int)
        }
        
        results = search.search_listings_advanced(query, filters)
        return jsonify(results), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/search/suggestions', methods=['GET'])
def get_suggestions():
    """搜索建议"""
    try:
        query = request.args.get('q', '').strip()
        limit = request.args.get('limit', 5, type=int)
        
        suggestions = search.get_search_suggestions(query, limit)
        return jsonify(suggestions), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/search/popular', methods=['GET'])
def get_popular():
    """热门搜索"""
    try:
        limit = request.args.get('limit', 10, type=int)
        popular = search.get_popular_searches(limit)
        return jsonify(popular), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/listings/<int:listing_id>/related', methods=['GET'])
def get_related(listing_id):
    """相关商品"""
    try:
        limit = request.args.get('limit', 4, type=int)
        related = search.get_related_listings(listing_id, limit)
        return jsonify(related), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== 保留原有的API（简化版） =====
@app.route('/api/communities', methods=['GET'])
def get_communities():
    communities = db.get_all_communities()
    return jsonify(communities), 200


@app.route('/api/listings', methods=['GET'])
def get_listings_api():
    community_id = request.args.get('community_id', type=int)
    category = request.args.get('category')
    status = request.args.get('status', 'active')
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    listings = db.get_listings(community_id, category, status, limit, offset)
    return jsonify(listings), 200


@app.route('/api/listings/<int:listing_id>', methods=['GET'])
def get_listing(listing_id):
    db.increment_view_count(listing_id)
    listing = db.get_listing_by_id(listing_id)
    if listing:
        return jsonify(listing), 200
    return jsonify({'error': '物品不存在'}), 404


@app.route('/api/listings', methods=['POST'])
def create_listing_api():
    try:
        data = request.get_json()
        required = ['user_id', 'title', 'price', 'category', 'community_id']
        
        for field in required:
            if field not in data:
                return jsonify({'error': f'缺少必要字段: {field}'}), 400
        
        user = db.get_user_by_id(data['user_id'])
        if not user or user['verify_status'] == 'unverified':
            return jsonify({'error': '用户未认证，无法发布'}), 403
        
        listing_id = db.create_listing(
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
        
        listing = db.get_listing_by_id(listing_id)
        return jsonify(listing), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/search/stats', methods=['GET'])
def get_search_stats():
    """获取搜索统计信息"""
    try:
        stats = search.search_by_category_stats()
        
        return jsonify({
            'categories': stats,
            'total_active_listings': sum(s['count'] for s in stats)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    

@app.route('/api/listings/search', methods=['GET'])
def quick_search():
    """
    快速搜索（兼容旧版API）
    
    查询参数:
        q: 搜索关键词
        community_id: 社区ID
        limit: 返回数量
    """
    try:
        query = request.args.get('q', '').strip()
        community_id = request.args.get('community_id', type=int)
        limit = request.args.get('limit', 50, type=int)
        
        filters = {'limit': limit}
        if community_id:
            filters['community_id'] = community_id
        
        results = search.search_listings_advanced(query, filters)
        
        return jsonify(results), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '2.0.0'
    }), 200




# ===== 初始化 =====
def init_app():
    os.makedirs('static', exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    
    print("正在初始化数据库...")
    db.init_database()
    notifications.init_notifications_table()
    search.init_search_tables()
    
    if os.getenv('FLASK_ENV') != 'production':
        print("正在插入示例数据...")
        db.insert_sample_data()
    
    print("应用初始化完成！")


def find_free_port(start=5000, limit=20):
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