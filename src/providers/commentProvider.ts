import * as vscode from 'vscode';
import { CommentManager, LocalComment, SharedComment } from '../managers/commentManager';
import { createDataUri } from '../utils/utils';
import axios from 'axios';

export class CommentProvider implements vscode.Disposable {
    private decorationType: vscode.TextEditorDecorationType;
    private tagDecorationType: vscode.TextEditorDecorationType;
    private commentManager: CommentManager;
    private isVisible: boolean = true;
    private disposables: vscode.Disposable[] = [];
    private updateTimer: NodeJS.Timeout | null = null; // 防抖定时器

    // 预加载的图标URIs
    private commentIconUri: string | null = null;
    private editIconUri: string | null = null;
    private deleteIconUri: string | null = null;
    private markdownIconUri: string | null = null;

    constructor(commentManager: CommentManager) {
        this.commentManager = commentManager;

        // 初始创建装饰类型（先不设置图标，这里的图标指行号旁边的小图标，可以用svg）
        this.decorationType = vscode.window.createTextEditorDecorationType({
            // 行内显示注释内容（不包含图标）
            after: {
                color: '#888888',
                fontStyle: 'italic',
                margin: '0 0 0 1em'
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });

        // 标签装饰器（当前未使用，但保留以避免错误）
        this.tagDecorationType = vscode.window.createTextEditorDecorationType({});

        // 监听编辑器变化
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(() => this.updateDecorations()),
            vscode.window.onDidChangeTextEditorSelection(() => this.debouncedUpdateDecorations())
        );

        // 异步加载图标，加载完成后重新创建装饰类型
        this.loadAllIcons().then(() => {
            this.recreateDecorationType();
            this.updateDecorations();
        });

        this.updateDecorations();
    }

    // 异步加载所有图标
    private async loadAllIcons(): Promise<void> {
        try {
            const context = this.commentManager.getContext();
            const [commentIcon, editIcon, deleteIcon, markdownIcon] = await Promise.all([
                createDataUri(context, 'src/resources/pin.svg'), // 注释图标
                createDataUri(context, 'src/resources/edit.svg'), // 编辑图标
                createDataUri(context, 'src/resources/delete.svg'), // 删除图标
                createDataUri(context, 'src/resources/markdown.svg') // Markdown图标
            ]);

            this.commentIconUri = commentIcon;
            this.editIconUri = editIcon;
            this.deleteIconUri = deleteIcon;
            this.markdownIconUri = markdownIcon;
        } catch (error) {
            console.error('加载图标失败:', error);
        }
    }

