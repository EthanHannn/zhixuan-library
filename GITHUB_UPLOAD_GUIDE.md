# GitHub 上传指南

由于 GitHub token 权限限制,请按照以下步骤手动上传项目到 GitHub:

## 方法一:通过 GitHub 网页界面

1. 访问 [GitHub](https://github.com)
2. 点击右上角的 "+" 按钮,选择 "New repository"
3. 填写仓库信息:
   - Repository name: `zhixuan-library`
   - Description: `知轩藏书排行榜 - 服务器版`
   - 选择 Public
   - 不要勾选 "Initialize this repository with a README"
4. 点击 "Create repository"
5. 在本地项目目录执行以下命令:

```bash
cd /home/ubuntu/zhixuan-library
git remote add origin https://github.com/YOUR_USERNAME/zhixuan-library.git
git branch -M main
git push -u origin main
```

## 方法二:使用 GitHub CLI (如果已安装)

```bash
cd /home/ubuntu/zhixuan-library
gh repo create zhixuan-library --public --source=. --remote=origin --push
```

## 方法三:下载压缩包后上传

1. 下载项目压缩包: `/home/ubuntu/zhixuan-library.tar.gz`
2. 解压到本地
3. 在 GitHub 创建新仓库
4. 使用 Git 命令推送代码

## 环境变量配置

上传到 GitHub 后,记得在部署平台(如 Vercel)配置以下环境变量:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="https://your-domain.vercel.app"
NEXTAUTH_SECRET="your-secret-key-here"
```

## 数据库迁移

首次部署后,需要运行数据库迁移:

```bash
npx prisma generate
npx prisma migrate deploy
node scripts/import-books-simple.js
```

## 注意事项

- 数据库文件 (`*.db`) 已被 `.gitignore` 排除,不会上传到 GitHub
- 需要在生产环境重新导入书籍数据
- 建议使用 PostgreSQL 或 MySQL 作为生产数据库
