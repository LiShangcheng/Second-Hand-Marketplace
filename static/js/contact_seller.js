/**
 * 联系卖家功能 - 修复版
 * Contact Seller Module - Fixed Version
 * 
 * 功能：处理用户点击"联系卖家"到发送讯息的完整流程
 */

// ===== 状态管理 =====
let currentThreadId = null;
let currentThread = null; // { threadId, listing, buyerId, sellerId, buyerNickname, sellerNickname }
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
        
        if (!currentUser || !currentUser.id) {
            showError('请先登录后再联系卖家');
            return;
        }
        
        if (!listing) {
            showError('商品不存在');
            return;
        }
        
        if (!listing.user || !listing.user.id) {
            showError('无法获取卖家信息');
            return;
        }
        
        // 2. 防止用户和自己联系
        if (listing.user.id === currentUser.id) {
            showError('不能和自己联系');
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
        
        // 4. 打开讯息对话框
        await openMessageDialog(threadId, listing, listing.user);
        
        // 5. 关闭详情弹窗
        closeModal('detailModal');
        
        console.log('✓ 联系卖家成功');
        
    } catch (error) {
        console.error('联系卖家失败:', error);
        showError('联系卖家失败: ' + error.message);
    }
}

/**
 * 创建或获取会话
 */
async function createThread(buyerId, sellerId, listingId) {
    try {
        const response = await fetch('/api/threads', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                buyer_id: buyerId,
                seller_id: sellerId,
                listing_id: listingId
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '创建会话失败');
        }
        
        return await response.json();
    } catch (error) {
        console.error('创建会话失败:', error);
        throw new Error('无法创建会话: ' + error.message);
    }
}

// ===== 讯息对话框管理 =====

/**
 * 打开讯息对话框
 */
async function openMessageDialog(threadId, listing, seller) {
    try {
        const currentUser = getCurrentUser();
        currentThreadId = threadId;
        currentThread = {
            threadId,
            listing: listing || null,
            buyerId: currentUser?.id || null,
            sellerId: seller?.id || null,
            buyerNickname: currentUser?.nickname || null,
            sellerNickname: seller?.nickname || null
        };
        
        // 如果传入的 listing 信息缺失，从接口补全
        if ((!listing || !listing.meetup_point || !listing.category) && listing?.id) {
            try {
                const freshListing = await getListing(listing.id);
                if (freshListing) {
                    currentThread.listing = freshListing;
                    listing = freshListing;
                }
            } catch (fetchError) {
                console.warn('补全商品信息失败:', fetchError);
            }
        }
        
        // 1. 更新对话框标题
        const dialogTitle = document.getElementById('messageDialogTitle');
        if (dialogTitle) {
            const sellerName = getChatPartnerNickname();
            dialogTitle.textContent = sellerName ? `与 ${sellerName} 的聊天` : '聊天';
        }
        
        // 2. 更新商品信息
        renderProductInfo(currentThread.listing || listing);
        
        // 3. 加载讯息列表
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
        showError('打开对话框失败: ' + error.message);
    }
}

/**
 * 渲染商品信息
 */
