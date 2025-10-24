"""
NYU 二手交易平台 - 完整版 app.py
包含登录注册功能
"""
from flask import Flask, jsonify, request, render_template, session, url_for
from flask_cors import CORS
from datetime import datetime
import os
import socket
import hashlib
import secrets
import json
from werkzeug.utils import secure_filename

# 导入所有模块
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
app.config['SECRET_KEY'] = secrets.token_hex(32)
app.config['UPLOAD_FOLDER'] = os.path.join(app.static_folder, 'uploads')
app.config['AVATAR_FOLDER'] = os.path.join(app.config['UPLOAD_FOLDER'], 'avatars')
app.config['ALLOWED_IMAGE_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['AVATAR_FOLDER'], exist_ok=True)


def allowed_file(filename):
    """校验图片扩展名"""
    return (
        isinstance(filename, str)
        and '.' in filename
        and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_IMAGE_EXTENSIONS']
    )


def build_static_url(path):
    """根据存储路径生成可访问的静态资源URL"""
    if not path:
        return None
    if path.startswith(('http://', 'https://', '/static/')):
        return path
    normalized_path = path
    if normalized_path.startswith('static/'):
        normalized_path = normalized_path[len('static/') :]
    return url_for('static', filename=normalized_path)


def normalize_user_profile(user):
    """统一处理用户头像路径"""
    if not user:
        return user
    normalized = dict(user)
    normalized['avatar'] = build_static_url(normalized.get('avatar'))
    return normalized


def normalize_listing_images(listing):
    """统一处理图片URL，确保前端可直接使用"""
    if not listing:
        return listing

    images = listing.get('images') or []
    normalized = []
    for image in images:
        if not image:
            continue
        if image.startswith(('http://', 'https://', '/static/')):
            normalized.append(image)
            continue
        image_path = image
        if image_path.startswith('static/'):
            image_path = image_path[len('static/') :]
        normalized.append(url_for('static', filename=image_path))
    listing['images'] = normalized
    if isinstance(listing.get('user'), dict):
        listing['user'] = normalize_user_profile(listing['user'])
    return listing


def normalize_listing_collection(listings):
    """批量处理商品图片"""
    if not listings:
        return listings
    return [normalize_listing_images(dict(item)) for item in listings]


# ===== 页面路由 =====
@app.route('/')
def index():
    """商城"""
    return render_template('index.html')


@app.route('/login')
def login_page():
    """登录页面"""
    return render_template('login.html')


@app.route('/register')
def register_page():
    """注册页面"""
    return render_template('register.html')


# ===== 用户认证API =====
@app.route('/api/auth/register', methods=['POST'])
def register():
    """用户注册"""
    try:
        data = request.get_json()
        if not isinstance(data, dict):
            return jsonify({'error': '请求格式无效'}), 400

        email = (data.get('email') or '').strip().lower()
        password = (data.get('password') or '').strip()
        nickname = (data.get('nickname') or '').strip()
        community_id = data.get('community_id')
        openid = data.get('openid', 'web_' + str(datetime.now().timestamp()))

        # 验证必要字段
        if not email or not password or not nickname or community_id is None:
            return jsonify({'error': '请完整填写注册信息'}), 400

        try:
            community_id = int(community_id)
        except (TypeError, ValueError):
            return jsonify({'error': '请选择有效的所属社区'}), 400

        # 验证邮箱格式
        if not auth.verify_email(email):
            return jsonify({'error': '请输入有效的邮箱地址'}), 400
        
        # 基本密码长度校验
        if len(password) < 8:
            return jsonify({'error': '密码长度至少 8 位'}), 400
        
        # 检查邮箱是否已注册
        existing_user = get_user_by_email(email)
        if existing_user:
            return jsonify({'error': '该邮箱已被注册'}), 400
        
        # 创建用户
        user_id = create_user(
            openid=openid,
            email=email,
            nickname=nickname
        )
        
        # 保存密码（实际应用中应该加密存储）
        save_user_password(user_id, auth.hash_password(password))
        
        # 设置社区
        set_user_community(user_id, community_id)
        
        # 标记用户为邮箱已验证（基础认证）
        update_user_verify_status(user_id, 'email_verified')
        
        # 获取完整用户信息
        user = get_user_by_id(user_id)
        user_dict = normalize_user_profile(user)
        
        # 生成token
        token = auth.generate_token(user['id'])
        
        return jsonify({
            'token': token,
            'user': user_dict,
            'message': '注册成功'
        }), 201
        
    except Exception as e:
        print(f'注册错误: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/login', methods=['POST'])
def login():
    """用户登录"""
    try:
        data = request.get_json()
        if not isinstance(data, dict):
            return jsonify({'error': '请求格式无效'}), 400

        email = (data.get('email') or '').strip().lower()
        password = (data.get('password') or '').strip()
        
        if not email or not password:
            return jsonify({'error': '请输入邮箱和密码'}), 400
        
        # 验证邮箱格式
        if not auth.verify_email(email):
            return jsonify({'error': '请输入有效的邮箱地址'}), 400
        
        # 查找用户
        user = get_user_by_email(email)
        if not user:
            return jsonify({'error': '用户不存在'}), 404
        
        # 验证密码
        stored_password = get_user_password(user['id'])
        if not stored_password or not auth.verify_password(password, stored_password):
            return jsonify({'error': '密码错误'}), 401
        
        # 生成token
        token = auth.generate_token(user['id'])
        
        return jsonify({
            'token': token,
            'user': normalize_user_profile(dict(user)),
            'message': '登录成功'
        }), 200
        
    except Exception as e:
        print(f'登录错误: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/send-verification', methods=['POST'])
def send_verification():
    """发送验证码"""
    try:
        data = request.get_json()
        email = data.get('email')
        verify_type = data.get('type', 'email')
        
        if not email:
            return jsonify({'error': '缺少邮箱地址'}), 400
        
        # 验证邮箱格式
        if not auth.verify_email(email):
            return jsonify({'error': '请输入有效的邮箱地址'}), 400
        
        return jsonify({
            'message': '当前注册流程无需邮箱验证码',
            'verification_required': False
        }), 200
        
    except Exception as e:
        print(f'发送验证码错误: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/verify', methods=['POST'])
def verify():
    """验证用户身份"""
    try:
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        
        if not token:
            return jsonify({'error': '缺少token'}), 401
        
        user_id = auth.decode_token(token)
        if not user_id:
            return jsonify({'error': 'token无效或已过期'}), 401
        
        user = get_user_by_id(user_id)
        if not user:
            return jsonify({'error': '用户不存在'}), 404
        
        return jsonify({'user': normalize_user_profile(user)}), 200
        
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
    return jsonify(normalize_listing_collection(listings)), 200


@app.route('/api/listings/<int:listing_id>', methods=['GET'])
def get_listing(listing_id):
    """获取商品详情"""
    increment_view_count(listing_id)
    listing = get_listing_by_id(listing_id)
    if listing:
        return jsonify(normalize_listing_images(listing)), 200
    return jsonify({'error': '物品不存在'}), 404


@app.route('/api/favorites', methods=['POST'])
def add_favorite_api():
    """收藏物品"""
    try:
        data = request.get_json()
        if not isinstance(data, dict):
            return jsonify({'error': '请求格式无效'}), 400

        user_id = data.get('user_id')
        listing_id = data.get('listing_id')

        if not user_id or not listing_id:
            return jsonify({'error': '缺少用户或物品信息'}), 400

        user = get_user_by_id(user_id)
        if not user:
            return jsonify({'error': '用户不存在'}), 404

        listing = get_listing_by_id(listing_id)
        if not listing:
            return jsonify({'error': '物品不存在'}), 404

        add_favorite(user_id, listing_id)

        return jsonify({
            'message': '收藏成功',
            'listing': normalize_listing_images(listing)
        }), 201
    except Exception as e:
        print(f'收藏物品错误: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/favorites/<int:listing_id>', methods=['DELETE'])
def remove_favorite_api(listing_id):
    """取消收藏物品"""
    try:
        data = request.get_json(silent=True) or {}
        user_id = data.get('user_id') or request.args.get('user_id', type=int)

        if not user_id:
            return jsonify({'error': '缺少用户信息'}), 400

        user = get_user_by_id(user_id)
        if not user:
            return jsonify({'error': '用户不存在'}), 404

        removed = remove_favorite(user_id, listing_id)
        if not removed:
            return jsonify({'error': '收藏记录不存在'}), 404

        return jsonify({'message': '已取消收藏'}), 200
    except Exception as e:
        print(f'取消收藏错误: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/<int:user_id>/favorites', methods=['GET'])
def get_user_favorites_api(user_id):
    """获取用户收藏的物品"""
    try:
        user = get_user_by_id(user_id)
        if not user:
            return jsonify({'error': '用户不存在'}), 404

        limit = request.args.get('limit', 100, type=int)
        offset = request.args.get('offset', 0, type=int)

        favorites = get_user_favorites(user_id, limit, offset)
        favorite_ids = get_user_favorite_ids(user_id)

        return jsonify({
            'favorites': normalize_listing_collection(favorites),
            'favorite_ids': favorite_ids
        }), 200
    except Exception as e:
        print(f'获取用户收藏错误: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/<int:user_id>/listings', methods=['GET'])
def get_user_listings_api(user_id):
    """获取用户发布的物品"""
    try:
        user = get_user_by_id(user_id)
        if not user:
            return jsonify({'error': '用户不存在'}), 404
        
        status = request.args.get('status', 'active')
        category = request.args.get('category')
        community_id = request.args.get('community_id', type=int)
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        listings = get_listings(
            community_id=community_id,
            category=category,
            status=status,
            limit=limit,
            offset=offset,
            user_id=user_id
        )
        return jsonify(normalize_listing_collection(listings)), 200
    except Exception as e:
        print(f'获取用户发布错误: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/<int:user_id>/avatar', methods=['POST'])
def upload_user_avatar(user_id):
    """上传或更新用户头像"""
    try:
        user = get_user_by_id(user_id)
        if not user:
            return jsonify({'error': '用户不存在'}), 404

        file = request.files.get('avatar')
        if not file or not file.filename:
            return jsonify({'error': '请上传头像文件'}), 400

        if not allowed_file(file.filename):
            return jsonify({'error': '不支持的文件类型'}), 400

        ext = file.filename.rsplit('.', 1)[1].lower()
        unique_name = f"avatar_{user_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}_{secrets.token_hex(4)}.{ext}"
        filename = secure_filename(unique_name)
        save_path = os.path.join(app.config['AVATAR_FOLDER'], filename)
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        file.save(save_path)

        relative_path = os.path.relpath(save_path, app.static_folder).replace('\\', '/')
        update_user_avatar(user_id, relative_path)

        updated_user = get_user_by_id(user_id)
        return jsonify({
            'message': '头像已更新',
            'user': normalize_user_profile(updated_user)
        }), 200
    except Exception as e:
        print(f'上传头像错误: {str(e)}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/listings', methods=['POST'])
def create_listing_api():
    """发布商品"""
    try:
        images_files = []
        content_type = request.content_type or ''

        if content_type.startswith('multipart/form-data'):
            data = request.form.to_dict()
            images_files = request.files.getlist('images')
        else:
            data = request.get_json() or {}

        required = ['user_id', 'title', 'price', 'category', 'community_id']
        
        if not isinstance(data, dict):
            return jsonify({'error': '请求格式无效'}), 400
        
        for field in required:
            if field not in data:
                return jsonify({'error': f'缺少必要字段: {field}'}), 400

        try:
            user_id = int(data.get('user_id'))
            community_id = int(data.get('community_id'))
            price = float(data.get('price'))
        except (TypeError, ValueError):
            return jsonify({'error': '用户、社区或价格格式无效'}), 400

        user = get_user_by_id(user_id)
        if not user or user['verify_status'] == 'unverified':
            return jsonify({'error': '用户未认证，无法发布'}), 403

        existing_images = data.get('images', [])
        if isinstance(existing_images, str):
            try:
                parsed_images = json.loads(existing_images)
                existing_images = parsed_images if isinstance(parsed_images, list) else [existing_images]
            except json.JSONDecodeError:
                existing_images = [existing_images]
        elif not isinstance(existing_images, list):
            existing_images = []

        saved_images = []
        for image in images_files:
            if not image or not image.filename:
                continue
            if not allowed_file(image.filename):
                continue
            ext = image.filename.rsplit('.', 1)[1].lower()
            unique_name = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}_{secrets.token_hex(4)}.{ext}"
            filename = secure_filename(unique_name)
            save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            image.save(save_path)
            saved_images.append(f'uploads/{filename}')

        all_images = existing_images + saved_images

        listing_id = create_listing(
            user_id=user_id,
            title=data['title'],
            price=price,
            category=data['category'],
            community_id=community_id,
            description=data.get('description', ''),
            course_code=data.get('course_code'),
            isbn=data.get('isbn'),
            meetup_point=data.get('meetup_point', ''),
            images=all_images
        )
        
        listing = get_listing_by_id(listing_id)
        return jsonify(normalize_listing_images(listing)), 201
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
        return jsonify(normalize_listing_collection(listings)), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== 消息相关API =====
