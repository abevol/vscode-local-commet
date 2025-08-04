// VS Code WebView API
const vscode = acquireVsCodeApi();

// 常量定义
const ANIMATION_DELAY = 800; // 按钮状态动画延迟时间（毫秒）

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

// 获取共享注释元素
const fetchSharedCommentsEl = document.getElementById('fetch-shared-comments');
const fetchSharedBtn = document.getElementById('fetch-shared-btn');
const fetchSharedStatusEl = document.getElementById('fetch-shared-status');

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

// 头像上传相关元素
const avatarContainerEl = document.querySelector('.avatar-container');
const avatarUploadModalEl = document.getElementById('avatar-upload-modal');
const uploadAreaEl = document.getElementById('upload-area');
const uploadPlaceholderEl = document.getElementById('upload-placeholder');
const previewContainerEl = document.getElementById('preview-container');
const previewImageEl = document.getElementById('preview-image');
const avatarFileInputEl = document.getElementById('avatar-file-input');
const uploadConfirmBtn = document.getElementById('upload-confirm-btn');
const uploadCancelBtn = document.getElementById('upload-cancel-btn');

// 文件上传状态
let selectedFile = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    requestUserInfo();
    setupEventListeners();
    
    // 测试预览功能
    testPreviewFunction();
});

// 测试预览功能
function testPreviewFunction() {
    console.log('测试预览功能...');
    console.log('预览容器元素:', previewContainerEl);
    console.log('预览图片元素:', previewImageEl);
    console.log('上传占位符元素:', uploadPlaceholderEl);
    
    // 检查元素是否存在
    if (!previewContainerEl) {
        console.error('预览容器元素不存在');
    }
    if (!previewImageEl) {
        console.error('预览图片元素不存在');
    }
    if (!uploadPlaceholderEl) {
        console.error('上传占位符元素不存在');
    }
    
    // 测试预览显示
    if (previewContainerEl && uploadPlaceholderEl) {
        console.log('测试预览显示...');
        uploadPlaceholderEl.style.display = 'none';
        previewContainerEl.style.display = 'flex';
        console.log('预览容器应该已显示');
    }
}

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
    
    // 获取共享注释按钮事件
    fetchSharedBtn.addEventListener('click', () => {
        vscode.postMessage({
            command: 'fetchSharedComments'
        });
    });
    
    // 头像上传相关事件
    avatarContainerEl.addEventListener('click', () => {
        showAvatarUploadModal();
    });
    
    uploadAreaEl.addEventListener('click', () => {
        avatarFileInputEl.click();
    });
    
    avatarFileInputEl.addEventListener('change', handleFileSelect);
    
    uploadConfirmBtn.addEventListener('click', handleAvatarUpload);
    uploadCancelBtn.addEventListener('click', hideAvatarUploadModal);
    
    // 拖拽上传功能
    uploadAreaEl.addEventListener('dragover', handleDragOver);
    uploadAreaEl.addEventListener('dragleave', handleDragLeave);
    uploadAreaEl.addEventListener('drop', handleDrop);
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
function showProjectsList(projects, associatedProjectId) {
    projectsLoadingEl.style.display = 'none';
    projectsListEl.style.display = 'block';
    projectsEmptyEl.style.display = 'none';
    projectsErrorEl.style.display = 'none';
    
    populateProjectsList(projects, associatedProjectId);
    
    // 如果有已关联的项目，显示获取共享注释按钮
    if (associatedProjectId) {
        fetchSharedCommentsEl.style.display = 'block';
    } else {
        fetchSharedCommentsEl.style.display = 'none';
    }
}

// 显示项目为空
function showProjectsEmpty() {
    projectsLoadingEl.style.display = 'none';
    projectsListEl.style.display = 'none';
    projectsEmptyEl.style.display = 'block';
    projectsErrorEl.style.display = 'none';
    fetchSharedCommentsEl.style.display = 'none';
}

// 显示项目错误
function showProjectsError(message) {
    projectsLoadingEl.style.display = 'none';
    projectsListEl.style.display = 'none';
    projectsEmptyEl.style.display = 'none';
    projectsErrorEl.style.display = 'block';
    projectsErrorTextEl.textContent = message || '加载项目失败';
    fetchSharedCommentsEl.style.display = 'none';
}

// 显示获取共享注释的状态
function showFetchSharedStatus(show) {
    if (show) {
        fetchSharedBtn.style.display = 'none';
        fetchSharedStatusEl.style.display = 'flex';
    } else {
        fetchSharedBtn.style.display = 'block';
        fetchSharedStatusEl.style.display = 'none';
    }
}

