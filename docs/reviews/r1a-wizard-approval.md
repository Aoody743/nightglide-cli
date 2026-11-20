# R1a 只读审查包：3.1 设置向导前置 + 3.3 审批风险分类草案

状态：2026-11-20 只读审查（R1a）。除本文档外未修改任何文件；未读取任何密钥内容。
代码基线：主线 fork `vendor/omp`（OMP 18.20.2 Nightglide fork），行号以当前工作区为准。
标注约定：【代码确认】= 直接读源码得出；【推断】= 由代码结构推导，未实机验证。
所有路径相对 `vendor/omp/packages/`，另注明者除外。

依据原文（先读）：
- 3.1 设置向导：`docs/DEVELOPMENT_PLAN.md:71-76`（提供商/Base URL/API Key/模型/调度/回退；取消、编辑、保存后重启恢复、连接失败、密钥遮掩；审查既有凭据存储与配置优先级，避免覆盖用户原有设置）。
- 3.3 审批策略：`docs/DEVELOPMENT_PLAN.md:84-87`（先依据 OMP 实际工具、命令和权限模型列出风险分类、无法判断的操作、逐工具覆盖、已有用户配置、headless 行为，明确局限并经确认）。

---

## 一、3.1 设置向导前置审查

### 1.1 凭据存储体系

**存储位置**【代码确认】
- 默认 SQLite 库 `~/.omp/agent/agent.db`（XDG 可重定向）：`utils/src/dirs.ts:980-983`（`getAgentDbPath` → `dirs.agentSubdir(..., "agent.db", "data")`）。
- 凭据表 `auth_credentials`，敏感材料存于 `data TEXT NOT NULL` 列（JSON 序列化的 credential，api_key 型即 `data.key` 原文）：`ai/src/auth/sqlite-credential-store.ts:786-800`。
- coding-agent 侧 `session/auth-storage.ts` 只是 re-export（`@oh-my-pi/pi-ai`），无独立存储：`coding-agent/src/session/auth-storage.ts:1-24`。
- 组装入口 `AuthStorage`：`ai/src/auth/storage.ts`… 实为 `ai/src/auth-storage.ts:139-241`（类 AuthStorage），本地后端 `LocalAuthStorageBackend` `ai/src/auth-storage.ts:244-405`，模块构成见 `#compose`（310-400）。

**加密与否 / 明文落盘**【代码确认】
- 无加密层：`sqlite-credential-store.ts` 全文无 encrypt/cipher/keychain 关键字（grep 为空）。API key 与 OAuth access/refresh token 以明文 JSON 存入 `data` 列。
- 保护仅是文件权限：建目录 `0o700`（sqlite-credential-store.ts:595），打开时 `chmod(dbPath, 0o600)`（:602，失败忽略，Windows 注释）。
- OAuth 刷新 token 在 auth-broker 网络快照中被替换为 `REMOTE_REFRESH_SENTINEL`，不出网：`ai/src/auth/pool.ts:741-768`（snapshot() 注释明确"clients never see the actual refresh token"）。

**KeyCascade 取 key 优先级链**（决定向导写哪层"最有效"）【代码确认】
- `runtime → config → OAuth → login key → env → stored key`：`ai/src/auth/cascade.ts:154`（类注释）、`source()` 实现 :217-236、`peek()` :259-309。
- runtime override 不落盘（`--api-key`）：cascade.ts:76-81；config override 来自 models.yml 等（`setConfig` :91-113；`fallback: true` 时排在 OAuth/login 之后，仅等 env 层）。
- env 名单：`ai/src/env-api-key.ts:15-48`（各 provider 的 `*_API_KEY`）。

**敏感文件清单**【代码确认】
| 文件 | 内容 |
|---|---|
| `~/.omp/agent/agent.db` | API key、OAuth token、usage 历史（明文，0o600） |
| `~/.omp/models.yml` / models.json（config 层） | 可能含 `apiKey:` 字面量、`!command`、env 名引用（cascade.ts:70-71 resolve 支持 `!command` 与 env 名） |
| 会话/日志 | 未发现记录 key 的日志调用（grep `logger.*key` 仅指纹/错误信息，见 1.4） |

