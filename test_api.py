#!/usr/bin/env python3
"""
API 测试脚本
用于测试 NYU 二手交易平台的所有 API 接口
"""

import requests
import json
from datetime import datetime

BASE_URL = 'http://localhost:5000'

class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_section(title):
    """打印测试章节标题"""
    print(f"\n{Colors.BLUE}{'='*50}{Colors.END}")
    print(f"{Colors.BLUE}{title}{Colors.END}")
    print(f"{Colors.BLUE}{'='*50}{Colors.END}\n")

def test_api(method, endpoint, data=None, expected_status=200):
    """测试 API 接口"""
    url = f"{BASE_URL}{endpoint}"
    
    try:
        if method == 'GET':
            response = requests.get(url)
        elif method == 'POST':
            response = requests.post(url, json=data)
        elif method == 'PUT':
            response = requests.put(url, json=data)
        elif method == 'DELETE':
            response = requests.delete(url)
        
        # 检查状态码
        status_ok = response.status_code == expected_status
        status_color = Colors.GREEN if status_ok else Colors.RED
        
        print(f"{status_color}{'✓' if status_ok else '✗'}{Colors.END} {method} {endpoint}")
        print(f"   状态码: {response.status_code}")
        
        # 打印响应内容
        if response.status_code < 300:
            try:
                response_data = response.json()
                if isinstance(response_data, list):
                    print(f"   返回: {len(response_data)} 条记录")
                    if response_data:
                        print(f"   示例: {json.dumps(response_data[0], ensure_ascii=False, indent=6)[:200]}...")
                else:
                    print(f"   返回: {json.dumps(response_data, ensure_ascii=False, indent=6)[:200]}...")
            except:
                print(f"   返回: {response.text[:100]}")
        else:
            print(f"   错误: {response.text}")
        
        print()
        return response
        
    except Exception as e:
        print(f"{Colors.RED}✗{Colors.END} {method} {endpoint}")
        print(f"   错误: {str(e)}\n")
        return None


def main():
    """主测试函数"""
    print(f"\n{Colors.YELLOW}🚀 NYU 二手交易平台 - API 测试{Colors.END}")
    print(f"{Colors.YELLOW}测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{Colors.END}")
    
    # 1. 健康检查
    print_section("1️⃣  健康检查")
    test_api('GET', '/health')
    
    # 2. 社区相关 API
    print_section("2️⃣  社区相关 API")
    test_api('GET', '/api/communities')
    test_api('GET', '/api/communities/1')
    test_api('GET', '/api/communities/999', expected_status=404)
    
    # 3. 用户相关 API
    print_section("3️⃣  用户相关 API")
    
    # 创建用户
    test_api('POST', '/api/users', {
        'openid': 'test_openid_' + str(datetime.now().timestamp()),
        'email': 'test@nyu.edu',
        'nickname': '测试用户'
    }, expected_status=201)
    
    # 获取用户
    test_api('GET', '/api/users/1')
    test_api('GET', '/api/users/999', expected_status=404)
    
    # 验证用户
    test_api('POST', '/api/users/1/verify', {
        'status': 'email_verified'
    })
    
    # 4. 物品相关 API
    print_section("4️⃣  物品相关 API")
    
    # 获取物品列表
    test_api('GET', '/api/listings')
    test_api('GET', '/api/listings?community_id=1')
    test_api('GET', '/api/listings?category=textbook')
    test_api('GET', '/api/listings?community_id=1&category=textbook')
    
    # 获取物品详情
    test_api('GET', '/api/listings/1')
    test_api('GET', '/api/listings/999', expected_status=404)
    
    # 发布物品 (需要认证用户)
    test_api('POST', '/api/listings', {
        'user_id': 1,
        'title': 'API测试物品',
        'price': 99.99,
        'category': 'electronics',
        'community_id': 1,
        'description': '这是通过API测试创建的物品',
        'meetup_point': 'Test Location'
    }, expected_status=201)
    
    # 搜索物品
    test_api('GET', '/api/listings/search?q=CS-UY')
    test_api('GET', '/api/listings/search?q=测试')
    test_api('GET', '/api/listings/search?q=', expected_status=400)
    
    # 更新物品状态
    test_api('PUT', '/api/listings/1', {
        'status': 'sold'
    })
    
    # 5. 消息相关 API
    print_section("5️⃣  消息相关 API")
    
    # 创建会话
    test_api('POST', '/api/threads', {
        'buyer_id': 1,
        'seller_id': 2,
        'listing_id': 1
    }, expected_status=201)
    
    # 获取用户会话列表
    test_api('GET', '/api/threads/1')
    
    # 发送消息
    test_api('POST', '/api/messages', {
        'thread_id': 1,
        'from_user_id': 1,
        'to_user_id': 2,
        'content': 'API测试消息'
    }, expected_status=201)
    
    # 获取会话消息
    test_api('GET', '/api/threads/1/messages')
    
    # 获取未读消息数
    test_api('GET', '/api/messages/2/unread-count')
    
    # 6. 举报相关 API
    print_section("6️⃣  举报相关 API")
    
    # 提交举报
    test_api('POST', '/api/reports', {
        'reporter_id': 1,
        'target_type': 'listing',
        'target_id': 1,
        'reason': 'API测试举报',
        'description': '这是测试举报'
    }, expected_status=201)
    
    # 获取举报列表
    test_api('GET', '/api/reports')
    
    # 处理举报
    test_api('POST', '/api/reports/1/handle', {
        'handler_id': 1
    })
    
    # 7. 评价相关 API
    print_section("7️⃣  评价相关 API")
    
    # 创建评价
    test_api('POST', '/api/reviews', {
        'listing_id': 1,
        'reviewer_id': 1,
        'reviewee_id': 2,
        'rating': 5,
        'comment': 'API测试评价',
        'tags': ['准时', '友好']
    }, expected_status=201)
    
    # 获取用户评价列表
    test_api('GET', '/api/users/2/reviews')
    
    # 获取用户评分统计
    test_api('GET', '/api/users/2/rating-stats')
    
    # 8. 统计相关 API
    print_section("8️⃣  统计相关 API")
    
    # 获取仪表盘统计
    test_api('GET', '/api/stats/dashboard')
    
    # 获取分类统计
    test_api('GET', '/api/stats/categories')
    
    # 测试完成
    print(f"\n{Colors.GREEN}{'='*50}{Colors.END}")
    print(f"{Colors.GREEN}✅ 测试完成!{Colors.END}")
    print(f"{Colors.GREEN}{'='*50}{Colors.END}\n")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}测试已中断{Colors.END}\n")
    except Exception as e:
        print(f"\n{Colors.RED}测试出错: {str(e)}{Colors.END}\n")
