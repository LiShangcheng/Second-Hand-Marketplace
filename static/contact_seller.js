/**
 * 联系卖家功能 - 独立模块
 * Contact Seller Module
 * 
 * 功能：处理用户点击"联系卖家"到发送消息的完整流程
 * Features: Complete workflow from clicking "contact seller" to sending messages
 */

// ===== 状态管理 =====
let currentThreadId = null;
let currentThread = null;
let messageRefreshInterval = null;

/**
 * 联系卖家 - 主入口
 * 用户点击"💬 联系卖家"按钮时调用
 */
async function contactSeller(listingId) {
    try {
        console.log('联系卖家...', { listingId });
        
        // 1. 获取商品信息和当前用户
        const listing = await getListing(listingId);
        const currentUser = getCurrentUser();
        
        if (!listing) {
            UI.showError('商品不存在');
            return;
        }
        
        if (!listing.user || !listing.user.id) {
            UI.showError('无法获取卖家信息');
            return;
        }
        
        // 2. 防止用户和自己联系
        if (listing.user.id === currentUser.id) {
            UI.showError('不能和自己联系');
            return;
        }
        
        // 3. 创建或获取会话
        console.log('创建会话...', {
            buyer_id: currentUser.id,
            seller_id: listing.user.id,
            listing_id: listingId
        });
        
        const threadResponse = await createThread(
            currentUser.id,
            listing.user.id,
            listingId
        );
        
        const threadId = threadResponse.id || threadResponse;
        console.log('会话创建成功，ID:', threadId);
        
        // 4. 打开消息对话框
        await openMessageDialog(threadId, listing, listing.user);
        
        // 5. 关闭详情弹窗
        closeModal('detailModal');
        
        console.log('✓ 联系卖家成功');
        
    } catch (error) {
        console.error('联系卖家失败:', error);
        UI.showError('联系卖家失败: ' + error.message);
    }
}

/**
 * 创建或获取会话
 */
async function createThread(buyerId, sellerId, listingId) {
    try {
        const response = await API.post('/api/threads', {
            buyer_id: buyerId,
            seller_id: sellerId,
            listing_id: listingId
        });
        
        return response;
    } catch (error) {
        console.error('创建会话失败:', error);
        throw new Error('无法创建会话: ' + error.message);
    }
}

// ===== 消息对话框管理 =====

/**
 * 打开消息对话框
 */
async function openMessageDialog(threadId, listing, seller) {
    try {
        currentThreadId = threadId;
        currentThread = { listing, seller };
        
        // 1. 更新对话框标题
        const dialogTitle = document.getElementById('messageDialogTitle');
        if (dialogTitle) {
            dialogTitle.textContent = `与 ${seller.nickname || '卖家'} 聊天`;
        }
        
        // 2. 更新商品信息
        renderProductInfo(listing);
        
        // 3. 加载消息列表
        await loadMessages(threadId);
        
        // 4. 打开对话框
        openModal('messageDialog');
        
        // 5. 聚焦输入框
        setTimeout(() => {
            const input = document.getElementById('messageInput');
            if (input) input.focus();
        }, 100);
        
    } catch (error) {
        console.error('打开对话框失败:', error);
        UI.showError('打开对话框失败: ' + error.message);
    }
}

/**
 * 渲染商品信息
 */
function renderProductInfo(listing) {
    const productInfo = document.getElementById('messageProductInfo');
    if (!productInfo) return;
    
    const placeholderColor = getColorByCategory(listing.category);
    
    productInfo.innerHTML = `
        <div style="display: flex; gap: 10px; padding: 10px; background: #f9fafb; border-radius: 8px; margin-bottom: 15px;">
            <div style="width: 60px; height: 60px; background: ${placeholderColor}; 
                        border-radius: 8px; display: flex; align-items: center; justify-content: center; 
                        color: white; font-size: 12px; text-align: center; flex-shrink: 0; font-weight: bold;">
                ${listing.title.substring(0, 10)}
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 500; font-size: 14px; margin-bottom: 5px; 
                           white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${listing.title}
                </div>
                <div style="color: #dc2626; font-weight: bold; font-size: 16px;">
                    ¥${listing.price}
                </div>
                <div style="font-size: 12px; color: #6b7280; margin-top: 3px;">
                    ${listing.meetup_point || '面交地点未设置'}
                </div>
            </div>
        </div>
    `;
}

/**
 * 根据分类获取颜色
 */
