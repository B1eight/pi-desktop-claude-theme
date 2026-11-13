# 字体说明

本版本不内嵌字体：主题 CSS 中不含 `@font-face` 或字体二进制，所有字形均来自宿主与系统已安装的字体族，无网络加载。

- UI：优先使用 `-apple-system` / `BlinkMacSystemFont`；其他平台回退至 `Segoe UI`、`PingFang SC`、`Noto Sans SC`、`system-ui` 和微软雅黑等。中文可用族位于通用回退之前，具体命中取决于本机安装情况。
- 回复正文、正文标题与引用：独立的 `--font-prose` 栈，包括 Iowan Old Style、Palatino Linotype、Book Antiqua、Georgia、Noto Serif SC、Source Han Serif SC、Songti SC、STSong 和 `serif`。未安装的字体会正常回退，不随插件下载。
- 等宽：`Cascadia Code`、`ui-monospace`、`SFMono-Regular`、`Consolas` 等；代码块不会继承正文衬线字体。

实际字形、字重与平滑效果随操作系统、已安装字体和用户设置变化，本项目不承诺跨平台字形一致。暗色字体平滑声明是呈现提示，不是跨平台栅格化保证。

此前版本内嵌的 Inter 与 JetBrains Mono 仍不随本版本分发，不存在需要随包分发的字体许可。
