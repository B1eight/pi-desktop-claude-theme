# Changelog
## 1.1.1

> 适配 PI-Desktop **v0.23.0**（宿主 `0.23.0.0`），完成兼容修复与新增界面的主题专项定制。
> 2026-11-21 已在 PI-Desktop 0.23.0 完成浅色 / 深色真机安装与人工验收；`docs/acceptance-states.json` 里的自动化封存证据仍对应 1.1.0 / 0.22.0.0。

### 宿主 v0.23.0 兼容修复

- **贴边弹窗与设置弹窗保护**：将 `.settings-dialog`、`.app-announcement-dialog`、`.startup-guide-dialog`、`.release-notes-dialog` 等宿主 `padding: 0` 贴边弹窗排除出主题通用 `.dialog` 外层内边距（含移动端断点）与 `h2/h3` 标题覆写，避免撑歪弹窗布局。
- **暗色设置弹窗焦点内衬**：将 `.settings-dialog` 排除出抬升层 `--at-cds-ring-liner`，保证 `.settings-shell` 内焦点环内衬与主背景同色、不再发灰。
- **侧栏无项目组独立会话区**：为 `.sidebar-standalone-sessions` 补上 `:not(.is-fill)`，兼容 v0.23.0 无项目组时释放高度的 `.is-fill` 机制。

### v0.23.0 新增界面专项定制

- **侧栏主导航与底部设置入口（`.sidebar-primary-item` / `.footer-settings`）**：纳入状态层 `row` 家族统一 hover / `.active` 叠墨，复用侧栏 32px 行节奏、UI 字阶、圆角与按压微缩反馈（含 `prefers-reduced-motion` 归零）。
- **自定义模式运行条与输出截断提示（`.mode-run-bar` / `.message-output-notice`）**：按卡片层级定制运行条材质、圆角、轻阴影、分割线与 `forced-colors` 适配；为 `.mode-run-rounds`、`.mode-run-elapsed` 注入 `reading` 等宽数字角色。
- **模式设置页（`.modes-settings-*`）**：纳入 1120px 宽版布局、面板描边与大圆角、`.modes-settings-source` 表单材质与等宽代码字阶；`.modes-settings-row` 纳入 32px 行高、`[aria-current="true"]` 选中字重与状态层 `row` 家族。
- **作曲器模式菜单与插件排序分段（`.composer-mode-menu*` / `.plugins-sort*`）**：模式菜单接入浮层焦点内衬、展开动效与分组标题/备注字阶；插件排序分段控件对齐 `.settings-segment` 轨道与激活态语言（含 `forced-colors` 轮廓）。
- **公告、引导与 Provider 高级设置弹窗（`.app-announcement-*` / `.startup-guide-*` / `.provider-advanced-*`）**：统一标题展示字阶、底栏/分段发丝线、正文行距、`kbd` 快捷键键帽（含 `.is-active`）、预览卡片阴影及 `.startup-guide-progress` 等宽数字角色。

### 门禁与产物

静态门禁全部通过（`check-host` 2468/2468、`check-vars` 81/81、`check-coverage` 未绑定类 599/609、`check-dead-selectors` 0 死组合、`check-states --strict`、`generate-roles --check`、`generate-states --check`、`check-surface-grammar` 0 违规、`check-role-cohesion` 0 未登记偏离），单元测试 **61/61** 通过，归因棘轮维持 147/147 无回归。生成体积：浅色 `64,174` / 深色 `64,246` bytes（目标 `< 65,000`，宿主硬限 `256 KB`），权限仍仅为 `ui.theme`，生命周期为空。

## 1.1.0

> 三波：令牌层 → 状态层 → 焦点与真机走查。1.0.3 与 1.0.4 从未单独发布，改动全部并入本版。
> 本版已发布：证据封存于 2026-11-14 的隔离宿主 0.22.0.0，`check:acceptance` 为 0 problems / 13 open。
> 13 项 open 不是没改完，而是证据层级不足：2 项范围外或需读屏软件（`business-operations`、`screen-reader`）、
> 3 项已在真机验证但尚未写进判据（`sidebar-sessions`、`code-block`、`theme-installation`）、8 项只有合成夹具证据。

### 状态层（本版新增的第 5 层）

把「交互状态」从逐条手写规则收成一份可核对的台账：`docs/states.json` 声明 5 个家族（`row` / `solid` /
`field` / `panel` / `ghost`）× 6 个状态（hover / focus / active / selected / expanded / disabled）共 30 格，
每格写清属主与取值。落地分布：generated 4 格、hand 5 格、global 6 格、none 15 格（宿主没有该类状态，
显式记为 none 而不是留给后人猜）。`row` 家族的 hover 走「叠墨」，selected 分叉 `.active` 与 `.is-active`
两种宿主写法，由 `memberSuffixes` 表达。

