/**
 * Authentication page interactions (login & register flows)
 * Handles form submissions, step transitions, and feedback to the user.
 */

const toastEl = document.getElementById('toast');

function showToast(message, type = 'info') {
    if (!toastEl) return;

    toastEl.textContent = message;
    toastEl.className = `toast show ${type}`;

    setTimeout(() => {
        toastEl.classList.remove('show');
    }, 3000);
}

function toggleButtonLoading(button, loading) {
    if (!button) return;

    button.disabled = loading;
    const textEl = button.querySelector('.btn-text');
    const loadingEl = button.querySelector('.btn-loading');

    if (textEl) {
        textEl.style.display = loading ? 'none' : '';
    }
    if (loadingEl) {
        loadingEl.style.display = loading ? '' : 'none';
    }
}

function persistCurrentUser(user) {
    if (typeof setCurrentUser === 'function') {
        setCurrentUser(user);
        return;
    }

    try {
        localStorage.setItem('currentUser', JSON.stringify(user));
    } catch (error) {
        console.error('保存用户信息失败:', error);
    }
}

async function apiRequest(url, options = {}) {
    const defaults = {
        headers: { 'Content-Type': 'application/json' }
    };

    const response = await fetch(url, {
        ...defaults,
        ...options,
        headers: { ...defaults.headers, ...(options.headers || {}) }
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = data.error || data.message || `请求失败 (${response.status})`;
        throw new Error(message);
    }

    return data;
}

// ===== 登录处理 =====
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        toggleButtonLoading(submitBtn, true);

        const email = loginForm.email.value.trim();
        const password = loginForm.password.value;
        const remember = document.getElementById('rememberMe')?.checked;

        try {
            const result = await apiRequest('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            if (remember) {
                localStorage.setItem('authToken', result.token);
                sessionStorage.removeItem('authToken');
            } else {
                sessionStorage.setItem('authToken', result.token);
                localStorage.removeItem('authToken');
            }
            persistCurrentUser(result.user);
            if (typeof updateNavAuthUI === 'function') {
                updateNavAuthUI();
            }
            if (typeof loadUserFavorites === 'function') {
                try {
                    await loadUserFavorites();
                } catch (favError) {
                    console.warn('加载收藏失败:', favError);
                }
            }

            showToast('登录成功，正在跳转...', 'success');
            setTimeout(() => {
                window.location.href = '/';
            }, 800);
        } catch (error) {
            console.error('登录失败:', error);
            showToast(error.message, 'error');
        } finally {
            toggleButtonLoading(submitBtn, false);
        }
    });
}

// ===== 注册处理 =====
const registerForm = document.getElementById('registerForm');
const communitySelect = document.getElementById('registerCommunity');
const communityPreview = document.getElementById('communityPreview');

function updateCommunityPreview() {
    if (!communityPreview || !communitySelect) return;

    const value = communitySelect.value;
    const selectedOption = communitySelect.selectedOptions?.[0];

    if (value && selectedOption) {
        communityPreview.style.display = '';
        communityPreview.textContent = `已选择社区：${selectedOption.textContent.trim()}`;
    } else {
        communityPreview.style.display = 'none';
        communityPreview.textContent = '';
    }
}

function validateRegisterForm(form) {
    const nickname = form.nickname.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const confirm = form.passwordConfirm.value;
    const community = form.community_id.value;

    if (!nickname || !email || !password || !confirm) {
        throw new Error('请完整填写信息');
    }

    if (!community) {
        throw new Error('请选择你的社区');
    }

    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
        throw new Error('请输入有效的邮箱地址');
    }

    if (password.length < 8) {
        throw new Error('密码长度至少 8 位');
    }

    if (password !== confirm) {
        throw new Error('两次输入的密码不一致');
    }

    return {
        nickname,
        email,
        password,
        community_id: parseInt(community, 10)
    };
}

if (communitySelect) {
    communitySelect.addEventListener('change', () => {
        updateCommunityPreview();
    });
    updateCommunityPreview();
}

if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const submitBtn = registerForm.querySelector('button[type="submit"]');
        toggleButtonLoading(submitBtn, true);

        try {
            const payload = validateRegisterForm(registerForm);
            const result = await apiRequest('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            localStorage.setItem('authToken', result.token);
            sessionStorage.removeItem('authToken');
            persistCurrentUser(result.user);
            if (typeof updateNavAuthUI === 'function') {
                updateNavAuthUI();
            }
            if (typeof loadUserFavorites === 'function') {
                try {
                    await loadUserFavorites();
                } catch (favError) {
                    console.warn('加载收藏失败:', favError);
                }
            }

            showToast('注册成功，正在跳转...', 'success');
            setTimeout(() => {
                window.location.href = '/';
            }, 800);
        } catch (error) {
            console.error('注册失败:', error);
            showToast(error.message, 'error');
        } finally {
            toggleButtonLoading(submitBtn, false);
        }
    });

    updateCommunityPreview();
}

// ===== 其它交互 =====
const wechatLoginBtn = document.getElementById('wechatLoginBtn');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');

if (wechatLoginBtn) {
    wechatLoginBtn.addEventListener('click', () => {
        showToast('微信登录暂未开放，敬请期待', 'info');
    });
}

if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (event) => {
        event.preventDefault();
        showToast('请联系管理员重置密码', 'info');
    });
}
