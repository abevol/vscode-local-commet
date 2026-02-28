import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from './logger';

export interface StorageConfig {
    comments: string;
    bookmarks: string;
}

export interface StoragePaths {
    newPath: string;
    commentsDir: string;
    bookmarksDir: string;
    oldPath: string;
    oldCommentsFile: string;
    oldBookmarksFile: string;
}

export class StoragePathUtils {
    /**
     * 获取项目的存储路径配置
     */
    static getStoragePaths(
        context: vscode.ExtensionContext,
        workspacePath: string
    ): StoragePaths {
        let newPath: string;
        if (context.storageUri) {
            newPath = path.join(context.storageUri.fsPath, 'local-comment');
        } else {
            const globalStorageDir = context.globalStorageUri?.fsPath || context.extensionPath;
            const pathHash = crypto.createHash('md5').update(workspacePath).digest('hex');
            newPath = path.join(globalStorageDir, 'workspace-storage', pathHash, 'local-comment');
        }

        const commentsDir = path.join(newPath, 'comments');
        const bookmarksDir = path.join(newPath, 'bookmarks');

        const globalStorageDir = context.globalStorageUri?.fsPath || context.extensionPath;
        const projectStorageDir = path.join(globalStorageDir, 'projects');
        const pathHash = crypto.createHash('md5').update(workspacePath).digest('hex');
        const projectName = path.basename(workspacePath);

        const oldCommentsFile = path.join(
            projectStorageDir,
            `${projectName}-${pathHash}.json`
        );
        const oldBookmarksFile = path.join(
            projectStorageDir,
            `${projectName}-${pathHash}-bookmarks.json`
        );

        return {
            newPath,
            commentsDir,
            bookmarksDir,
            oldPath: projectStorageDir,
            oldCommentsFile,
            oldBookmarksFile
        };
    }

    /**
     * 获取当前使用的注释配置文件路径
     */
    static getCurrentCommentsFile(paths: StoragePaths): string | null {
        const config = this.loadConfig(paths);
        const fileName = config.comments || 'comments.json';
        const commentsFilePath = path.join(paths.commentsDir, fileName);

        if (fs.existsSync(commentsFilePath)) {
            return commentsFilePath;
        }

        const defaultFile = path.join(paths.commentsDir, 'comments.json');
        if (fs.existsSync(defaultFile)) {
            const updatedConfig = { ...config, comments: 'comments.json' };
            this.saveConfig(paths, updatedConfig).catch(e => logger.error('saveConfig failed', e));
            return defaultFile;
        }

        return null;
    }

    /**
     * 获取当前使用的书签配置文件路径
     */
    static getCurrentBookmarksFile(paths: StoragePaths): string | null {
        const config = this.loadConfig(paths);
        const fileName = config.bookmarks || 'bookmarks.json';
        const bookmarksFilePath = path.join(paths.bookmarksDir, fileName);

        if (fs.existsSync(bookmarksFilePath)) {
            return bookmarksFilePath;
        }

        const defaultFile = path.join(paths.bookmarksDir, 'bookmarks.json');
        if (fs.existsSync(defaultFile)) {
            const updatedConfig = { ...config, bookmarks: 'bookmarks.json' };
            this.saveConfig(paths, updatedConfig).catch(e => logger.error('saveConfig failed', e));
            return defaultFile;
        }

        return null;
    }

    /**
     * 判断新存储是否已启用（.vscode/local-comment 下已有注释或书签数据文件）
     */
    static hasNewStorageEnabled(paths: StoragePaths): boolean {
        const hasNewComments = this.getCurrentCommentsFile(paths) !== null;
        const hasNewBookmarks = this.getCurrentBookmarksFile(paths) !== null;
        return hasNewComments || hasNewBookmarks;
    }

    /**
     * 从 VSCode Settings 加载存储配置（注释/书签配置文件名）
     */
    static loadConfig(paths: StoragePaths): StorageConfig {
        const configPath = path.join(paths.newPath, 'config.json');
        if (fs.existsSync(configPath)) {
            try {
                const data = fs.readFileSync(configPath, 'utf8');
                const parsed = JSON.parse(data) as StorageConfig;
                return {
                    comments: parsed.comments ?? 'comments.json',
                    bookmarks: parsed.bookmarks ?? 'bookmarks.json'
                };
            } catch (err) {
                logger.error('Failed to read config.json', err);
            }
        }

        const vscodeConfig = vscode.workspace.getConfiguration('local-comment');
        const commentsConfig = vscodeConfig.get<string>('storage.commentsConfig');
        const bookmarksConfig = vscodeConfig.get<string>('storage.bookmarksConfig');
        return {
            comments: commentsConfig ?? 'comments.json',
            bookmarks: bookmarksConfig ?? 'bookmarks.json'
        };
    }

    /**
     * 将存储配置保存到 storageUri 目录下的 config.json
     */
    static async saveConfig(paths: StoragePaths, config: StorageConfig): Promise<void> {
        this.ensureNewPathExists(paths);
        const configPath = path.join(paths.newPath, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }

    /**
     * 列出所有可用的配置文件
     */
    static listConfigFiles(dir: string): string[] {
        if (!fs.existsSync(dir)) {
            return [];
        }
        return fs.readdirSync(dir)
            .filter(file => file.endsWith('.json'))
            .map(file => file);
    }

    /**
     * 确保目录存在
     */
    static ensureDirectoryExists(dir: string): void {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    /**
     * 确保新路径目录存在
     */
    static ensureNewPathExists(paths: StoragePaths): void {
        this.ensureDirectoryExists(paths.newPath);
        this.ensureDirectoryExists(paths.commentsDir);
        this.ensureDirectoryExists(paths.bookmarksDir);
    }

    /**
     * 检查文件是否存在
     */
    static fileExists(filePath: string): boolean {
        return fs.existsSync(filePath);
    }

    /**
     * 判断是否为只读/权限类错误
     */
    static isWritePermissionError(err: unknown): boolean {
        if (err instanceof Error) {
            const code = (err as NodeJS.ErrnoException).code;
            return code === 'EACCES' || code === 'EROFS' || code === 'EPERM';
        }
        return false;
    }
}
