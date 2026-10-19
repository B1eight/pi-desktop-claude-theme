# Claude Theme

PI-Desktop 的非官方 Claude 风格浅色与深色主题。不隶属于 Anthropic，也未获其背书；不包含其专有字体、logo 或官方产品代码。

## 使用

安装发布的 `.piplug` 文件后，在 PI-Desktop 的主题设置中选择 **Claude Theme Light** 或 **Claude Theme Dark**。切换其他主题即可恢复。

- 版本：**1.0.0**
- 插件 ID：`io.github.b1eight.pi-desktop-claude-theme`
- 主题 ID：`claude-light`、`claude-dark`
- 宿主要求：PI-Desktop **>=0.20.1**；不保证未来宿主版本的样式兼容性。
- 仅声明 `ui.theme` 权限，无网络请求、工具注册或运行时 DOM 脚本。

## 呈现与限制

提供统一的聊天、侧栏、设置与局部反馈样式，保留原生过程结构和折叠交互。过程区不增加整体外框；thinking 保持原有 12px／1.625 行高，正文不截断、不整体弱化。

主题不改变宿主业务行为，无法修复流式说明后续迁入过程区的归组问题。中文等字形使用系统字体回退。

1.0.0 安装包已通过本地包校验，用户真机安装验收未发现明显差异或阻塞。尚未发布到插件市场或通过市场审核；此结论不代表跨平台或未来版本认证。

## 开发

需要 Node.js **24+**，无 npm 依赖。

```sh
npm run build
npm test
npm run verify
npm run check:roles
```

构建、浏览器测试与打包说明见 [开发说明](docs/DEVELOPMENT.md)。`themes/` 是清单直接引用的运行文件，应纳入仓库；安装包和测试输出不纳入源码。

## 许可与致谢

代码使用 [MIT](LICENSE)，保留 ebo、Caho1 的版权声明。部分设计参考 [Caho1/open-claude-ui](https://github.com/Caho1/open-claude-ui)（提交 `2834bc158a4849f21c97cbb2e0b10525f6e646f1`）。独立仓库不代表所有代码均为原创。

内嵌 Inter 与 JetBrains Mono 字体使用 [SIL OFL 1.1](assets/licenses/OFL-1.1.txt)，详见 [字体说明](assets/README.md)。
