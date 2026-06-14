# Windows 部署与运维

## 适用范围

本说明用于客户专用 Windows 电脑。程序、SQLite、原始报表、日志和凭证均保存在客户电脑，默认运行目录为 `C:\YiwuCollector\runtime`。

## 安装前检查

1. 使用固定的 Windows 业务账号登录。
2. 安装 Node.js 24 LTS，并确认 `node --version` 的主版本为 24。
3. 安装并登录比特浏览器，确认 Local API 地址可访问。
4. 确认 `C:` 盘有足够空间保存原始报表、截图和备份。
5. 将项目放在固定目录，不要放在会自动同步到个人云盘的位置。

## 首次安装

在项目根目录打开 PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install.ps1
```

脚本会安装依赖、构建服务端和管理端、创建运行目录、复制本地配置模板并执行数据库迁移。它不会写入密码、Cookie 或飞书密钥。

检查 `config\app.local.json` 中的非敏感参数。需要保存密钥时使用：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\set-secret.ps1 -Name feishu_app_secret
```

## 启动与停止

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\start.ps1
Invoke-RestMethod http://127.0.0.1:4310/health
```

浏览器打开 `http://127.0.0.1:4310/`。停止服务：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\stop.ps1
```

启动脚本仅记录并管理 `runtime\pids\collector.pid` 指向的进程，不会按名称批量结束其他 Node.js 程序。

## 备份

手动执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\backup.ps1
```

备份流程先暂停新任务，等待运行中任务结束，再调用 SQLite 在线备份 API。备份包含数据库、无凭证配置、迁移文件和报表定义，不包含 DPAPI 密钥文件。

备份目录格式：

```text
C:\YiwuCollector\runtime\backups\yyyyMMdd-HHmmss
```

## 注册计划任务

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\register-task.ps1
```

只创建两个 Windows 计划任务：

- `YiwuCollector-Startup`：当前业务账号登录后启动服务。
- `YiwuCollector-DailyBackup`：每天 03:00 执行备份。

不会为每个平台、账号或店铺创建 Windows 任务。店铺调度由应用内部统一管理。

## 恢复演练

1. 停止服务。
2. 复制当前 `runtime` 到临时保留目录。
3. 从选定备份恢复数据库和无凭证配置。
4. 保留现有 `runtime\secrets`，不要从其他电脑复制 DPAPI 文件。
5. 启动服务并检查 `/health`、店铺列表、最近任务和原始文件下载。
6. 完成一次手动采集验证后，再恢复定时任务。

## 故障位置

- 服务输出：`runtime\logs\server.stdout.log`
- 服务错误：`runtime\logs\server.stderr.log`
- 原始文件：`runtime\raw`
- 截图：`runtime\screenshots`
- 隔离数据：管理端任务详情和 SQLite `quarantined_batches`
- 登录失效：管理端 `waiting_auth`，人工打开对应比特浏览器环境处理