function renderProductInfo(listing) {
    const productInfo = document.getElementById('messageProductInfo');
    if (!productInfo) return;
    if (!listing) {
        productInfo.innerHTML = '';
        return;
    }
    
    const placeholderColor = getColorByCategory(listing.category);
    
    productInfo.innerHTML = `
        <div class="message-product-card">
            <div class="message-product-thumb" style="background:${placeholderColor};">
                ${(listing.title || '').substring(0, 10)}
            </div>
            <div class="message-product-body">
                <div class="message-product-title">${listing.title}</div>
                <div class="message-product-price">$${listing.price}</div>
                <div class="message-product-meta">📍 ${listing.meetup_point || '推荐面交地点未设置'}</div>
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
        rental: '#22d3ee',
        other: '#6b7280'
    };
    return colors[category] || '#9ca3af';
}

/**
 * 关闭讯息对话框
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

// ===== 讯息加载和显示 =====

/**
 * 加载讯息列表
 */
async function loadMessages(threadId) {
    try {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) {
            console.error('讯息容器不存在');
            return;
        }
        
        messagesContainer.innerHTML = '<div class="loading" style="text-align: center; color: #9ca3af; padding: 20px;">加载讯息中...</div>';
        
        const response = await fetch(`/api/threads/${threadId}/messages`);
        
        if (!response.ok) {
            throw new Error('加载讯息失败');
        }
        
        const messages = await response.json();
        console.log('获取讯息:', messages);
        
        if (!messages || messages.length === 0) {
            messagesContainer.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 20px;">开始新对话</div>';
        } else {
            messagesContainer.innerHTML = messages.map(msg => renderMessage(msg)).join('');
            
            // 滚动到最新讯息
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 100);
        }
    } catch (error) {
        console.error('加载讯息失败:', error);
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 20px;">加载讯息失败</div>';
        }
    }
}

/**
 * 渲染单个讯息
 */
function renderMessage(message) {
    const currentUser = getCurrentUser();
    const currentUserId = currentUser && currentUser.id ? currentUser.id : null;
    const isOwn = currentUserId ? message.from_user_id === currentUserId : false;
    
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

// ===== 讯息发送 =====

/**
 * 发送讯息
 */
async function sendMessage() {
    try {
        const input = document.getElementById('messageInput');
        const content = input.value.trim();
        
        // 1. 验证讯息内容
        if (!content) {
            showError('请输入讯息内容');
            return;
        }
        
        if (content.length > 1000) {
            showError('讯息过长（最多1000字）');
            return;
        }
        
        if (!currentThreadId) {
            showError('没有会话ID');
            return;
        }
        
        const currentUser = getCurrentUser();
        if (!currentUser || !currentUser.id) {
            showError('请先登录后再发送讯息');
            return;
        }

        const receiverId = getChatPartnerId();
        
        if (!receiverId) {
            showError('无法确定接收方，请刷新页面后重试');
            return;
        }
        
        // 2. 禁用发送按钮，显示加载状态
        const sendBtn = document.getElementById('messageSendBtn');
        sendBtn.disabled = true;
        sendBtn.textContent = '发送中...';
        
        // 3. 发送讯息到后端
        console.log('发送讯息...', {
            thread_id: currentThreadId,
            from_user_id: currentUser.id,
            to_user_id: receiverId,
            content: content
        });
        
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                thread_id: currentThreadId,
                from_user_id: currentUser.id,
                to_user_id: receiverId,
                content: content
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '发送失败');
        }
        
        const result = await response.json();
        console.log('讯息发送成功:', result);
        
        // 4. 清空输入框
        input.value = '';
        
        // 5. 重新加载讯息列表
        await loadMessages(currentThreadId);
        
        // 6. 恢复按钮
        sendBtn.disabled = false;
        sendBtn.textContent = '发送';
        
    } catch (error) {
        console.error('发送讯息失败:', error);
        showError('发送讯息失败: ' + error.message);
        
        // 恢复按钮
        const sendBtn = document.getElementById('messageSendBtn');
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.textContent = '发送';
        }
    }
}

/**
 * 获取聊天对象ID
 */
function getChatPartnerId() {
    if (!currentThread) return null;
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) return null;
    
    if (currentUser.id === currentThread.buyerId) {
        return currentThread.sellerId;
    }
    if (currentUser.id === currentThread.sellerId) {
        return currentThread.buyerId;
    }
    return null;
}

/**
 * 获取聊天对象名称
 */
function getChatPartnerNickname() {
    if (!currentThread) return null;
    if (currentThread.sellerNickname) return currentThread.sellerNickname;
    if (currentThread.listing && currentThread.listing.user && currentThread.listing.user.nickname) {
        return currentThread.listing.user.nickname;
    }
    return '卖家';
}

// ===== 讯息列表页面 =====

/**
 * 加载讯息列表页面（显示所有会话）
 */
async function loadMessagesPage() {
    try {
        const currentUser = getCurrentUser();
        const threadList = document.getElementById('threadList');
        
        if (!threadList) {
            console.error('线程容器不存在');
            return;
        }
        
        if (!currentUser || !currentUser.id) {
            threadList.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 40px;">请先登录查看讯息</div>';
            return;
        }
        
        threadList.innerHTML = '<div style="text-align: center; color: #9ca3af; padding: 40px;">加载中...</div>';
        
        const response = await fetch(`/api/threads/${currentUser.id}`);
        
        if (!response.ok) {
            throw new Error('加载失败');
        }
        
        const threads = await response.json();
        console.log('获取会话列表:', threads);
        
        if (!threads || threads.length === 0) {
            threadList.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 40px;">💬<br>暂无讯息</div>';
            return;
        }
        
        threadList.innerHTML = threads.map(thread => renderThreadItem(thread)).join('');
        
    } catch (error) {
        console.error('加载讯息列表失败:', error);
        const threadList = document.getElementById('threadList');
        if (threadList) {
            threadList.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 40px;">加载讯息列表失败</div>';
        }
    }
}

/**
 * 渲染会话项
 */
function renderThreadItem(thread) {
    const currentUser = getCurrentUser();
    const isBuyer = currentUser && currentUser.id === thread.buyer_id;
    const otherNickname = isBuyer
        ? (thread.seller_nickname || '卖家')
        : (thread.buyer_nickname || '买家');
    
    return `
        <div class="thread-item" onclick="openThreadFromList(${thread.id})">
            <div class="thread-header">
                <div class="thread-title">${otherNickname}</div>
                <div class="thread-time">${formatTime(thread.last_message_at)}</div>
            </div>
            <div class="thread-preview">${thread.listing_title}</div>
            <div class="thread-price">$${thread.listing_price}</div>
        </div>
    `;
}

/**
 * 从讯息列表打开会话
 */
async function openThreadFromList(threadId) {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser || !currentUser.id) {
            showError('请先登录后再查看讯息');
            return;
        }
        
        currentThreadId = threadId;
        
        // 获取会话详情
        const response = await fetch(`/api/threads/${threadId}`);
        if (!response.ok) {
            throw new Error('获取会话详情失败');
        }
        
        const thread = await response.json();
        
        currentThread = {
            threadId,
            listing: {
                id: thread.listing_id,
                title: thread.listing_title,
                price: thread.listing_price,
                meetup_point: thread.listing_meetup_point || thread.meetup_point || '',
                category: thread.listing_category || 'other'
            },
            buyerId: thread.buyer_id,
            sellerId: thread.seller_id,
            buyerNickname: thread.buyer_nickname,
            sellerNickname: thread.seller_nickname
        };
        currentThreadId = threadId;
        
        // 更新对话框信息
        const dialogTitle = document.getElementById('messageDialogTitle');
        if (dialogTitle) {
            const sellerName = thread.seller_nickname || '卖家';
            dialogTitle.textContent = `与 ${sellerName} 的聊天`;
        }
        
        // 更新商品信息
        const productInfo = document.getElementById('messageProductInfo');
        if (productInfo) {
            productInfo.innerHTML = `
                <div class="message-product-card">
                    <div class="message-product-thumb">
                        ${(thread.listing_title || '').substring(0, 10)}
                    </div>
                    <div class="message-product-body">
                        <div class="message-product-title">${thread.listing_title}</div>
                        <div class="message-product-price">$${thread.listing_price}</div>
                        <div class="message-product-meta">📍 ${thread.listing_meetup_point || '推荐面交地点未设置'}</div>
                    </div>
                </div>
            `;
        }

        // 加载讯息
        await loadMessages(threadId);
        
        // 打开对话框
        openModal('messageDialog');
        
    } catch (error) {
        console.error('打开会话失败:', error);
        showError('打开会话失败');
    }
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
            const response = await fetch(`/api/listings/${listingId}`);
            if (!response.ok) {
                throw new Error('获取商品失败');
            }
            listing = await response.json();
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
 * 显示错误信息
 */
function showError(message) {
    alert('❌ ' + message);
}

// ===== 初始化 =====

/**
 * 初始化联系卖家功能
 */
function initContactSeller() {
    console.log('✓ 联系卖家功能已初始化');
    
    // 为讯息输入框添加Enter快捷键
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
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContactSeller);
} else {
    initContactSeller();
}
