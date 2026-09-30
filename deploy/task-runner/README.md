# task-runner 部署说明（一次写好，部署到你的服务器就能 24/7 运行）

本服务是一个**零依赖 HTTP API**，部署到任何 VPS（阿里云/腾讯云/AWS/Linode/Oracle Free Tier 等）后即可 24/7 常驻。它不是 AI，它是你**自己服务器上**的一个任务执行器，由我给你写好的代码。

## 1. 目录结构
```text
task-runner/
├── server.js
├── tasks.json        # 预定义任务（可按需增删）
├── Dockerfile
├── docker-compose.yml
├── schedule.json     # 定时任务（自动生成/可编辑）
├── jobs/             # 任务日志 + JSON 状态（自动生成）
├── reports/         # 报告输出目录
└── geo/              # 把 F:\24\geo 整个目录复制过来
```

## 2. 本地准备（先同步审计脚本）
把 GEO 审计脚本同步到 `geo/`：
```bash
# Windows PowerShell
robocopy F:\24\geo F:\24\deploy\task-runner\geo /MIR
```

也可以手动把 `F:\24\geo\` 下的所有 `.js`、`.json` 都复制到 `task-runner/geo/`。

## 3. 部署到你的服务器（推荐 Docker）

### 步骤
1. 上传 `task-runner/` 整个目录到你的服务器（比如 `/opt/task-runner/`）
2. 修改 `docker-compose.yml` 里的 `TASK_TOKEN`：**一定换成强随机字符串**（至少 32 位）
3. 启动：
```bash
cd /opt/task-runner
docker compose up -d --build
```
4. 检查健康：
```bash
curl http://your-server-ip:8080/healthz
# {"ok":true,"uptimeSec":5}
```

## 4. 使用方法（向 API 发指令）

所有接口都需要 `x-task-token` 或 `token` 验证。

### 4.1 一次性运行任务
```bash
curl -X POST http://your-server-ip:8080/api/run \
  -H "Content-Type: application/json" \
  -H "x-task-token: YOUR_STRONG_TOKEN" \
  -d '{
        "task": "audit",
        "url": "https://example.com"
      }'
# 返回：{"id":"job-1759218923456-1","status":"queued"}
```

```bash
curl -X POST http://your-server-ip:8080/api/run \
  -H "Content-Type: application/json" \
  -H "x-task-token: YOUR_STRONG_TOKEN" \
  -d '{
        "task": "report",
        "url": "https://example.com"
      }'
```

### 4.2 查询任务状态
```bash
curl http://your-server-ip:8080/api/status/job-1759218923456-1 \
  -H "x-task-token: YOUR_STRONG_TOKEN"
# 返回：status、exitCode、created/started/finished、outputTail/errorTail
```

### 4.3 查看最近任务
```bash
curl http://your-server-ip:8080/api/jobs \
  -H "x-task-token: YOUR_STRONG_TOKEN"
```

### 4.4 设置定时任务（24/7 自动跑）
每 60 分钟自动跑 `report`：
```bash
curl -X POST http://your-server-ip:8080/api/schedule \
  -H "Content-Type: application/json" \
  -H "x-task-token: YOUR_STRONG_TOKEN" \
  -d '{
        "name": "example_weekly",
        "task": "report",
        "url": "https://example.com",
        "everyMinutes": 60,
        "enabled": true
      }'
```

定时任务配置保存在 `schedule.json`，服务每 30 秒检查一次，到时间自动投队列执行。

## 5. 新增自定义任务
编辑 `tasks.json`：
```json
{
  "batch100": {
    "cmd": "node",
    "args": ["{geo}/batch-audit.js", "{geo}/targets-100.json"],
    "cwd": "{geo}"
  },
  "fixes": {
    "cmd": "node",
    "args": ["{geo}/full-report.js", "{url}", "{workspace}/reports", "--fixes"],
    "cwd": "{geo}"
  }
}
```

可用占位符：
- `{url}`：请求传入的 URL
- `{geo}`：`GEO_DIR` 环境变量（`/app/geo` 容器内）
- `{workspace}`：`WORKSPACE`（`/app`）

改完 `tasks.json` 后：`docker compose restart task-runner`（或重启进程）。

## 6. 安全建议
- **强制改 `TASK_TOKEN`**，不要用 `change-me-strong`
- 建议只暴露 8080 到内网/反向代理（Nginx/Cloudflare Tunnel/Zero Trust），不直接暴露公网全开
- 可在 Nginx 加 Basic Auth + HTTPS（证书用 Let's Encrypt）
- `jobs/*.json/.log` 会不断增长，按需清理（可加 cron 清理 30 天前的日志）

## 7. 不需要再谈「我接管电脑」
这套服务**运行在你的服务器**，24/7、不依赖你的电脑开关、不依赖我会话。你只管给指令（curl/你自己的后台/API 调用），它就执行。

**结论：你想要的「挂到网上 24/7 跑」已经落实成可直接部署的代码包。**