// 填充项目列表
function populateProjectsList(projects, associatedProjectId) {
    if (!projects || projects.length === 0) {
        showProjectsEmpty();
        return;
    }
    
    projectsListEl.innerHTML = '';
    
    projects.forEach(project => {
        const projectItem = document.createElement('div');
        projectItem.className = 'project-item';
        
        // 检查这个项目是否已经关联（转换为字符串进行比较，避免类型不匹配）
        const isAssociated = String(associatedProjectId) === String(project.id);
        const buttonText = isAssociated ? '已关联' : '关联';
        const buttonClass = isAssociated ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm';
        const buttonDisabled = isAssociated ? '' : '';
        
        // 为已关联的项目添加高亮类
        if (isAssociated) {
            projectItem.classList.add('associated');
        }
        
        projectItem.innerHTML = `
            <div class="project-info-wrapper">
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
            </div>
            <div class="project-actions">
                <button class="${buttonClass}" data-project-id="${project.id}" data-associated="${isAssociated}" ${buttonDisabled}>${buttonText}</button>
            </div>
        `;
        
        projectsListEl.appendChild(projectItem);
    });

    // 为所有关联按钮添加事件监听
    const associateButtons = projectsListEl.querySelectorAll('.btn[data-project-id]');
    associateButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation(); // 防止触发 project-item 的点击事件
            const projectId = button.dataset.projectId;
            const isAssociated = button.dataset.associated === 'true';
            
            if (isAssociated) {
                // 取消关联
                button.textContent = '取消关联中...';
                button.disabled = true;
                
                vscode.postMessage({
                    command: 'disassociateProject',
                    projectId: projectId
                });
            } else {
                // 关联项目
                button.textContent = '关联中...';
                button.disabled = true;
                
                vscode.postMessage({
                    command: 'associateProject',
                    projectId: projectId
                });
            }
        });
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
                showProjectsList(message.data, message.associatedProjectId);
            } else {
                showProjectsError(message.message || '获取项目列表失败');
            }
            break;
        case 'associateProjectResult':
            const btn = document.querySelector(`.btn[data-project-id="${message.projectId}"]`);
            if (btn) {
                const projectItem = btn.closest('.project-item');
                if (message.success) {
                    // 添加短暂延迟，改善用户体验
                    setTimeout(() => {
                        btn.textContent = '已关联';
                        btn.disabled = false;
                        btn.dataset.associated = 'true';
                        btn.className = 'btn btn-secondary btn-sm';
                        // 添加高亮显示类
                        if (projectItem) {
                            projectItem.classList.add('associated');
                        }
                        // 显示获取共享注释按钮
                        fetchSharedCommentsEl.style.display = 'block';
                    }, 300);
                } else {
                    btn.textContent = '关联';
                    btn.disabled = false;
                    btn.dataset.associated = 'false';
                    btn.className = 'btn btn-primary btn-sm';
                    // 移除高亮显示类
                    if (projectItem) {
                        projectItem.classList.remove('associated');
                    }
                    // 隐藏获取共享注释按钮
                    fetchSharedCommentsEl.style.display = 'none';
                    // 显示错误信息（如果有的话）
                    if (message.message) {
                        console.error('关联失败:', message.message);
                    }
                }
            }
            break;
        case 'disassociateProjectResult':
            const disassociateBtn = document.querySelector(`.btn[data-project-id="${message.projectId}"]`);
            if (disassociateBtn) {
                if (message.success) {
                    disassociateBtn.textContent = '关联';
                    disassociateBtn.disabled = false;
                    disassociateBtn.dataset.associated = 'false';
                    disassociateBtn.className = 'btn btn-primary btn-sm';
                    // 移除高亮显示类
                    const projectItem = disassociateBtn.closest('.project-item');
                    if (projectItem) {
                        projectItem.classList.remove('associated');
                    }
                    // 隐藏获取共享注释按钮
                    fetchSharedCommentsEl.style.display = 'none';
                } else {
                    disassociateBtn.textContent = '已关联';
                    disassociateBtn.disabled = false;
                    disassociateBtn.dataset.associated = 'true';
                    disassociateBtn.className = 'btn btn-secondary btn-sm';
                    // 显示错误信息（如果有的话）
                    if (message.message) {
                        console.error('取消关联失败:', message.message);
                    }
                }
            }
            break;
        case 'fetchSharedCommentsResult':
            // 处理获取共享注释的结果
            showFetchSharedStatus(false);
            if (message.success) {
                // 显示成功消息
                console.log(message.message || '获取共享注释成功');
                
                // 如果有返回数据，可以进一步处理
                if (message.data && Array.isArray(message.data)) {
                    console.log('获取到的共享注释:', message.data);
                    // 这里可以添加处理共享注释的逻辑
                    // 例如：更新UI显示共享注释数量等
                }
            } else {
                // 显示错误消息
                console.error('获取共享注释失败: ' + (message.message || '未知错误'));
            }
            break;
        case 'logoutResult':
            if (message.success) {
                // 退出登录成功，关闭面板
                window.close();
            } else {
                // 退出登录失败，重置按钮状态
                resetLogoutButton();
                console.error('退出登录失败: ' + message.message);
            }
            break;
        case 'uploadAvatarResult':
            // 重置上传按钮状态
            uploadConfirmBtn.disabled = false;
            uploadConfirmBtn.textContent = '确定上传';
            
            if (message.success) {
                // 上传成功，关闭模态框并刷新用户信息
                hideAvatarUploadModal();
                console.log('头像上传成功！');
                requestUserInfo(); // 刷新用户信息以显示新头像
            } else {
                // 上传失败，显示错误信息
                console.error('头像上传失败: ' + (message.message || '未知错误'));
            }
            break;
    }
});

