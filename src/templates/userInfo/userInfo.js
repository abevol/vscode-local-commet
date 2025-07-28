// VS Code WebView API
const vscode = acquireVsCodeApi();

// DOM元素
const loadingEl = document.getElementById('loading');
const userProfileEl = document.getElementById('user-profile');
const errorMessageEl = document.getElementById('error-message');
const errorTextEl = document.getElementById('error-text');

// 用户信息元素
const userAvatarEl = document.getElementById('user-avatar');
const avatarPlaceholderEl = document.getElementById('avatar-placeholder');
const avatarInitialEl = document.getElementById('avatar-initial');
const userNameEl = document.getElementById('user-name');
const userEmailEl = document.getElementById('user-email');
const userIdEl = document.getElementById('user-id');
const userCreatedAtEl = document.getElementById('user-created-at');
const userLastLoginEl = document.getElementById('user-last-login');

// 项目信息元素
const projectsLoadingEl = document.getElementById('projects-loading');
const projectsListEl = document.getElementById('projects-list');
const projectsEmptyEl = document.getElementById('projects-empty');
const projectsErrorEl = document.getElementById('projects-error');
const projectsErrorTextEl = document.getElementById('projects-error-text');
const retryProjectsBtn = document.getElementById('retry-projects-btn');

// 统计信息元素
const commentsCountEl = document.getElementById('comments-count');
const bookmarksCountEl = document.getElementById('bookmarks-count');
const tagsCountEl = document.getElementById('tags-count');

// 按钮元素
const refreshBtn = document.getElementById('refresh-btn');
const logoutBtn = document.getElementById('logout-btn');
const retryBtn = document.getElementById('retry-btn');

// 模态框元素
const confirmModalEl = document.getElementById('confirm-modal');
const modalTextEl = document.getElementById('modal-text');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    requestUserInfo();
    setupEventListeners();
});

// 设置事件监听器
function setupEventListeners() {
    
    refreshBtn.addEventListener('click', () => {
        requestUserInfo();
    });
    
    logoutBtn.addEventListener('click', () => {
        showConfirmModal(
            '确定要退出登录吗？',
            '退出登录',
            () => {
                // 显示退出登录中的状态
                logoutBtn.disabled = true;
                logoutBtn.textContent = '退出中...';
                
                vscode.postMessage({
                    command: 'logout'
                });
            }
        );
    });
    
    retryBtn.addEventListener('click', () => {
        requestUserInfo();
    });
    
    retryProjectsBtn.addEventListener('click', () => {
        requestProjects();
    });
}

// 请求用户信息
function requestUserInfo() {
    showLoading();
    vscode.postMessage({
        command: 'getUserInfo'
    });
}

// 请求项目列表
function requestProjects() {
    showProjectsLoading();
    vscode.postMessage({
        command: 'getProjects'
    });
}

// 显示加载状态
function showLoading() {
    loadingEl.style.display = 'block';
    userProfileEl.style.display = 'none';
    errorMessageEl.style.display = 'none';
}

// 显示用户信息
function showUserInfo(data) {
    loadingEl.style.display = 'none';
    userProfileEl.style.display = 'block';
    errorMessageEl.style.display = 'none';
    
    populateUserInfo(data.user);
    populateStats(data.stats);
    
    // 请求项目列表
    requestProjects();
}

// 显示错误信息
function showError(message) {
    loadingEl.style.display = 'none';
    userProfileEl.style.display = 'none';
    errorMessageEl.style.display = 'block';
    errorTextEl.textContent = message;
}

// 填充用户信息
function populateUserInfo(user) {
    if (!user) return;
    
    // 设置头像
    if (user.avatar) {
        userAvatarEl.src = user.avatar;
        userAvatarEl.style.display = 'block';
        avatarPlaceholderEl.style.display = 'none';
    } else {
        // 使用用户名首字母作为头像
        const initial = user.username ? user.username.charAt(0).toUpperCase() : '?';
        avatarInitialEl.textContent = initial;
        userAvatarEl.style.display = 'none';
        avatarPlaceholderEl.style.display = 'flex';
    }
    
    // 设置基本信息
    userNameEl.textContent = user.username || '未知用户';
    userEmailEl.textContent = user.email || '未设置邮箱';
    userIdEl.textContent = user.id || '--';
    
    // 格式化时间
    if (user.createdAt) {
        userCreatedAtEl.textContent = formatDate(user.createdAt);
    } else {
        userCreatedAtEl.textContent = '--';
    }
    
    if (user.lastLoginAt) {
        userLastLoginEl.textContent = formatDate(user.lastLoginAt);
    } else {
        userLastLoginEl.textContent = '--';
    }
}

// 显示项目加载状态
function showProjectsLoading() {
    projectsLoadingEl.style.display = 'flex';
    projectsListEl.style.display = 'none';
    projectsEmptyEl.style.display = 'none';
    projectsErrorEl.style.display = 'none';
}

