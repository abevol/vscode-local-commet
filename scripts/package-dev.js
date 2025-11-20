/**
 * 开发版本打包脚本
 * 生成带-debug后缀的包名，并设置日志级别为debug
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 读取package.json获取版本号
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;
const name = packageJson.name;

// 生成带-debug后缀的文件名
// 格式: publisher-name-debug-version.vsix
const outputFileName = `${name}-debug-${version}.vsix`;

console.log(`📦 正在打包开发版本: ${outputFileName}`);
console.log(`   日志级别: debug (显示所有日志)`);

try {
    // 先设置日志级别为debug
    console.log('   设置日志级别为 debug...');
    execSync(`node scripts/set-log-level.js debug`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
    });
    
    // 使用--out参数指定输出文件名
    // 注意：vsce package 会自动执行 vscode:prepublish 脚本（即 npm run compile），所以不需要手动编译
    console.log('   打包VSIX文件（将自动编译TypeScript）...');
    execSync(`npx @vscode/vsce package --out ${outputFileName}`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
    });
    
    console.log(`✅ 开发版本打包完成: ${outputFileName}`);
} catch (error) {
    console.error('❌ 打包失败:', error.message);
    process.exit(1);
}