// 头像上传相关函数
function showAvatarUploadModal() {
    avatarUploadModalEl.style.display = 'flex';
    resetUploadState();
}

function hideAvatarUploadModal() {
    avatarUploadModalEl.style.display = 'none';
    resetUploadState();
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        validateAndPreviewFile(file);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    uploadAreaEl.classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    uploadAreaEl.classList.remove('dragover');
}

function handleDrop(event) {
    event.preventDefault();
    uploadAreaEl.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        validateAndPreviewFile(files[0]);
    }
}

function validateAndPreviewFile(file) {
    console.log('开始验证文件:', {
        name: file.name,
        type: file.type,
        size: file.size
    });
    
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
        console.error('请选择图片文件');
        return;
    }
    
    // 验证文件大小（2MB）
    if (file.size > 2 * 1024 * 1024) {
        console.error('文件大小不能超过2MB');
        return;
    }
    
    selectedFile = file;
    
    // 预览图片
    const reader = new FileReader();
    reader.onload = function(e) {
        console.log('文件读取成功，开始预览');
        console.log('预览容器元素:', previewContainerEl);
        console.log('预览图片元素:', previewImageEl);
        console.log('上传占位符元素:', uploadPlaceholderEl);
        
        try {
            // 设置图片源
            previewImageEl.src = e.target.result;
            console.log('图片源设置完成:', e.target.result.substring(0, 50) + '...');
            
            // 确保预览容器显示
            if (previewContainerEl) {
                previewContainerEl.style.display = 'flex';
                console.log('预览容器已显示');
            }
            
            // 隐藏占位符
            if (uploadPlaceholderEl) {
                uploadPlaceholderEl.style.display = 'none';
                console.log('占位符已隐藏');
            }
            
            // 启用上传按钮
            uploadConfirmBtn.disabled = false;
            
            console.log('预览功能完成');
            
        } catch (error) {
            console.error('预览过程中出错:', error);
            console.error('预览失败，请重新选择图片');
            resetUploadState();
        }
    };
    
    reader.onerror = function() {
        console.error('文件读取失败');
        console.error('文件读取失败，请重新选择图片');
        resetUploadState();
    };
    
    reader.readAsDataURL(selectedFile);
}

// 修改上传处理函数，使用原始图片
function handleAvatarUpload() {
    if (!selectedFile) {
        console.error('请先选择图片');
        return;
    }
    
    // 显示上传中状态
    uploadConfirmBtn.disabled = true;
    uploadConfirmBtn.textContent = '上传中...';
    
    try {
        // 将文件转换为base64数据
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Data = e.target.result;
            
            // 发送上传请求到扩展
            vscode.postMessage({
                command: 'uploadAvatar',
                data: {
                    fileName: selectedFile.name,
                    fileType: selectedFile.type,
                    fileSize: selectedFile.size,
                    base64Data: base64Data
                }
            });
        };
        
        reader.onerror = function() {
            console.error('文件读取失败');
            uploadConfirmBtn.disabled = false;
            uploadConfirmBtn.textContent = '确定上传';
        };
        
        reader.readAsDataURL(selectedFile);
        
    } catch (error) {
        console.error('图片处理失败:', error);
        uploadConfirmBtn.disabled = false;
        uploadConfirmBtn.textContent = '确定上传';
    }
}

// 修改重置函数，移除裁剪状态重置
function resetUploadState() {
    selectedFile = null;
    
    // 重置UI状态
    if (uploadPlaceholderEl) {
        uploadPlaceholderEl.style.display = 'flex';
    }
    if (previewContainerEl) {
        previewContainerEl.style.display = 'none';
    }
    if (uploadConfirmBtn) {
        uploadConfirmBtn.disabled = true;
        uploadConfirmBtn.textContent = '确定上传';
    }
} 