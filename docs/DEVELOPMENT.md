# 开发说明

## 结构与构建

- `src/`：当前主题样式源。
- `assets/`：无内嵌字体（仅 `README.md` 说明）；排版使用宿主与系统字体族，无网络加载。
- `themes/`：生成的浅色与深色主题，必须与源码构建一致。
- `scripts/`、`tests/`：构建、检查与独立测试。
- `host-contract.json`：PI-Desktop 0.20.1 的静态指纹与结构约束，不含宿主源码。

从项目根执行 `npm run build`。修改版本时同步 `manifest.json` 和 `package.json`，再构建与验证。

每份 CSS 的宿主硬限为 **262144 bytes**；1.1.0 的额外视觉验收目标为 **低于 65000 bytes**。当前大小由构建输出与校验报告记录，不提高宿主硬限来绕过检查。

构建采用主题作用域与前缀提取，再进行三步等价减容：

1. 将同一完整字面主题根下的规则嵌套，保留条件与顺序，关键帧保持全局；未知结构拒绝处理。
2. 只合并同父级、相邻、声明逐字相同的叶规则；不跨规则搬移声明，不合并厂商专有伪元素列表。
3. 只清理选择器逗号后的空白，不改声明、字符串或后代空格。

## 检查

`npm test` 检查变换边界、阶段等价与视觉令牌合同；`npm run verify` 检查身份、权限、资源、生成产物和分层对比度；`npm run check:roles` 检查颜色角色及运行色的最终声明。正文/功能角色保留 4.5:1 下限，视觉优先的 faint/page 与 placeholder/composer 配对使用 2.8:1–3.6:1 区间；这不是整套主题的 WCAG 符合性声明。muted/faint 的相对亮度绝对差至少为 0.10，未采用与浅色目标不相容的 0.12。

浏览器检查使用本项目合成场景，比较全部规则的 CSSOM 及代表场景计算样式。输出必须是项目外的新目录：

```sh
node scripts/check-css-equivalence.mjs --output-dir <external-new-directory>
```

默认使用 Windows Chrome，可用 `--chrome <executable>` 指定浏览器。静态或合成测试不代替用户实际安装验收。

1.1.0 的视觉状态检查独立执行，输出同样必须是项目外的新目录：

```sh
npm run test:visual -- --output-dir <external-new-directory>
# 可选：叠加本机提取的宿主 CSS，检查实际层叠竞争
npm run test:visual -- --output-dir <another-new-directory> --host-root <external-host-css-directory>
```

该检查测量圆角、焦点阴影、字体分工、复制按钮、按压/禁用、运行/完成、减少动态效果、强制色及上下文读数位移，并输出报告与浅/深色截图。场景是项目自建 fixture；即使叠加宿主 CSS，也不是宿主 React 业务端到端或实际安装验收。宿主源码与测试截图留在外部目录，不进入安装包。

可选本地宿主检查：

```sh
node scripts/verify.mjs --host-bundle <external-host-main.js>
node scripts/check-host-contract.mjs --host-root <external-evidence-directory> --runtime-json <external-runtime.json> --self-test
```

未提供 host-bundle 时不执行实际宿主 sanitizer。宿主契约只检查指纹与结构，不认证业务、持久化或未来版本；宿主变化需人工审查，不自动更新期望指纹。

`capture-host-evidence.mjs` 是可选本机取证工具，需显式指定 `--asar`、`--electron-exe`、`--output-dir`，并把 `PI_SCRATCH_DIR` 设为项目外临时根；输出目录必须全新。使用前阅读工具，不在 CI 默认执行。取证源码、ASAR、浏览器 profile 与本机报告不进入仓库。

## 设计基准与验收闭环

`docs/design-baseline.json` 是"像不像 Claude"的唯一数值依据，`docs/design-map.json` 记录主题令牌与原生令牌的对应关系，`docs/acceptance-states.json` 是验收结论的唯一来源。三者都进版本库；一次性审计 HTML 报告是过程产物，已被忽略。

基准提取需要本机 Claude Desktop，只保留令牌名与值，不分发对方的样式表或字体：

```sh
npm run extract:baseline -- --asar "<...>\Claude\app\resources\app.asar" --app-version <v>
npm run extract:baseline -- --dir "<...>\Claude\app" --app-version <v>
```

