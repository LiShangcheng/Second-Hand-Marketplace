/**
 * 增强版搜索功能模块
 * 支持实时建议、搜索历史、热门搜索
 */

class SearchModule {
    constructor() {
        this.searchTimeout = null;
        this.currentQuery = '';
        this.searchHistory = [];
        this.popularSearches = [];
        this.isSearching = false;
        
        this.init();
    }
    
    init() {
        this.loadPopularSearches();
        this.loadSearchHistory();
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            // 实时搜索
            searchInput.addEventListener('input', (e) => {
                this.handleSearchInput(e.target.value);
            });
            
            // 回车搜索
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.executeSearch(e.target.value);
                }
            });
            
            // 焦点事件 - 显示建议
            searchInput.addEventListener('focus', () => {
                this.showSuggestions();
            });
        }
    }
    
    handleSearchInput(query) {
        clearTimeout(this.searchTimeout);
        
        this.currentQuery = query.trim();
        
        if (this.currentQuery.length === 0) {
            this.hideSuggestions();
            this.loadDefaultListings();
            return;
        }
        
        // 显示搜索建议
        if (this.currentQuery.length >= 2) {
            this.searchTimeout = setTimeout(() => {
                this.loadSuggestions(this.currentQuery);
            }, 300);
        }
        
        // 延迟执行搜索
        this.searchTimeout = setTimeout(() => {
            this.executeSearch(this.currentQuery);
        }, 800);
    }
    
    async executeSearch(query) {
        if (!query || query.trim().length === 0) {
            return;
        }
        
        this.isSearching = true;
        this.updateSearchUI(true);
        
        try {
            const filters = this.getCurrentFilters();
            const params = new URLSearchParams({
                q: query,
                ...filters
            });
            
            const response = await fetch(`/api/search?${params}`);
            const data = await response.json();
            
            if (data.success) {
                this.displaySearchResults(data.results, query);
                this.addToSearchHistory(query);
            } else {
                this.showError('搜索失败，请重试');
            }
        } catch (error) {
            console.error('搜索错误:', error);
            this.showError('网络错误，请检查连接');
        } finally {
            this.isSearching = false;
            this.updateSearchUI(false);
        }
    }
    
    getCurrentFilters() {
        const filters = {};
        
        // 获取当前选中的分类
        const activeCategory = document.querySelector('.filter-chip.active');
        if (activeCategory && activeCategory.dataset.category !== 'all') {
            filters.category = activeCategory.dataset.category;
        }
        
        // 获取当前选中的社区
        const activeCommunity = document.querySelector('.community-btn.active');
        if (activeCommunity) {
            filters.community_id = activeCommunity.dataset.community;
        }
        
        // 默认排序方式
        filters.sort_by = 'relevance';
        filters.limit = 20;
        
        return filters;
    }
    
    async loadSuggestions(query) {
        try {
            const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}&limit=5`);
            const suggestions = await response.json();
            
            this.displaySuggestions(suggestions);
        } catch (error) {
            console.error('加载建议失败:', error);
        }
    }
    
    displaySuggestions(suggestions) {
        let suggestionBox = document.getElementById('searchSuggestions');
        
        if (!suggestionBox) {
            suggestionBox = document.createElement('div');
            suggestionBox.id = 'searchSuggestions';
            suggestionBox.className = 'search-suggestions';
            document.querySelector('.search-bar').appendChild(suggestionBox);
        }
        
        if (suggestions.length === 0) {
            suggestionBox.style.display = 'none';
            return;
        }
        
        suggestionBox.innerHTML = suggestions.map(s => `
            <div class="suggestion-item" onclick="searchModule.selectSuggestion('${s.text.replace(/'/g, "\\'")}')">
                <span class="suggestion-icon">${this.getSuggestionIcon(s.type)}</span>
                <span class="suggestion-text">${this.highlightMatch(s.display, this.currentQuery)}</span>
            </div>
        `).join('');
        
        suggestionBox.style.display = 'block';
    }
    
    getSuggestionIcon(type) {
        switch(type) {
            case 'course_code': return '📚';
            case 'title': return '🔍';
            case 'category': return '📂';
            default: return '💡';
        }
    }
    
    highlightMatch(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<strong>$1</strong>');
    }
    
    selectSuggestion(text) {
        document.getElementById('searchInput').value = text;
        this.hideSuggestions();
        this.executeSearch(text);
    }
    
    showSuggestions() {
        const suggestionBox = document.getElementById('searchSuggestions');
        if (suggestionBox && suggestionBox.children.length > 0) {
            suggestionBox.style.display = 'block';
        }
    }
    
    hideSuggestions() {
        const suggestionBox = document.getElementById('searchSuggestions');
        if (suggestionBox) {
            suggestionBox.style.display = 'none';
        }
    }
    
    async loadPopularSearches() {
        try {
            const response = await fetch('/api/search/popular?limit=10');
            this.popularSearches = await response.json();
            this.displayPopularSearches();
        } catch (error) {
            console.error('加载热门搜索失败:', error);
            // 使用默认数据
            this.popularSearches = [
                {keyword: 'CS-UY 1134', count: 45},
                {keyword: 'MA-UY 1024', count: 38},
                {keyword: '计算器', count: 32},
                {keyword: '椅子', count: 28},
                {keyword: 'Python', count: 25}
            ];
            this.displayPopularSearches();
        }
    }
    
    displayPopularSearches() {
        const container = document.getElementById('popularTags');
        if (!container) return;
        
        container.innerHTML = this.popularSearches.map(item => `
            <div class="search-tag" onclick="searchModule.searchByTag('${item.keyword}')">
                <span class="tag-text">${item.keyword}</span>
                <span class="tag-count">${item.count}</span>
            </div>
        `).join('');
    }
    
    async loadSearchHistory() {
        try {
            const response = await fetch('/api/search/history?limit=10');
            if (response.ok) {
                this.searchHistory = await response.json();
                this.displaySearchHistory();
            }
        } catch (error) {
            console.error('加载搜索历史失败:', error);
        }
    }
    
    displaySearchHistory() {
        const container = document.getElementById('historyTags');
        if (!container) return;
        
        if (this.searchHistory.length === 0) {
            container.innerHTML = '<div style="color: #6b7280; font-size: 14px;">暂无搜索历史</div>';
            return;
        }
        
        container.innerHTML = this.searchHistory.map(query => `
            <div class="search-tag history-tag">
                <span onclick="searchModule.searchByTag('${query}')">${query}</span>
                <span class="remove-history" onclick="searchModule.removeFromHistory('${query}')">×</span>
            </div>
        `).join('') + `
            <div class="search-tag clear-all" onclick="searchModule.clearAllHistory()">
                清空历史
            </div>
        `;
    }
    
    addToSearchHistory(query) {
        if (!this.searchHistory.includes(query)) {
            this.searchHistory.unshift(query);
            this.searchHistory = this.searchHistory.slice(0, 10);
            this.displaySearchHistory();
        }
    }
    
    removeFromHistory(query) {
        this.searchHistory = this.searchHistory.filter(q => q !== query);
        this.displaySearchHistory();
    }
    
    async clearAllHistory() {
        try {
            await fetch('/api/search/history', { method: 'DELETE' });
            this.searchHistory = [];
            this.displaySearchHistory();
        } catch (error) {
            console.error('清除历史失败:', error);
        }
    }
    
    searchByTag(keyword) {
        document.getElementById('searchInput').value = keyword;
        switchTab('home');
        this.executeSearch(keyword);
    }
    
    displaySearchResults(results, query) {
        const container = document.getElementById('listingsContainer');
        
        if (results.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding:40px; color:#6b7280">
                    <div style="font-size: 48px; margin-bottom: 10px;">🔍</div>
                    <div style="font-size: 16px; margin-bottom: 5px;">未找到"${query}"的相关结果</div>
                    <div style="font-size: 14px;">试试其他关键词吧</div>
                </div>
            `;
            return;
        }
        
        // 显示结果统计
        this.showSearchStats(query, results.length);
        
        // 渲染商品列表
        const gradients = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
            'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
        ];
        
        container.innerHTML = results.map((listing, i) => `
            <div class="listing-card" onclick="showListingDetail(${listing.id})">
                <div class="listing-image" style="background: ${gradients[i % gradients.length]}">
                    ${listing.title.substring(0, 20)}
                </div>
                <div class="listing-info">
                    <div class="listing-title">${this.highlightMatch(listing.title, query)}</div>
                    <div class="listing-price">$${listing.price}</div>
                    <div class="listing-meta">
                        <span class="user-badge">${listing.user?.verify_status === 'email_verified' ? 'NYU认证' : '已认证'}</span>
                        <span>📍 ${listing.meetup_point}</span>
                    </div>
                    ${listing.relevance_score ? `<div class="relevance-badge">匹配度: ${listing.relevance_score}</div>` : ''}
                </div>
            </div>
        `).join('');
    }
    
    showSearchStats(query, count) {
        // 创建或更新搜索结果统计
        let statsBar = document.getElementById('searchStatsBar');
        
        if (!statsBar) {
            statsBar = document.createElement('div');
            statsBar.id = 'searchStatsBar';
            statsBar.className = 'search-stats-bar';
            const filterBar = document.querySelector('.filter-bar');
            filterBar.parentNode.insertBefore(statsBar, filterBar.nextSibling);
        }
        
        statsBar.innerHTML = `
            <div class="search-stats-content">
                <span>搜索"${query}"找到 <strong>${count}</strong> 个结果</span>
                <button class="clear-search" onclick="searchModule.clearSearch()">×</button>
            </div>
        `;
        statsBar.style.display = 'block';
    }
    
    clearSearch() {
        document.getElementById('searchInput').value = '';
        const statsBar = document.getElementById('searchStatsBar');
        if (statsBar) {
            statsBar.style.display = 'none';
        }
        this.loadDefaultListings();
    }
    
    loadDefaultListings() {
        // 重新加载默认商品列表
        if (typeof loadListings === 'function') {
            loadListings();
        }
    }
    
    updateSearchUI(isSearching) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.disabled = isSearching;
            searchInput.placeholder = isSearching ? '搜索中...' : '搜索课程代码、物品名称...';
        }
    }
    
    showError(message) {
        // 简单的错误提示
        alert(message);
    }
}

