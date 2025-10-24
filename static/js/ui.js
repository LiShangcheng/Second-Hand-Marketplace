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
        const select = document.getElementById('communitySelector');
        if (!select) return;

        if (!communities || communities.length === 0) {
            select.innerHTML = '<option value="" selected>暂无地点</option>';
            select.disabled = true;
            return;
        }

        const options = communities.map(c => `
            <option value="${c.id}">${c.name}</option>
        `).join('');

        select.innerHTML = options;
        select.disabled = false;

        const targetValue = typeof activeId !== 'undefined' && activeId !== null
            ? String(activeId)
            : String(communities[0].id);

        select.value = targetValue;
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
        const verifyBadge = listing.user?.verify_status === 'email_verified' ? '已认证用户' : '普通用户';
        const favorited = typeof isListingFavorited === 'function' && isListingFavorited(listing.id);
        const favoriteIcon = favorited ? '❤️' : '🤍';
        const favoriteTitle = favorited ? '取消收藏' : '收藏';
        const hasImages = Array.isArray(listing.images) && listing.images.length > 0;
        const primaryImage = hasImages ? listing.images[0] : null;
        const safeTitle = (listing.title || '').replace(/"/g, '&quot;');
        const sellerNameRaw = (listing.user?.nickname || '卖家').toString();
        const safeSellerName = sellerNameRaw
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const meetupPoint = listing.meetup_point || '面交待定';
        const placeholder = `
            <div class="listing-placeholder" style="background: ${gradient};">
                ${(listing.title || '').substring(0, 20)}
            </div>
        `;
        const imageContent = primaryImage
            ? `<img src="${primaryImage}" alt="${safeTitle}" class="listing-photo" loading="lazy">`
            : placeholder;
        
        return `
            <div class="listing-card" onclick="showListingDetail(${listing.id})" style="position: relative;">
                <button 
                    class="favorite-inline-btn" 
                    onclick="event.stopPropagation(); toggleFavorite(${listing.id});" 
                    title="${favoriteTitle}"
                    style="
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        width: 36px;
                        height: 36px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: rgba(255, 255, 255, 0.95);
                        border: none;
                        border-radius: 50%;
                        font-size: 16px;
                        cursor: pointer;
                        box-shadow: 0 6px 16px rgba(0,0,0,0.12);
                    "
                >
                    ${favoriteIcon}
                </button>
                <div class="listing-image ${hasImages ? 'has-photo' : ''}">
                    ${imageContent}
                </div>
                <div class="listing-info">
                    <div class="listing-title">${listing.title}</div>
                    <div class="listing-price-row">
                        <div class="listing-price">$${listing.price}</div>
                        <span class="listing-verify">${verifyBadge}</span>
                    </div>
                    <div class="listing-meta">
                        <span class="seller-name">👤 ${safeSellerName}</span>
                        <span class="listing-location">📍 ${meetupPoint}</span>
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * 渲染个人中心列表卡片
     */
    renderProfileListingCard(listing, index, options = {}) {
        const escape = (value) => (value ?? '').toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const opts = options || {};
        const gradient = this.gradients[index % this.gradients.length];
        const plainTitle = (listing.title || '').toString();
        const hasImages = Array.isArray(listing.images) && listing.images.length > 0;
        const primaryImage = hasImages ? listing.images[0] : null;
        const safeTitle = escape(plainTitle || '未命名物品');
        const categoryKey = (listing.category || 'other').toString().toLowerCase();
        const categoryMap = {
            textbook: { icon: '📚', label: '教材' },
            furniture: { icon: '🪑', label: '家具' },
            electronics: { icon: '💻', label: '电子产品' },
            dorm_supplies: { icon: '🛏️', label: '宿舍用品' },
            rental: { icon: '🏢', label: '租房' },
            other: { icon: '🎯', label: '其他' }
        };
        const categoryInfo = categoryMap[categoryKey] || categoryMap.other;

        const priceNumber = Number(listing.price);
        const priceDisplay = Number.isFinite(priceNumber)
            ? `$${priceNumber % 1 === 0 ? priceNumber.toFixed(0) : priceNumber.toFixed(2)}`
            : escape(listing.price || '—');

        const meetupPoint = escape(listing.meetup_point || '面交待定');
        const sellerName = escape(
            listing.nickname ||
            listing.seller_nickname ||
            listing.user?.nickname ||
            ''
        );

        const verifyStatus = listing.user?.verify_status || listing.verify_status;
        let verifyLabel = null;
        if (verifyStatus === 'email_verified') {
            verifyLabel = '邮箱认证';
        } else if (verifyStatus === 'phone_verified') {
            verifyLabel = '手机号认证';
        } else if (verifyStatus === 'pending') {
            verifyLabel = '审核中';
        }

        const statusMap = {
            active: '上架中',
            sold: '已售出',
            hidden: '已隐藏',
            flagged: '需处理'
        };
        const statusKey = (listing.status || '').toString().toLowerCase();
        const statusLabel = opts.showStatus && statusKey
            ? statusMap[statusKey] || escape(listing.status)
            : null;

        const description = escape(listing.description || '');

        const placeholderText = escape(plainTitle.substring(0, 12));
        const thumbnail = hasImages
            ? `<div class="profile-listing-thumb"><img src="${primaryImage}" alt="${safeTitle}"></div>`
            : `<div class="profile-listing-thumb placeholder" style="background:${gradient};">
                    ${placeholderText}
               </div>`;

        const onClick = opts.onClick ? `onclick="${opts.onClick}"` : `onclick="showListingDetail(${listing.id})"`;
        const favoriteBtn = opts.showFavoriteButton ? `
            <button class="profile-favorite-btn ${opts.favorited ? 'favorited' : ''}"
                    onclick="event.stopPropagation(); toggleFavorite(${listing.id});"
                    title="${opts.favorited ? '取消收藏' : '收藏'}">
                ${opts.favorited ? '❤️' : '🤍'}
            </button>
        ` : '';

        const sellerMarkup = sellerName ? `<span class="profile-listing-seller">👤 ${sellerName}</span>` : '';
        const verifyMarkup = verifyLabel ? `<span class="profile-verify">${verifyLabel}</span>` : '';
        const descMarkup = description ? `<div class="profile-listing-desc">${description}</div>` : '';
        const statusMarkup = statusLabel ? `<span class="profile-listing-status status-${statusKey}">${statusLabel}</span>` : '';

        return `
            <div class="profile-listing-card" ${onClick}>
                ${favoriteBtn}
                ${thumbnail}
                <div class="profile-listing-body">
                    <div class="profile-listing-header">
                        <span class="profile-listing-title">${safeTitle}</span>
                        <div class="profile-price-status">
                            <span class="profile-listing-price">${priceDisplay}</span>
                            ${statusMarkup}
                        </div>
                    </div>
                    <div class="profile-listing-meta">
                        <span class="profile-listing-category">${categoryInfo.icon} ${categoryInfo.label}</span>
                        <span class="profile-listing-location">📍 ${meetupPoint}</span>
                        ${sellerMarkup}
                        ${verifyMarkup}
                    </div>
                    ${descMarkup}
                </div>
            </div>
        `;
    },
    
    /**
     * 渲染商品详情
     */
    renderListingDetail(listing) {
        const verifyBadge = listing.user?.verify_status === 'email_verified' ? '已认证用户' : '普通用户';
        const favorited = typeof isListingFavorited === 'function' && isListingFavorited(listing.id);
        const favoriteIcon = favorited ? '❤️' : '🤍';
        const favoriteTitle = favorited ? '取消收藏' : '收藏';
        const courseCode = listing.course_code ? `
            <div style="margin-bottom: 15px;">
                <strong>课程代码：</strong> ${listing.course_code}
            </div>
        ` : '';
        const hasImages = Array.isArray(listing.images) && listing.images.length > 0;
        const primaryImage = hasImages ? listing.images[0] : null;
        const safeTitle = (listing.title || '').replace(/"/g, '&quot;');
        const sellerNameRaw = (listing.user?.nickname || '卖家').toString();
        const safeSellerName = sellerNameRaw
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const meetupPoint = listing.meetup_point || '面交待定';
        const detailImage = hasImages
            ? `<img src="${primaryImage}" alt="${safeTitle}" class="listing-photo">`
            : `<div class="listing-placeholder" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    ${listing.title}
               </div>`;
        
        return `
            <div style="margin-bottom: 15px; position: relative;">
                <div class="listing-image ${hasImages ? 'has-photo' : ''}" style="height: 200px; border-radius: 12px;">
                    ${detailImage}
                </div>
                <button 
                    id="favoriteToggleBtn"
                    class="favorite-detail-btn ${favorited ? 'favorited' : ''}"
                    onclick="toggleFavorite(${listing.id})"
                    title="${favoriteTitle}"
                    style="
                        position: absolute;
                        top: 12px;
                        right: 12px;
                        width: 48px;
                        height: 48px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: rgba(255,255,255,0.96);
                        border: none;
                        border-radius: 50%;
                        font-size: 20px;
                        cursor: pointer;
                        box-shadow: 0 8px 20px rgba(0,0,0,0.15);
                        transition: transform 0.15s ease;
                    "
                >
                    ${favoriteIcon}
                </button>
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
                <strong>推荐面交地点：</strong> 📍 ${meetupPoint}
            </div>
            <div style="margin-bottom: 20px;">
                <strong>卖家：</strong> 
                <span class="user-badge">${verifyBadge}</span>
                <span class="seller-name detail">👤 ${safeSellerName}</span>
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
                <div class="empty-placeholder">
                    <div class="empty-state-icon">🔍</div>
                    <div style="font-size: 16px; margin-bottom: 8px;">未找到“${query}”的相关结果</div>
                    <div style="font-size: 14px;">尝试调整关键词或查看热门信号</div>
                </div>
            `;
        }
        
        const items = results.map((listing, i) => {
            const gradient = this.gradients[i % this.gradients.length];
            const verifyBadge = listing.user?.verify_status === 'email_verified' ? '已认证用户' : '普通用户';
            const hasImages = Array.isArray(listing.images) && listing.images.length > 0;
            const primaryImage = hasImages ? listing.images[0] : null;
            const safeTitle = (listing.title || '').replace(/"/g, '&quot;');
            const sellerNameRaw = (listing.user?.nickname || '卖家').toString();
            const safeSellerName = sellerNameRaw
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            const thumbnail = hasImages
                ? `<img src="${primaryImage}" alt="${safeTitle}" class="search-result-thumb">`
                : `<div class="search-result-thumb placeholder" style="background:${gradient};">
                        ${(listing.title || '').substring(0, 15)}
                   </div>`;
            const meetupPoint = listing.meetup_point || '面交待定';
            
            return `
                <div class="search-result-item" onclick="showListingDetailFromSearch(${listing.id})">
                    ${thumbnail}
                    <div class="search-result-body">
                        <div class="search-result-title">${listing.title}</div>
                        <div class="search-result-price">$${listing.price}</div>
                        <div class="search-result-meta">
                            <span class="user-badge">${verifyBadge}</span>
                            <span class="search-result-meta-item">👤 ${safeSellerName}</span>
                            <span class="search-result-meta-item">📍 ${meetupPoint}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        return `<div class="search-results-list">${items}</div>`;
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
        
        return history.map(term => {
            const safeAttr = term.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const safeLabel = term
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            return `
                <div class="search-tag" onclick="searchByTag('${safeAttr}')">
                    <span>${safeLabel}</span>
                    <span onclick="event.stopPropagation(); removeFromHistory('${safeAttr}')" 
                          style="margin-left: 6px; cursor: pointer; opacity: 0.6;">×</span>
                </div>
            `;
        }).join('');
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
