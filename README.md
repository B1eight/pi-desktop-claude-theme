# Claude Theme

为 PI-Desktop 提供简洁、温和的 Claude 风格浅色与深色主题。

[插件市场](https://plugins.aiuo.net/plugins/io.github.b1eight.pi-desktop-claude-theme) · [下载与版本发布](https://github.com/B1eight/pi-desktop-claude-theme/releases) · [更新记录](CHANGELOG.md) · [问题反馈](https://github.com/B1eight/pi-desktop-claude-theme/issues)

## 安装与使用

从上方[插件市场](https://plugins.aiuo.net/plugins/io.github.b1eight.pi-desktop-claude-theme)页下载 `.piplug`，安装后确认 `ui.theme` 权限；也可以从 [Releases](https://github.com/B1eight/pi-desktop-claude-theme/releases) 页下载同一安装包（不要下载自动生成的 Source code 压缩包），在 PI-Desktop 插件页面通过菜单选择“安装插件包”。

安装完成后，在主题设置中选择 **Claude Theme Light** 或 **Claude Theme Dark**。切换其他主题即可恢复。

需要 PI-Desktop **0.20.1 或更高版本**。插件 ID：`io.github.b1eight.pi-desktop-claude-theme`。声明的最低版本不等于逐版验收：1.1.0 的真机验收基线是 **0.22.0**，0.20.1–0.21.x 未单独验收。

## 特点

- 浅色与深色两套配色，覆盖聊天、侧栏、设置与常用反馈界面；输入框 12px、用户气泡 14px、模态框 10px，与 Claude 原生档位一致。
- UI 用平台优先的系统无衬线字体，正文用独立的人文衬线回退栈，代码等宽；无内嵌字体或网络加载，实际字形取决于已安装字体。
- 区分文字陶土色与状态/聚焦陶土色，采用细内环、柔和光晕与单层容器边界。
- 70ms 按压微缩、CSS 弹簧近似、滚动边缘渐隐、运行态呼吸与微光；遵循减少动态效果与强制色设置。
- 保留原生过程结构、折叠交互与滚动定位，不增加过程区整体外框，不截断正文。

主题只调整外观，不改变宿主业务行为；仅使用 `ui.theme`，无运行时 DOM 脚本。构建与合成浏览器检查不能替代实际安装体验，未来宿主版本的兼容性以实际使用为准。覆盖到哪一步、哪些面未覆盖，见 [验收状态目录](docs/acceptance-states.json) 与 [CHANGELOG 的「已知未覆盖」](CHANGELOG.md)。

## 与 Claude 的已知差异

这是「像 Claude」的复刻，不是逐令牌克隆。以下差异均为刻意保留，取值依据保存在维护者的基准材料里：

- **弱化文字比 Claude 略深**：Claude 的 gray-450 `#7b7974` 在浅色纸面上只有 4.13:1，我们改用 `#75746d`（4.69:1）；代价是 muted 文字比焦点环更深，次要文字不会淡到近乎消失。faint 与 placeholder 在指定页面/输入框背景上的目标为 2.8:1–3.6:1，属于视觉优先的弱化，不是 WCAG 豁免或整套主题的无障碍符合性声明。
- **深色内联码比 Claude 更浅**：`#f1a6a6`，Claude 用 `--cds-red-300 #e66767`；浅色完全一致（`#8e2626` = Claude `--cds-text-tint-red`）。
- **基础过渡 150ms**（Claude 200ms）是宿主身份值，改它等于整体换节奏；焦点环单独用 200ms 对齐 Claude。
- **正文行高 1.68**：Claude 的换算基于 14px 西文正文，与本主题 16px 正文分母不同，不可直接比较。
- **三处 1–3 个色阶的细节兼容**：`text-primary` Δ1、`text-secondary` Δ2、`bg-inset` +1/+2/+3。

## 开发

仓库只含插件主体与构建链：`src/` 的 CSS、`scripts/build.mjs` 及其三个压缩依赖、`themes/` 的产物。需要 Node.js **24+**，无 npm 依赖。

```sh
npm run build
```

构建产物写入 `themes/claude-light.css` 与 `themes/claude-dark.css`；打包用 PI-Desktop 的 PluginCheck → PluginPack，`dist/` 不进版本库。基准材料、真机取证脚本与校验工具留在维护者本机，因此仓库不提供 `npm test` 或验收类命令。

## 许可与致谢

代码使用 [MIT](LICENSE)，保留 ebo、Caho1 的版权声明。部分设计参考 [Caho1/open-claude-ui](https://github.com/Caho1/open-claude-ui)（提交 `2834bc158a4849f21c97cbb2e0b10525f6e646f1`）。本版本不再随包分发字体，详见 [字体说明](assets/README.md)。

本项目是非官方主题，不隶属于 Anthropic，也未获其背书；不包含其专有字体、logo 或官方产品代码。