function getColorByCategory(category) {
    const colors = {
        textbook: '#667eea',
        furniture: '#ec4899',
        electronics: '#3b82f6',
        dorm_supplies: '#8b5cf6',
        other: '#6b7280'
    };
    return colors[category] || '#9ca3af';
}

/**
 * 关闭消息对话框
 */
function closeMessageDialog() {
    currentThreadId = null;
    currentThread = null;
    if (messageRefreshInterval) {
        clearInterval(messageRefreshInterval);
        messageRefreshInterval = null;
    }
    closeModal('messageDialog');
}

// ===== 消息加载和显示 =====

/**
 * 加载消息列表
 */
async function loadMessages(threadId) {
    try {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) {
            console.error('消息容器不存在');
            return;
        }
        
        messagesContainer.innerHTML = '<div class="loading" style="text-align: center; color: #9ca3af; padding: 20px;">加载消息中...</div>';
        
        const messages = await API.get(`/api/threads/${threadId}/messages`);
        console.log('获取消息:', messages);
        
        if (!messages || messages.length === 0) {
            messagesContainer.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 20px;">开始新对话</div>';
        } else {
            messagesContainer.innerHTML = messages.map(msg => renderMessage(msg)).join('');
            
            // 滚动到最新消息
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 100);
        }
    } catch (error) {
        console.error('加载消息失败:', error);
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 20px;">加载消息失败</div>';
        }
    }
}

/**
 * 渲染单个消息
 */
function renderMessage(message) {
    const currentUser = getCurrentUser();
    const isOwn = message.from_user_id === currentUser.id;
    
    return `
        <div style="display: flex; margin-bottom: 12px; justify-content: ${isOwn ? 'flex-end' : 'flex-start'};">
            <div style="max-width: 70%; background: ${isOwn ? '#5b21b6' : '#f3f4f6'}; 
                        color: ${isOwn ? 'white' : '#111827'}; padding: 10px 14px; 
                        border-radius: 12px; word-break: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <div style="font-size: 14px; line-height: 1.5;">
                    ${escapeHtml(message.content)}
                </div>
                <div style="font-size: 11px; margin-top: 5px; opacity: 0.7;">
                    ${formatTime(message.created_at)}
                </div>
            </div>
        </div>
    `;
}

// ===== 消息发送 =====

/**
 * 发送消息
 */
async function sendMessage() {
    try {
        const input = document.getElementById('messageInput');
        const content = input.value.trim();
        
        // 1. 验证消息内容
        if (!content) {
            UI.showError('请输入消息内容');
            return;
        }
        
        if (content.length > 1000) {
            UI.showError('消息过长（最多1000字）');
            return;
        }
        
        if (!currentThreadId) {
            UI.showError('没有会话ID');
            return;
        }
        
        const currentUser = getCurrentUser();
        const sellerId = getSellerId();
        
        if (!sellerId) {
            UI.showError('无法获取卖家ID');
            return;
        }
        
        // 2. 禁用发送按钮，显示加载状态
        const sendBtn = document.getElementById('messageSendBtn');
        sendBtn.disabled = true;
        sendBtn.textContent = '发送中...';
        
        // 3. 发送消息到后端
        console.log('发送消息...', {
            thread_id: currentThreadId,
            from_user_id: currentUser.id,
            to_user_id: sellerId,
            content: content
        });
        
        const response = await API.post('/api/messages', {
            thread_id: currentThreadId,
            from_user_id: currentUser.id,
            to_user_id: sellerId,
            content: content
        });
        
        console.log('消息发送成功:', response);
        
        // 4. 清空输入框
        input.value = '';
        
        // 5. 重新加载消息列表
        await loadMessages(currentThreadId);
        
        // 6. 恢复按钮
        sendBtn.disabled = false;
        sendBtn.textContent = '发送';
        
    } catch (error) {
        console.error('发送消息失败:', error);
        UI.showError('发送消息失败: ' + error.message);
        
        // 恢复按钮
        const sendBtn = document.getElementById('messageSendBtn');
        sendBtn.disabled = false;
        sendBtn.textContent = '发送';
    }
}

/**
 * 获取卖家ID
 */
function getSellerId() {
    if (!currentThread) return null;
    const currentUser = getCurrentUser();
    // 如果当前用户是买家，卖家ID就是 listing.user.id
    // 如果当前用户是卖家，卖家ID就是 currentUser.id
    return currentThread.seller ? currentThread.seller.id : null;
}

