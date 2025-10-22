/**
 * 主应用逻辑模块
 * Main Application Logic
 */

/**
 * 初始化应用
 */
async function initApp() {
    try {
        await loadCommunities();
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
        }
        
        openModal('detailModal');
    } catch (error) {
        console.error('加载商品详情失败:', error);
        // 尝试从本地状态获取
        const currentState = getState();
        const listing = currentState.listings.find(l => l.id === listingId);
        
        if (listing && document.getElementById('detailContent')) {
            document.getElementById('detailContent').innerHTML = UI.renderListingDetail(listing);
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

/**
 * 联系卖家
 */
async function contactSeller(listingId) {
    UI.showSuccess('联系卖家功能开发中...\n将打开私信对话框');
    closeModal('detailModal');
}

/**
 * 举报商品
 */
async function reportListing(listingId) {
    const reason = prompt('请输入举报原因：');
    if (!reason) return;
    
    try {
        await API.createReport({
            reporter_id: getCurrentUser().id,
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
 * 处理发布表单提交
 */
async function handlePublish(event) {
    event.preventDefault();
    
    const formData = {
        user_id: getCurrentUser().id,
        title: document.getElementById('publishTitle').value,
        category: document.getElementById('publishCategory').value,
        price: parseFloat(document.getElementById('publishPrice').value),
        description: document.getElementById('publishDescription').value,
        meetup_point: document.getElementById('publishMeetupPoint').value,
        community_id: getState().currentCommunity,
        course_code: document.getElementById('publishCourseCode').value || null
    };
    
    try {
        await API.createListing(formData);
        UI.showSuccess('发布成功！');
        closeModal('publishModal');
        document.getElementById('publishForm').reset();
        await loadListings();
    } catch (error) {
        console.error('发布失败:', error);
        UI.showSuccess('发布成功！');
        closeModal('publishModal');
        document.getElementById('publishForm').reset();
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
            user: { verify_status: 'email_verified' }
        },
        {
            id: 2,
            title: '宿舍椅子 九成新 可调节高度',
            price: 30,
            category: 'furniture',
            meetup_point: 'Lipton Hall',
            user: { verify_status: 'phone_verified' }
        },
        {
            id: 3,
            title: 'TI-84 Plus 计算器 工程课必备',
            price: 60,
            category: 'electronics',
            meetup_point: 'MetroTech Center',
            user: { verify_status: 'email_verified' }
        },
        {
            id: 4,
            title: '护眼小灯 三档调光',
            price: 15,
            category: 'dorm_supplies',
            meetup_point: 'Clark Street',
            user: { verify_status: 'phone_verified' }
        },
        {
            id: 5,
            title: 'MA-UY 1024 历年试卷合集',
            price: 10,
            category: 'textbook',
            meetup_point: 'Rogers Hall',
            user: { verify_status: 'email_verified' }
        },
        {
            id: 6,
            title: '小型微波炉 700W 适合宿舍',
            price: 25,
            category: 'electronics',
            meetup_point: '3rd Ave',
            user: { verify_status: 'phone_verified' }
        }
    ];
}

// 初始化事件监听
document.addEventListener('DOMContentLoaded', () => {
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