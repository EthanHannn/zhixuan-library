# 知轩藏书排行榜 - 服务器版

这是知轩藏书排行榜的服务器版本,使用 Next.js + Prisma + SQLite 构建,支持用户系统、评论功能和书籍管理。

## 功能特性

- ✅ 用户注册/登录系统
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
- **ORM**: Prisma
- **用户认证**: NextAuth.js
- **表单验证**: Zod + React Hook Form

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

环境变量已配置在 `.env` 文件中:

```bash
# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="zhixuan-secret-key-change-in-production-2026"
```

### 3. 数据库已初始化

数据库和数据已经导入完成,包含 6759 本书籍。

### 4. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 项目结构

```
zhixuan-library/
├── prisma/
│   ├── schema.prisma          # 数据库模型定义
│   ├── dev.db                 # SQLite 数据库文件
│   └── migrations/            # 数据库迁移文件
├── scripts/
│   ├── books_complete.json    # 书籍数据
│   └── import-books-simple.js # 数据导入脚本
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── api/              # API路由
│   │   │   ├── auth/         # 认证API
│   │   │   ├── books/        # 书籍API
│   │   │   ├── comments/     # 评论API
│   │   │   └── votes/        # 投票API
│   │   ├── layout.tsx        # 根布局
│   │   ├── page.tsx          # 首页
│   │   └── providers.tsx     # Providers
│   └── lib/                  # 工具函数
│       ├── prisma.ts         # Prisma客户端
│       └── auth.ts           # 认证配置
├── .env                      # 环境变量
├── package.json
└── README.md
```

## API 接口

### 认证

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/[...nextauth]` - NextAuth 认证

### 书籍

- `GET /api/books` - 获取书籍列表
- `GET /api/books/[id]` - 获取书籍详情
- `POST /api/books` - 提交新书(需登录)

### 投票

- `POST /api/votes` - 投票(需登录)
- `GET /api/votes?bookId=xxx` - 获取投票记录

### 评论

- `POST /api/comments` - 发表评论(需登录)
- `GET /api/comments?bookId=xxx` - 获取评论列表

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

## 许可证

MIT
