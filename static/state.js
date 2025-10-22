/**
 * 状态管理模块
 * State Management Module
 */

const state = {
    currentCommunity: null,
    currentCategory: 'all',
    listings: [],
    communities: [],
    currentUser: {
        id: 1,
        nickname: '测试用户',
        verify_status: 'email_verified'
    },
    searchHistory: []
};

const API_BASE_URL = '/api';

/**
 * 更新当前社区
 */
function updateCurrentCommunity(communityId) {
    state.currentCommunity = communityId;
}

/**
 * 更新当前分类
 */
function updateCurrentCategory(category) {
    state.currentCategory = category;
}

/**
 * 更新商品列表
 */
function updateListings(listings) {
    state.listings = listings;
}

/**
 * 更新社区列表
 */
function updateCommunities(communities) {
    state.communities = communities;
}

/**
 * 获取当前状态
 */
function getState() {
    return state;
}

/**
 * 获取当前用户
 */
function getCurrentUser() {
    return state.currentUser;
}

/**
 * 添加到搜索历史
 */
function addToSearchHistory(query) {
    if (!query || query.trim().length === 0) return;
    
    state.searchHistory = state.searchHistory.filter(item => item !== query);
    state.searchHistory.unshift(query);
    state.searchHistory = state.searchHistory.slice(0, 10);
    
    // 持久化到 localStorage
    try {
        localStorage.setItem('searchHistory', JSON.stringify(state.searchHistory));
    } catch (error) {
        console.error('保存搜索历史失败:', error);
    }
}

/**
 * 加载搜索历史
 */
function loadSearchHistory() {
    try {
        const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
        state.searchHistory = history;
    } catch (error) {
        console.error('加载搜索历史失败:', error);
        state.searchHistory = [];
    }
}

/**
 * 清空搜索历史
 */
function clearSearchHistoryState() {
    state.searchHistory = [];
    try {
        localStorage.removeItem('searchHistory');
    } catch (error) {
        console.error('清空搜索历史失败:', error);
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        state,
        updateCurrentCommunity,
        updateCurrentCategory,
        updateListings,
        updateCommunities,
        getState,
        getCurrentUser,
        addToSearchHistory,
        loadSearchHistory,
        clearSearchHistoryState
    };
}