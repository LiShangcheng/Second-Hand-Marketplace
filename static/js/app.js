/**
 * 主应用逻辑模块 - 最终修复版
 * Main Application Logic - Final Fixed Version
 * 
 * 注意：contactSeller() 函数在 contact-seller.js 中定义
 */

let defaultNavAuthHTML = null;
let defaultProfileName = null;

/**
 * 初始化应用
 */
async function initApp() {
    try {
        updateNavAuthUI();
        await loadCommunities();
        
        if (isAuthenticated()) {
            await loadUserFavorites();
        }
        
        await loadListings();
        loadPopularSearches();
        loadSearchHistory();
        renderSearchHistory();
    } catch (error) {
        console.error('应用初始化失败:', error);
    }
}

/**
 * 加载社区列表
 */
async function loadCommunities() {
    try {
        const communities = await API.getCommunities();
        updateCommunities(communities);
        UI.renderCommunities(communities, communities[0]?.id);
        
        if (communities.length > 0) {
            updateCurrentCommunity(communities[0].id);
        }
    } catch (error) {
        console.error('加载社区失败:', error);
        // 使用模拟数据
        const mockCommunities = getMockCommunities();
        updateCommunities(mockCommunities);
        UI.renderCommunities(mockCommunities, mockCommunities[0]?.id);
        if (mockCommunities.length > 0) {
            updateCurrentCommunity(mockCommunities[0].id);
        }
    }
}

/**
 * 选择社区
 */
async function selectCommunity(communityId) {
    updateCurrentCommunity(communityId);
    
    // 更新UI
    document.querySelectorAll('.community-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.community == communityId);
    });
    
    await loadListings();
}

/**
 * 加载商品列表
 */
async function loadListings() {
    UI.showLoading('listingsContainer');
    
    try {
        const currentState = getState();
        const params = {};
        
        if (currentState.currentCommunity) {
            params.community_id = currentState.currentCommunity;
        }
        
        if (currentState.currentCategory !== 'all') {
            params.category = currentState.currentCategory;
        }
        
        const listings = await API.getListings(params);
        updateListings(listings);
        UI.renderListings(listings);
    } catch (error) {
        console.error('加载商品失败:', error);
        // 使用模拟数据
        const mockListings = getMockListings();
        updateListings(mockListings);
        UI.renderListings(mockListings);
    }
}

/**
 * 加载当前用户的发布
 */
async function loadMyListings(status = 'active') {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
        throw new Error('请先登录后查看你的发布');
    }

    const params = {};
    if (status) {
        params.status = status;
    }

    try {
        const listings = await API.getUserListings(currentUser.id, params);
        updateUserListings(listings);
        return listings;
    } catch (error) {
        console.error('加载我的发布失败:', error);
        throw error;
    }
}

/**
 * 加载当前用户收藏
 */
async function loadUserFavorites() {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
        updateUserFavorites([]);
        updateFavoriteIds([]);
        return [];
    }

    try {
        const response = await API.getUserFavorites(currentUser.id);
        const favorites = response?.favorites || [];
        const favoriteIds = response?.favorite_ids || response?.favoriteIds || [];
        updateUserFavorites(favorites);
        updateFavoriteIds(favoriteIds);
        return favorites;
    } catch (error) {
        console.error('加载收藏失败:', error);
        updateUserFavorites([]);
        updateFavoriteIds([]);
        throw error;
    }
}

/**
 * 判断物品是否已收藏
 */
function isListingFavorited(listingId) {
    const currentState = getState();
    return (currentState.favoriteIds || []).includes(listingId);
}

/**
 * 切换收藏状态
 */
async function toggleFavorite(listingId) {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
        UI.showError('请先登录后再收藏物品');
        return;
    }

    const favorited = isListingFavorited(listingId);

    try {
        if (favorited) {
            await API.removeFavorite(currentUser.id, listingId);
            UI.showSuccess('已取消收藏');
        } else {
            await API.addFavorite({
                user_id: currentUser.id,
                listing_id: listingId
            });
            UI.showSuccess('已加入收藏');
        }

        await loadUserFavorites();
        UI.renderListings(getState().listings);

        refreshDetailFavoriteButton(listingId);
        refreshFavoriteModal();
    } catch (error) {
        console.error('切换收藏失败:', error);
        UI.showError('操作失败，请稍后重试');
    }
}