新增 `npm run check:states`（`--strict`，已接入 `check:system`）：把规格与真实 CSS 对账，能抓六类漂移
（规格有 CSS 无、CSS 有规格局、属主不符、取值不符、家族缺失、`none` 格被偷偷写规则）。首跑抓到 7 处真
漂移，修正后归零。状态层只负责颜色与不透明度；形变、动画、字号归动效与排版层，`check-states` 用
`STATE_PROPS` 过滤，避免把 `:active { transform }` 误判成状态色。

### 令牌层与死代码（原波一 / 波三）

宿主 81 个 `--ds-*` 现在全部有态度：`--ds-bg-sidebar-image: none` 由主题钉住，其余 18 个登记为显式继承
（14 个布局尺寸、4 个由别的令牌推导的材质值）。新增 `npm run check:vars` 并接进 `check:full` 与
`self-test:contracts`：宿主新增令牌而主题既没声明也没登记会失败并点名，登记过期或两个调色板只声明一边也
会失败。宿主 0.22.0.0 样式表与 JS 里都不存在的类名清掉四处（`.agent-capability-menu-item`、
`.activity-issue-count`、`.composer-thinking-dot(s)` 整条旧圆点滑杆分支）；`.hosted-search` /
`.turn-process-error` / `.agent-subagents-page` / `.is-status` 在 CSS 里查不到但由 JS 动态添加，属于
extend 面，保留。

### 焦点：从「一帧硬切」到 200ms 淡入

焦点评测实测出一个一直存在的缺陷：环的入场是 **0ms 硬切**（采样只有 1 个值），而 hover 有 220ms。
根因是配方首层 `inset` 内衬与静止态的全 outset 阴影不可插值；`git show HEAD` 证明自 inset 衬线引入起
就是死的，不是本版引入。同时盒子的两层环境影会在聚焦瞬间被整体替换，视觉上「变平」。

现在环改画在 `.composer-shell::after`：三层配方与 Claude `--cds-focus-shadow` 逐层相同（页底色内衬 +
1px 环 + 18% 柔光），只对 `opacity` 做 200ms 过渡；外壳 `box-shadow` 在聚焦前后**逐字节相同**。真机采样
12 帧中间值（0 → 0.20 → 0.86 → 1）。环色回到 Claude 基准 `#7b7974`（浅色，对页底 4.57:1；Claude 对
`#f9f9f7` 为 4.13:1），深色 `#96948d`（5.14:1）。过渡档位 `t-emph` 220ms → 200ms，对齐 Claude
`--cds-dur-base`。

### 状态语汇的四条修正

1. **叠墨（D1）**：hover 用 `rgba(11,11,11,.05)`，选中用第二档 `.10`（深色 `rgba(245,244,240,.05/.10)`）。
   真机侧栏会话行实测一致：未选中行静止为透明 + 次要墨，悬停 5% 底 + 主墨 + 「更多」显现，选中 10% 底 + 主墨。
2. **焦点墨（D2）**：焦点环从「文本 4.5 门槛」里摘出，改判非文本 3:1，并加上「浅色必须等于 `#7b7974`」
   的双向断言 —— 门槛不再反压基准。
3. **透明度（D3）**：动作 `.4`、输入 `.55`、实心只换色。复制键实测静止 0.6 → 悬停/聚焦 1。
4. **结果态（D4）**：完成项文字显式 `color: var(--ds-text-primary)`（真机发现只删 secondary 会落回宿主
   muted，方向反了），图标用 `--ds-success`；取消项保留宿主 `.72` 单层，不再叠第二层透明。

### 侧栏运行标记与文字流光

- 侧栏运行态从「陶土呼吸点」改为**陶土旋转弧**：14px、270° 实弧 + 90° 缺口、`clay-ink`（浅 `#bd562f` / 深 `#d97757`）、1.5px 环带、10% 淡轨道、1s 匀速。几何与周期取自 Claude 图标集里的 `Spinner` 字形（`M13.5 8 C…` = 270° 弧，渲染器 `stroke="currentColor" strokeLinecap="round"`，配 `--animate-spin: spin 1s linear infinite`）。
- 环色换深一档是量化结论：浅色 `clay-vivid` 对侧栏底只有 2.99:1，`clay-ink` 是 4.43:1（≈ 跟随文字色的 4.49:1），深色 5.06 → 5.90:1。圆头端点在纯 CSS 里做不到，只能直线切口，已在契约里写明是限制而非选择。
- 等待/授权态保持 2.4s 呼吸，未改。
- 状态行三点的文字流光修正两处：中心色改 `--at-cds-shimmer-ink`（浅色用 `faint`、深色用 `secondary`），**修掉浅色模式「扫过时变暗」的方向错误**；缓动由 `ease-out-expo` 改 `linear`，消除「前冲后停」；光带 `38/50/62` 收窄到 `44/50/56`。