    // 重新创建装饰类型（加载图标后）
    private recreateDecorationType(): void {
        // 先释放旧的装饰类型
        this.decorationType.dispose();

        // 创建新的装饰类型，包含图标
        this.decorationType = vscode.window.createTextEditorDecorationType({
            // 在行号区域显示注释图标
            gutterIconPath: this.commentIconUri ? vscode.Uri.parse(this.commentIconUri) : undefined,
            gutterIconSize: 'contain', // 使图标适应行号区域大小

            // 行内显示注释内容（不包含图标）
            after: {
                color: '#888888',
                fontStyle: 'italic',
                margin: '0 0 0 1em'
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
    }

    public refresh(): void {
        this.updateDecorations();
    }

    public toggleVisibility(): void {
        this.isVisible = !this.isVisible;
        if (this.isVisible) {
            this.updateDecorations();
            vscode.window.showInformationMessage('本地注释已显示');
        } else {
            this.clearDecorations();
            vscode.window.showInformationMessage('本地注释已隐藏');
        }
    }

    private updateDecorations(): void {
        if (!this.isVisible) {
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        // 拿到所有能匹配到的注释
        const comments = this.commentManager.getComments(editor.document.uri);

        const normalDecorations: vscode.DecorationOptions[] = [];

        // 按行号分组注释
        const commentsByLine = this.groupCommentsByLine(comments, editor.document.lineCount);

        // 处理每一行的注释
        for (const [lineNumber, lineComments] of commentsByLine) {
            const line = editor.document.lineAt(lineNumber);

            // 为每一行只创建一个装饰器，包含该行的所有注释
            const decoration = this.createSingleDecoration(lineComments, line, editor);
            normalDecorations.push(decoration);
        }

        editor.setDecorations(this.decorationType, normalDecorations);
    }

    // 创建注释的装饰器
    private createSingleDecoration(comments: (LocalComment | SharedComment)[], line: vscode.TextLine, editor: vscode.TextEditor): vscode.DecorationOptions {
        const lineLength = line.text.length;

        // 只显示本地注释，过滤掉共享注释
        const localComments = comments.filter(comment => !('userId' in comment));

        // 构建显示文本
        let contentText = '';
        let color = '#6B7283'; // 默认灰蓝色
        let fontStyle = 'italic';
        let margin = '0 0 0 0.8em';

        // 只显示本地注释
        if (localComments.length > 0) {
            const localComment = localComments[0]; // 只显示第一条本地注释
            contentText = ` ${localComment.content}`;
            color = '#6B7283'; // 灰蓝色
        }

        // 创建装饰选项
        const decoration: vscode.DecorationOptions = {
            range: new vscode.Range(line.lineNumber, lineLength, line.lineNumber, lineLength),
            renderOptions: {
                after: {
                    contentText: contentText,
                    color: color,
                    fontStyle: fontStyle,
                    margin: margin
                }
            }
        };

        return decoration;
    }

    /**
     *
     * @param content 主要作用：将注释内容按照标签进行分割，识别出哪些是普通文本，哪些是特殊标签。
     * 支持的标签格式：
     * 声明标签：$标签名 （如 $bug、$todo）
     * 引用标签：@标签名 （如 @bug、@todo）
     * @returns 返回一个数组，数组中每个元素包含文本和是否是标签的标志
     */
    private parseCommentIntoSegments(content: string): Array<{text: string, isTag: boolean}> {
        const segments: Array<{text: string, isTag: boolean}> = [];
        let lastIndex = 0;

        // 匹配所有标签（声明和引用）
        const tagRegex = /(\$[a-zA-Z_][a-zA-Z0-9_]*)|(@[a-zA-Z_][a-zA-Z0-9_]*)/g;
        let match;

        while ((match = tagRegex.exec(content)) !== null) {
            // 添加标签前的普通文本
            if (match.index > lastIndex) {
                segments.push({
                    text: content.substring(lastIndex, match.index),
                    isTag: false
                });
            }

            // 添加标签
            segments.push({
                text: match[0],
                isTag: true
            });

            lastIndex = match.index + match[0].length;
        }

        // 添加剩余的普通文本
        if (lastIndex < content.length) {
            segments.push({
                text: content.substring(lastIndex),
                isTag: false
            });
        }

        // 如果没有找到任何标签，返回整个内容作为普通文本
        if (segments.length === 0) {
            segments.push({
                text: content,
                isTag: false
            });
        }

        return segments;
    }

    private extractTagsFromContent(content: string): Array<{text: string, type: 'declaration' | 'reference'}> {
        const tags: Array<{text: string, type: 'declaration' | 'reference'}> = [];

        // 匹配所有标签（声明和引用）
        const tagRegex = /(\$[a-zA-Z_][a-zA-Z0-9_]*)|(@[a-zA-Z_][a-zA-Z0-9_]*)/g;
        let match;

        while ((match = tagRegex.exec(content)) !== null) {
            tags.push({
                text: match[0],
                type: match[0].startsWith('$') ? 'declaration' : 'reference'
            });
        }

        return tags;
    }

    /**
     * 按行号分组注释
     *
     * @param comments 注释数组
     * @param documentLineCount 文档总行数
     * @returns 按行号分组的注释Map
     *
     * @example
     * 假设有以下注释：
     * - 第5行：本地注释A
     * - 第5行：共享注释B
     * - 第10行：本地注释C
     * - 第15行：共享注释D
     *
     * 分组后的结果：
     * ```typescript
     * commentsByLine = {
     *   5: [本地注释A, 共享注释B],
     *   10: [本地注释C],
     *   15: [共享注释D]
     * }
     * ```
     */
    private groupCommentsByLine(comments: (LocalComment | SharedComment)[], documentLineCount: number): Map<number, (LocalComment | SharedComment)[]> {
        const commentsByLine = new Map<number, (LocalComment | SharedComment)[]>();

        for (const comment of comments) {
            if (comment.line >= 0 && comment.line < documentLineCount) {
                if (!commentsByLine.has(comment.line)) {
                    commentsByLine.set(comment.line, []);
                }
                commentsByLine.get(comment.line)!.push(comment);
            }
        }

        return commentsByLine;
    }

    private clearDecorations(): void {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.setDecorations(this.decorationType, []);
            editor.setDecorations(this.tagDecorationType, []);
        }
    }

    public dispose(): void {
        // 清理防抖定时器
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }

        this.decorationType.dispose();
        this.tagDecorationType.dispose();
        this.disposables.forEach(d => d.dispose());
    }

    private processMarkdownContent(content: string): string {
        return content
            .replace(/\\n/g, '\n')      // \n -> 换行
            .replace(/\\t/g, '\t')      // \t -> 制表符
            .replace(/\\r/g, '\r')      // \r -> 回车
            .replace(/\\\\/g, '\\')     // \\ -> \
            .replace(/\\"/g, '"')       // \" -> "
            .replace(/\\'/g, "'");      // \' -> '
    }

    // 提供悬浮提示
    public async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | undefined> {
        if (!this.isVisible) {
            return;
        }

        const line = position.line;
        const comments = this.commentManager.getComments(document.uri);
        const lineComments = comments.filter(c => c.line === line);

        // 检查所有注释的存储状态
        const allComments = this.commentManager.getAllComments();
        const filePath = document.uri.fsPath;
        const storedComments = allComments[filePath] || [];

        if (lineComments.length > 0) {
            // 使用预加载的图标URIs，如果没有加载完成则跳过图标显示
            const editIconUri = this.editIconUri || '';
            const deleteIconUri = this.deleteIconUri || '';
            const markDownIconUri = this.markdownIconUri || '';

            const markdownContent = new vscode.MarkdownString();
            markdownContent.isTrusted = true;
            markdownContent.supportHtml = true;

            // 分离本地注释和共享注释
            const localComments = lineComments.filter(comment => !('userId' in comment));
            const sharedComments = lineComments.filter(comment => 'userId' in comment);



            // 显示本地注释
            for (let i = 0; i < localComments.length; i++) {
                const comment = localComments[i];

                if (i > 0) {
                    markdownContent.appendMarkdown(`---\n\n`);
                }

                markdownContent.appendMarkdown(`**本地注释**\n\n`);

                // 处理用户输入的转义字符
                const processedContent = this.processMarkdownContent(comment.content);

                // 将注释内容中的@标签转换为可点击的链接
                const segments = this.parseCommentIntoSegments(processedContent);
                let enhancedContent = '';

                for (const segment of segments) {
                    if (segment.isTag && segment.text.startsWith('@')) {
                        // 提取标签名（去掉@符号）
                        const tagName = segment.text.substring(1);
                        // 创建可点击链接
                        enhancedContent += `[${segment.text}](command:localComment.goToTagDeclaration?${encodeURIComponent(JSON.stringify({tagName}))})`;
                    } else {
                        // 普通文本直接添加
                        enhancedContent += segment.text;
                    }
                }

                markdownContent.appendMarkdown(enhancedContent);
                markdownContent.appendMarkdown(`\n\n`);

                // 添加标签信息部分并进行去重
                const tags = this.extractTagsFromContent(comment.content);
                if (tags.length > 0) {
                    // 使用Set进行去重
                    const declarationTags = new Set<string>();
                    const referenceTags = new Set<string>();

                    // 收集唯一标签
                    for (const tag of tags) {
                        if (tag.type === 'declaration') {
                            declarationTags.add(tag.text);
                        } else {
                            referenceTags.add(tag.text);
                        }
                    }

                    markdownContent.appendMarkdown(`**标签信息**\n\n`);

                    // 处理声明标签
                    for (const tagText of declarationTags) {
                        markdownContent.appendMarkdown(`️**声明**: \`${tagText}\`\n\n`);
                    }

                    // 处理引用标签
                    for (const tagText of referenceTags) {
                        const tagName = tagText.substring(1);
                        markdownContent.appendMarkdown(`**引用**: \`${tagText}\` - [跳转到声明](command:localComment.goToTagDeclaration?${encodeURIComponent(JSON.stringify({tagName}))})\n\n`);
                    }
                }

                markdownContent.appendMarkdown(`---\n`);
                markdownContent.appendMarkdown(`*${new Date(comment.timestamp).toLocaleString()}*\n\n`);

                // 本地注释显示完整的操作按钮
                const editArgs = JSON.stringify({
                    uri: document.uri.toString(),
                    commentId: comment.id,
                    line: comment.line
                });

                const removeArgs = JSON.stringify({
                    uri: document.uri.toString(),
                    commentId: comment.id,
                    line: comment.line
                });

                const editIcon = `<img src="${editIconUri}" width="16" height="16" alt="编辑" style="vertical-align: middle; " />`;
                const deleteIcon = `<img src="${deleteIconUri}" width="16" height="16" alt="删除" style="vertical-align: middle;" />`;
                const markDownIcon = `<img src="${markDownIconUri}" width="16" height="16" alt="Markdown编辑" style="vertical-align: middle;" />`;

                markdownContent.appendMarkdown(`[${editIcon} 编辑](command:localComment.quickEditCommentFromHover?${encodeURIComponent(editArgs)} "快速编辑注释") | `);
                markdownContent.appendMarkdown(`[${markDownIcon} Markdown编辑](command:localComment.editCommentFromHover?${encodeURIComponent(editArgs)} "多行编辑注释") | `);
                markdownContent.appendMarkdown(`[${deleteIcon} 删除](command:localComment.removeCommentFromHover?${encodeURIComponent(removeArgs)} "删除注释")`);
            }

            // 显示共享注释
            for (let i = 0; i < sharedComments.length; i++) {
                const comment = sharedComments[i] as SharedComment;

                if (localComments.length > 0 || i > 0) {
                    markdownContent.appendMarkdown(`---\n\n`);
                }

                markdownContent.appendMarkdown(`**共享注释**\n\n`);

                // 显示用户信息
                if (comment.username) {
                    // 如果有用户头像，显示头像和用户名
                    if (comment.userAvatar) {
                        // 获取API基础URL并拼接完整的头像URL
                        const apiBaseUrl = this.getApiBaseUrl();
                        let avatarUrl = comment.userAvatar;

                        // 如果avatar是相对路径，需要拼接API基础URL
                        if (avatarUrl && !avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://') && !avatarUrl.startsWith('data:')) {
                            // 确保avatar路径以/开头
                            if (!avatarUrl.startsWith('/')) {
                                avatarUrl = '/' + avatarUrl;
                            }
                            avatarUrl = apiBaseUrl + avatarUrl;
                        }

                        // 尝试获取头像并转换为base64，如果失败则使用VSCode内置图标
                        try {
                            const imageData = await this.fetchImageAsBase64(avatarUrl);
                            console.log('imageData---------------')
                            console.log(imageData)
                            if (imageData) {
                                markdownContent.appendMarkdown(`<img src="${imageData}" width="20" height="20" style="border-radius: 50%; vertical-align: middle; margin-right: 8px;" alt="用户头像" />`);
                                markdownContent.appendMarkdown(`**用户**: ${comment.username}\n\n`);
                            } else {
                                // 如果获取失败，使用VSCode内置图标
                                markdownContent.appendMarkdown(`$(account) **用户**: ${comment.username}\n\n`);
                            }
                        } catch (error) {
                            console.error('获取头像失败:', error);
                            // 使用VSCode内置图标作为备选
                            markdownContent.appendMarkdown(`$(account) **用户**: ${comment.username}\n\n`);
                        }
                    } else {
                        markdownContent.appendMarkdown(`**用户**: ${comment.username}\n\n`);
                    }
                } else {
                    markdownContent.appendMarkdown(`**用户ID**: ${comment.userId}\n\n`);
                }

                // 处理用户输入的转义字符
                const processedContent = this.processMarkdownContent(comment.content);

                // 将注释内容中的@标签转换为可点击的链接
                const segments = this.parseCommentIntoSegments(processedContent);
                let enhancedContent = '';

                for (const segment of segments) {
                    if (segment.isTag && segment.text.startsWith('@')) {
                        // 提取标签名（去掉@符号）
                        const tagName = segment.text.substring(1);
                        // 创建可点击链接
                        enhancedContent += `[${segment.text}](command:localComment.goToTagDeclaration?${encodeURIComponent(JSON.stringify({tagName}))})`;
                    } else {
                        // 普通文本直接添加
                        enhancedContent += segment.text;
                    }
                }

                markdownContent.appendMarkdown(enhancedContent);
                markdownContent.appendMarkdown(`\n\n`);

                // 添加标签信息部分并进行去重
                const tags = this.extractTagsFromContent(comment.content);
                if (tags.length > 0) {
                    // 使用Set进行去重
                    const declarationTags = new Set<string>();
                    const referenceTags = new Set<string>();

                    // 收集唯一标签
                    for (const tag of tags) {
                        if (tag.type === 'declaration') {
                            declarationTags.add(tag.text);
                        } else {
                            referenceTags.add(tag.text);
                        }
                    }

                    markdownContent.appendMarkdown(`**标签信息**\n\n`);

                    // 处理声明标签
                    for (const tagText of declarationTags) {
                        markdownContent.appendMarkdown(`️**声明**: \`${tagText}\`\n\n`);
                    }

                    // 处理引用标签
                    for (const tagText of referenceTags) {
                        const tagName = tagText.substring(1);
                        markdownContent.appendMarkdown(`**引用**: \`${tagText}\` - [跳转到声明](command:localComment.goToTagDeclaration?${encodeURIComponent(JSON.stringify({tagName}))})\n\n`);
                    }
                }

                markdownContent.appendMarkdown(`---\n`);
                markdownContent.appendMarkdown(`*${new Date(comment.timestamp).toLocaleString()}*\n\n`);

                // 共享注释只显示查看信息，不提供编辑功能
                markdownContent.appendMarkdown(`**共享注释** - 此注释来自其他用户`);
            }

            return new vscode.Hover(markdownContent);
        }

        return undefined;
    }

    // 防抖更新方法，避免频繁更新装饰
    private debouncedUpdateDecorations(): void {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }

        this.updateTimer = setTimeout(() => {
            this.updateDecorations();
            this.updateTimer = null;
        }, 100); // 100ms防抖延迟
    }

    /**
     * 获取API基础URL
     */
    private getApiBaseUrl(): string {
        const config = vscode.workspace.getConfiguration('local-comment');
        const apiUrl = config.get<string>('server.apiUrl');
        if (!apiUrl) {
            throw new Error('API服务器地址未配置，请在设置中配置 server.apiUrl');
        }
        return apiUrl;
    }

    /**
     * 获取图片并转换为base64格式
     */
    private async fetchImageAsBase64(imageUrl: string): Promise<string | null> {
        try {
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 5000,
                validateStatus: (status) => status === 200
            });

            const buffer = Buffer.from(response.data);
            const base64 = buffer.toString('base64');
            const contentType = response.headers['content-type'] || 'image/png';
            const dataUri = `data:${contentType};base64,${base64}`;

            return dataUri;
        } catch (error) {
            console.error('获取图片失败:', error);
            return null;
        }
    }
}