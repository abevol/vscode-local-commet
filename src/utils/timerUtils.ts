import * as vscode from 'vscode';

/**
 * 定时器管理器
 * 用于统一管理类中的所有定时器，确保在dispose时能够自动清理
 */
export class TimerManager implements vscode.Disposable {
    private timers: Set<NodeJS.Timeout> = new Set();
    
    /**
     * 创建可追踪的定时器
     * @param callback 回调函数
     * @param delay 延迟时间（毫秒）
     * @returns 定时器ID
     */
    setTimeout(callback: () => void, delay: number): NodeJS.Timeout {
        const timer = setTimeout(() => {
            this.timers.delete(timer);
            callback();
        }, delay);
        this.timers.add(timer);
        return timer;
    }
    
    /**
     * 清除所有定时器
     */
    clearAll(): void {
        this.timers.forEach(timer => clearTimeout(timer));
        this.timers.clear();
    }
    
    /**
     * 清除单个定时器
     * @param timer 定时器ID
     */
    clearTimeout(timer: NodeJS.Timeout): void {
        clearTimeout(timer);
        this.timers.delete(timer);
    }
    
    /**
     * 实现 Disposable 接口
     * 清理所有定时器
     */
    dispose(): void {
        this.clearAll();
    }
}
