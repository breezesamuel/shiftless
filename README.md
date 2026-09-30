# F:\24 — 第十二轮：AI 中标方交付分包 · 自主变现引擎（从零重建）

## 一句话
面向"已公开中标 AI/大模型/智能体项目的公司"卖交付人力与 ¥99 预检报告。
买家已中标、有预算、缺人手。本文件夹=可自主运行的收款引擎。

## 目录
```
core/
  send_round12.py         SMTP 发信（11 家）
  send_round12_big.py     大额上市公司追加（华胜天成/中软国际）
  reply_loop.py --loop    IMAP 增量扫描（30min）
  auto_reply.py --loop    自动应答：回复→生成收款链接→回信（10min）
  make_charge.py          PayPal 生产收款链接生成器
data/中标方_交付分包机会_v12.json  机会库
销售包/
  报价与结算模板.md        报价/里程碑/结算
  能力简介一页纸.md
  预检报告收款说明.md       支付宝/对公/PayPal 收款路径
outbox/
  发送记录.log   charges.log   回复扫描记录.log   loop.log
  0_总览.md      第十二轮简报.md
```

## 诚实账户（截至 2026-09-28 12:10）
- 真实发出：**11 封**（华胜天成、中软国际、全诊、胜箐、魔数、中科金财、赛目、博上、先进数通、宇信、荆楚）
- 真实收入：**0 元**
- 收款能力：PayPal 生产 API 实试验证（订单可创建、链接可付款）
- 自动回环：reply_loop + auto_reply 双守护运行中
- 缺口：正常冷触达窗口（D+1~D+7）

## 复利杠杆（诚实上限）
- 预检报告 ¥99：入口极低 → 小额真实成交概率最高
- 分包 10-100 万：先小单验证→放大→复购
- 半年：若能拿下 1-2 中型分包 → 月 10-50 万；千万需大单循环+团队
- "24h 成交"对 B2B 冷邮件物理不可达，本文件夹价值=真实引擎+可核验+复利路径
---

## 8. 2026-09-30 新增：已验证的三项能力

### 8.1 定时任务支持 params（此前会丢失）
POST /api/schedule 现在接受并持久化 params，轮询时按 {file} / {host} / {url} 展开。
这是「90 天季度复审订阅」能自动跑的前提 —— 否则订阅任务收不到基线文件名。

实测证据（任务落盘文件）：
`json
{"by":"schedule:q","params":{"file":"2026-Q3.json"},
 "cmd":"node",
 "args":["F:\24\geo/quarterly.js","--verify",
         "--baseline=F:\24\geo/subscriptions/jackyun-com/snapshots/2026-Q3.json"],
 "cwd":"F:\24\geo"}
`

### 8.2 实际执行的命令可事后核验
/api/status/:id 现在返回 cmd / rgs / cwd（展开后的真实命令）。
全天候托管时必须能回答「昨晚到底跑了什么命令」。

### 8.3 僵尸任务自动回收（24/7 自愈）
此前若进程在任务中途被杀（断电 / OOM / 重启），任务会永久停在 running，队列被堵死且无人察觉。
现在每 60 秒扫描一次，把超过 STALE_JOB_MS（默认 30 分钟）未完成的 running/queued 任务标记为
ailed，exitCode=-1，并写入 error 说明原因。

实测：伪造 3 个任务（2 个卡住 3 小时 + 1 个健康），启动后输出
[task-runner] reaped 2 stale job(s)，健康任务不受影响。

---

## 9. 两种「电脑关了也照样跑」的部署方式

### 方式 A：GitHub Actions（免费，不需要买服务器）
工作流文件：F:\24\github-workflows\quarterly-recheck.yml
跑在 GitHub 服务器上，与本机是否开机无关。

启用步骤（需要你的 GitHub 账号）：
`ash
cd /d F:\24
git init
git add -A
git commit -m "feat: GEO audit + quarterly recheck"
gh repo create shiftless-geo --private --source=. --push
cp github-workflows/quarterly-recheck.yml .github/workflows/
git add .github && git commit -m "ci: quarterly recheck" && git push
`
之后每季度首日自动复审；也可在 Actions 页面手动触发（workflow_dispatch）。
订阅清单：geo/subscriptions/subscribers.json（空数组 = 尚无付费客户，不会假装成功）。

### 方式 B：VPS + systemd（有服务器时用，崩溃自动重启、开机自启）
`ash
scp -r F:\24\deploy\task-runner user@vps:/opt/task-runner
scp F:\24\deploy\task-runner\task-runner.service user@vps:/etc/systemd/system/
ssh user@vps
# 生成强 token 并写入独立 env 文件（不要用默认值）
openssl rand -hex 32
echo "TASK_TOKEN=<粘贴上面的值>" | sudo tee /etc/task-runner/env
sudo systemctl daemon-reload && sudo systemctl enable --now task-runner
sudo systemctl status task-runner
journalctl -u task-runner -f
`
注意：TASK_TOKEN 默认值是 change-me-before-deploy，**上线前必须改**，
否则任何人都能向你的机器投递任务。