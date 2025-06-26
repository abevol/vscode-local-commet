import * as vscode from 'vscode';
import { LocalComment } from './commentManager';

/**
 * 注释匹配器 - 负责在文档内容变化时智能匹配注释位置
 */
export class CommentMatcher {
    // 用于跟踪已经被匹配的行，防止多个注释匹配到同一行
    private matchedLines: Set<number> = new Set();
    
    /**
     * 批量匹配所有注释，确保不会有重复匹配
     */
    public batchMatchComments(document: vscode.TextDocument, comments: LocalComment[]): Map<string, number> {
        // 重置匹配状态
        this.matchedLines.clear();
        const results = new Map<string, number>();
        
        // 按照匹配优先级排序：
        // 1. 原始行号仍然匹配的注释（最高优先级）
        // 2. 按照注释创建时间排序（较早的注释优先级更高）
        const sortedComments = [...comments].sort((a, b) => {
            // 首先检查原始位置是否仍然匹配
            const aOriginalMatch = this.isExactMatch(document, a, a.line);
            const bOriginalMatch = this.isExactMatch(document, b, b.line);
            
            if (aOriginalMatch && !bOriginalMatch) return -1;
            if (!aOriginalMatch && bOriginalMatch) return 1;
            
            // 如果都匹配或都不匹配，按时间戳排序（早的优先）
            return a.timestamp - b.timestamp;
        });
        
        // 逐个匹配注释
        for (const comment of sortedComments) {
            const matchedLine = this.findMatchingLineInternal(document, comment);
            results.set(comment.id, matchedLine);
            
            // 如果匹配成功，标记该行已被占用
            if (matchedLine >= 0) {
                this.matchedLines.add(matchedLine);
            }
        }
        
        return results;
    }
    
    /**
     * 内部匹配逻辑
     */
    private findMatchingLineInternal(document: vscode.TextDocument, comment: LocalComment): number {
        const lineContent = comment.lineContent?.trim();
        
        // 如果没有保存的行内容，严格隐藏注释
        if (!lineContent || lineContent.length === 0) {
            console.warn(`⚠️ 注释 ${comment.id} 缺少代码内容快照，将被隐藏`);
            return -1;
        }
        
        // 提高匹配标准：行内容必须有足够的特征性
        if (!this.hasEnoughCharacteristics(lineContent)) {
            console.warn(`⚠️ 注释 ${comment.id} 对应的代码行特征性不足，将被隐藏以避免误匹配`);
            return -1;
        }

        // 1. 优先在原始行号位置查找精确匹配
        if (comment.line >= 0 && comment.line < document.lineCount) {
            if (this.isExactMatch(document, comment, comment.line) && !this.matchedLines.has(comment.line)) {
                return comment.line;
            }
        }

        // 2. 检查注释行上面的行（处理插入行导致的位移）
        const previousLine = comment.line - 1;
        if (previousLine >= 0 && previousLine < document.lineCount) {
            if (this.isExactMatch(document, comment, previousLine) && !this.matchedLines.has(previousLine)) {
                console.log(`✅ 注释需要上移一行：从行 ${comment.line + 1} 到行 ${previousLine + 1}`);
                return previousLine;
            }
        }

        // 3. 检查注释行下面的行（处理删除行导致的位移）
        const nextLine = comment.line + 1;
        if (nextLine < document.lineCount) {
            if (this.isExactMatch(document, comment, nextLine) && !this.matchedLines.has(nextLine)) {
                console.log(`✅ 注释需要下移一行：从行 ${comment.line + 1} 到行 ${nextLine + 1}`);
                return nextLine;
            }
        }

        // 4. 在有限范围内搜索精确匹配
        const searchRange = this.calculateSearchRange(document.lineCount, lineContent);
        console.log(`🔍 使用受限搜索范围: ±${searchRange} 行 (文件总行数: ${document.lineCount}行)`);
        
        const startLine = Math.max(0, comment.line - searchRange);
        const endLine = Math.min(document.lineCount - 1, comment.line + searchRange);

        for (let i = startLine; i <= endLine; i++) {
            // 跳过已经检查过的行和已被占用的行
            if (i === comment.line || i === previousLine || i === nextLine || this.matchedLines.has(i)) {
                continue;
            }
            
            if (this.isExactMatch(document, comment, i)) {
                console.log(`✅ 在附近找到精确匹配：行 ${i + 1}`);
                return i;
            }
        }

        // 5. 严格模式：不进行全文搜索和模糊匹配
        // 这样可以避免误匹配到完全不相关的代码行
        console.log(`❌ 注释 ${comment.id} 未找到可靠匹配，将被隐藏以避免误匹配`);
        return -1;
    }
    