### 侧栏列表节奏与遮罩

- 会话行高回到 32px（`20 + 12`），与项目组同节奏。
- **侧栏会话/项目列表去掉滚动遮罩**：渐变遮罩此前只挂在聊天正文与侧栏列表上，导致末行被削、且与项目组格式不一致；现在遮罩只属于聊天正文。

### 令牌与账目

- `--ds-text-faint` 改判锚点：原先记为「Claude 无对应物」，复核后是 `--cds-gray-350 #97958d`，改挂 reference
  并登记偏离。证据优先于「我以为没有」。
- `--ds-text-muted` 保留 `#75746d`：Claude 的 gray-450 更深，但那样会跌破 AA 4.5:1。这一处登记为
  approved design-choice，理由写「我们选择 AA」，不写成「Claude 就是这样」，连带代价写进 tradeoff。
- 三处细节兼容登记为已批偏离：`text-primary` Δ1/255、`text-secondary` Δ2/255、`bg-inset` +1/+2/+3。
- 测试不变式：`design-choice` 必须 `approved: true` 且字段完整；`alpha-rounding` 只校验位数；未定偏离只能走
  `resolution: null + pending`。

### 真机验收（2026-11-14，隔离宿主 0.22.0.0）

- **安装链路**：安装包 126,641 bytes / 6 文件 / sha256 `5722c4c3…`；装入干净宿主后主题菜单出现
  「Claude Theme Light / Dark」→ 选中 Light（`data-plugin-theme` 生效、页底 `#fcfcfb`）→ **重启后仍是
  该主题** → 卸载（`uninstallPlugin` 返回 ok，插件与主题双双消失，`data-plugin-theme` 回到 null）。
- **侧栏会话行**：见上「叠墨」；`thread-item-more` 静止 0 → 悬停 1。
- **代码块**：头部与正文同底色（浅 `#f4f2ec` / 深 `#0d0d0c`），12px 圆角、0.5px 内环、无边框；语言标签
  12px 等宽低对比；复制键 0.6 → 1。
- **内联码**：浅色 `#8e2626` 正好等于 Claude `--cds-text-tint-red`（= `--cds-red-600`）；深色 `#f1a6a6`
  比 Claude 的 `--cds-red-300 #e66767` 更浅，属暗色组已裁定不动的声明式偏离。
- **设置 / 项目 / 对话框**：外观（4 面板 / 15 行）、快捷键、项目归档空态、信息页均正常；创建项目对话框
  10px 圆角、主题阴影、Esc 可关。

### 门禁

`npm test` 81、`check:system`（含 `check:states --strict`）、`verify` 2,145 断言、`check:roles` 93、
`check:visual` **132/132**（含 30 条 reduced-motion、14 条 forced-colors）。`check:baseline` 28/50（其余为
暗色 pending-evidence，按裁定保留为明账）。生成体积：浅色 59,617 / 深色 59,685 bytes（目标 < 65,000，
硬限 256 KB）。权限仍仅为 `ui.theme`，生命周期为空。

### 已知未覆盖

范围外：`business-operations`、`native-menus`、`os-dialogs`、`independent-documents`。
无法自测：`screen-reader`（需要真实读屏软件）。
合成夹具已覆盖、缺真机截图：`review-changes`、`tool-run-states`、`delegation`、`notifications`、
`scheduled-tasks`、`plugin-pages`、`reduced-motion`、`forced-colors`。

## 1.0.2

