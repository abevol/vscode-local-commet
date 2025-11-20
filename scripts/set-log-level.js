/**
 * 设置日志级别配置脚本
 * 根据构建参数（debug或prod）生成logger.config.json文件到out目录
 * 
 * 使用方法:
 *   node scripts/set-log-level.js debug   # 开发版本，显示所有日志
 *   node scripts/set-log-level.js prod     # 生产版本，只显示错误日志
 */

const fs = require('fs');
const path = require('path');

// 获取命令行参数
const buildMode = process.argv[2] || 'prod';

// 验证参数
if (buildMode !== 'debug' && buildMode !== 'prod') {
    console.error('❌ 错误: 构建模式必须是 "debug" 或 "prod"');
    console.error('   使用方法: node scripts/set-log-level.js [debug|prod]');
    process.exit(1);
}

// 根据构建模式设置日志级别
const logLevel = buildMode === 'debug' ? 'debug' : 'error';

// 生成JSON配置文件内容
const configContent = {
    LOG_LEVEL: logLevel,
    buildMode: buildMode
};

// 确保 out 目录存在
const outDir = path.join(__dirname, '../out');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

// 写入JSON配置文件到out目录（供运行时使用）
const configPath = path.join(outDir, 'logger.config.json');
fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2), 'utf8');

console.log(`✅ 日志级别已设置为: ${logLevel} (构建模式: ${buildMode})`);
console.log(`   配置文件: ${configPath}`);