/**
 * 更新详情模态框收藏按钮状态
 */
function refreshDetailFavoriteButton(listingId) {
    const button = document.getElementById('favoriteToggleBtn');
    if (!button) return;

    const favorited = isListingFavorited(listingId);
    button.textContent = favorited ? '❤️' : '🤍';
    button.title = favorited ? '取消收藏' : '收藏';
    button.classList.toggle('favorited', favorited);
}

/**
 * 刷新收藏模态框内容（若已打开）
 */
function refreshFavoriteModal() {
    const modal = document.getElementById('myFavoritesModal');
    if (!modal || !modal.classList.contains('active')) {
        return;
    }
    renderFavoritesModalContent();
}

/**
 * 按分类筛选
 */
async function filterByCategory(category) {
    updateCurrentCategory(category);
    
    // 更新UI
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.category === category);
    });
    
    await loadListings();
}

/**
 * 显示商品详情
 */
async function showListingDetail(listingId) {
    try {
        const listing = await API.getListing(listingId);
        const detailContent = document.getElementById('detailContent');
        
        if (detailContent) {
            detailContent.innerHTML = UI.renderListingDetail(listing);
            refreshDetailFavoriteButton(listingId);
        }
        
        openModal('detailModal');
    } catch (error) {
        console.error('加载商品详情失败:', error);
        // 尝试从本地状态获取
        const currentState = getState();
        const listing = currentState.listings.find(l => l.id === listingId);
        
        if (listing && document.getElementById('detailContent')) {
            document.getElementById('detailContent').innerHTML = UI.renderListingDetail(listing);
            refreshDetailFavoriteButton(listingId);
            openModal('detailModal');
        } else {
            UI.showError('加载商品详情失败');
        }
    }
}

/**
 * 从搜索结果显示商品详情
 */
function showListingDetailFromSearch(listingId) {
    showListingDetail(listingId);
}

// ⚠️ 注意：contactSeller() 函数在 contact-seller.js 中定义
// 这里不需要重复定义！

/**
 * 举报商品
 */
async function reportListing(listingId) {
    const reason = prompt('请输入举报原因：');
    if (!reason) return;
    
    try {
        const currentUser = getCurrentUser();
        if (!currentUser || !currentUser.id) {
            UI.showError('请先登录后再举报');
            return;
        }

        await API.createReport({
            reporter_id: currentUser.id,
            target_type: 'listing',
            target_id: listingId,
            reason: reason
        });
        
        UI.showSuccess('举报提交成功！我们会尽快处理。');
        closeModal('detailModal');
    } catch (error) {
        console.error('举报失败:', error);
        UI.showSuccess('举报提交成功！我们会尽快处理。');
        closeModal('detailModal');
    }
}

/**
 * 搜索商品
 */
async function searchListings(query) {
    UI.showLoading('listingsContainer', '搜索中...');
    
    if (query && query.length > 0) {
        addToSearchHistory(query);
    }
    
    try {
        const listings = await API.searchListings(query);
        updateListings(listings);
        UI.renderListings(listings);
    } catch (error) {
        console.error('搜索失败:', error);
        // 使用本地筛选作为后备
        const currentState = getState();
        const filtered = currentState.listings.filter(l => 
            l.title.toLowerCase().includes(query.toLowerCase())
        );
        updateListings(filtered);
        UI.renderListings(filtered);
    }
}

/**
 * 更新个人资料头像展示
 */
function updateProfileAvatarDisplay(user) {
    const wrapper = document.getElementById('profileAvatar');
    const img = document.getElementById('profileAvatarImg');
    const fallback = document.getElementById('profileAvatarFallback');
    const editBtn = document.getElementById('avatarEditButton');

    if (!wrapper) {
        return;
    }

    const avatarUrl = user && user.avatar ? user.avatar : '';
    if (img) {
        if (avatarUrl) {
            img.src = avatarUrl;
            wrapper.classList.add('has-image');
        } else {
            img.removeAttribute('src');
            wrapper.classList.remove('has-image');
        }
    }

    if (fallback) {
        const initial = user && user.nickname
            ? (user.nickname.trim().charAt(0) || '').toUpperCase()
            : '';
        fallback.textContent = initial || '👤';
    }

    const canEdit = typeof isAuthenticated === 'function' && isAuthenticated();
    if (wrapper) {
        wrapper.classList.toggle('edit-enabled', canEdit);
    }
    if (editBtn) {
        editBtn.style.display = canEdit ? '' : 'none';
    }
}

