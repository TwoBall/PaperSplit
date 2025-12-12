# Cloudflare Pages 自动化部署指南

本指南将帮助你将 `paper-split` 项目部署到 Cloudflare Pages，并实现 Git 提交后的自动构建与发布。

## 前置条件

1.  拥有一个 **Cloudflare** 账号。
2.  拥有一个 **GitHub** 账号。
3.  项目代码已上传至你的 GitHub 仓库。

## 自动化原理

Cloudflare Pages 会连接你的 GitHub 仓库。每当你向仓库（通常是 `master` 或 `main` 分支）推送新代码时，Cloudflare 会自动拉取代码、安装依赖、运行构建脚本，并将生成的静态文件发布到全球网络。

## 操作步骤

### 1. 登录 Cloudflare Pages

1.  访问 [Cloudflare Dashboard](https://dash.cloudflare.com/) 并登录。
2.  在左侧菜单选择 **"Workers & Pages"**。
3.  点击 **"Create Application"** (创建应用)。
4.  选择 **"Pages"** 标签页。
5.  点击 **"Connect to Git"** (连接到 Git)。

### 2. 连接 GitHub 仓库

1.  如果你未授权，点击 "Connect GitHub" 并授权 Cloudflare 访问你的仓库。
2.  在仓库列表中，选择 `paper-split` 项目仓库。
3.  点击 **"Begin setup"** (开始设置)。

### 3. 配置构建设置 (关键步骤)

在 "Set up builds and deployments" 页面，填写以下信息：

*   **Project name**: 自定义项目名称（将成为默认域名的一部分，如 `paper-split.pages.dev`）。
*   **Production branch**: 选择 `master` 或 `main`。
*   **Framework preset** (框架预设): 选择 **Vite**。
*   **Build command** (构建命令): `npm run build` (选择 Vite 后会自动填充)。
*   **Build output directory** (构建输出目录): `dist` (选择 Vite 后会自动填充)。

> **注意**: 环境变量通常不需要配置，除非你后续添加了特殊的 API Keys。

### 4. 完成部署

1.  点击 **"Save and Deploy"**。
2.  Cloudflare 将开始首次构建。你可以查看实时日志。
    *   它会执行 `Cloning repository...`
    *   然后 `Installing dependencies...`
    *   接着 `Running build command: npm run build`
    *   最后 `Uploading build output...`
3.  看到 **"Success!"** 后，点击上方提供的链接（例如 `https://your-project.pages.dev`）即可访问。

## 后续自动更新

设置完成后，**自动化已经建立**。

*   **操作**: 每次你在本地修改代码后，执行 `git push` 推送到 GitHub。
*   **结果**: Cloudflare Pages 会在几秒钟内检测到变更，自动触发新的部署。你无需再次登录 Cloudflare 操作。

## 常见问题排查

*   **构建失败**: 检查 Cloudflare 上的 "Build logs"。常见原因是 `package.json` 中的依赖版本冲突或构建脚本错误。
*   **页面空白**: 确保构建输出目录确实是 `dist`。本项目使用的是 Vite，默认即为 `dist`。
