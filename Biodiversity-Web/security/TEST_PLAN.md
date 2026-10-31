# 本地安全测试计划

目标：验证敏感资料在数据库中是可认证密文，未授权请求无法取用，迁移可恢复，并且现有 Web 功能不受影响。本计划属于本地 SSDLC 的安全设计、验证、修复与复测证据，不是正式渗透测试或合规认证。

## 范围、环境与威胁模型

- 本地 main Web/PHP、隔离的 loopback `*_test` MySQL、真实接口和浏览器；只使用虚构资料。
- 攻击／故障假设：未登录请求、普通用户越权、已停用账号、被降级的旧会话、恶意输入、数据库只读泄露、密文篡改／跨行交换、密钥缺失、迁移中断和错误恢复。
- 不涵盖真实硬件、云端、生产 TLS 证书、整机入侵、DDoS、完整第三方 DAST 或法律合规判定。
- 浏览器测试以 Playwright 驱动实际页面；刷新故障测试使用模拟响应和加速时钟。设备链路以合成 JSON 上报模拟传感器，后端和数据库是真实运行的。

## 测试矩阵

| 编号 | 测试 | 通过标准 |
| --- | --- | --- |
| SEC-01 | 注册、登录、错误密码、限流、退出 | 正确流程可用；普通注册不获特权；连续失败返回 429；退出后 401 |
| SEC-02 | 角色、账号停用、角色变化、对象归属 | 后端拒绝越权，旧会话不能绕过当前账号状态 |
| SEC-03 | CSRF、Origin、内容类型及输入 | 非法请求拒绝；没有不完整写入 |
| SEC-04 | SQL 搜索、图片类型及文本输出 | 查询参数化；恶意 SVG／伪图像拒绝；文本不作为可执行 HTML |
| SEC-05 | 数据库字段机密性 | 姓名、邮箱、观察和审核文本均为认证密文；没有明文回退 |
| SEC-06 | 加密完整性 | 修改标签、截断、错误密钥、跨用户／字段移植被拒绝 |
| SEC-07 | 密钥和配置访问 | 密钥在 Git/公开目录外；配置不被 HTTP 读取；不输出密钥／资料；运行账号无 DDL 权限 |
| SEC-08 | 密钥故障与资料损坏 API | 仅返回通用错误；被篡改资料不能建立登录；格式有效但不匹配的密钥也不能注册新用户 |
| SEC-09 | 旧数据迁移及恢复 | 先有可验证加密快照；ID／密码哈希／关联保持；恢复不覆盖新行；重复迁移不产生双重加密 |
| SEC-10 | 业务回归 | 登录、用户管理、审核、报告、地图、历史分析、警报和设备追踪保持可用 |
| SEC-11 | 依赖检查 | 记录 npm audit 结果；零已知依赖漏洞不被解释为无漏洞 |

## 工具与复跑

运行前设置 `REVIEW_TEST_FIXTURES=1`、loopback `*_test` 数据库操作员变量和 `REVIEW_TEST_PHP`。标准接口测试还需 `REVIEW_TEST_URL=http://localhost:<test-port>`；共享设备测试需要显式配置专用设备测试 key。不要使用生产数据库或真实密钥测试故障。

从仓库根目录：

```sh
php Biodiversity-Web/backend/tests/data_protection_test.php
php Biodiversity-Web/backend/tests/audit_encrypted_data.php
python Biodiversity-Web/backend/tests/encryption_migration_test.py
python Biodiversity-Web/backend/tests/encryption_api_test.py
python -m unittest discover -s Biodiversity-Web/backend/tests -p '*integration.py' -v
python Biodiversity-Web/backend/tests/web_acceptance.py
```

迁移测试仅创建并删除它自己拥有的随机临时库；需要操作员建库权限。API 缺失密钥测试需要额外 `REVIEW_TEST_FAILURE_URL`，指向故意配置不存在密钥文件的**独立**服务；不能破坏正常服务的配置。

运行 `runtime_permissions.php` 时不要给进程注入 root 凭据，它应读取实际 Web 私有配置，检查运行账号权限。Crypto 测试使用仓库外私有目录中的临时测试密钥，结束后清除。

前端目录执行 `npm run build`、`node --test tests/*.test.mjs`、`npm audit --omit=dev --json`。浏览器脚本使用 Playwright 和 `REVIEW_TEST_WEB_URL`；具体流程见 `TEST_RESULTS.md`、`../TEST_RESULTS.md` 及各功能文档。

退出条件：所有指定测试通过，故障注入已清理，未暴露密钥或明文资料，维护模式已关闭；任何失败须记录原因、修复及同场景复测结果。不得把跳过的设备专用测试记为执行通过。
