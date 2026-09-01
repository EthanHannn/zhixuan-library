# 生产部署布局

服务器目录固定为 `/opt/zhixuan-library`：

- `compose.production.yml`：单实例 Docker Compose 配置，只监听宿主机 `127.0.0.1:6870`。
- `.env.production`：生产环境变量，禁止提交 Git。
- `data/library.db`：可写 SQLite 数据库。
- `novels/`：只读挂载的评分不低于 7.5 的正文。
- `covers/`：容器内 `node` 用户可写；用于保存阅读时低频补全的真实封面。
- `nginx-library.conf`：签发证书前使用的 HTTP / ACME 反向代理模板。
- `nginx-library-https.conf`：证书就绪后使用的 HTTPS 与强制跳转模板。

镜像必须在本地或 CI 构建为 `linux/amd64`，服务器只负责加载镜像和启动容器。