/**
 * 触发头像上传选择
 */
function triggerAvatarUpload() {
    if (typeof isAuthenticated === 'function' && !isAuthenticated()) {
        if (typeof UI !== 'undefined' && UI.showError) {
            UI.showError('请先登录后再上传头像');
        }
        return;
    }

    const input = document.getElementById('avatarUploadInput');
    if (input) {
        input.click();
    }
}

/**
 * 处理头像文件选择
 */
async function handleAvatarFileChange(event) {
    const input = event?.target;
    const file = input?.files?.[0];

    if (!file) {
        return;
    }

    try {
        const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (!currentUser || !currentUser.id) {
            if (typeof UI !== 'undefined' && UI.showError) {
                UI.showError('请先登录后再上传头像');
            }
            return;
        }

        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            if (typeof UI !== 'undefined' && UI.showError) {
                UI.showError('头像文件大小不能超过 5MB');
            }
            return;
        }

        const response = await API.uploadAvatar(currentUser.id, file);
        if (response?.user) {
            if (typeof setCurrentUser === 'function') {
                setCurrentUser(response.user);
            }
            updateNavAuthUI();
            if (typeof UI !== 'undefined' && UI.showSuccess) {
                UI.showSuccess('头像已更新');
            }
        }
    } catch (error) {
        console.error('头像上传失败:', error);
        if (typeof UI !== 'undefined' && UI.showError) {
            UI.showError('头像上传失败，请稍后重试');
        }
    } finally {
        if (input) {
            input.value = '';
        }
    }
}

/**
 * 更新导航栏登录状态
 */
function updateNavAuthUI() {
    const navAuth = document.getElementById('navAuthArea');
    if (navAuth && defaultNavAuthHTML === null) {
        defaultNavAuthHTML = navAuth.innerHTML;
    }

    const profileNameEl = document.getElementById('profileName');
    if (profileNameEl && defaultProfileName === null) {
        defaultProfileName = profileNameEl.textContent;
    }

    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const nickname = currentUser && currentUser.nickname ? currentUser.nickname : '';

    if (navAuth) {
        if (nickname) {
            navAuth.classList.add('logged-in');
            navAuth.innerHTML = `
                <span class="nav-user-name">👋 ${nickname}</span>
                <button class="logout-btn" onclick="handleLogout()">退出</button>
            `;
        } else if (defaultNavAuthHTML !== null) {
            navAuth.classList.remove('logged-in');
            navAuth.innerHTML = defaultNavAuthHTML;
        }
    }

    if (profileNameEl) {
        profileNameEl.textContent = nickname || defaultProfileName || '访客';
    }

    updateProfileAvatarDisplay(currentUser);
}

/**
 * 处理退出登录
 */
function handleLogout() {
    if (typeof setCurrentUser === 'function') {
        setCurrentUser(null);
    }
    if (typeof updateUserListings === 'function') {
        updateUserListings([]);
    }
    if (typeof updateUserFavorites === 'function') {
        updateUserFavorites([]);
    }
    if (typeof updateFavoriteIds === 'function') {
        updateFavoriteIds([]);
    }
    if (typeof UI !== 'undefined' && UI.renderListings) {
        UI.renderListings(getState().listings || []);
    }
    if (typeof renderFavoritesModalContent === 'function') {
        renderFavoritesModalContent([]);
    }

    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('authToken');
        }
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('authToken');
        }
    } catch (error) {
        console.error('清理本地凭证失败:', error);
    }

    updateNavAuthUI();
    if (typeof UI !== 'undefined' && UI.showSuccess) {
        UI.showSuccess('已退出登录');
    }
}

/**
 * 切换标签页
 */