// 全局搜索模块实例
let searchModule;

// 在页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    searchModule = new SearchModule();
});

// 添加必要的CSS样式
const searchStyles = `
<style>
    .search-suggestions {
        position: absolute;
        top: 100%;
        left: 20px;
        right: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        margin-top: 5px;
        z-index: 100;
        max-height: 300px;
        overflow-y: auto;
        display: none;
    }
    
    .suggestion-item {
        padding: 12px 15px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        border-bottom: 1px solid #f3f4f6;
        transition: background 0.2s;
    }
    
    .suggestion-item:hover {
        background: #f9fafb;
    }
    
    .suggestion-item:last-child {
        border-bottom: none;
    }
    
    .suggestion-icon {
        font-size: 18px;
    }
    
    .suggestion-text {
        flex: 1;
        font-size: 14px;
    }
    
    .suggestion-text strong {
        color: #5b21b6;
        font-weight: 600;
    }
    
    .search-stats-bar {
        background: #ede9fe;
        padding: 10px 20px;
        border-bottom: 1px solid #e5e5e5;
        display: none;
    }
    
    .search-stats-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 14px;
        color: #5b21b6;
    }
    
    .clear-search {
        background: none;
        border: none;
        font-size: 20px;
        color: #6b7280;
        cursor: pointer;
        padding: 0 5px;
    }
    
    .search-tag {
        display: flex;
        align-items: center;
        gap: 5px;
        position: relative;
    }
    
    .tag-count {
        background: #5b21b6;
        color: white;
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 10px;
    }
    
    .history-tag {
        background: #f3f4f6;
    }
    
    .remove-history {
        margin-left: 5px;
        color: #6b7280;
        cursor: pointer;
        font-size: 18px;
        font-weight: bold;
    }
    
    .remove-history:hover {
        color: #ef4444;
    }
    
    .clear-all {
        background: #fee2e2 !important;
        color: #dc2626 !important;
        cursor: pointer;
    }
    
    .relevance-badge {
        font-size: 11px;
        color: #5b21b6;
        background: #ede9fe;
        padding: 2px 8px;
        border-radius: 10px;
        display: inline-block;
        margin-top: 5px;
    }
    
    .search-bar {
        position: relative;
    }
</style>
`;

// 将样式添加到页面
document.head.insertAdjacentHTML('beforeend', searchStyles);
