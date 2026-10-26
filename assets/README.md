# 字体说明

本版本不内嵌字体：主题 CSS 中不含 `@font-face` 或字体二进制，所有字形均来自宿主与系统已安装的字体族。

- 西文：`Segoe UI`。
- 中文：`Noto Sans SC`。该族必须排在 `system-ui` 之前；Windows 上 `system-ui` 直接映射到微软雅黑，会抢先匹配所有中文字形，排在它后面的字体对中文不生效。
- 等宽：`Cascadia Code`、`ui-monospace`、`SFMono-Regular`、`Consolas`。

因此实际字形随操作系统与用户设置变化，本项目不承诺跨平台字形一致。由于不再随包分发字体，也不存在需要随包分发的字体许可。

此前版本内嵌的 Inter 与 JetBrains Mono 已从源码与安装包中移除。
