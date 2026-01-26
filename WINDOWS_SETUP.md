# Windows 部署指南

本指南专为 Windows 用户提供详细的部署步骤。

## 前置要求

- Node.js 18+ (推荐 LTS 版本)
- Git (可选)

## 快速开始

### 1. 下载项目

**方法 A: 使用 Git**
```cmd
git clone https://github.com/aabaoqaq/zhixuan-library.git
cd zhixuan-library
```

**方法 B: 直接下载**
- 访问 https://github.com/aabaoqaq/zhixuan-library
- 点击 "Code" -> "Download ZIP"
- 解压到任意目录

### 2. 安装依赖

打开命令提示符(CMD)或 PowerShell,进入项目目录:

```cmd
npm install
```

**注意**: 本项目已移除 `better-sqlite3` 依赖,无需编译原生模块,安装过程会很快。

### 3. 配置环境变量

复制环境变量示例文件:

```cmd
copy .env.example .env
```

使用记事本编辑 `.env` 文件:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here-change-in-production"
```

### 4. 初始化数据库

```cmd
npx prisma generate
npx prisma migrate dev --name init
```

### 5. 导入书籍数据

**重要**: 使用新的跨平台兼容脚本

```cmd
node scripts/import-books-prisma.js
```

导入过程大约需要 1-2 分钟,会显示进度:
```
开始导入书籍数据...
读取到 6759 本书籍数据
已导入 100/6759 本书籍...
已导入 200/6759 本书籍...
...
✅ 数据导入完成!
数据库中共有 6759 本书籍
```

### 6. 启动开发服务器

```cmd
npm run dev
```

看到以下信息表示启动成功:
```
▲ Next.js 16.1.4
- Local:         http://localhost:3000
✓ Ready in 2s
```

访问 http://localhost:3000 查看应用。

## 常见问题

### Q1: 端口 3000 被占用

如果看到 `Port 3000 is in use`,Next.js 会自动使用其他端口(如 3001)。

### Q2: 导入数据时出错

确保:
1. 已经运行 `npx prisma migrate dev`
2. `scripts/books_complete.json` 文件存在
3. 没有其他程序在使用数据库文件

### Q3: npm install 很慢

使用国内镜像:
```cmd
npm config set registry https://registry.npmmirror.com
npm install
```

### Q4: 如何重置数据库

```cmd
del prisma\dev.db
npx prisma migrate dev --name init
node scripts/import-books-prisma.js
```

### Q5: 注册时需要邮箱吗?

不需要!本项目已简化用户系统,只需要:
- 用户名(2-20个字符)
- 密码(至少6个字符)

## 生产部署

### 构建项目

```cmd
npm run build
```

### 启动生产服务器

```cmd
npm start
```

### 使用 PM2 管理(推荐)

安装 PM2:
```cmd
npm install -g pm2
```

启动应用:
```cmd
pm2 start npm --name "zhixuan-library" -- start
```

查看状态:
```cmd
pm2 status
pm2 logs zhixuan-library
```

## 技术支持

如果遇到问题:
1. 查看 README.md 中的常见问题
2. 检查 GitHub Issues
3. 确保 Node.js 版本 >= 18

## 项目结构

```
zhixuan-library/
├── prisma/
│   ├── dev.db              # SQLite 数据库文件
│   ├── schema.prisma       # 数据库模型
│   └── migrations/         # 迁移文件
├── scripts/
│   ├── books_complete.json # 书籍数据(6759本)
│   └── import-books-prisma.js  # 导入脚本
├── src/
│   ├── app/                # Next.js 页面和 API
│   └── lib/                # 工具库
├── .env                    # 环境变量(不要提交到 Git)
├── .env.example            # 环境变量示例
└── package.json
```

## 下一步

- 注册账号并登录
- 浏览书籍列表
- 为喜欢的书投票
- 发表评论

祝使用愉快! 🎉
