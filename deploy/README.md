# 生产部署布局

服务器目录固定为 `/opt/zhixuan-library`：

- `compose.production.yml`：单实例 Docker Compose 配置，只监听宿主机 `127.0.0.1:6870`。
- `.env.production`：生产环境变量，禁止提交 Git。
- `data/library.db`：可写 SQLite 数据库。
- `novels/`：只读挂载的评分不低于 7.5 的正文。
- `covers/`：容器内 `node` 用户可写；用于保存生产服务定时补全及阅读时即时补全的真实封面。
- nginx 配置统一由 personal-portal 生成；本仓库旧的直接反代模板已移除，避免遗漏统一鉴权。

镜像必须在本地或 CI 构建为 `linux/amd64`，服务器只负责加载镜像和启动容器。

生产环境默认每约 90 秒自动处理一本待补封面的作品，并优先处理仙草数较高的作品。可在 `.env.production` 中用 `COVER_AUTO_FETCH`、`COVER_AUTO_FETCH_INTERVAL_SECONDS` 和 `COVER_AUTO_FETCH_INITIAL_DELAY_SECONDS` 控制开关与频率；任务保持单并发，来源未匹配、普通错误和限流均有冷却保护。部署后可通过 `/api/health` 的 `coverBackfill` 字段确认调度器状态。


认证配置为 `PORTAL_ALLOWED_USER`、`LIBRARY_PUBLIC_URL`、`PORTAL_AUTH_URL`，书屋不再使用密码或 NextAuth 密钥。启动脚本先幂等移除旧密码列并创建默认读者；准备一致性备份后才更新镜像。保留原 `.env.production` 中与书库和封面有关的设置，删除旧认证变量。

切换时先让旧书屋入口进入维护状态，再停止书屋、备份 SQLite 并启动新版本；新版本健康且可信身份访问通过后，启用受保护的新子域，旧域名只作页面跳转且拒绝 API。回滚同时恢复旧数据库、Compose、镜像与 nginx 配置，其他站点不参与切换。
