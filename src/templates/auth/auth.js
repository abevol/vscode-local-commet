const vscode = acquireVsCodeApi();
        
function switchTab(tabName) {
    // 现在只有一个标签页，不需要切换逻辑
}

function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = 'message ' + type;
    element.style.display = 'block';
}

function hideMessage(elementId) {
    document.getElementById(elementId).style.display = 'none';
}

function showLoading(elementId) {
    document.getElementById(elementId).style.display = 'block';
}

function hideLoading(elementId) {
    document.getElementById(elementId).style.display = 'none';
}

// 登录表单处理
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    hideMessage('login-message');
    showLoading('login-loading');
    
    vscode.postMessage({
        command: 'login',
        credentials: { username, password }
    });
});

// 监听来自扩展的消息
window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
        case 'loginResult':
            hideLoading('login-loading');
            if (message.success) {
                showMessage('login-message', message.message, 'success');
            } else {
                showMessage('login-message', message.message, 'error');
            }
            break;
    }
}); 