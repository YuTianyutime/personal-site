# 余天宇个人主页

这是一个可直接部署到 GitHub Pages 的个人主页。公开页面适合手机浏览，管理页面可以在手机上编辑文字、上传头像、添加或替换照片。

## 页面地址

- 公开主页：`index.html`
- 手机管理页：`admin.html`
- 网站内容：`data/site.json`
- 上传照片：`assets/uploads/`

## 第一次发布

1. 在 GitHub 新建一个公开仓库，例如 `personal-site`。
2. 把这个文件夹中的全部文件上传到仓库的 `main` 分支。
3. 打开仓库的 `Settings → Pages`。
4. 在 `Build and deployment` 中选择 `Deploy from a branch`。
5. 分支选择 `main`，目录选择 `/ (root)`，然后保存。
6. 等待 1–3 分钟，公开地址通常是：
   `https://你的用户名.github.io/personal-site/`
7. 手机管理地址是在公开地址后加 `admin.html`：
   `https://你的用户名.github.io/personal-site/admin.html`

## 手机管理需要的 GitHub 令牌

管理页不使用普通账号密码，而是通过一个只针对这个仓库的 GitHub 令牌保存修改。

1. 登录 GitHub。
2. 打开 `Settings → Developer settings → Personal access tokens → Fine-grained tokens`。
3. 创建一个新令牌，并把仓库访问范围限制为这个个人网站仓库。
4. 在仓库权限中开启 `Contents: Read and write`。
5. 把令牌粘贴到手机管理页。令牌只保存在你的浏览器中，不会写入网站文件。

## 日常更新

1. 手机打开管理地址。
2. 修改文字，或者从相册添加 / 替换照片。
3. 点击底部“保存到网站”。
4. 等 1–3 分钟，刷新公开主页即可看到新内容。

## 注意

- 不要把访问令牌发给别人。
- 管理页本身没有独立登录密码，真正的写入权限由 GitHub 令牌保护。
- 建议定期使用“设置与备份 → 导出”保存一份内容备份。
- 如果不需要公开管理入口，可以删除主页页脚的“管理网页”链接，管理地址仍然可以直接访问。