**风险要点**【推断】
- 明文 SQLite 意味着任何同用户进程、任意备份/云同步均可读；3.1 向导若新增"API Key 输入"场景，落盘方式与现状一致（明文），需在 UI 说明。
- `!op read ...` 式 config 引用（`!command`）是现成的"不落盘"路径，向导可复用（cascade.ts:70-71 默认 resolver env 或字面量；coding-agent 侧有带命令缓存的 resolver，见 cascade.ts:132-140 注释）。

### 1.2 配置优先级链与向导写入层

**SettingProvenance 六层**【代码确认】
- 类型定义：`coding-agent/src/config/settings.ts:65-66`：`"env" | "runtime" | "overlay" | "project" | "global" | "default"`。
- 生效顺序（getProvenance）：runtime → overlay → project → global → overlay 父级 → default：`config/settings.ts:1155-1168`。env 由 `config/registry.ts:842-843` 在 `settings.getProvenance` 之前优先返回 `"env"`（env 高于一切层）。
- 层标签（UI 展示用）：`config/model-presets.ts:147-154`（env=environment, runtime=command line, overlay=`--config file`, project=project config, global=global config）。
- 运行时 override（CLI `--approval-mode` 等）走 `Setting.override` → writeValue(layer "override")：`config/registry.ts:776-780`、`coding-agent/src/main.ts:1998-2010`。

**向导写到哪里**【代码确认】
- 六场景的保存全部经 `Setting.set` → `settings.writeValue(setting, value, "global")`：`config/registry.ts:768-771`；writeValue 全局层暂存+后台落盘 `config/settings.ts:1189-1208`（`#stageGlobal`/`#queueSave`；同值重写有 no-op 守卫 :1199）。
- Host 绑定：`coding-agent/src/modes/setup.ts:35-102`（saveTheme/saveComposerShape/saveSymbolPreset/saveColorBlindMode/saveAutoUpdate 均 `cfg*.set(settings, ...)`；selectModel :67-72 走 `ctx.session.setModel(..., persist: !projectScope)`，`cfgModelRoleStorage === "project"` 时写 project 层 `setProjectModelRole`）。
- 完成标记 `cfgSetupVersion` 同样 global 层：modes/setup.ts:105-108。

**会不会覆盖用户已有配置**【代码确认 + 推断】
- 只写 global 层的对应 setting 段，不整文件重建用户 config.yml 的其他键（writeValue 按段 stage；同值 no-op settings.ts:1197-1202）——不会删改 project/overlay/env 层【代码确认】。
- 但 global 层写入会**替换该键既有 global 值**（正常语义），且若用户在更高层（env/runtime/overlay/project）已有同名值，向导写入会被其遮蔽而不生效——已有专门的遮蔽提示逻辑可参考：model-presets.ts:156-161（`modelPresetSavedMessage`"…but the project config still defines…"）【代码确认】。
- 模型角色默认存储位置受 `cfgModelRoleStorage` 控制，向导已区分 project/global（setup.ts:68-70）【代码确认】。
- 计划要求的"避免破坏或覆盖用户原有设置"现状结论：机制上不破坏他层；风险点是【推断】向导不读既有值做 diff 预览（theme 有"未确认不保存"预览，model/sign-in 是直接提交），3.1 增加提供商配置时应显式展示将写入的层与被遮蔽情况。

### 1.3 向导六场景 vs 计划要求缺口表

场景定义：`tui/src/setup/wizard.ts:18-25`（ALL_SCENES 顺序：providers→model→glyph→composer→theme→updates），场景选择/版本门 `selectSetupScenes` :57-76，`OMP_SKIP_SETUP`/`startup.setupWizard`/TTY 门 :46-55。

