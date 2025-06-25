import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TagManager } from '../tagManager';
import { CommentManager } from '../commentManager';

export async function showWebViewInput(
    context: vscode.ExtensionContext,
    prompt: string, 
    placeholder: string = '', 
    existingContent: string = '',
    contextInfo?: {
        fileName?: string;
        lineNumber?: number;
        lineContent?: string;
        selectedText?: string;
    },
    markedJsUri: string = ''
): Promise<string | undefined> {
    // 保存当前活动编辑器的引用，以便稍后恢复焦点
    const activeEditor = vscode.window.activeTextEditor;
    
    return new Promise((resolve) => {
        // 创建WebView面板
        const panel = vscode.window.createWebviewPanel(
            'localCommentInput',
            '本地注释输入',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'src')]
            }
        );

        // 获取marked.js的本地路径
        const markedJsPath = vscode.Uri.joinPath(context.extensionUri, 'src', 'lib', 'marked.min.js');
        const markedJsUri = panel.webview.asWebviewUri(markedJsPath);

        // 获取标签建议
        const commentManager = new CommentManager(context);
        const tagManager = new TagManager();
        tagManager.updateTags(commentManager.getAllComments());
        const tagSuggestions = tagManager.getAvailableTagNames().map(tag => `@${tag}`).join(',');

        // HTML内容
        panel.webview.html = getWebviewContent(context, prompt, placeholder, existingContent, contextInfo, markedJsUri.toString(), tagSuggestions);

        // 处理WebView消息
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'save':
                        resolve(message.content);
                        panel.dispose();
                        // WebView关闭后恢复编辑器焦点
                        setTimeout(() => restoreFocus(activeEditor), 100);
                        break;
                    case 'cancel':
                        resolve(undefined);
                        panel.dispose();
                        // WebView关闭后恢复编辑器焦点
                        setTimeout(() => restoreFocus(activeEditor), 100);
                        break;
                }
            }
        );

        // 面板关闭时返回undefined
        panel.onDidDispose(() => {
            resolve(undefined);
            // WebView关闭后恢复编辑器焦点
            setTimeout(() => restoreFocus(activeEditor), 100);
        });
    });
}

// 辅助函数：恢复编辑器焦点
function restoreFocus(editor: vscode.TextEditor | undefined) {
    if (editor) {
        vscode.window.showTextDocument(editor.document, {
            viewColumn: editor.viewColumn,
            selection: editor.selection,
            preserveFocus: false
        });
    }
}

function getWebviewContent(
    context: vscode.ExtensionContext,
    prompt: string,
    placeholder: string,
    existingContent: string,
    contextInfo?: {
        fileName?: string;
        lineNumber?: number;
        lineContent?: string;
        selectedText?: string;
    },
    markedJsUri: string = '',
    tagSuggestions: string = ''
): string {
    // HTML转义函数
    const escapeHtml = (text: string): string => {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    // 构建上下文信息HTML
    let contextHtml = '';
    if (contextInfo) {
        contextHtml = '<div class="context-info">';
        contextHtml += '<div class="context-title">📍 代码上下文</div>';
        
        if (contextInfo.fileName) {
            contextHtml += `<div class="context-item">
                <span class="context-label">文件:</span>
                <span class="context-value">${escapeHtml(contextInfo.fileName)}</span>
            </div>`;
        }
        
        if (contextInfo.lineNumber !== undefined) {
            contextHtml += `<div class="context-item">
                <span class="context-label">行号:</span>
                <span class="context-value">第 ${contextInfo.lineNumber + 1} 行</span>
            </div>`;
        }
        
        if (contextInfo.selectedText) {
            contextHtml += `<div class="context-item">
                <span class="context-label">选中:</span>
                <div class="context-value">
                    <div class="code-preview">${escapeHtml(contextInfo.selectedText)}</div>
                </div>
            </div>`;
        } else if (contextInfo.lineContent) {
            contextHtml += `<div class="context-item">
                <span class="context-label">代码:</span>
                <div class="context-value">
                    <div class="code-preview">${escapeHtml(contextInfo.lineContent)}</div>
                </div>
            </div>`;
        }
        
        contextHtml += '</div>';
    }

    // 准备模板变量
    const templateVariables: Record<string, string> = {
        contextHtml,
        escapedPrompt: escapeHtml(prompt),
        escapedPlaceholder: escapeHtml(placeholder),
        escapedContent: escapeHtml(existingContent || ''),
        markedJsUri: markedJsUri || '',
        tagSuggestions: tagSuggestions
    };

    // 读取模板文件
    const templatePath = vscode.Uri.joinPath(context.extensionUri, 'src', 'templates', 'commentInput.html');
    let template = fs.readFileSync(templatePath.fsPath, 'utf8');

    // 使用正则表达式一次性替换所有变量
    template = template.replace(/\${(\w+)}/g, (match, key: string) => {
        return templateVariables[key] || '';
    });

    return template;
} 