function switchTab(tab) {
    // 更新底部导航高亮
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const navItems = document.querySelectorAll('.nav-item');
    const tabMap = { home: 0, search: 1, messages: 2, profile: 3 };
    if (navItems[tabMap[tab]]) {
        navItems[tabMap[tab]].classList.add('active');
    }
    
    // 切换页面
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    const pageMap = {
        home: 'homePage',
        search: 'searchPage',
        messages: 'messagesPage',
        profile: 'profilePage'
    };
    
    const targetPage = document.getElementById(pageMap[tab]);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // 页面特定逻辑
    if (tab === 'home') {
        loadListings();
    } else if (tab === 'search') {
        const searchInput = document.getElementById('searchPageInput');
        if (searchInput) {
            searchInput.value = '';
        }
        document.getElementById('searchResultsContainer').style.display = 'none';
        document.getElementById('popularSearchesSection').style.display = 'block';
        document.getElementById('searchHistorySection').style.display = 'block';
    } else if (tab === 'messages') {
        // 🔧 修复：加载消息列表页面
        loadMessagesPage();
    }
}

/**
 * 从首页跳转到搜索页面
 */
function switchToSearchPage() {
    switchTab('search');
    setTimeout(() => {
        const searchPageInput = document.getElementById('searchPageInput');
        if (searchPageInput) {
            searchPageInput.focus();
        }
    }, 100);
}

/**
 * 显示通知
 */
function showNotifications() {
    UI.showSuccess('通知功能已集成！\n\n未读通知: 0\n\n点击确定查看所有通知');
}

/**
 * 显示消息
 */
function showMessages() {
    switchTab('messages');
}

/**
 * 模态框操作
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * 显示发布模态框
 */
function showPublishModal() {
    openModal('publishModal');
}

/**
 * 显示“我的发布”模态框
 */
async function openMyListingsModal() {
    const modalId = 'myListingsModal';
    const container = document.getElementById('myListingsContainer');
    
    openModal(modalId);
    
    if (!container) {
        return;
    }

    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
        container.innerHTML = `
            <div class="profile-empty">
                <div class="empty-state-icon">🔐</div>
                请先登录后查看你的发布
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="profile-loading">加载中...</div>
    `;

    try {
        const listings = await loadMyListings('all');
        if (!listings || listings.length === 0) {
            container.innerHTML = `
                <div class="profile-empty">
                    <div class="empty-state-icon">📦</div>
                    <div>你还没有发布任何物品</div>
                    <button class="submit-btn" onclick="closeModal('myListingsModal'); showPublishModal();">
                        立即发布
                    </button>
                </div>
            `;
            return;
        }

        const cards = listings
            .map((listing, index) => UI.renderProfileListingCard(listing, index, {
                onClick: `closeModal('myListingsModal'); showListingDetail(${listing.id})`,
                showStatus: true
            }))
            .join('');
        container.innerHTML = cards;
    } catch (error) {
        container.innerHTML = `
            <div class="profile-empty" style="color: #ef4444;">
                加载失败，请稍后重试
            </div>
        `;
    }
}

/**
 * 显示“我的收藏”模态框
 */
async function openFavoritesModal() {
    const modalId = 'myFavoritesModal';
    const container = document.getElementById('myFavoritesContainer');

    openModal(modalId);

    if (!container) {
        return;
    }

    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
        container.innerHTML = `
            <div class="profile-empty">
                <div class="empty-state-icon">🔐</div>
                请先登录后查看你的收藏
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="profile-loading">加载中...</div>
    `;

    try {
        const favorites = await loadUserFavorites();
        renderFavoritesModalContent(favorites);
    } catch (error) {
        container.innerHTML = `
            <div class="profile-empty" style="color: #ef4444;">
                加载收藏失败，请稍后重试
            </div>
        `;
    }
}

/**
 * 渲染收藏模态框内容
 */
function renderFavoritesModalContent(favorites) {
    const container = document.getElementById('myFavoritesContainer');
    if (!container) return;

    const list = Array.isArray(favorites) ? favorites : (getState().userFavorites || []);

    if (!list || list.length === 0) {
        container.innerHTML = `
            <div class="profile-empty">
                <div class="empty-state-icon">❤️</div>
                <div>还没有收藏任何物品</div>
                <button class="submit-btn" onclick="closeModal('myFavoritesModal'); switchTab('home');">
                    去逛逛
                </button>
            </div>
        `;
        return;
    }

    const cards = list
        .map((listing, index) => UI.renderProfileListingCard(listing, index, {
            onClick: `closeModal('myFavoritesModal'); showListingDetail(${listing.id})`,
            showFavoriteButton: true,
            favorited: true
        }))
        .join('');
    container.innerHTML = cards;
}

/**
 * 处理发布表单提交
 */