@app.route('/api/threads', methods=['POST'])
def create_thread_api():
    """创建会话"""
    try:
        data = request.get_json()
        buyer_id = data.get('buyer_id')
        seller_id = data.get('seller_id')
        listing_id = data.get('listing_id')
        
        if not all([buyer_id, seller_id, listing_id]):
            return jsonify({'error': '缺少必要参数'}), 400
        
        buyer = get_user_by_id(buyer_id)
        seller = get_user_by_id(seller_id)
        
        if not buyer or not seller:
            return jsonify({'error': '用户不存在'}), 404
        
        if buyer_id == seller_id:
            return jsonify({'error': '不能和自己联系'}), 400
        
        thread_id = create_thread(buyer_id, seller_id, listing_id)
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
        
        if not all([thread_id, from_user_id, to_user_id, content]):
            return jsonify({'error': '缺少必要参数'}), 400
        
        if len(content) == 0 or len(content) > 1000:
            return jsonify({'error': '消息长度不合法'}), 400
        
        from_user = get_user_by_id(from_user_id)
        to_user = get_user_by_id(to_user_id)
        
        if not from_user or not to_user:
            return jsonify({'error': '用户不存在'}), 404
        
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
    """获取待处理的举报"""
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
@app.route('/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '2.1.0'
    }), 200