    /**
     * 检查是否为精确匹配
     */
    private isExactMatch(document: vscode.TextDocument, comment: LocalComment, lineIndex: number): boolean {
        if (lineIndex < 0 || lineIndex >= document.lineCount) {
            return false;
        }
        
        const currentLineContent = document.lineAt(lineIndex).text.trim();
        const targetLineContent = comment.lineContent?.trim() || '';
        
        // 精确匹配：内容必须完全一致
        return currentLineContent === targetLineContent;
    }
    
    /**
     * 检查行内容是否有足够的特征性来进行可靠匹配
     */
    private hasEnoughCharacteristics(lineContent: string): boolean {
        const trimmed = lineContent.trim();
        
        // 空行或只有空白字符
        if (trimmed.length === 0) {
            return false;
        }
        
        // 只有简单的符号（如单独的 {、}、;、, 等）
        if (trimmed.length <= 2 && /^[{}();,\[\]]+$/.test(trimmed)) {
            return false;
        }
        
        // 只有简单的关键字（如 else、try、catch 等单独出现）
        const simpleKeywords = ['else', 'try', 'catch', 'finally', 'do', 'then'];
        if (simpleKeywords.includes(trimmed.toLowerCase())) {
            return false;
        }
        
        // 只有数字或简单的赋值
        if (/^\d+$/.test(trimmed) || /^[a-zA-Z]\s*[=:]\s*\d+$/.test(trimmed)) {
            return false;
        }
        
        // 内容太短且没有特殊字符
        if (trimmed.length < 5 && !/[a-zA-Z0-9_$]/.test(trimmed)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 计算搜索范围，更加保守
     */
    private calculateSearchRange(totalLines: number, lineContent: string): number {
        // 基于行内容的复杂度调整搜索范围
        const contentComplexity = this.calculateContentComplexity(lineContent);
        
        let baseRange: number;
        
        // 根据内容复杂度确定基础搜索范围
        if (contentComplexity > 0.8) {
            // 高复杂度内容，可以使用较大的搜索范围
            baseRange = 10;
        } else if (contentComplexity > 0.5) {
            // 中等复杂度内容
            baseRange = 5;
        } else {
            // 低复杂度内容，使用很小的搜索范围
            baseRange = 2;
        }
        
        // 根据文件大小进行微调，但保持保守
        if (totalLines <= 100) {
            return Math.min(baseRange, 3);
        } else if (totalLines <= 500) {
            return Math.min(baseRange, 8);
        } else {
            return Math.min(baseRange, 15);
        }
    }
    
    /**
     * 计算内容复杂度（0-1之间的值）
     */
    private calculateContentComplexity(content: string): number {
        if (!content || content.trim().length === 0) {
            return 0;
        }
        
        const trimmed = content.trim();
        let complexity = 0;
        
        // 长度因子
        complexity += Math.min(trimmed.length / 50, 0.3);
        
        // 字母数字字符比例
        const alphanumericCount = (trimmed.match(/[a-zA-Z0-9]/g) || []).length;
        complexity += (alphanumericCount / trimmed.length) * 0.3;
        
        // 特殊字符多样性
        const specialChars = new Set(trimmed.match(/[^a-zA-Z0-9\s]/g) || []);
        complexity += Math.min(specialChars.size / 10, 0.2);
        
        // 单词数量
        const words = trimmed.split(/\s+/).filter(w => w.length > 0);
        complexity += Math.min(words.length / 10, 0.2);
        
        return Math.min(complexity, 1);
    }

    /**
     * 模糊匹配单个注释 - 用于手动触发的模糊匹配
     * 
     * 该方法会在精确匹配失败后，使用模糊匹配算法尝试找到最相似的代码行。
     * 与常规匹配不同，这个方法会搜索整个文档，并返回多个候选结果供用户选择。
     * 
     * @param document - VSCode文档对象
     * @param comment - 要匹配的注释
     * @param maxCandidates - 最大候选结果数量，默认5个
     * @returns 返回匹配候选结果数组，按相似度降序排列
     */
    public fuzzyMatchComment(document: vscode.TextDocument, comment: LocalComment, maxCandidates: number = 5): Array<{
        line: number;
        content: string;
        similarity: number;
        confidence: 'high' | 'medium' | 'low';
    }> {
        const lineContent = comment.lineContent?.trim();
        
        // 如果没有保存的行内容，无法进行模糊匹配
        if (!lineContent || lineContent.length === 0) {
            return [];
        }

        const candidates: Array<{
            line: number;
            content: string;
            similarity: number;
            confidence: 'high' | 'medium' | 'low';
        }> = [];

        // 标准化目标内容
        const normalizedTarget = this.normalizeLineContent(lineContent);
        if (normalizedTarget.length === 0) {
            return [];
        }

        // 遍历文档的每一行
        for (let i = 0; i < document.lineCount; i++) {
            const currentLine = document.lineAt(i).text.trim();
            
            // 跳过空行
            if (currentLine.length === 0) {
                continue;
            }

            // 计算相似度
            const directSimilarity = this.calculateSimilarity(lineContent, currentLine);
            const normalizedSimilarity = this.calculateSimilarity(normalizedTarget, this.normalizeLineContent(currentLine));
            
            // 使用两种相似度的最大值
            const similarity = Math.max(directSimilarity, normalizedSimilarity);
            
            // 只考虑相似度超过阈值的行
            if (similarity >= 0.3) {
                // 确定置信度等级
                let confidence: 'high' | 'medium' | 'low';
                if (similarity >= 0.8) {
                    confidence = 'high';
                } else if (similarity >= 0.6) {
                    confidence = 'medium';
                } else {
                    confidence = 'low';
                }

                candidates.push({
                    line: i,
                    content: currentLine,
                    similarity: similarity,
                    confidence: confidence
                });
            }
        }

        // 按相似度降序排序，并限制结果数量
        return candidates
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, maxCandidates);
    }

    /**
     * 标准化行内容，用于模糊匹配（已废弃，保留用于向后兼容）
     * @deprecated 不再使用模糊匹配以提高精度
     */
    public normalizeLineContent(content: string): string {
        const normalized = content
            .replace(/\s+/g, '') // 移除所有空白字符
            .replace(/[;,{}()]/g, '') // 移除常见标点符号
            .toLowerCase(); // 转为小写
        
        // 避免过于短的内容造成误匹配
        return normalized.length >= 3 ? normalized : '';
    }

    /**
     * 计算两个字符串的相似度（已废弃，保留用于向后兼容）
     * @deprecated 不再使用相似度匹配以提高精度
     */
    public calculateSimilarity(str1: string, str2: string): number {
        if (!str1 || !str2) return 0;
        
        // 简单的编辑距离算法
        const len1 = str1.length;
        const len2 = str2.length;
        
        if (len1 === 0) return len2 === 0 ? 1 : 0;
        if (len2 === 0) return 0;
        
        const matrix: number[][] = [];
        
        // 初始化矩阵
        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        for (let j = 1; j <= len2; j++) {
            matrix[0][j] = j;
        }
        
        // 填充矩阵
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1, // 删除
                    matrix[i][j - 1] + 1, // 插入
                    matrix[i - 1][j - 1] + cost // 替换
                );
            }
        }
        
        // 编辑距离
        const distance = matrix[len1][len2];
        
        // 将距离转换为相似度分数（0到1之间）
        return 1 - distance / Math.max(len1, len2);
    }
} 