// ===== 消息列表页面 =====

/**
 * 加载消息列表页面（显示所有会话）
 */
async function loadMessagesPage() {
    try {
        const currentUser = getCurrentUser();
        const threadList = document.getElementById('threadList');
        
        if (!threadList) {
            console.error('线程容器不存在');
            return;
        }
        
        threadList.innerHTML = '<div style="text-align: center; color: #9ca3af; padding: 40px;">加载中...</div>';
        
        const threads = await API.get(`/api/threads/${currentUser.id}`);
        console.log('获取会话列表:', threads);
        
        if (!threads || threads.length === 0) {
            threadList.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 40px;">💬<br>暂无消息</div>';
            return;
        }
        
        threadList.innerHTML = threads.map(thread => renderThreadItem(thread)).join('');
        
    } catch (error) {
        console.error('加载消息列表失败:', error);
        const threadList = document.getElementById('threadList');
        if (threadList) {
            threadList.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 40px;">加载消息列表失败</div>';
        }
    }
}

/**
 * 渲染会话项
 */
function renderThreadItem(thread) {
    const currentUser = getCurrentUser();
    const otherUser = thread.buyer_id === currentUser.id 
        ? { id: thread.seller_id, nickname: thread.seller_nickname }
        : { id: thread.buyer_id, nickname: thread.buyer_nickname };
    
    return `
        <div class="thread-item" onclick="openThreadFromList(${thread.id})" 
             style="padding: 15px; border-bottom: 1px solid #e5e5e5; cursor: pointer; 
                    transition: background 0.2s; hover-bg: #f9fafb;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div style="font-weight: 500; color: #111827;">${otherUser.nickname}</div>
                <div style="font-size: 12px; color: #9ca3af;">${formatTime(thread.last_message_at)}</div>
            </div>
            <div style="font-size: 13px; color: #374151; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${thread.listing_title}
            </div>
            <div style="font-size: 14px; color: #dc2626; font-weight: bold;">
                ¥${thread.listing_price}
            </div>
        </div>
    `;
}

/**
 * 从消息列表打开会话
 */
function openThreadFromList(threadId) {
    currentThreadId = threadId;
    
    // 更新对话框信息
    const dialogTitle = document.getElementById('messageDialogTitle');
    if (dialogTitle) {
        dialogTitle.textContent = '消息对话';
    }
    
    loadMessages(threadId);
    openModal('messageDialog');
}

// ===== 辅助函数 =====

/**
 * 获取商品信息
 */
async function getListing(listingId) {
    try {
        // 先从本地状态查找
        const currentState = getState();
        let listing = currentState.listings.find(l => l.id === listingId);
        
        // 如果本地没有，从API获取
        if (!listing) {
            listing = await API.getListing(listingId);
        }
        
        return listing;
    } catch (error) {
        console.error('获取商品信息失败:', error);
        return null;
    }
}

/**
 * 格式化时间
 */
function formatTime(dateString) {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        // 不到1分钟
        if (diff < 60000) {
            return '刚刚';
        }
        // 不到1小时
        if (diff < 3600000) {
            return Math.floor(diff / 60000) + '分钟前';
        }
        // 不到1天
        if (diff < 86400000) {
            return Math.floor(diff / 3600000) + '小时前';
        }
        
        // 显示日期时间
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${date.getMonth() + 1}/${date.getDate()} ${hours}:${minutes}`;
    } catch (e) {
        console.error('时间格式化失败:', e);
        return dateString;
    }
}

/**
 * 转义HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 获取当前用户
 */
function getCurrentUser() {
    const currentState = getState();
    return currentState.currentUser || {
        id: Math.floor(Math.random() * 1000) + 1,
        nickname: '用户' + Math.floor(Math.random() * 100)
    };
}

/**
 * 获取状态
 */
function getState() {
    // 这个函数假设已在 state.js 中定义
    if (typeof window.appState !== 'undefined') {
        return window.appState;
    }
    return {
        currentUser: null,
        listings: [],
        currentCommunity: null,
        currentCategory: 'all'
    };
}

/**
 * 打开模态框
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * 关闭模态框
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// ===== 初始化 =====

/**
 * 初始化联系卖家功能
 */
function initContactSeller() {
    console.log('✓ 联系卖家功能已初始化');
    
    // 为消息输入框添加Enter快捷键
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initContactSeller);