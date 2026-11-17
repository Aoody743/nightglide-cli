# M2 分叉线 Worktree 盘点(feat_m2_coding_experience)

**一句话结论:** 该 worktree 是旧 OpenTUI 原型线上的 M2 里程碑分叉——在主仓库当前基线之上有 4 个未合并提交(合计约 +10k 行)和 1 个未提交改动,测试全绿但仍属旧原型架构;与新主线(vendor/omp 原生改造)方向不同,整体不迁移,其中若干纯算法与设计资产对新主线后续阶段有参考价值。

---

## 1 · 位置与分支信息

- Worktree 路径:`/Users/aoody743/.gemini/antigravity/worktrees/Nightglide CLI/feat_m2_coding_experience`
- 分支:`feat_m2_coding_experience`。仅存在于本地,无上游远端(主仓库 `git remote` 为空),删除分支即永久丢失这 4 个提交。
- 基线:`3630414`(等于主仓库当前 HEAD,分支 `docs/nightglide-experience-design`)。

基线之上的 4 个提交(自旧至新,日期均为 2026-11-15/16):

| 提交 | 内容摘要 | 规模 |
| :--- | :--- | :--- |
| `8c9d5a6` feat(m2) | M2 主交付:diff 查看器、Celestial Kinetics 动效系统、Flight Deck 头部/状态栏、工具审批卡片、omp-adapter 大幅扩展、M2 实施报告 | 49 文件,+6871/−300 |
| `3945e00` feat(providers) | provider 注册表动态解析 `/models` 响应发现本地模型;omlx/sk-local 端点接入 | 5 文件,+82/−3 |
| `7a06fc9` feat(experience) | 双隐喻 UI(flight-deck / abyss-dive)、厂商签名动效帧、本地 co-pilot 委派路由、OMP 原生认证封装、新登录命令 | 30 文件,+3025/−134 |
| `262fd69` feat(ui) | 高对比块状欢迎横幅,清理硬编码 qwen2.5 占位符 | 10 文件,+129/−54 |

合计:74 文件,+10066/−450。另有 1 个未提交修改(见第 4 节)。

这 4 个提交继续开发的是旧原型线(`apps/cli` + `packages` + `tests`,基于 `@opentui/react` 与 npm 安装的 OMP SDK),不是主线的 vendor/omp 原生改造。

## 2 · 资产清单

价值评级为对新主线的潜在迁移参考价值(高 / 中 / 低)。

| 资产 | 位置(worktree 内) | 价值 | 备注 |
| :--- | :--- | :--- | :--- |
| unified diff 解析器 | `apps/cli/src/ui/components/diff/diffParser.ts`(324 行) | **高(纯算法,可平移)** | hunk 头正则、行分类、行号 gutter 格式化、CJK 宽度感知的截断/换行、增删统计;与渲染完全解耦。配套 `diff.test.ts`(498 行)覆盖边界用例。 |
| diff 渲染组件 | `apps/cli/src/ui/components/diff/DiffViewer.tsx`、`NativeDiffView.tsx` | 低(旧架构专用) | OpenTUI React 组件,不可直接迁移;窄终端(<80 列)降级布局思路可参考。 |
| Celestial Kinetics 动效系统 | `apps/cli/src/ui/motion/`(engine / constants / hooks / slots / reducedMotion / color)+ `components/motion/` 5 个组件 | **高(纯设计/算法,实现需重写)** | 帧率预算(环境 10 FPS、上限 15 FPS)、T0–T3 时序分层、防抖动固定 slot(ANSI 剥离 + CJK 宽度计算)、reduced-motion 降级与零计时器策略;与主仓库 `docs/MOTION_SYSTEM.md` 规范一致。实现绑定 React hooks / @opentui,迁移时按 vendor/omp 前端重写;预算常量与防抖逻辑可直接采纳。 |
| 终端尺寸分级 | `apps/cli/src/ui/dimensions.ts` | 中(纯函数,可平移) | small(80×24)/ medium(100×30)/ large(120×36+)分级与视口容量计算;`flight-deck.test.ts`(477 行)覆盖。布局组件本身(Header / StatusBar / ChatScreen / Composer)旧架构专用。 |
| 厂商签名与动效帧数据 | `apps/cli/src/ui/motion/vendors.ts`(244 行) | 中(纯数据,可直接搬) | anthropic / openai / google / xai / omp / local 的品牌色、glyph、帧序列、ASCII logo;数据与渲染解耦。 |
| OMP 原生认证封装 | `packages/providers/src/auth.ts`(306 行)+ `apps/cli/src/commands/login.ts` | **高(思路可参考,对应 Stage 3)** | 直接包装 OMP 自身 `AuthStorage` / `discoverAuthStorage` / `SqliteAuthCredentialStore` / `isAuthenticated`,不另建第二套凭据体系,与新主线「不重建冗余层」原则同向;`providers/auth.test.ts`(284 行)。 |
| 本地模型动态发现 | `packages/providers/src/registry.ts`、`packages/engine/src/omp-adapter.ts` | 中 | 解析 `/models` 响应动态注册模型;与新主线 Stage 1 已完成的 oMLX endless 动态探测部分重叠,算法可对照,不必整体迁移。 |
| 本地 co-pilot 委派路由 | `packages/routing/src/classifier.ts`、`router.ts` + `tests/routing/delegation.test.ts`(397 行) | 中 | LOCAL / BALANCED / PERFORMANCE / MANUAL 派发与回退路径;对应新主线 Stage 3 规划,测试可作规格参考。 |
| Abyss 隐喻与主题扩展 | `apps/cli/src/ui/metaphors/`、`packages/themes/src/themes.ts`(abyss-trench 主题与海洋 token)、`tokens.ts` | 低–中 | 新主线工作台已自带「深潜 Abyss」双主题;本线新增 `sonarPing` / `depthGauge` / `hullBorder` 等海洋 token 及 WCAG AA 对比度测试(`metaphor.test.ts`,325 行)可对照 Stage 2 主题工作。 |
| omp-adapter 事件映射 | `packages/engine/src/omp-adapter.ts`(提交中 +483 行) | 低 | 旧架构的薄适配层(OMP SDK 事件 → Nightglide contracts);新主线在 vendor/omp 上原生改造,此层整体不迁移,事件映射清单可作参考。 |
| 其余 UI 组件与 mock-engine | `apps/cli/src/ui/screens/`、`components/tools/`、`packages/engine/src/mock-engine.ts` 等 | 低(旧架构专用) | 不可直接迁移。 |
| M2 实施报告 | `docs/M2_IMPLEMENTATION_REPORT.md`(worktree 内) | 低 | 历史交付记录,含 Mock/SDK/Live 分级验证矩阵;「246 tests」数字出处(见第 3 节)。 |