// 显示项目列表
function showProjectsList(projects) {
    projectsLoadingEl.style.display = 'none';
    projectsListEl.style.display = 'block';
    projectsEmptyEl.style.display = 'none';
    projectsErrorEl.style.display = 'none';
    
    populateProjectsList(projects);
}

// 显示项目为空
function showProjectsEmpty() {
    projectsLoadingEl.style.display = 'none';
    projectsListEl.style.display = 'none';
    projectsEmptyEl.style.display = 'block';
    projectsErrorEl.style.display = 'none';
}

// 显示项目错误
function showProjectsError(message) {
    projectsLoadingEl.style.display = 'none';
    projectsListEl.style.display = 'none';
    projectsEmptyEl.style.display = 'none';
    projectsErrorEl.style.display = 'block';
    projectsErrorTextEl.textContent = message || '加载项目失败';
}

// 填充项目列表
function populateProjectsList(projects) {
    if (!projects || projects.length === 0) {
        showProjectsEmpty();
        return;
    }
    
    projectsListEl.innerHTML = '';
    
    projects.forEach(project => {
        const projectItem = document.createElement('div');
        projectItem.className = 'project-item';
        projectItem.onclick = () => {
            // 可以在这里添加项目点击事件
        };
        
        projectItem.innerHTML = `
            <div class="project-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 7V4C4 2.89543 4.89543 2 6 2H18C19.1046 2 20 2.89543 20 4V7" stroke="currentColor" stroke-width="2"/>
                    <path d="M4 7H20L19 21H5L4 7Z" stroke="currentColor" stroke-width="2"/>
                    <path d="M9 11V7" stroke="currentColor" stroke-width="2"/>
                    <path d="M15 11V7" stroke="currentColor" stroke-width="2"/>
                </svg>
            </div>
            <div class="project-details">
                <div class="project-name">${project.name || '未知项目'}</div>
                <div class="project-description">${project.description || '暂无描述'}</div>
                <div class="project-meta">
                    <span class="project-role ${project.role || 'member'}">${getRoleText(project.role)}</span>
                    ${project.memberCount ? `<span class="project-members">${project.memberCount} 个成员</span>` : ''}
                </div>
            </div>
        `;
        
        projectsListEl.appendChild(projectItem);
    });
}

// 获取角色文本
function getRoleText(role) {
    switch (role) {
        case 'owner':
            return '所有者';
        case 'admin':
            return '管理员';
        case 'member':
            return '成员';
        default:
            return '成员';
    }
}

// 填充统计信息
function populateStats(stats) {
    if (!stats) {
        commentsCountEl.textContent = '--';
        bookmarksCountEl.textContent = '--';
        tagsCountEl.textContent = '--';
        return;
    }
    
    commentsCountEl.textContent = stats.comments || '0';
    bookmarksCountEl.textContent = stats.bookmarks || '0';
    tagsCountEl.textContent = stats.tags || '0';
}

// 格式化日期
function formatDate(timestamp) {
    try {
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return '无效日期';
    }
}

// 显示确认模态框
function showConfirmModal(text, confirmText, onConfirm) {
    modalTextEl.textContent = text;
    modalConfirmBtn.textContent = confirmText;
    modalCancelBtn.textContent = '取消';
    confirmModalEl.style.display = 'flex';

    const confirmHandler = () => {
        onConfirm();
        hideConfirmModal();
    };

    const cancelHandler = () => {
        hideConfirmModal();
    };

    const hideConfirmModal = () => {
        confirmModalEl.style.display = 'none';
        modalConfirmBtn.removeEventListener('click', confirmHandler);
        modalCancelBtn.removeEventListener('click', cancelHandler);
    };

    modalConfirmBtn.addEventListener('click', confirmHandler, { once: true });
    modalCancelBtn.addEventListener('click', cancelHandler, { once: true });
}

// 重置退出登录按钮状态
function resetLogoutButton() {
    logoutBtn.disabled = false;
    logoutBtn.textContent = '退出登录';
}

// 监听来自扩展的消息
window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
        case 'userInfoResult':
            if (message.success) {
                showUserInfo(message.data);
            } else {
                showError(message.message || '获取用户信息失败');
            }
            break;
        case 'projectsResult':
            if (message.success) {
                showProjectsList(message.data);
            } else {
                showProjectsError(message.message || '获取项目列表失败');
            }
            break;
        case 'logoutResult':
            // 重置退出登录按钮状态
            resetLogoutButton();
            
            if (message.success) {
                // 关闭webview或返回登录界面
                vscode.postMessage({
                    command: 'close'
                });
            } else {
                // 显示退出登录失败的错误消息
                showError(message.message || '退出登录失败');
            }
            break;
    }
}); 