| 计划要求（3.1） | 现状 | 判定 |
|---|---|---|
| 本地/云端提供商 | 仅 OAuth 提供商选择器（`getOAuthProviders`），无本地 provider（oMLX/lm-studio 等）注册入口；keyless `empty-fallback` 机制存在于 cascade（ai/src/auth/cascade.ts:172-195）但向导未暴露 | 【缺】 |
| Base URL | 无向导场景；配置走 models.yml/models.json（config/config/model-patch.ts:63-77） | 【缺】 |
| API Key | 向导无任何 API key 输入（grep setup/ 无 apiKey）；仅 OAuth 流（sign-in.ts:233-281）。MCP add-wizard 有 key 输入但属另一流程 | 【缺】 |
| 模型 | model 场景：搜索已发现模型、设默认角色（tui/setup/scenes/model.ts:308-322；持久化 setup.ts:67-72） | 【已有】 |
| 自动/手动调度 | 向导无调度配置；语义在 config/nightglide-routing.ts（manual/local/balanced/performance），未接入向导 | 【缺】 |
| 回退 | 向导无回退配置 | 【缺】 |
| 主题/字形/输入框/更新 | glyph/composer/theme/updates 四场景（各 scenes 文件） | 【已有】（超出计划列举，属 OMP 既有） |

**取消/失败恢复/连接失败现状**【代码确认】
- 逐场景 Esc=跳过不保存：sign-in.ts:79（`finish("skipped")`）、model.ts:60、glyph.ts:56、composer.ts:52-54（注释"Esc skips… configured shape stays untouched"）、theme.ts:291-299、updates.ts:44-45。
- Ctrl+C = 退出整个向导并**标记完成**（wizard-overlay.ts:162-165 → beginOutro → #complete :566-570；wizard.ts:109-112 run 结束后 markComplete）——【注意】Ctrl+C 中途退出也会写 `cfgSetupVersion`，未保存的场景保持原状。
- 连接失败：model 场景 discovery 失败可重试（model.ts:82-84, 147, 172-174）；save 失败显示错误且不 finish（:316-321）；sign-in 失败显示错误行并回列表（sign-in.ts:209-215, 270-277）。
- 保存后重启恢复：各场景保存即 `flush()` 落盘 + 完成版本号持久化（setup.ts:71/107）【代码确认】。
- 3.1 要求的"编辑"（编辑已有配置）与"保存后重启恢复"的实测验收：机制存在，向导 UI 无"编辑已有 provider"入口【缺】。

### 1.4 密钥遮掩现状

**UI 输入遮掩**【代码确认】
- 通用机制：`tui/src/components/input.ts:72`（`mask = false` 默认；true 时渲染 bullets，值内部保留）；debug 预览同步遮掩 :110-121。
- 登录对话框：`tui/src/overlays/login-dialog.ts:264-277`（`showPrompt`：`prompt.secret === true` → 新输入框 mask；已答的 secret 旧值回显为 `********` :268；防 undo/yank 取回 secret :275 注释）。`#createInput(secret)` :131-146 → `TextFormField({secret})` → `form.ts:311,332`（`input.mask = options.secret ?? false`）。
- 提供方标 secret 的实例：antigravity 粘贴授权码 `secret: true`（ai/src/registry/oauth/antigravity-cli.ts:169）。
- **反例（缺口）**：MCP add-wizard 的 API key 步骤未标 secret——`tui/src/overlays/mcp-add-wizard.ts:1428-1439`（`#renderApiKeyStep` 无 `secret: true`），同文件 OAuth client secret 步骤有标（:1374-1380）→ API key 明文显示【代码确认，建议后续修复，非 3.1 向导本体】。
- oauth-selector 只显示来源标签（"API key · config/env"）不显值：`tui/src/overlays/oauth-selector.ts:515`。

**日志/错误信息防护**【代码确认】
- 出站内容 redaction：`ai/src/providers/transform-messages.ts:758-775`（`redactSensitiveCredentials`：按前缀替换为 `[github_token_redacted]` 等；激活条件 :733-735，可 scope 关闭）；`redactSensitiveInObject` :779-809。
- auth-broker 快照去 refresh token：ai/src/auth/pool.ts:741-768。
- 日志调用 grep：auth 模块日志只含 provider/指纹/error.message，未发现 key 值入日志【代码确认，基于 grep】。
- sign-in 成功行显示存储路径不显值：sign-in.ts:206（`Credentials saved to <path>`）。
- 【推断】风险残留：工具错误透传 `error.message`（model.ts:319、sign-in.ts:276）未经 redact；若上游错误回显请求头/URL 查询参数中的 key，会进入向导状态行与日志——3.1 验收"日志和截图不暴露 key"需在实机验证该项。