- 基于 Claude 桌面端原生设计令牌（v3.6556.2.0 实测提取）做还原度调优，基准含品牌橙 `#d97757`、深色页底 `#151515` 等精确值。
- 深色文字明度层次贴近原生：`--ds-text-primary` `#f0efec`→`#f5f4f0`、`--ds-text-muted`/`-faint`/`placeholder-ink` `#96948d`→`#a3a29b`，对比度分别 16.59 与 7.13，保留充足可及性余量。
- 浅色弱化文字折中调亮：`--ds-text-muted`/`placeholder-ink` `#707069`→`#75746d`、`--ds-text-faint`→`#7b7a74`，向原生 `#97958d` 靠拢但不跌破 WCAG AA 4.5:1 底线（原生该值仅 2.85:1）。
- 顶栏整体可读性提升：会话标题 12.5→14.5px，顶部项目名与面包屑分隔符 11→13px，均随 `--font-scale` 同步缩放；侧栏标题与会话行保持不变。
- 输入框控件行对齐 Claude 原生：模型名、推理等级、上下文百分比统一为 14px / 500 medium（随 `--font-scale` 缩放），消除原先 14/14/11 字号断层与 400/500/600 字重跳变。推理等级去掉胶囊盒（`padding:1px 6px`+圆角改为 `padding:1px 0`+无圆角），与模型名同为纯文字形态。左下"智能体 / 全自动"chip 文字设为 12px / 500 作为低一档次级控件，并通过爬升至 `.composer-toolbar` / `.composer-right` 修正选择器特异性（此前裸类名被宿主 `text-sm` 工具类与 `.composer-right .context-inspector-trigger` 压住未生效）。
- 品牌强调橙 `--at-cds-compose-accent` 由 `#c6613f` 微调为 `#bd562f`：色相不变仅略深，推理等级等橙色文字在浅底上对比度由约 3.95 提升至 4.51（过 WCAG AA 4.5）。
- 小字号字重收敛：12px 的"智能体 / 全自动"chip 文字由 500 降为 400。Segoe UI / 雅黑在 12px + 500 下笔画发虚；宿主小字号规则 84% 用 400，本改动与之对齐以缓解小字模糊。14px 控件行（模型名/推理等级/上下文）维持 500 不变。


## 1.0.1

- 取消内嵌字体设计：移除 Inter 与 JetBrains Mono 的 `@font-face` 与字体二进制，排版改用系统字体族，单份主题 CSS 由约 253KB 降至约 51KB。
- 中文字体改用 Noto Sans SC，插在 `system-ui` 之前：中文可绘制的字重档位由 3 档增加到 6 档，语义上的“中等”与“半粗”不再渲染成同一档；西文仍由 Segoe UI 渲染，度量不变。`system-ui` 在 Windows 上直接映射到微软雅黑并抢先匹配中文字形，故 Noto 必须排在其前。
- 适配 PI-Desktop v0.21.0 新增界面：任务坞、Todo 清单、Gen UI 卡片、插件市场评价、worktree 面板、侧栏会话元信息、项目运行徽标与活动标记。
- 建立四档圆角体系（5 / 7 / 10 / 12px）、六档中性色阶梯（`--ds-neutral-0` 至 `--ds-neutral-6`）与 6 / 8 / 12 / 20 间距节奏，语义表面槽位改为引用阶梯。
- 建立排版体系：七档字号各配对应行高，字重收敛为常规与半粗，全部随 `--font-scale` 同步缩放；侧栏行高、缩进、图标槽位、圆角与过渡改由体系令牌推导。
- 固化动效时长三档（60 / 150 / 220ms），输入框采用“阴影慢、背景快”的分档过渡，并推广到菜单项、代码语言标签与对话框内边距。
- 任务坞重做为单层卡片：去掉外框描边与内层面板的二次圆角，清单改用圆形状态标记，已完成项不再划删除线。
- 修复输入框输入区与外壳叠两层半透明导致的颜色不一致：输入区改为透明，由外壳单独承担填充。
- 修复任务坞展开按钮被压缩：该按钮为固定 32px 方盒，此前继承文本按钮的侧内边距，图标只剩 4px 宽，现恢复对称内边距。
- 修复输入框控件行：模式标签不再截断；上下文用量还原为宿主原本的 11px 半粗读数；推理等级保留胶囊内边距并改为按内容撑高，放大字号时不再裁切。
- 侧栏运行提示收敛为单一暖色，项目徽标去掉橙色底改为圆点加灰色数字，与会话运行点和活动流光形成三级层次；取消当前项目组的灰底高亮，仅保留悬停反馈。
- 模式菜单与每轮 Token 用量气泡对齐宿主的圆角、边框和阴影。
- 修复三处交互状态纰漏：任务坞内可聚焦元素的焦点环改为内缩，避免被容器裁切；七条悬停规则补齐 `aria-disabled` 排除；全局焦点环不再对被 `aria-disabled` 标记的控件生效。
- 删除与宿主完全等价的重复规则，主题体积回落，为后续调整留出余量。

## 1.0.0

- 提供 Claude Theme Light 和 Claude Theme Dark 两款主题，覆盖聊天、侧栏、设置和常用反馈界面。
- 仅使用 `ui.theme` 权限，保留原生过程结构与折叠交互。
- 内嵌 Inter 与 JetBrains Mono 字体，无网络依赖。
- 代码使用 MIT 许可，字体使用 SIL OFL 1.1。
