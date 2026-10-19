# Claude Theme

为 PI-Desktop 提供简洁、温和的 Claude 风格浅色与深色主题。

[下载与版本发布](https://github.com/B1eight/pi-desktop-claude-theme/releases) · [更新记录](CHANGELOG.md) · [问题反馈](https://github.com/B1eight/pi-desktop-claude-theme/issues)

## 效果预览

### Claude Theme Light

![Claude Theme Light 浅色主题实际界面](docs/screenshots/claude-light.png)

### Claude Theme Dark

![Claude Theme Dark 深色主题实际界面](docs/screenshots/claude-dark.png)

## 安装与使用

1. 在 [Releases](https://github.com/B1eight/pi-desktop-claude-theme/releases) 页下载 `.piplug` 安装包，而不是 GitHub 自动生成的 Source code 压缩包。
2. 打开 PI-Desktop 的插件页面，通过菜单选择“安装插件包”，选中下载的文件并确认权限。
3. 在主题设置中选择 **Claude Theme Light** 或 **Claude Theme Dark**。切换其他主题即可恢复。

需要 PI-Desktop **0.20.1 或更高版本**。插件 ID：`io.github.b1eight.pi-desktop-claude-theme`。

## 特点

- 浅色与深色两套配色，覆盖聊天、侧栏、设置和常用反馈界面。
- 内嵌 Inter 与 JetBrains Mono 字体，无需联网加载；中文等字形使用系统字体回退。
- 保留原生过程结构和折叠交互，不增加过程区整体外框，不截断正文。
- 仅使用 `ui.theme` 权限，无网络请求、工具注册或运行时 DOM 脚本。

主题只调整外观，不改变宿主业务行为；流式说明迁入过程区等宿主行为不在主题修复范围。1.0.0 已获用户本地安装验收，未来宿主版本的样式兼容性仍需验证。

## 开发

需要 Node.js **24+**，无 npm 依赖。

```sh
npm run build
npm test
npm run verify
npm run check:roles
```

构建、浏览器测试与打包方式见 [开发说明](docs/DEVELOPMENT.md)。

## 许可与致谢

代码使用 [MIT](LICENSE)，保留 ebo、Caho1 的版权声明。部分设计参考 [Caho1/open-claude-ui](https://github.com/Caho1/open-claude-ui)（提交 `2834bc158a4849f21c97cbb2e0b10525f6e646f1`）。字体使用 [SIL OFL 1.1](assets/licenses/OFL-1.1.txt)，详见 [字体说明](assets/README.md)。

本项目是非官方主题，不隶属于 Anthropic，也未获其背书；不包含其专有字体、logo 或官方产品代码。