---

## 二、3.3 审批风险分类（草案——非行为变更）

> **本节为草案**。默认值（含 `tools.approvalMode` 现行 schema 默认 `yolo`）的任何变更都需用户确认后另行实施；本文档不构成任何行为变更，代码验证前不得宣称新默认已生效（DEVELOPMENT_PLAN.md:87）。

### 2.1 审批机制现状

- Tier 定义与序：`read(0) < write(1) < exec(2)`：`coding-agent/src/tools/approval.ts:129-136`；未声明 approval 的工具 fail-closed 记为 exec（:295, :281）。
- 模式与各自放行上限：`always-ask/always-ask-cached → read`、`write → write`、`yolo → exec`：approval.ts:153-158（`APPROVAL_MODE_MAX_TIER`）。
- 模式 schema 默认 **yolo**：`coding-agent/src/tools/settings.ts:314-318`（`tools.approvalMode` default `"yolo"`，四模式说明 :308-313）。
- 无 settings 上下文时 fail-closed 到 always-ask+空策略；`--auto-approve/--yolo` 强制 yolo：approval.ts:97-113（resolveApprovalFromContext）。
- 解析顺序：工具自declared decision → 用户逐工具覆盖 → 模式 tier 比较 → restrictedFolders 强化；deny 最优先：approval.ts:349-390（resolveApproval）、:392-514（resolvePolicy）。yolo 模式下 override 型工具 prompt 仍生效，用户 `tools.approval` 始终权威（:363-364 注释、:446-464）。
- 会话级/目录级记忆授权（`always-ask-cached`）：approval.ts:189-259、:605-612（tier 参与授权键，批准 write 不覆盖 exec）。
- 逐工具覆盖：`tools.approval.<tool>: allow|prompt|deny`：`tools/settings.ts:295-306`；policyKey 子工具回退、旧名只继承 deny/prompt 不继承 allow：approval.ts:400-424（fail-closed 注释）。
- restrictedFolders：配置 `tools.restrictedFolders`（tools/settings.ts:354-373，默认空数组）；"任何模式、任何授权记忆之上每调用必问"：approval.ts:324-344、:377-389（`source:"restriction"`，override 强制再问）、:573-596（含递归搜索、symlink/大小写归一、相对/`~` 展开）。
- headless（无 UI）：prompt 一律硬拒并给出三条出路提示：`coding-agent/src/extensibility/extensions/wrapper.ts:446-470`（`hasUI()` 默认 false，sdk.ts:2647）；restricted folder 触发的 prompt 亦硬拒（:457-463）；provider 安全检查即使 yolo 也不可跳过（:446-447 注释，:452-456）。
- headless yolo 警告：用户未表达任何审批意图时 stderr 提示：`coding-agent/src/config/nightglide-routing.ts:453-464`（headlessApprovalWarning）。
- 与 T2 实证一致【代码确认】：always-ask 下 read tier 自动放行（modeApprovesTier :320-322），write/bash/eval（exec）走 prompt → 无 UI → 硬拒（wrapper.ts:448-470）。

### 2.2 内置工具 × tier 清单

注册表：`coding-agent/src/tools/index.ts:613-646`（BUILTIN_TOOLS）+ 隐藏工具 :656-659（think/yield/goal）；名称清单 `tools/builtin-names.ts:1-30`。

