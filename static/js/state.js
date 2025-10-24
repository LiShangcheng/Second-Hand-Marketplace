/**
 * 状态管理模块
 * State Management Module
 */

const state = {
    currentCommunity: null,
    currentCategory: 'all',
    listings: [],
    communities: [],
    currentUser: null,
    searchHistory: [],
    userListings: [],
    userFavorites: [],
    favoriteIds: []
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
 * 更新当前用户的发布列表
 */
function updateUserListings(listings) {
    state.userListings = listings;
}

/**
 * 更新用户收藏列表
 */
function updateUserFavorites(favorites) {
    state.userFavorites = favorites;
}

/**
 * 更新收藏的物品ID集合
 */
function updateFavoriteIds(ids) {
    state.favoriteIds = Array.isArray(ids) ? ids : [];
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
 * 判断是否已登录
 */
function isAuthenticated() {
    return !!(state.currentUser && state.currentUser.id);
}

/**
 * 设置当前用户
 */
function setCurrentUser(user) {
    state.currentUser = user || null;

    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        try {
            if (user) {
                localStorage.setItem('currentUser', JSON.stringify(user));
            } else {
                localStorage.removeItem('currentUser');
            }
        } catch (error) {
            console.error('保存用户信息失败:', error);
        }
    }
}

/**
 * 从本地存储加载当前用户
 */
function hydrateCurrentUserFromStorage() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return;
    }

    try {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            state.currentUser = JSON.parse(storedUser);
        } else {
            state.currentUser = null;
        }
    } catch (error) {
        console.error('加载用户信息失败:', error);
        state.currentUser = null;
    }
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
        updateUserListings,
        updateUserFavorites,
        updateFavoriteIds,
        updateCommunities,
        getState,
        getCurrentUser,
        isAuthenticated,
        setCurrentUser,
        hydrateCurrentUserFromStorage,
        addToSearchHistory,
        loadSearchHistory,
        clearSearchHistoryState
    };
}

if (typeof window !== 'undefined') {
    hydrateCurrentUserFromStorage();
}