MSIX 安装在 `C:\Program Files\WindowsApps` 下：PowerShell 能列出目录但 Node 的 `scandir` 会被拒，所以 `--find` 用 `Get-AppxPackage` 解析安装位置；文件本身可以直接读，通常不需要提权，被拒时把 `app.asar` 复制到项目外临时目录再指向它。提取成功会把 `source.authoritative` 置为 `true`。仓库当前存的是从 Claude Desktop **3.6556.2.0** 提取的权威基准（样式表 sha256 `948bac16bdce…`，914 个 `--cds-*` 令牌）；一旦被替换成二手数据或删除，`check:baseline` 会以退出码 2 拒绝出结论。

```sh
npm run check:baseline                        # 基准未固化即拒绝出结论（退出码 2）
npm run check:baseline -- --allow-secondary    # 临时对照，不构成通过结论
npm run check:source                          # 素材指纹：本机 Claude 的 sha 是否还等于基准记录的
npm run check:attribution                     # 归因棘轮：新增令牌必须先在 design-map 里归因
npm run check:host                            # 宿主棘轮：版本/asar 变了就列新增类与待处理项
npm run check:cohesion                        # 角色一致性：手写偏离必须登记在 role-deviations.json
npm run check:acceptance                      # 有未闭环状态即失败
npm run self-test:contracts                   # 三个脚本的内置自检
```

`design-map.json` 描述的是**关系**而不是等值：Claude 是参考系，不是规格书，主题在宿主框架内借鉴它的风格与质感。每项只归入三种关系之一——`reference`（原生值在此同样成立，直接取用，差值不得超过 `tolerance`）、`derived`（原生给的是原则，用 `rule` 重新推导；检查器求值 `rule` 而不是比对某个数字，`offset` 表示「某原生令牌 ± 若干 px」，`equals` 表示一个已声明常量，`range` 表示允许区间，`declared` 表示「有意偏离并钉死取值」）、`original`（无对应物，不参与比对，只要求写明理由并受 surface-contract 约束）。`derived` 缺 `rule` 即判失败，`original` 缺 `reason` 同样判失败。动画、缓动、字体族、遮罩等无法令牌化的改动列在 `notTokenizable`，必须另行取证。

阴影有独立的比较方式：`area: "shadow"` 的项按层比较几何（px）与不透明度（百分点），层数不同直接判失败，不做字符串匹配。`--cds-shadow-sm` 的 `0 1px 2px 0 #0000000d` 与主题的 `0 1px 2px rgba(0,0,0,.05)` 因此被认作同一档高度。

`docs/surface-contract.json` 处理的是另一个问题：PI-Desktop 有 Claude 没有的界面（任务坞、Todo、用量、改动摘要、委托拓扑等），这些不可能一对一复刻。契约把每个宿主界面归入 `mirror` / `translate` / `extend` 三种模式，并给 `extend` 层一套可执行的设计语法（I1 表面阶梯、I2 圆角档位、I3 发丝线、I4 强调色纪律、I5 状态语义、I6 字号档位、I7 动效预算、I8 焦点唯一、I9 间距、I10 高度）。验收标准随之改变：`extend` 层不比像素，只比「是否复用了同一套档位与语义」。

```sh
npm run check:grammar                      # 新界面是否自造了档位外字面值
npm run check:grammar -- --allow-pending   # 只看越轨，不把待决项算作失败
```

检查只针对**写死在规则里的字面值**：用 `var()` 引用令牌的交给 `check:baseline` 管。档位分十三张：圆角（含宿主压缩网格）、字号、动效、描边、状态环、线式、行高（比率）、行高（px）、组件内边距、布局间距、控件高度、图形高度、阴影（sm / md / popover 三档模型字符串）。出现档位外的值只有两条出路——改回档位内，或在契约的 `exceptions` 里登记并说明理由；未登记即为「新方言」并判失败。负向光学微调、发丝线内衬、功能性留白、键帽倒角、输入框复合阴影、模态第四层高度都已登记为 `registered`；`pending-decision` / `undecided` 的例外会一直让门禁失败。内阴影按描边语言处理，不参与高度判定。契约里某个 surface 绑定不到任何规则时会单独提示，说明宿主可能改了类名。

每张档位表还要交代**出处**：`check:baseline` 会读 `surface-contract.json` 的 `ladderAnchors`，凡是没有任何关系做锚的表，必须在那里登记 `anchor: "none"` 并写理由；既没关系又没声明即失败，声明了「无锚」却又有关系算矛盾。目前 13 张里 3 张有锚（radius / duration / shadow），其余 10 张登记为无锚。

验收状态只有四种：`verified`（必须带真实宿主证据，合成 fixture 与层叠探针不算）、`failed`、`unverified`（必须写 `blocker`）、`out-of-scope`（必须写 `reason`）。`artifacts` 记录被验收的主题哈希；重新构建后哈希变化，原有 `verified` 自动变为 `stale`，必须重新上机验收。

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
