# 知轩藏书排行榜 - 服务器版

这是知轩藏书排行榜的服务器版本,使用 Next.js + Prisma + SQLite 构建,支持用户系统、评论功能、书籍管理,以及**本地小说在线阅读**。

## 功能特性

- ✅ 门户统一登录（nginx + Authelia，书屋无独立密码）
- ✅ 书籍列表展示与搜索(封面墙,支持"只看有正文"筛选)
- ✅ 书籍详情页(封面、简介、评分、**开始阅读**、**查看原站**)
- ✅ **本地小说在线阅读**(`/read/[id]`):章节目录、上下章、字号调节、六套阅读配色、可关闭的彩色正文、键盘翻页、阅读进度记忆(本地 + 云端同步)
- ✅ 个人中心:**最近阅读**(续读入口) + 投票记录
- ✅ 投票功能(仙草/粮草/干草/枯草/毒草)
- ✅ 评论系统(支持回复)
- ✅ 提交新书 / 管理员审核
- ✅ 私有书房权限:页面、API、封面和图片优化均由门户认证保护，容器内部健康检查保留
- ✅ 作者作品聚合、动态分类书架与真实封面元数据

## 私有访问与默认读者

书屋只接受受信任 nginx 转发的 `Remote-User`，必须匹配 `PORTAL_ALLOWED_USER`。配置 `LIBRARY_PUBLIC_URL` 和 `PORTAL_AUTH_URL` 为完整 HTTPS 地址；缺少配置或身份即拒绝访问，不提供开发认证绕过。

nginx 配置由相邻 personal-portal 项目生成；仅发布 `127.0.0.1:6870`。门户登录成功后可直接阅读，退出前往统一认证页。旧 `/login` 和 `/register` 固定返回首页，旧 `/api/auth/*` 退役。

```bash
npm run seed:reader
```

此脚本幂等移除用户表的旧密码列，创建 `default-reader` 作为书架、进度、评论和投票的归属。它不会导入旧用户关系，不重建书籍和章节。生产启动时自动执行，执行失败则不启动服务；部署前须一致性备份数据库。

```bash
npm run test:policy
npm run build
npm run test:auth
```

`test:auth` 使用系统临时目录中的独立数据库、样本正文和回环端口 16870，不读取生产书库。可设置 `AUTH_TEST_IMAGE` 验证构建后的 Docker 镜像。

## 本地正文导入

项目通过 `scripts/import-full.js` 把本地已解压的知轩藏书 TXT 合集导入 SQLite:

```bash
# 全量导入(元数据来自 scripts/catalog.json,正文扫描 NOVEL_ROOT 下的分卷文件夹)
node scripts/import-full.js --reset

# 用文件夹名中的 POST序号 补匹配未命中的书籍
node scripts/rematch.js
```

> **警告:** `--reset` 会清空现有书籍、章节、投票、评论和阅读进度,只应在首次初始化或确定要重建全部数据时使用。

- 正文不复制进数据库,按 **GB18030 字节偏移** 建立章节索引,按需从磁盘读取
- `NOVEL_ROOT` 环境变量指向小说根目录(见 `.env`)
- 导入时自动为每本书生成封面 SVG 到 `public/covers/{id}.svg`;该目录由 Git 忽略,部署时需要重新生成
- 数据源: `scripts/catalog.json`(由知轩藏书统计 Excel 生成,含 6759 本书的元数据)

## 高分封面刮削

原知轩站目前无法解析，封面脚本依次查询起点移动站、QQ 阅读和豆瓣的公开页面或元数据，进行严格的书名+作者匹配。封面只下载到本地，不在页面中盗链远程图片：

```bash
# 默认评分 >= MIN_BOOK_SCORE,单并发,每批100本
npm run scrape:covers

# 扩大一个可续跑批次;0表示处理所有剩余作品
node scripts/scrape-covers.js --limit 300
```

脚本默认在每次外部请求之间随机等待 4.5~7.5 秒。单个来源遇到 HTTP 403/429 后，本批将暂停该来源并继续尝试后备来源，不会轮换 IP 或绕过限制。运行状态保存在 Git 忽略的 `var/cover-scrape-state.json`，真实封面保存在 `public/covers/real/`，并在数据库记录实际来源和抓取时间。

生产服务会自动低频补全真实封面：默认启动 30 秒后开始，之后约每 90 秒从尚无真实封面的作品中选择一本，优先处理仙草数和评分较高的作品。阅读页仍会即时触发当前作品的补全，两种入口共用服务器端单并发队列。未匹配 30 天内不重试，普通错误 24 小时内不重试；单个来源遇到 403/429 会暂停该来源 6 小时，并继续使用其他来源。生产环境的 `covers/` 因此需要对容器内的 `node` 用户可写。

自动补全在生产环境默认开启，可用 `COVER_AUTO_FETCH=false` 关闭；`COVER_AUTO_FETCH_INTERVAL_SECONDS` 和 `COVER_AUTO_FETCH_INITIAL_DELAY_SECONDS` 可调整常规间隔与首次延迟。常规间隔最低为 30 秒，并自动加入 ±20% 随机抖动，避免形成固定频率请求。`/api/health` 会返回不含敏感信息的 `coverBackfill` 运行状态。

## 语音朗读

阅读器使用浏览器 Web Speech API 提供本地 TTS，支持分段朗读、播放/暂停/停止、上一段/下一段、系统音色、0.6~2.0 倍语速、当前段高亮与自动跟随。音色和语速只保存在当前浏览器，不上传服务端；具体可用音色取决于操作系统与浏览器。

## 技术栈

- **前端框架**: Next.js 16 (App Router)
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
PORTAL_ALLOWED_USER="owner"
LIBRARY_PUBLIC_URL="https://library.private.example.test"
PORTAL_AUTH_URL="https://auth.private.example.test"

# 本地已解压的小说根目录（推荐使用正斜杠，便于跨平台配置）
NOVEL_ROOT="E:/path/to/novels"

# 只展示和处理该评分以上的作品
MIN_BOOK_SCORE="7.5"
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
# 导入 6759 本书籍元数据 + 本地正文章节索引
node scripts/import-full.js
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## Windows 用户注意事项

本项目已移除 `better-sqlite3` 依赖,完全使用 Prisma Client,确保在 Windows 环境下无需编译原生模块。

如果遇到问题:
1. 确保使用 Node.js 20.9+ 版本
2. 删除 `node_modules` 和 `package-lock.json` 重新安装
3. 使用 `node scripts/import-full.js` 导入数据

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