| 工具 | tier | 依据 | 备注 |
|---|---|---|---|
| read | read（个别 exec） | tools/read.ts:1210-1215 | PDF 图片成员语法→exec；内部 URL 按 scheme readTier（internal-urls/router.ts:419-430） |
| bash | 动态：write(allow)→exec | tools/bash.ts:652-708 | 模式允许的命令→tier write+allow（:707）；其余 exec；拦截/模式 deny→硬拒（:660-663,676-684）；CRITICAL_BASH_PATTERNS（rm -rf /、mkfs、dd 到设备、fork bomb 等，:192-232）→exec+override 强制问（:686-698） |
| edit | write（按目标取最严） | edit/index.ts:429-436 | 各写目标 strictestApproval（approval.ts:143-151）；只读 URL 目标→deny |
| write | write（按目标） | tools/write.ts:593-600 | `xd://` 设备可变 tier；只读 scheme→deny（router.ts:410-417） |
| ast_grep | read（按 path scheme） | tools/ast-grep.ts:146；path-utils.ts:1503-1515 | searchPathTier：文本中出现更高 readTier scheme 即升 |
| ast_edit | write（按目标最严；非法输入 exec） | tools/ast-edit.ts:160-174 | fail-closed：畸形条目→exec（:169-170） |
| grep | read（同上） | tools/grep.ts:553 | |
| glob | read | tools/glob.ts:124 | |
| find | read | tools/jfind/index.ts:73 | |
| web_search | read | web/search/index.ts:459（custom tool :507 同） | |
| ask | read | tools/ask.ts:354 | 向用户提问，无副作用 |
| todo | read | tools/todo.ts:680 | |
| wait | read | tools/wait.ts:219 | |
| think / yield | read（隐藏工具） | tools/think.ts:53; tools/yield.ts:358 | |
| memory_edit / recall / reflect | read | tools/memory-edit.ts:22; memory-recall.ts:20; memory-reflect.ts:21 | 项目内记忆读写均 read |
| retain / learn | read；global 范围→write | tools/memory-retain.ts:42-43; tools/learn.ts:52-56 | "global 影响所有项目，等同文件写"（原注释） |
| checkpoint / rewind | read | tools/checkpoint.ts:55, :91 | git 状态操作，语义上可改工作区【推断：rewind 恢复快照会覆写文件，归 read 值得复核】 |
| context_notes | 带 text→write，否则 read | tools/context-notes.ts:82-84 | |
| new_context | write | tools/context-notes.ts:156 | 清空上下文，无文件副作用 |
| manage_skill | write | tools/manage-skill.ts:42 | 增删技能文件 |
| lsp | 只读 action→read，否则 write | lsp/tool.ts:183-187 | LSP_READONLY_ACTIONS（lsp/servers.ts:26-36：diagnostics/definition/…） |
| debug | 只读 action→read，否则 exec | tools/debug.ts:545-549 | DEBUG_READONLY_ACTIONS（debug.ts:57-66） |
| github | 只读 op→read，否则 exec | tools/gh.ts:140-143 | GITHUB_READONLY_OPS（gh.ts:69-79：repo_view/file_read/search_*/run_watch）；pr_create/pr_checkout/pr_push→exec |
| eval | exec | tools/eval.ts:349 | 任意 JS/Python 代码 |
| task | exec | task/index.ts:705 | 子智能体派发 |
| security_scan | exec | tools/security-scan.ts:109 | |
| goal | op=get→read，否则 write | goals/tools/goal-tool.ts:65-67 | 会话状态，不触盘 |
| ida | list→read / exec→exec / 其余 write | tools/ida.ts:81-85 | IDA 数据库操作 |
| computer（设置门控，非 builtin30） | capabilities/只读链→read，否则 exec | tools/computer.ts:117-131 | cfgComputerEnabled 门控 |

MCP 工具：无自declared approval 时按 exec 处理（approval.ts:281），审批提示带 "Origin: MCP server tool"（:723-725）。

### 2.3 风险分类草案（供 3.3 确认，不改默认值）

**A. read（现 always-ask/always-ask-cached 下自动可跑）**【代码确认】
- 纯本地读取/搜索：read、grep、glob、ast_grep、find、lsp 只读 action、memory_*。
- 网络读取：web_search、github 只读 op、read 对 http(s) 目标（read.ts:1210 + router readTier 默认 read——【注意】公网 URL 读取自动放行且无缓存授权键，见 read.ts:1226-1230 注释"already public"）。
- 会话内状态：todo/ask/wait/think/yield/goal(get)/checkpoint/rewind。
- 草案关注点【推断】：`rewind` 会用快照覆写工作区却标 read；`learn/retain` 的 write 判定依赖参数中的 scope 字段；`context_notes` 读分支 read。这三处属于"tier 声明与副作用不完全对齐"的待确认项。

**B. write（现 always-ask 下必问；write 模式自动跑）**
- edit、write、ast_edit、lsp 非 read action、context_notes(写)、new_context、manage_skill、retain/learn(global)、ida(结构化编辑)、goal(写 op)、bash 中被 `bash.patterns` 显式 allow 的命令（bash.ts:707，tier=write+policy allow——【注意】此设计把"模式允许的 shell 命令"归入 write 档，`write` 模式下将自动执行）。