## 3 · 测试验证结果

在 worktree 根目录实际运行 `bun test`(2026-11-18):

- **314 pass / 0 fail**,2487 个 `expect()` 断言,17 个测试文件,约 10.8 秒。
- 提交信息及 M2 报告中的「246 tests across 13 files」出自 `8c9d5a6` 时的 `docs/M2_IMPLEMENTATION_REPORT.md`;其后 `7a06fc9` 又新增 4 个测试文件(auth / delegation / metaphor / provider-motion),当前分支顶端实际为 314 / 17。该数字已过时(偏小),并非虚报;当时的 246 未独立复跑验证。

## 4 · 未提交改动说明

`packages/engine/src/omp-adapter.ts`(1 个文件,约 40 行,未提交):

1. omlx provider 注册的 `api` 字段由 `"openai-chat"` 改为 `"openai-completions"`(两处)。
2. 注册模型列表由固定 `endless` 一个,扩展为 `endless` + 目标模型动态加入。
3. 顺带修正一段缩进/括号结构。

性质判断:针对本地 oMLX 端点(`127.0.0.1:8000/v1`)的调试/兼容性微调,属未完成的工作状态;`openai-completions` 是否正确适配该端点未经验证。若不经提交直接删除 worktree,此改动将丢失。

## 5 · 处置选项与建议

| 选项 | 内容 | 代价 |
| :--- | :--- | :--- |
| A · 保留待迁移 | 保留分支与 worktree 原样,待 Stage 4 统一处理 | 零前期成本;worktree 目录继续存在,且主线 Stage 1/2 正逐步覆盖同类能力,越晚提取,资产过期/重复度越高 |
| B · 归档提取后删除 worktree(建议) | 摘取纯算法与数据资产(diffParser、动效预算与 slot 逻辑、vendors 数据、auth 封装思路及配套测试)进主仓库参考位置,然后 `git worktree remove`;分支引用保留不删 | 需一次挑选/移植与引用检查;收益是目录清理、高价值资产落入主仓库,历史仍可追溯 |
| C · 立即废弃 | 删除 worktree 并删除分支 | 风险最高:本仓库无任何远端,分支删除后 4 个提交与未提交改动不可恢复;不建议在资产提取前执行 |

倾向选项 B:主线 Stage 4 明确列有「将确认有用的旧主题、路由和测试迁入新架构」事项,先提取、后清理既保留可用资产又不留长期悬空目录。**最终决定待项目负责人确认。**

---

> 说明:本盘点基于提交信息与代码结构阅读,以及一次全量测试运行;未验证上述资产与新主线(vendor/omp 原生改造)的实际兼容性,价值评级为结构阅读层面的判断。