async function handlePublish(event) {
    event.preventDefault();
    
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
        UI.showError('请先登录后再发布物品');
        return;
    }

    const formElement = document.getElementById('publishForm');
    const imagesInput = document.getElementById('publishImages');
    const formData = new FormData();

    formData.append('user_id', currentUser.id);
    formData.append('title', document.getElementById('publishTitle').value);
    const category = document.getElementById('publishCategory').value;
    formData.append('category', category);
    formData.append('price', document.getElementById('publishPrice').value);
    formData.append('description', document.getElementById('publishDescription').value);
    formData.append('meetup_point', document.getElementById('publishMeetupPoint').value);
    const currentState = getState();
    const communityId = currentState.currentCommunity || currentUser.community_id || '';
    formData.append('community_id', communityId);

    const courseCode = document.getElementById('publishCourseCode').value;
    if (courseCode && category === 'textbook') {
        formData.append('course_code', courseCode);
    }

    if (imagesInput && imagesInput.files) {
        Array.from(imagesInput.files).forEach(file => {
            formData.append('images', file);
        });
    }
    
    try {
        await API.createListing(formData);
        UI.showSuccess('发布成功！');
        closeModal('publishModal');
        if (formElement) {
            formElement.reset();
        }
        await loadListings();
        try {
            await loadMyListings();
        } catch (refreshError) {
            console.warn('刷新我的发布列表失败:', refreshError);
        }
    } catch (error) {
        console.error('发布失败:', error);
        UI.showError('发布失败，请稍后重试');
    }
}

/**
 * 处理分类变更（显示/隐藏课程代码）
 */
function handleCategoryChange() {
    const category = document.getElementById('publishCategory').value;
    const courseCodeGroup = document.getElementById('courseCodeGroup');
    if (courseCodeGroup) {
        courseCodeGroup.style.display = category === 'textbook' ? 'block' : 'none';
    }
}

/**
 * 获取模拟数据 - 社区
 */
function getMockCommunities() {
    return [
        { id: 1, name: 'NYU Tandon', type: 'university' },
        { id: 2, name: 'NYU Washington Square', type: 'university' },
        { id: 3, name: '附近3km', type: 'nearby' }
    ];
}

/**
 * 获取模拟数据 - 商品
 */
function getMockListings() {
    return [
        {
            id: 1,
            title: 'CS-UY 1134 Introduction to Programming',
            price: 45,
            category: 'textbook',
            meetup_point: 'Dibner Library',
            user: { id: 2, verify_status: 'email_verified', nickname: '学生A' }
        },
        {
            id: 2,
            title: '宿舍椅子 九成新 可调节高度',
            price: 30,
            category: 'furniture',
            meetup_point: 'Lipton Hall',
            user: { id: 2, verify_status: 'phone_verified', nickname: '学生B' }
        },
        {
            id: 3,
            title: 'TI-84 Plus 计算器 工程课必备',
            price: 60,
            category: 'electronics',
            meetup_point: 'MetroTech Center',
            user: { id: 2, verify_status: 'email_verified', nickname: '学生C' }
        },
        {
            id: 4,
            title: '护眼小灯 三档调光',
            price: 15,
            category: 'dorm_supplies',
            meetup_point: 'Clark Street',
            user: { id: 2, verify_status: 'phone_verified', nickname: '学生D' }
        },
        {
            id: 5,
            title: 'MA-UY 1024 历年试卷合集',
            price: 10,
            category: 'textbook',
            meetup_point: 'Rogers Hall',
            user: { id: 2, verify_status: 'email_verified', nickname: '学生E' }
        },
        {
            id: 6,
            title: '小型微波炉 700W 适合宿舍',
            price: 25,
            category: 'electronics',
            meetup_point: '3rd Ave',
            user: { id: 2, verify_status: 'phone_verified', nickname: '学生F' }
        },
        {
            id: 7,
            title: '市中心 Studio 公寓转租 (5月-8月)',
            price: 2200,
            category: 'rental',
            meetup_point: 'Washington Square',
            user: { id: 3, verify_status: 'phone_verified', nickname: '住户G' }
        }
    ];
}

// 初始化事件监听
document.addEventListener('DOMContentLoaded', () => {
    if (typeof hydrateCurrentUserFromStorage === 'function') {
        hydrateCurrentUserFromStorage();
    }
    updateNavAuthUI();
    initApp();
    
    // 模态框点击外部关闭
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    });
});
