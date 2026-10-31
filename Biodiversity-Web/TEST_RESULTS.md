> Status update (2026-11-01): field encryption is deferred pending Mobile integration. Earlier encryption checks describe the previous version, not current protection. See `security/DATA_PROTECTION.md`.

# Main Web 本机验收结果

日期：2026-10-31（Asia/Kuala_Lumpur）

范围：本地 `main`，基准提交 `74f6119`，以及本轮在工作区修复的注册流程。远程 `origin/main` 仍为 `b49079a`，没有执行推送。本次使用隔离的本机测试数据库及虚构数据。

## 结论

本次覆盖的 Web 核心流程验收通过，没有遗留的阻断问题。发现注册成功后未跳转的问题，已复现、修复并通过新增回归测试。修复和测试文件保留在本地 main 工作区，未提交、未推送。

## 验证结果

| 项目 | 实测内容 | 结果 |
| --- | --- | --- |
| 构建及语法 | 生产构建；全部 PHP 语法；9 项前端逻辑测试 | 通过 |
| 数据库集成 | 审核、分布地图、报告、历史统计、监控、自动警报、设备关联，共 26 个测试方法 | 通过 |
| Web API 验收 | 照片 CRUD、数据验证、角色变化、停用／退出、CSRF、来源和私有文件保护，共 6 组 | 通过 |
| 注册与登录 | 密码不一致；注册成功跳转；成功提示；错误／正确密码；普通用户角色；管理员页面拒绝；退出；五次失败后的限流 | 通过 |
| 物种管理 | 浏览器实际新增、上传及移除照片、搜索、编辑、取消删除、确认删除 | 通过 |
| 观察审核 | 搜索、证据照片预览、审核清单、必填理由、取消、批准／要求修改／拒绝、刷新后保留决定、已审核只读 | 通过 |
| 物种分布地图 | 缺失 GPS 排除、待审核开关、物种过滤、键盘选点、空结果、在线瓦片失败后的本地底图、详情返回和浏览器 Back 保留筛选 | 通过 |
| 报告 | 真实 CSV 下载；筛选变化后旧报告禁止导出；登出后禁止导出；打印函数及实际 PDF 文件 | 通过 |
| 导出内容 | CSV UTF-8 BOM、中文、引号、换行、公式前缀防护；PDF 横向一页且包含全部 4 个测试物种 | 通过 |
| 监控刷新 | 首次加载、30 秒刷新、手动刷新、暂停、隐藏标签页暂停／恢复、失败保留旧数据及恢复、离开页面停止请求 | 通过 |
| 历史分析 | 起止日期、物种筛选、日／月平均值、缺测留空、图表指标切换、分页、无结果和失败恢复 | 通过 |
| 自动警报 | 模拟上报后真实数据库生成警报并在 30 秒刷新后显示；阈值边界、冷却、Critical 升级、多个规则、过期基线、注入写入失败后的事务回滚 | 通过 |
| 植株与设备追踪 | 注册、一次性密钥、绑定、独立密钥上报、地图标记及轨迹、绑定历史、编辑、暂停、换绑／解绑、旧密钥失效及设备隔离 | 通过 |
| 窄屏 | 390／768 像素布局按各浏览器测试覆盖；宽表和地图使用局部滚动 | 通过 |
| 生产依赖 | npm audit --omit=dev | 检查时已知漏洞数 0 |

执行了 10 套不同的浏览器流程（既有登录业务、注册、审核、分布地图、地图返回、报告、监控、历史分析、自动警报、设备追踪）。注册修复后复跑了注册和既有登录／物种管理测试，并重新通过构建及前端逻辑测试。

## 本轮修复

- 注册 API 返回成功后，跳转到登录页并显示账号已创建的提示。
- 修复注册表单引用不存在的反馈清理函数。
- 将密码提示和输入最低长度与现有校验对齐，移除旧的 8–128 字符提示。
- 提交完成后清除表单中的密码值。
- 新增注册／登录限流浏览器回归，以及仅允许清理虚构认证账号的测试工具。

## 验收边界

- IoT 使用真实后端接口和数据库处理模拟上报，没有连接真实硬件；阈值仍需现场校准。
- 监控故障／后台刷新测试使用模拟响应及加速时钟；真实上报到警报展示另有浏览器测试覆盖。
- 本地功能通过不等于已完成 HTTPS、云端同步、数据库与备份加密、现场设备准确性或正式安全渗透评估。
- 本次新增的临时账号、物种和设备测试记录由对应工具清理。审核测试会在隔离库保留虚构观察与审核记录，便于查看，不应视为真实调查数据。
- 原 Mobile 工作区未改动。没有提交或推送本轮修复。


## 后续本地加密验收

敏感字段加密、密钥错误／篡改拒绝、旧数据迁移和加密备份恢复，以及运行账号最小权限的后续测试，见 `security/TEST_RESULTS.md`。此更新不表示已经部署 HTTPS 或完成整机／云端安全认证。

## Encryption deferral regression (2026-11-01)

Local main working tree only; not committed or pushed. Sensitive-field encryption was withdrawn pending joint Mobile integration. The existing isolated local database was backed up in full and converted using the original key. User IDs, password hashes, roles and relationships were preserved. The final rollback check found no encryption schema or encrypted fields. Private keys and historical encrypted backups were retained outside Git for recovery.

Verification after conversion:

- 26 database integration methods passed, including observation review, reports, distribution, monitoring, history, automatic alerts and tracking. The local service used a dedicated restricted runtime account and a synthetic shared device test key, not physical hardware.
- 6 Web acceptance groups passed, covering CRUD, photos, inputs, registration policy, live roles, disabled accounts, CSRF and private paths.
- 2 browser flows passed: registration/login/logout/throttling and role routes/species/photo CRUD/user/admin navigation.
- Production build and 9 frontend tests passed; all PHP syntax checks passed.
- Restricted runtime-account permissions check passed.
- `rollback_sensitive_data_test.php` passed against its own randomly named temporary database: missing-key refusal before mutation, authenticated conversion, preserved credentials/relationships, unique plaintext email constraint and repeat safety. Its temporary database and snapshots were cleaned up.

The normal backend no longer loads cryptographic field helpers or requires an encryption key. Password hashing, sessions, role checks and CSRF controls remain. The legacy cipher helper is CLI-only and exists solely for converting previously encrypted databases. Historical encryption test documents are explicitly marked as such; this version does not claim encryption of personal fields at rest.
