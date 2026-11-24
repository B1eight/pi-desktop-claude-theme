# Claude Theme

为 PI-Desktop 提供简洁、克制的 Claude 风格浅色与深色纯声明式主题。

[插件市场](https://plugins.aiuo.net/plugins/io.github.b1eight.pi-desktop-claude-theme) · [下载与发布](https://github.com/B1eight/pi-desktop-claude-theme/releases) · [更新记录](CHANGELOG.md) · [问题反馈](https://github.com/B1eight/pi-desktop-claude-theme/issues)

## 安装与使用

1. 从[插件市场](https://plugins.aiuo.net/plugins/io.github.b1eight.pi-desktop-claude-theme)或 [Releases](https://github.com/B1eight/pi-desktop-claude-theme/releases) 下载 `.piplug` 安装包（不要下载 Source code 压缩包）。
2. 在 PI-Desktop 插件页选择「安装插件包」并确认 `ui.theme` 权限。
3. 在「设置 → 外观」选择 **Claude Theme Light** 或 **Claude Theme Dark**；切换回内置主题即可恢复默认外观。

## 说明

- **轻量兼容**：面向 PI-Desktop **0.23.0**（清单声明 `>= 0.20.1`），以宿主原生主题变量为主，保持轻量并兼容宿主交互；支持 `prefers-reduced-motion`、`prefers-contrast: more` 与 `forced-colors: active`。
- **零依赖字体**：不内嵌字体、不联网请求。正文优先使用本机已安装的开源衬线（`Source Serif 4` / `Newsreader` / `Literata` 与 `Noto Serif SC` / `Source Han Serif SC`），未安装时自动回落至系统衬线。

## 构建

需要 Node.js **24+**，执行以下命令从 `src/` 生成 `themes/claude-{light,dark}.css`：

```sh
npm run build
```

## 许可与声明

基于 [MIT](LICENSE) 开源，部分早期设计参考 [Caho1/open-claude-ui](https://github.com/Caho1/open-claude-ui)。本插件不随包分发字体（见 [assets/README.md](assets/README.md)）。

本项目为非官方主题，不隶属于 Anthropic，不含任何 Anthropic 专有字体、标识或代码。
