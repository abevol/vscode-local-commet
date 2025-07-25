import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface UserInfo {
    id: string;
    username: string;
    email: string;
    avatar?: string;
    createdAt: number;
    lastLoginAt: number;
}

export interface LoginCredentials {
    username: string;
    password: string;
}

export interface AuthSession {
    token: string;
    user: UserInfo;
    expiresAt: number;
}

export class AuthManager {
    public context: vscode.ExtensionContext;
    private sessionFile: string;
    private currentSession: AuthSession | null = null;
    private isAuthenticated = false;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.sessionFile = path.join(context.globalStorageUri?.fsPath || context.extensionPath, 'auth-session.json');
        this.loadSession();
    }

    /**
     * 加载已保存的会话
     */
    private async loadSession(): Promise<void> {
        try {
            if (fs.existsSync(this.sessionFile)) {
                const data = fs.readFileSync(this.sessionFile, 'utf8');
                const session: AuthSession = JSON.parse(data);
                
                // 检查会话是否过期
                if (session.expiresAt > Date.now()) {
                    this.currentSession = session;
                    this.isAuthenticated = true;
                    console.log('已加载有效会话');
                } else {
                    // 会话过期，清除
                    this.clearSession();
                }
            }
        } catch (error) {
            console.error('加载会话失败:', error);
            this.clearSession();
        }
    }

    /**
     * 保存会话到本地
     */
    private async saveSession(session: AuthSession): Promise<void> {
        try {
            const storageDir = path.dirname(this.sessionFile);
            if (!fs.existsSync(storageDir)) {
                fs.mkdirSync(storageDir, { recursive: true });
            }
            fs.writeFileSync(this.sessionFile, JSON.stringify(session, null, 2));
        } catch (error) {
            console.error('保存会话失败:', error);
        }
    }

    /**
     * 清除会话
     */
    private clearSession(): void {
        this.currentSession = null;
        this.isAuthenticated = false;
        if (fs.existsSync(this.sessionFile)) {
            fs.unlinkSync(this.sessionFile);
        }
    }

    /**
     * 用户登录
     */
    public async login(credentials: LoginCredentials): Promise<{ success: boolean; message: string; user?: UserInfo }> {
        try {
            // 这里应该调用实际的登录API
            // 目前使用模拟登录
            const result = await this.mockLoginAPI(credentials);
            
            if (result.success) {
                const session: AuthSession = {
                    token: result.token!,
                    user: result.user!,
                    expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24小时过期
                };
                
                this.currentSession = session;
                this.isAuthenticated = true;
                await this.saveSession(session);
                
                return { success: true, message: '登录成功', user: result.user };
            } else {
                return { success: false, message: result.message };
            }
        } catch (error) {
            return { success: false, message: '登录失败: ' + (error as Error).message };
        }
    }

    /**
     * 用户注册
     */
    public async register(userInfo: { username: string; email: string; password: string }): Promise<{ success: boolean; message: string }> {
        try {
            // 这里应该调用实际的注册API
            const result = await this.mockRegisterAPI(userInfo);
            return result;
        } catch (error) {
            return { success: false, message: '注册失败: ' + (error as Error).message };
        }
    }

    /**
     * 用户登出
     */
    public async logout(): Promise<void> {
        try {
            // 这里应该调用登出API
            if (this.currentSession) {
                await this.mockLogoutAPI(this.currentSession.token);
            }
        } catch (error) {
            console.error('登出API调用失败:', error);
        } finally {
            this.clearSession();
        }
    }

    /**
     * 检查用户是否已登录
     */
    public isLoggedIn(): boolean {
        return this.isAuthenticated && this.currentSession !== null;
    }

    /**
     * 获取当前用户信息
     */
    public getCurrentUser(): UserInfo | null {
        return this.currentSession?.user || null;
    }

    /**
     * 获取认证token
     */
    public getAuthToken(): string | null {
        return this.currentSession?.token || null;
    }

    /**
     * 刷新会话
     */
    public async refreshSession(): Promise<boolean> {
        if (!this.currentSession) {
            return false;
        }

        try {
            // 这里应该调用刷新token的API
            const result = await this.mockRefreshTokenAPI(this.currentSession.token);
            if (result.success) {
                this.currentSession.token = result.token!;
                this.currentSession.expiresAt = Date.now() + (24 * 60 * 60 * 1000);
                await this.saveSession(this.currentSession);
                return true;
            }
        } catch (error) {
            console.error('刷新会话失败:', error);
        }
        
        return false;
    }

    /**
     * 模拟登录API
     */
    private async mockLoginAPI(credentials: LoginCredentials): Promise<{ success: boolean; message: string; token?: string; user?: UserInfo }> {
        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 简单的验证逻辑
        if (credentials.username === 'demo' && credentials.password === 'password') {
            const user: UserInfo = {
                id: '1',
                username: credentials.username,
                email: 'demo@example.com',
                createdAt: Date.now(),
                lastLoginAt: Date.now()
            };
            
            return {
                success: true,
                message: '登录成功',
                token: crypto.randomBytes(32).toString('hex'),
                user
            };
        } else {
            return {
                success: false,
                message: '用户名或密码错误'
            };
        }
    }

    /**
     * 模拟注册API
     */
    private async mockRegisterAPI(userInfo: { username: string; email: string; password: string }): Promise<{ success: boolean; message: string }> {
        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 简单的验证逻辑
        if (userInfo.username.length < 3) {
            return { success: false, message: '用户名至少需要3个字符' };
        }
        
        if (userInfo.password.length < 6) {
            return { success: false, message: '密码至少需要6个字符' };
        }
        
        return { success: true, message: '注册成功' };
    }

    /**
     * 模拟登出API
     */
    private async mockLogoutAPI(token: string): Promise<void> {
        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('已登出，token:', token);
    }

    /**
     * 模拟刷新token API
     */
    private async mockRefreshTokenAPI(token: string): Promise<{ success: boolean; token?: string }> {
        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return {
            success: true,
            token: crypto.randomBytes(32).toString('hex')
        };
    }
} 