**C. exec（现 always-ask/write 下必问；yolo 自动跑）**
- bash（未被模式 allow 的任意命令）、eval、task、security_scan、github 写 op（pr_create/pr_checkout/pr_push）、debug 非 read action、computer 非 read 调用、ida exec、`xd://` 设备写声明为 exec 时。
- bash 内部还有更高一级"critical patterns"（rm -rf/、mkfs、dd 写设备、fork bomb 等）：即便用户策略 allow 之外，工具自declared override=true 强制每次问（bash.ts:686-698；approval.ts:466-475 override 分支；yolo 下 override prompt 仍生效 approval.ts:446-456）。

**D. 无法判断/边界操作**【代码确认 + 推断】
1. 未声明 approval 的第三方/MCP 工具：记 exec（fail-closed，approval.ts:295）但内容黑盒——无法从参数判断副作用。
2. `bash.patterns` 覆盖不了复合命令碎片时的判断依赖 shell 词法（compoundSegments，bash.ts:666-668），非 POSIX shell 下 compound 分析关闭（:666-667 shell 白名单判断）——【推断】存在绕过模式匹配的语法空间。
3. 内部 URL `xd://` 设备：tier 由设备 spec 决定、可按参数变化（write.ts:593-600、approval.ts:309-318），未知设备默认 fail-closed。
4. read 的 PDF 图片成员/`?q=` 等语法边界：判 exec（read.ts:1213-1215），普通用户难预判。
5. provider 安全检查（computer 等）：与 tier 正交，yolo 也不能跳过（wrapper.ts:446-456）。
6. headless：任何 prompt 都无法应答→硬拒（wrapper.ts:448-470）；非交互验收必须经 `tools.approval.*: allow` 或 yolo 显式放行——这正是 T2 实证行为的机制来源。

**E. 与计划 3.3 的差距**（草案，待确认）
- 现行 schema 默认 `yolo`（tools/settings.ts:318）vs 计划目标"默认高风险询问"——需用户确认迁移策略与对既有用户的行为变化（DEVELOPMENT_PLAN.md:87、:99-100 已列为待决策项 2）。
- 模式名 `yolo` 语义 = exec 全放行；"全部询问/高风险询问/自动执行"三档易切换 UI 尚未对齐（always-ask/always-ask-cached/write/yolo 四档已存在，settings.ts:308-350 UI 描述齐全）。
- D 组"无法判断的操作"清单需在 3.3 文档中显式列出并给默认（现全部 fail-closed exec，属保守但非零风险）。

---

## 附：本次审查实际读取文件清单

- docs/DEVELOPMENT_PLAN.md（3.1/3.3 原文）
- vendor/omp/packages/ai/src/{auth-storage.ts, auth/{cascade,sqlite-credential-store,pool,refresh}.ts, env-api-key.ts, providers/transform-messages.ts, registry/oauth/antigravity-cli.ts}
- vendor/omp/packages/coding-agent/src/{config/{settings,registry,model-presets,model-provider-discovery,nightglide-routing}.ts, session/auth-storage.ts, modes/{setup,print-mode}.ts, main.ts, sdk.ts, cli/args.ts, tools/{approval,builtin-names,settings,index,read,write,bash,ast-edit,ast-grep,grep,glob,ask,todo,wait,think,yield,memory-edit,memory-recall,memory-reflect,memory-retain,learn,manage-skill,checkpoint,security-scan,eval,gh,debug,ida,computer,path-utils,jfind/index}.ts, edit/index.ts, lsp/{tool,servers}.ts, task/index.ts, web/search/index.ts, goals/tools/goal-tool.ts, extensibility/extensions/wrapper.ts}
- vendor/omp/packages/tui/src/{setup/{wizard,wizard-overlay}.ts, setup/scenes/{types,sign-in,model,glyph,composer,theme,updates}.ts, components/{input,form}.ts, overlays/{login-dialog,oauth-selector,mcp-add-wizard}.ts}
- vendor/omp/packages/utils/src/dirs.ts
