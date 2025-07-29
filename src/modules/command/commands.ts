import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CommentManager } from '../../managers/commentManager';
import { TagManager } from '../../managers/tagManager';
import { CommentProvider } from '../../providers/commentProvider';
import { CommentTreeProvider } from '../../providers/commentTreeProvider';
import { BookmarkManager } from '../../managers/bookmarkManager';

import { showQuickInputWithTagCompletion } from '../../utils/quickInput';
import { ApiRoutes } from '../../apiService';
import { ProjectManager } from '../../managers/projectManager';
import { normalizeFilePath, normalizeFileComments, buildExportData } from '../../utils/utils';
import { registerCommentCommands } from './comment';
import { registerBookmarkCommands } from './bookmark';

export function registerCommands(
    context: vscode.ExtensionContext,
    commentManager: CommentManager,
    tagManager: TagManager,
    commentProvider: CommentProvider,
    commentTreeProvider: CommentTreeProvider,
    bookmarkManager?: BookmarkManager,
    authManager?: any
) {

    const showStorageLocationCommand = vscode.commands.registerCommand('localComment.showStorageLocation', () => {
        const projectInfo = commentManager.getProjectInfo();
        const storageFile = commentManager.getStorageFilePath();
        
        let message = `项目注释存储信息:\n\n`;
        message += `项目名称: ${projectInfo.name}\n`;
        message += `项目路径: ${projectInfo.path}\n`;
        message += `存储文件: ${storageFile}\n\n`;
        message += `️注意: 每个项目的注释数据独立存储`;
        
        vscode.window.showInformationMessage(
            message,
            '打开文件夹', '复制路径', '查看项目目录'
        ).then(selection => {
            if (selection === '打开文件夹') {
                vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(storageFile));
            } else if (selection === '复制路径') {
                vscode.env.clipboard.writeText(storageFile);
                vscode.window.showInformationMessage('路径已复制到剪贴板');
            } else if (selection === '查看项目目录') {
                const projectDir = path.dirname(path.dirname(storageFile)); // 返回到projects目录
                vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(projectDir));
            }
        });
    });

    const showStorageStatsCommand = vscode.commands.registerCommand('localComment.showStorageStats', () => {
        const projectInfo = commentManager.getProjectInfo();
        const allComments = commentManager.getAllComments();
        const fileCount = Object.keys(allComments).length;
        const totalComments = Object.values(allComments).reduce((sum, comments) => sum + comments.length, 0);
        
        // 统计标签信息
        const tagDeclarations = tagManager.getTagDeclarations();
        const tagReferences = tagManager.getTagReferences();
        
        let message = `${projectInfo.name} 项目注释统计:\n\n`;
        message += `包含注释的文件: ${fileCount} 个\n`;
        message += `总注释数量: ${totalComments} 条\n`;
        message += `标签声明: ${tagDeclarations.size} 个\n`;
        message += `标签引用: ${tagReferences.length} 个\n\n`;
        
        if (fileCount > 0) {
            message += `详细信息:\n`;
            for (const [filePath, comments] of Object.entries(allComments)) {
                const fileName = filePath.split(/[/\\]/).pop();
                message += `• ${fileName}: ${comments.length} 条注释\n`;
            }
        }
        
        if (tagDeclarations.size > 0) {
            message += `\n️ 可用标签:\n`;
            for (const tagName of tagManager.getAvailableTagNames()) {
                message += `• $${tagName}\n`;
            }
        }
        
        message += `\n 存储位置: ${projectInfo.storageFile}`;
        message += `\n️ 注意: 注释数据按项目分离存储`;
        
        vscode.window.showInformationMessage(message, { modal: true });
    });

    // 添加管理所有项目注释数据的命令
    const manageProjectsCommand = vscode.commands.registerCommand('localComment.manageProjects', async () => {
        try {
            const globalStorageDir = commentManager.getContext().globalStorageUri?.fsPath || commentManager.getContext().extensionPath;
            const projectsDir = path.join(globalStorageDir, 'projects');
            
            if (!fs.existsSync(projectsDir)) {
                vscode.window.showInformationMessage('暂无项目注释数据');
                return;
            }
            
            const files = fs.readdirSync(projectsDir).filter(file => file.endsWith('.json'));
            
            if (files.length === 0) {
                vscode.window.showInformationMessage('暂无项目注释数据');
                return;
            }
            
            let message = ` 所有项目注释数据:\n\n`;
            message += ` 项目数量: ${files.length} 个\n\n`;
            
            let totalFiles = 0;
            let totalComments = 0;
            
            for (const file of files) {
                const filePath = path.join(projectsDir, file);
                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    const fileCount = Object.keys(data).length;
                    const commentCount = Object.values(data).reduce((sum: number, comments: any) => sum + comments.length, 0);
                    
                    totalFiles += fileCount;
                    totalComments += commentCount;
                    
                    // 从文件名解析项目名称（格式：项目名-哈希值.json）
                    const projectName = file.replace(/-[a-f0-9]+\.json$/, '');
                    message += `${projectName}: ${fileCount} 个文件, ${commentCount} 条注释\n`;
                } catch (error) {
                    console.error(`读取项目文件失败: ${file}`, error);
                }
            }
            
            message += `\n 总计: ${totalFiles} 个文件, ${totalComments} 条注释`;
            message += `\n 存储目录: ${projectsDir}`;
            
            vscode.window.showInformationMessage(
                message,
                '打开项目目录', '清理旧数据'
            ).then(selection => {
                if (selection === '打开项目目录') {
                    vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(projectsDir));
                } else if (selection === '清理旧数据') {
                    showCleanupDialog(projectsDir, files);
                }
            });
            
        } catch (error) {
            console.error('管理项目数据失败:', error);
            vscode.window.showErrorMessage('管理项目数据时发生错误');
        }
    });

    // 清理数据对话框
    async function showCleanupDialog(projectsDir: string, files: string[]) {
        const items = files.map(file => {
            const projectName = file.replace(/-[a-f0-9]+\.json$/, '');
            return {
                label: projectName,
                description: file,
                detail: `删除 ${projectName} 项目的注释数据`
            };
        });
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择要删除的项目注释数据',
            canPickMany: true
        });
        
        if (selected && selected.length > 0) {
            const confirm = await vscode.window.showWarningMessage(
                `确定要删除 ${selected.length} 个项目的注释数据吗？此操作不可恢复！`,
                '确定删除', '取消'
            );
            
            if (confirm === '确定删除') {
                let deletedCount = 0;
                for (const item of selected) {
                    try {
                        const filePath = path.join(projectsDir, item.description);
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    } catch (error) {
                        console.error(`删除文件失败: ${item.description}`, error);
                    }
                }
                
                vscode.window.showInformationMessage(
                    `已删除 ${deletedCount} 个项目的注释数据`
                );
            }
        }
    }

    const toggleCommentsCommand = vscode.commands.registerCommand('localComment.toggleComments', () => {
        commentProvider.toggleVisibility();
    });

    const removeCommentCommand = vscode.commands.registerCommand('localComment.removeComment', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件');
            return;
        }

        const selection = editor.selection;
        const line = selection.active.line;
        
        await commentManager.removeComment(editor.document.uri, line);
        tagManager.updateTags(commentManager.getAllComments());
        commentProvider.refresh();
        commentTreeProvider.refresh();
    });

    const removeCommentFromHoverCommand = vscode.commands.registerCommand('localComment.removeCommentFromHover', async (args) => {
        try {
            let parsedArgs;
            
            // 检查参数是否已经是对象
            if (typeof args === 'object') {
                parsedArgs = args;
            } else if (typeof args === 'string') {
                try {
                    parsedArgs = JSON.parse(args);
                } catch (parseError) {
                    console.error('参数解析失败:', parseError);
                    vscode.window.showErrorMessage('参数格式错误');
                    return;
                }
            } else {
                vscode.window.showErrorMessage('参数类型不正确');
                return;
            }

            const { uri, commentId, line } = parsedArgs;
            
            if (!uri || !commentId || line === undefined) {
                vscode.window.showErrorMessage('参数不完整');
                return;
            }

            const documentUri = vscode.Uri.parse(uri);
            
            // 通过commentId直接查找注释，不依赖光标位置
            const comment = commentManager.getCommentById(documentUri, commentId);
            
            if (!comment) {
                vscode.window.showWarningMessage(`找不到指定的注释`);
                return;
            }

            // 删除注释
            await commentManager.removeCommentById(documentUri, commentId);
            tagManager.updateTags(commentManager.getAllComments());
            commentProvider.refresh();
            commentTreeProvider.refresh();
            // 删除注释无需提示，用户可以直接看到结果
        } catch (error) {
            console.error('从hover删除注释时发生错误:', error);
            vscode.window.showErrorMessage(`删除注释时发生错误: ${error}`);
        }
    });





    // 添加单行注释命令
    const addCommentCommand = vscode.commands.registerCommand('localComment.addComment', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件');
            return;
        }

        const line = editor.selection.active.line;
        
        try {
            // 使用单行快速输入界面
            const content = await showQuickInputWithTagCompletion(
                '添加本地注释',
                '请输入注释内容... (支持 @标签名 引用标签)',
                '',
                tagManager
            );
            
            if (content !== undefined && content.trim() !== '') {
                await commentManager.addComment(editor.document.uri, line, content);
                // 刷新标签和界面
                tagManager.updateTags(commentManager.getAllComments());
                commentProvider.refresh();
                commentTreeProvider.refresh();
            }
        } catch (error) {
            console.error('添加注释时出错:', error);
            vscode.window.showErrorMessage(`添加注释失败: ${error}`);
        }
    });



    // 导出注释数据命令
    const exportCommentsCommand = vscode.commands.registerCommand('localComment.exportComments', async () => {
        try {
            const projectInfo = commentManager.getProjectInfo();
            const allComments = commentManager.getAllComments();
            
            // 检查是否有注释数据
            const totalComments = Object.values(allComments).reduce((sum, comments) => sum + comments.length, 0);
            if (totalComments === 0) {
                vscode.window.showWarningMessage('当前项目没有注释数据可以导出');
                return;
            }

            // 让用户选择导出方式
            const exportOptions = [
                {
                    label: '$(save) 保存到本地',
                    description: '将注释数据保存到本地文件',
                    detail: '选择保存位置并下载到本地计算机',
                    value: 'local'
                },
                {
                    label: '$(cloud-upload) 上传到云端',
                    description: '将注释数据上传到云端服务器',
                    detail: '需要登录账户，数据将安全存储在云端',
                    value: 'cloud'
                }
            ];

            const selectedOption = await vscode.window.showQuickPick(exportOptions, {
                placeHolder: '选择导出方式',
                ignoreFocusOut: true
            });

            if (!selectedOption) {
                return; // 用户取消了操作
            }

            if (selectedOption.value === 'local') {
                // 本地保存流程
                await handleLocalExport(projectInfo, allComments, totalComments);
            } else if (selectedOption.value === 'cloud') {
                // 云端上传流程
                await handleCloudUpload(projectInfo, allComments, totalComments, authManager);
            }

        } catch (error) {
            console.error('导出注释数据时发生错误:', error);
            vscode.window.showErrorMessage(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    });

    // 处理本地导出
    async function handleLocalExport(projectInfo: any, allComments: any, totalComments: number) {
        // 生成默认文件名
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const defaultFileName = `${projectInfo.name}-comments-${timestamp}.json`;

        // 让用户选择保存位置
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(defaultFileName),
            filters: {
                'JSON文件': ['json'],
                '所有文件': ['*']
            },
            saveLabel: '导出注释数据'
        });

        if (!saveUri) {
            return; // 用户取消了操作
        }

        // 构建导出数据
        const exportData = buildExportData(projectInfo, allComments, totalComments);

        // 执行导出
        const success = await commentManager.exportComments(saveUri.fsPath);
        
        if (success) {
            const fileCount = Object.keys(allComments).length;
            vscode.window.showInformationMessage(
                `导出成功！已导出 ${fileCount} 个文件的 ${totalComments} 条注释`,
                '打开文件位置', '查看文件'
            ).then(selection => {
                if (selection === '打开文件位置') {
                    vscode.commands.executeCommand('revealFileInOS', saveUri);
                } else if (selection === '查看文件') {
                    vscode.commands.executeCommand('vscode.open', saveUri);
                }
            });
        } else {
            vscode.window.showErrorMessage('导出失败，请检查文件路径和权限');
        }
    }

    // 处理云端上传
    async function handleCloudUpload(projectInfo: any, allComments: any, totalComments: number, authManager?: any) {
        // 检查用户是否已登录
        if (!authManager || !authManager.isLoggedIn()) {
            const loginChoice = await vscode.window.showWarningMessage(
                '上传到云端需要先登录账户',
                '立即登录', '取消'
            );
            
            if (loginChoice === '立即登录') {
                // 显示登录界面
                const { AuthWebview } = require('./authWebview');
                AuthWebview.createOrShow(context, authManager);
                return;
            } else {
                return; // 用户取消
            }
        }

        // 获取项目管理器实例
        const projectManager = new ProjectManager(context);
        
        // 获取关联的项目ID
        const associatedProjectId = projectManager.getAssociatedProject();
        if (!associatedProjectId) {
            const associateChoice = await vscode.window.showWarningMessage(
                '当前项目未关联云端项目，需要先关联项目才能上传',
                '关联项目', '取消'
            );
            
            if (associateChoice === '关联项目') {
                // 显示用户信息面板，让用户关联项目
                const { UserInfoWebview } = require('./userInfoWebview');
                UserInfoWebview.createOrShow(context.extensionUri, authManager, projectManager, commentManager, bookmarkManager, tagManager);
                return;
            } else {
                return; // 用户取消
            }
        }

        // 显示上传进度
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在上传注释数据到云端...',
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ increment: 0, message: '准备数据...' });
                
                // 构建导出数据
                const exportData = buildExportData(projectInfo, allComments, totalComments);

                progress.report({ increment: 30, message: '数据准备完成，正在上传...' });

                // 调用真实的API接口上传数据
                const uploadPayload = {
                    content: exportData,
                    project_id: parseInt(associatedProjectId)
                };

                // 获取认证token
                const token = authManager.getAuthToken();
                if (!token) {
                    throw new Error('认证token无效');
                }

                // 获取API基础URL
                const config = vscode.workspace.getConfiguration('local-comment');
                const apiUrl = config.get<string>('server.apiUrl');
                if (!apiUrl) {
                    throw new Error('API服务器地址未配置');
                }

                // 构建完整的API URL
                const fullApiUrl = `${apiUrl}${ApiRoutes.comment.uploadComments}`;

                // 发送API请求
                const response = await fetch(fullApiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(uploadPayload)
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`上传失败: ${response.status} ${response.statusText} - ${errorData.message || '未知错误'}`);
                }

                const result = await response.json();
                
                progress.report({ increment: 70, message: '上传完成，正在验证...' });
                
                // 验证上传结果
                if (!result.id) {
                    throw new Error('上传验证失败：服务器未返回有效的记录ID');
                }
                
                progress.report({ increment: 100, message: '上传成功！' });

                // 显示成功消息
                const fileCount = Object.keys(allComments).length;
                const uploadTime = new Date(result.created_at).toLocaleString('zh-CN');
                vscode.window.showInformationMessage(
                    `云端上传成功！已上传 ${fileCount} 个文件的 ${totalComments} 条注释\n上传时间：${uploadTime}`,
                    
                );

            } catch (error) {
                console.error('云端上传失败:', error);
                vscode.window.showErrorMessage(`云端上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        });
    }

    // 导入注释数据命令
    const importCommentsCommand = vscode.commands.registerCommand('localComment.importComments', async () => {
        try {
            // 让用户选择导入文件
            const openUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'JSON文件': ['json'],
                    '所有文件': ['*']
                },
                openLabel: '选择注释数据文件'
            });

            if (!openUri || openUri.length === 0) {
                return; // 用户取消了操作
            }

            const importPath = openUri[0].fsPath;

            // 验证导入文件
            const validation = await commentManager.validateImportFile(importPath);
            
            if (!validation.valid) {
                vscode.window.showErrorMessage(`文件验证失败: ${validation.message}`);
                return;
            }

            // 分析导入文件的路径信息
            const pathAnalysis = await commentManager.analyzeImportPaths(importPath);
            
            if (!pathAnalysis.success) {
                vscode.window.showErrorMessage(`路径分析失败: ${pathAnalysis.message}`);
                return;
            }

            // 获取当前项目信息
            const currentProject = commentManager.getProjectInfo();

            // 显示导入预览信息
            let previewMessage = `导入预览:\n\n`;
            previewMessage += `源项目: ${validation.projectName}\n`;
            previewMessage += `目标项目: ${currentProject.name}\n`;
            previewMessage += `导出时间: ${validation.exportTime}\n`;
            previewMessage += `文件数量: ${validation.fileCount} 个\n`;
            previewMessage += `注释数量: ${validation.commentCount} 条\n\n`;

            // 检查是否需要跨项目导入
            const needsCrossProjectImport = pathAnalysis.commonBasePath && 
                !pathAnalysis.commonBasePath.startsWith(currentProject.path.replace(/\\/g, '/'));

            let importOptions: Array<{
                label: string;
                description: string;
                detail: string;
                mode: 'merge' | 'replace';
            }> = [];

            if (needsCrossProjectImport) {
                // 跨项目导入选项
                previewMessage += `检测到跨项目导入需求\n`;
                previewMessage += `源项目路径: ${pathAnalysis.commonBasePath}\n`;
                previewMessage += `当前项目路径: ${currentProject.path}\n\n`;
                previewMessage += `请选择导入方式:`;

                importOptions = [
                    {
                        label: '路径重映射 + 合并',
                        description: '自动重映射文件路径并合并注释',
                        detail: `将源路径 ${pathAnalysis.commonBasePath} 映射到 ${currentProject.path}`,
                        mode: 'merge'
                    },
                    {
                        label: '路径重映射 + 替换',
                        description: '自动重映射文件路径并替换所有注释',
                        detail: '警告：这将删除当前项目的所有注释数据',
                        mode: 'replace'
                    }
                ];
            } else {
                // 同项目导入选项
                previewMessage += `请选择导入模式:`;

                importOptions = [
                    {
                        label: '合并导入',
                        description: '将导入的注释与现有注释合并',
                        detail: '如果存在相同ID的注释将跳过，保留现有数据',
                        mode: 'merge'
                    },
                    {
                        label: '替换导入',
                        description: '用导入的注释替换所有现有注释',
                        detail: '警告：这将删除当前项目的所有注释数据',
                        mode: 'replace'
                    }
                ];
            }

            // 让用户选择导入模式
            const importMode = await vscode.window.showQuickPick(importOptions, {
                placeHolder: '选择导入方式',
                ignoreFocusOut: true
            });

            if (!importMode) {
                return; // 用户取消了操作
            }

            // 如果是替换模式，再次确认
            if (importMode.mode === 'replace') {
                const confirm = await vscode.window.showWarningMessage(
                    '确定要替换所有现有注释数据吗？\n\n此操作将删除当前项目的所有注释，且不可恢复！',
                    { modal: true },
                    '确定替换', '取消'
                );
                
                if (confirm !== '确定替换') {
                    return;
                }
            }

            // 准备路径映射配置
            let pathMapping: { oldBasePath: string; newBasePath: string } | undefined;
            
            if (needsCrossProjectImport && pathAnalysis.commonBasePath) {
                pathMapping = {
                    oldBasePath: pathAnalysis.commonBasePath,
                    newBasePath: currentProject.path.replace(/\\/g, '/') + '/'
                };
            }

            // 执行导入
            const result = await commentManager.importComments(
                importPath,
                importMode.mode,
                pathMapping
            );
            
            if (result.success) {
                // 刷新界面
                tagManager.updateTags(commentManager.getAllComments());
                commentProvider.refresh();
                commentTreeProvider.refresh();

                // 构建成功消息
                let successMessage = result.message;
                if (result.remappedFiles && result.remappedFiles > 0) {
                    successMessage += `\n 已重映射 ${result.remappedFiles} 个文件的路径`;
                }
                
                // 显示成功消息
                vscode.window.showInformationMessage(
                    `${successMessage}`,
                    '查看注释列表', '显示统计'
                ).then(selection => {
                    if (selection === '查看注释列表') {
                        vscode.commands.executeCommand('workbench.view.explorer');
                    } else if (selection === '显示统计') {
                        vscode.commands.executeCommand('localComment.showStorageStats');
                    }
                });
            } else {
                vscode.window.showErrorMessage(result.message);
            }

        } catch (error) {
            console.error('导入注释数据时发生错误:', error);
            vscode.window.showErrorMessage(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    });



    // 认证相关命令
    const logoutCommand = vscode.commands.registerCommand('localComment.logout', async () => {
        if (!authManager) {
            vscode.window.showErrorMessage('认证管理器未初始化');
            return;
        }
        
        if (!authManager.isLoggedIn()) {
            vscode.window.showInformationMessage('您尚未登录');
            return;
        }
        
        const result = await vscode.window.showWarningMessage(
            '确定要登出吗？',
            '确定',
            '取消'
        );
        
        if (result === '确定') {
            await authManager.logout();
            vscode.window.showInformationMessage('已成功登出');
        }
    });

    // 注册comment.ts中的命令
    const commentCommands = registerCommentCommands(commentManager, tagManager, commentProvider, commentTreeProvider, context);

    // 注册bookmark.ts中的命令
    const bookmarkCommands = registerBookmarkCommands(bookmarkManager);

    // 返回所有注册的命令，以便在extension.ts中添加到subscriptions
    return [
        showStorageLocationCommand,
        showStorageStatsCommand,
        manageProjectsCommand,
        toggleCommentsCommand,
        removeCommentCommand,
        removeCommentFromHoverCommand,
        addCommentCommand,
        exportCommentsCommand,
        importCommentsCommand,
        // 认证相关命令
        logoutCommand,
        ...commentCommands,
        ...bookmarkCommands,
    ];
} 