# ===== 辅助函数 =====
def get_user_by_email(email):
    """根据邮箱获取用户"""
    email = (email or '').strip().lower()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE email = ?', (email,))
        row = cursor.fetchone()
        return dict(row) if row else None


def save_user_password(user_id, password_hash):
    """保存用户密码"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO user_passwords (user_id, password_hash)
            VALUES (?, ?)
        ''', (user_id, password_hash))


def get_user_password(user_id):
    """获取用户密码"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT password_hash FROM user_passwords WHERE user_id = ?', (user_id,))
        row = cursor.fetchone()
        return row[0] if row else None


def set_user_community(user_id, community_id):
    """设置用户社区"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('UPDATE users SET community_id = ? WHERE id = ?', (community_id, user_id))


# ===== 初始化 =====
def init_app():
    """初始化应用"""
    os.makedirs('static', exist_ok=True)
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    
    print("正在初始化数据库...")
    try:
        from modules.db import init_database, insert_sample_data
        init_database()
        
        # 创建密码表
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_passwords (
                    user_id INTEGER PRIMARY KEY,
                    password_hash TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            ''')
        
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
    print(f"登录页面: http://{host}:{port}/login")
    print(f"注册页面: http://{host}:{port}/register")
    print(f"调试模式: {'开启' if debug else '关闭'}")
    print(f"{'='*50}\n")
    
    app.run(host=host, port=port, debug=debug)
