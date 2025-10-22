/**
 * API 工具模块
 * API Utility Module
 */

const API = {
    baseURL: '/api',
    
    /**
     * 通用请求方法
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API请求失败:', error);
            throw error;
        }
    },
    
    /**
     * GET 请求
     */
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    },
    
    /**
     * POST 请求
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    /**
     * PUT 请求
     */
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    
    /**
     * DELETE 请求
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },
    
    // ===== 社区相关 =====
    async getCommunities() {
        return this.get('/communities');
    },
    
    async getCommunity(id) {
        return this.get(`/communities/${id}`);
    },
    
    // ===== 商品相关 =====
    async getListings(params = {}) {
        return this.get('/listings', params);
    },
    
    async getListing(id) {
        return this.get(`/listings/${id}`);
    },
    
    async createListing(data) {
        return this.post('/listings', data);
    },
    
    async updateListing(id, data) {
        return this.put(`/listings/${id}`, data);
    },
    
    async searchListings(query, params = {}) {
        return this.get('/listings/search', { q: query, ...params });
    },
    
    // ===== 用户相关 =====
    async getUser(id) {
        return this.get(`/users/${id}`);
    },
    
    async createUser(data) {
        return this.post('/users', data);
    },
    
    async verifyUser(id, status) {
        return this.post(`/users/${id}/verify`, { status });
    },
    
    // ===== 消息相关 =====
    async getThreads(userId) {
        return this.get(`/threads/${userId}`);
    },
    
    async createThread(data) {
        return this.post('/threads', data);
    },
    
    async getMessages(threadId) {
        return this.get(`/threads/${threadId}/messages`);
    },
    
    async sendMessage(data) {
        return this.post('/messages', data);
    },
    
    async getUnreadCount(userId) {
        return this.get(`/messages/${userId}/unread-count`);
    },
    
    // ===== 举报相关 =====
    async createReport(data) {
        return this.post('/reports', data);
    },
    
    async getReports() {
        return this.get('/reports');
    },
    
    // ===== 评价相关 =====
    async createReview(data) {
        return this.post('/reviews', data);
    },
    
    async getUserReviews(userId) {
        return this.get(`/users/${userId}/reviews`);
    },
    
    async getRatingStats(userId) {
        return this.get(`/users/${userId}/rating-stats`);
    },
    
    // ===== 统计相关 =====
    async getDashboardStats() {
        return this.get('/stats/dashboard');
    },
    
    async getCategoryStats() {
        return this.get('/stats/categories');
    }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}