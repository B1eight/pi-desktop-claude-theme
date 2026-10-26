# 开发说明

## 结构与构建

- `src/`：当前主题样式源。
- `assets/`：六款字体源文件及许可；构建将字体内嵌到 CSS，无网络依赖。
- `themes/`：生成的浅色与深色主题，必须与源码构建一致。
- `scripts/`、`tests/`：构建、检查与独立测试。
- `host-contract.json`：PI-Desktop 0.20.1 的静态指纹与结构约束，不含宿主源码。

从项目根执行 `npm run build`。修改版本时同步 `manifest.json` 和 `package.json`，再构建与验证。

每份 CSS 硬限 **262144 bytes**。当前 Light 为 **259402 bytes**，Dark 为 **259413 bytes**，剩余 **2742／2731 bytes**，低于 4 KiB 软余量目标；不要提高硬限或删除字体来绕过检查。

构建采用主题作用域与前缀提取，再进行三步等价减容：

1. 将同一完整字面主题根下的规则嵌套，保留条件与顺序，关键帧保持全局；未知结构拒绝处理。
2. 只合并同父级、相邻、声明逐字相同的叶规则；不跨规则搬移声明，不合并厂商专有伪元素列表。
3. 只清理选择器逗号后的空白，不改声明、字符串、后代空格或字体载荷。

## 检查

`npm test` 检查变换边界与阶段等价；`npm run verify` 检查身份、权限、字体和生成产物；`npm run check:roles` 检查颜色角色。

浏览器检查使用本项目合成场景，比较全部规则的 CSSOM 及代表场景计算样式。输出必须是项目外的新目录：

```sh
node scripts/check-css-equivalence.mjs --output-dir <external-new-directory>
```

默认使用 Windows Chrome，可用 `--chrome <executable>` 指定浏览器。静态或合成测试不代替用户实际安装验收。

可选本地宿主检查：

```sh
node scripts/verify.mjs --host-bundle <external-host-main.js>
node scripts/check-host-contract.mjs --host-root <external-evidence-directory> --runtime-json <external-runtime.json> --self-test
```

未提供 host-bundle 时不执行实际宿主 sanitizer。宿主契约只检查指纹与结构，不认证业务、持久化或未来版本；宿主变化需人工审查，不自动更新期望指纹。

`capture-host-evidence.mjs` 是可选本机取证工具，需显式指定 `--asar`、`--electron-exe`、`--output-dir`，并把 `PI_SCRATCH_DIR` 设为项目外临时根；输出目录必须全新。使用前阅读工具，不在 CI 默认执行。取证源码、ASAR、浏览器 profile 与本机报告不进入仓库。

## 打包

不要直接打包整个源码目录，`.gitignore` 不控制打包工具。向干净暂存目录只复制以下文件：

```text
manifest.json
main.js
LICENSE
README.md
themes/claude-light.css
themes/claude-dark.css
```

使用 PI-Desktop 官方 **PluginCheck → PluginPack** 生成安装包，不用普通 ZIP 工具替代。核对解包内容、主题哈希与声明身份。安装包适合作为 GitHub Release 附件，不提交到源码仓库。市场上传按实际表单要求另行准备。

后续公开版本有内容变更时升级版本号并重新检查、安装验收，不覆盖同版本的不同内容。`package.json` 的 `private: true` 仅防止误发 npm，不限制 GitHub 公开。
