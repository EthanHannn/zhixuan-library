# 生产部署布局

服务器目录固定为 `/opt/zhixuan-library`：

- `compose.production.yml`：单实例 Docker Compose 配置，只监听宿主机 `127.0.0.1:6870`。
- `.env.production`：生产环境变量，禁止提交 Git。
- `data/library.db`：可写 SQLite 数据库。
- `novels/`：只读挂载的评分不低于 7.5 的正文。
- `covers/`：只读封面。
- `nginx-library.conf`：`library.aivideoart.cn` 的反向代理模板。

镜像必须在本地或 CI 构建为 `linux/amd64`，服务器只负责加载镜像和启动容器。

