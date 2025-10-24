"""
用户认证和授权模块
"""
import jwt
import re
import hashlib
import secrets
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify
from modules import db

# JWT 密钥（生产环境应使用环境变量）
SECRET_KEY = secrets.token_hex(32)
TOKEN_EXPIRATION = timedelta(days=7)


def hash_password(password):
    """密码哈希"""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password, hashed):
    """验证密码"""
    return hash_password(password) == hashed


def generate_token(user_id):
    """生成JWT令牌"""
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + TOKEN_EXPIRATION,
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')


def decode_token(token):
    """解码JWT令牌"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return payload['user_id']
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def token_required(f):
    """装饰器：要求JWT令牌"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'error': '缺少认证令牌'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            
            user_id = decode_token(token)
            if not user_id:
                return jsonify({'error': '无效的令牌'}), 401
            
            # 将用户信息添加到请求中
            request.current_user_id = user_id
            
        except Exception as e:
            return jsonify({'error': str(e)}), 401
        
        return f(*args, **kwargs)
    
    return decorated


def verify_email(email):
    """验证邮箱格式"""
    return bool(re.match(r"^[^@]+@[^@]+\.[^@]+$", email))


def send_verification_email(email, code):
    """发送验证邮件（模拟）"""
    print(f"发送验证码到 {email}: {code}")
    # 实际应用中应该使用真实的邮件服务
    return True


def send_verification_sms(phone, code):
    """发送验证短信（模拟）"""
    print(f"发送验证码到 {phone}: {code}")
    # 实际应用中应该使用真实的短信服务
    return True


def generate_verification_code():
    """生成6位验证码"""
    return secrets.randbelow(900000) + 100000


# 存储验证码（生产环境应使用Redis）
verification_codes = {}


def create_verification_code(identifier, type='email'):
    """创建验证码"""
    code = generate_verification_code()
    verification_codes[identifier] = {
        'code': code,
        'type': type,
        'created_at': datetime.now(),
        'expires_at': datetime.now() + timedelta(minutes=10)
    }
    return code


def verify_code(identifier, code):
    """验证验证码"""
    if identifier not in verification_codes:
        return False
    
    stored = verification_codes[identifier]
    
    # 检查是否过期
    if datetime.now() > stored['expires_at']:
        del verification_codes[identifier]
        return False
    
    # 验证码是否正确
    if str(stored['code']) == str(code):
        del verification_codes[identifier]
        return True
    
    return False


def check_user_permission(user_id, action, resource_id=None):
    """检查用户权限"""
    user = db.get_user_by_id(user_id)
    if not user:
        return False
    
    # 未认证用户只能浏览
    if user['verify_status'] == 'unverified' and action != 'read':
        return False
    
    # 被封禁用户无权限
    if user['verify_status'] == 'banned':
        return False
    
    return True
