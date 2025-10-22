/**
 * 搜索功能模块
 * Search Functionality Module
 */

let searchTimeout = null;

/**
 * 加载热门搜索
 */
async function loadPopularSearches() {
    const tags = [
        'CS-UY 1134', 'MA-UY 1024', '计算器', '椅子', 'Python',
        '微波炉', 'iPad', '台灯', '数据结构', '显示器'
    ];
    
    const container = document.getElementById('popularTags');
    if (container) {
        container.innerHTML = UI.renderPopularTags(tags);
    }
}

/**
 * 通过标签搜索
 */
function searchByTag(tag) {
    const searchInput = document.getElementById('searchPageInput');
    if (searchInput) {
        searchInput.value = tag;
    }
    
    addToSearchHistory(tag);
    handleSearchPageInput({ target: { value: tag } });
}

/**
 * 处理搜索页面输入
 */
function handleSearchPageInput(event) {
    clearTimeout(searchTimeout);
    const query = event.target.value.trim();
    
    if (query.length === 0) {
        document.getElementById('searchResultsContainer').style.display = 'none';
        document.getElementById('popularSearchesSection').style.display = 'block';
        document.getElementById('searchHistorySection').style.display = 'block';
        return;
    }
    
    searchTimeout = setTimeout(async () => {
        await searchInSearchPage(query);
    }, 500);
}

/**
 * 在搜索页面执行搜索
 */
async function searchInSearchPage(query) {
    // 隐藏热门搜索和历史
    document.getElementById('popularSearchesSection').style.display = 'none';
    document.getElementById('searchHistorySection').style.display = 'none';
    
    // 显示结果容器
    const container = document.getElementById('searchResultsContainer');
    const resultsList = document.getElementById('searchResultsList');
    
    container.style.display = 'block';
    resultsList.innerHTML = '<div class="loading">搜索中...</div>';
    
    try {
        const results = await API.searchListings(query);
        resultsList.innerHTML = UI.renderSearchResults(results, query);
    } catch (error) {
        console.error('搜索失败:', error);
        // 使用本地筛选
        const currentState = getState();
        const filtered = currentState.listings.filter(l => 
            l.title.toLowerCase().includes(query.toLowerCase())
        );
        resultsList.innerHTML = UI.renderSearchResults(filtered, query);
    }
}

/**
 * 渲染搜索历史
 */
function renderSearchHistory() {
    loadSearchHistory();
    const currentState = getState();
    const container = document.getElementById('historyTags');
    
    if (container) {
        container.innerHTML = UI.renderSearchHistory(currentState.searchHistory);
    }
}

/**
 * 从历史中移除
 */
function removeFromHistory(term) {
    const currentState = getState();
    currentState.searchHistory = currentState.searchHistory.filter(item => item !== term);
    
    try {
        localStorage.setItem('searchHistory', JSON.stringify(currentState.searchHistory));
    } catch (error) {
        console.error('删除搜索历史失败:', error);
    }
    
    renderSearchHistory();
}

/**
 * 清空搜索历史
 */
function clearSearchHistory() {
    clearSearchHistoryState();
    renderSearchHistory();
}