/**
 * UI 工具模块
 * UI Utility Module - 负责渲染各种UI组件
 */

const UI = {
    // 渐变色列表
    gradients: [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
        'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
    ],
    
    /**
     * 渲染社区选择器
     */
    renderCommunities(communities, activeId) {
        const container = document.getElementById('communitySelector');
        if (!container) return;
        
        container.innerHTML = communities.map(c => `
            <button class="community-btn ${c.id === activeId ? 'active' : ''}" 
                    onclick="selectCommunity(${c.id})"
                    data-community="${c.id}">
                ${c.name}
            </button>
        `).join('');
    },
    
    /**
     * 渲染商品列表
     */
    renderListings(listings) {
        const container = document.getElementById('listingsContainer');
        if (!container) return;
        
        if (!listings || listings.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding:40px; color:#6b7280">
                    <div class="empty-state-icon">📦</div>
                    <div>暂无商品</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = listings.map((listing, i) => this.renderListingCard(listing, i)).join('');
    },
    
    /**
     * 渲染单个商品卡片
     */
    renderListingCard(listing, index) {
        const gradient = this.gradients[index % this.gradients.length];
        const verifyBadge = listing.user?.verify_status === 'email_verified' ? 'NYU认证' : '已认证';
        
        return `
            <div class="listing-card" onclick="showListingDetail(${listing.id})">
                <div class="listing-image" style="background: ${gradient}">
                    ${listing.title.substring(0, 20)}
                </div>
                <div class="listing-info">
                    <div class="listing-title">${listing.title}</div>
                    <div class="listing-price">$${listing.price}</div>
                    <div class="listing-meta">
                        <span class="user-badge">${verifyBadge}</span>
                        <span>📍 ${listing.meetup_point}</span>
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * 渲染商品详情
     */
    renderListingDetail(listing) {
        const verifyBadge = listing.user?.verify_status === 'email_verified' ? 'NYU认证' : '已认证';
        const courseCode = listing.course_code ? `
            <div style="margin-bottom: 15px;">
                <strong>课程代码：</strong> ${listing.course_code}
            </div>
        ` : '';
        
        return `
            <div style="margin-bottom: 15px;">
                <div class="listing-image" style="height: 200px; border-radius: 8px;">
                    ${listing.title}
                </div>
            </div>
            <h3 style="font-size: 18px; margin-bottom: 10px;">${listing.title}</h3>
            <div class="listing-price" style="margin-bottom: 15px;">$${listing.price}</div>
            <div style="margin-bottom: 15px;">
                <strong>物品描述：</strong>
                <p style="color: #6b7280; margin-top: 5px;">
                    ${listing.description || '九成新，仅使用一学期，无划痕和笔记。'}
                </p>
            </div>
            ${courseCode}
            <div style="margin-bottom: 15px;">
                <strong>面交地点：</strong> 📍 ${listing.meetup_point}
            </div>
            <div style="margin-bottom: 20px;">
                <strong>卖家：</strong> 
                <span class="user-badge">${verifyBadge}</span>
            </div>
            <button class="submit-btn" onclick="contactSeller(${listing.id})">
                💬 联系卖家
            </button>
            <button class="submit-btn secondary" onclick="reportListing(${listing.id})">
                🚩 举报
            </button>
        `;
    },
    
    /**
     * 渲染搜索结果
     */
    renderSearchResults(results, query) {
        if (!results || results.length === 0) {
            return `
                <div style="text-align:center; padding:40px; color:#6b7280">
                    <div class="empty-state-icon">🔍</div>
                    <div style="font-size: 16px; margin-bottom: 5px;">未找到"${query}"的相关结果</div>
                    <div style="font-size: 14px;">试试其他关键词吧</div>
                </div>
            `;
        }
        
        return results.map((listing, i) => {
            const gradient = this.gradients[i % this.gradients.length];
            const verifyBadge = listing.user?.verify_status === 'email_verified' ? 'NYU认证' : '已认证';
            
            return `
                <div style="display: flex; gap: 15px; padding: 15px; border-bottom: 1px solid #e5e5e5; 
                            cursor: pointer; transition: background 0.2s;" 
                     onclick="showListingDetailFromSearch(${listing.id})"
                     onmouseover="this.style.background='#f9fafb'" 
                     onmouseout="this.style.background='white'">
                    <div style="width: 80px; height: 80px; border-radius: 8px; background: ${gradient}; 
                                display: flex; align-items: center; justify-content: center; color: white; 
                                font-size: 12px; text-align: center; padding: 5px; flex-shrink: 0;">
                        ${listing.title.substring(0, 15)}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 500; margin-bottom: 5px; overflow: hidden; 
                                    text-overflow: ellipsis; white-space: nowrap;">
                            ${listing.title}
                        </div>
                        <div style="color: #dc2626; font-size: 16px; font-weight: bold; margin-bottom: 5px;">
                            $${listing.price}
                        </div>
                        <div style="display: flex; gap: 10px; font-size: 12px; color: #6b7280;">
                            <span class="user-badge">${verifyBadge}</span>
                            <span>📍 ${listing.meetup_point}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    /**
     * 渲染热门搜索标签
     */
    renderPopularTags(tags) {
        return tags.map(tag => 
            `<div class="search-tag" onclick="searchByTag('${tag}')">${tag}</div>`
        ).join('');
    },
    
    /**
     * 渲染搜索历史
     */
    renderSearchHistory(history) {
        if (!history || history.length === 0) {
            return '<div style="color: #6b7280; font-size: 14px;">暂无搜索历史</div>';
        }
        
        return history.map(term => `
            <div class="search-tag">
                ${term}
                <span onclick="event.stopPropagation(); removeFromHistory('${term.replace(/'/g, "\\'")}')}" 
                      style="margin-left: 5px; cursor: pointer; opacity: 0.6;">×</span>
            </div>
        `).join('');
    },
    
    /**
     * 显示加载状态
     */
    showLoading(containerId, message = '加载中...') {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="loading">${message}</div>
            `;
        }
    },
    
    /**
     * 显示空状态
     */
    showEmpty(containerId, icon = '📦', message = '暂无数据') {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">${icon}</div>
                    <div>${message}</div>
                </div>
            `;
        }
    },
    
    /**
     * 显示错误信息
     */
    showError(message) {
        alert(message);
    },
    
    /**
     * 显示成功信息
     */
    showSuccess(message) {
        alert(message);
    }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UI;
}