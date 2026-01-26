# 知轩藏书排行榜 - 服务器版

这是知轩藏书排行榜的服务器版本,使用 Next.js + Prisma + SQLite 构建,支持用户系统、评论功能和书籍管理。

## 功能特性

- ✅ 用户注册/登录系统(用户名+密码)
- ✅ 书籍列表展示与搜索
- ✅ 书籍详情页
- ✅ 投票功能(仙草/粮草/干草/枯草/毒草)
- ✅ 评论系统(支持回复)
- ✅ 个人中心
- ✅ 提交新书
- ✅ 管理员审核

## 技术栈

- **前端框架**: Next.js 14 (App Router)
- **样式方案**: TailwindCSS
- **数据库**: SQLite (开发环境)
- **ORM**: Prisma 5.22.0
- **用户认证**: NextAuth.js
- **表单验证**: Zod

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`:

**Windows:**
```cmd
copy .env.example .env
```

**Linux/Mac:**
```bash
cp .env.example .env
```

环境变量说明:
```env
# Database - SQLite 开发环境
DATABASE_URL="file:./dev.db"

# NextAuth 配置
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
```

### 3. 初始化数据库

```bash
# 生成 Prisma Client
npx prisma generate

# 运行迁移
npx prisma migrate dev --name init
```

### 4. 导入书籍数据

**重要**: 使用新的跨平台兼容脚本

```bash
# 导入 6759 本书籍数据
node scripts/import-books-prisma.js
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## Windows 用户注意事项

本项目已移除 `better-sqlite3` 依赖,完全使用 Prisma Client,确保在 Windows 环境下无需编译原生模块。

如果遇到问题:
1. 确保使用 Node.js 18+ 版本
2. 删除 `node_modules` 和 `package-lock.json` 重新安装
3. 使用 `node scripts/import-books-prisma.js` 导入数据

## 项目结构

```
zhixuan-library/
├── prisma/
│   ├── schema.prisma          # 数据库模型定义
│   └── migrations/            # 数据库迁移文件
├── scripts/
│   ├── books_complete.json    # 书籍数据(6759本)
│   └── import-books-prisma.js # 数据导入脚本(跨平台)
├── src/
│   ├── app/
│   │   ├── api/              # API路由
│   │   │   ├── auth/         # 认证API
│   │   │   ├── books/        # 书籍API
│   │   │   ├── comments/     # 评论API
│   │   │   └── votes/        # 投票API
│   │   ├── book/[id]/        # 书籍详情页
│   │   ├── login/            # 登录页
│   │   ├── register/         # 注册页
│   │   ├── profile/          # 个人中心
│   │   ├── layout.tsx        # 根布局
│   │   ├── page.tsx          # 首页
│   │   └── providers.tsx     # Providers
│   └── lib/
│       ├── prisma.ts         # Prisma客户端
│       └── auth.ts           # 认证配置
├── .env.example              # 环境变量示例
├── package.json
└── README.md
```

## API 接口

### 认证

- `POST /api/auth/register` - 用户注册(用户名+密码)
- `POST /api/auth/[...nextauth]` - NextAuth 认证

### 书籍

- `GET /api/books` - 获取书籍列表(支持搜索、排序、分页)
- `GET /api/books/[id]` - 获取书籍详情
- `POST /api/books` - 提交新书(需登录)

### 投票

- `POST /api/votes` - 投票(需登录)
- `GET /api/votes?bookId=xxx` - 获取投票记录

### 评论

- `POST /api/comments` - 发表评论(需登录)
- `GET /api/comments?bookId=xxx` - 获取评论列表

## 页面路由

- `/` - 首页(书籍列表)
- `/login` - 登录页
- `/register` - 注册页
- `/profile` - 个人中心
- `/book/[id]` - 书籍详情页

## 部署

### Vercel 部署

1. 将代码推送到 GitHub
2. 在 Vercel 导入项目
3. 配置环境变量
4. 部署

### 数据库选择

开发环境使用 SQLite,生产环境建议使用:

- **Railway** - PostgreSQL
- **PlanetScale** - MySQL
- **Supabase** - PostgreSQL + 认证服务

## 常见问题

### Q: Windows 上导入数据失败?
A: 使用 `node scripts/import-books-prisma.js` 而不是旧的 `import-books-simple.js`

### Q: 数据库文件在哪里?
A: 在 `prisma/dev.db`,这是 SQLite 数据库文件

### Q: 如何重置数据库?
A: 删除 `prisma/dev.db` 和 `prisma/migrations` 目录,重新运行 `npx prisma migrate dev`

## 许可证

MIT
