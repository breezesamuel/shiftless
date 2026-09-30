#!/usr/bin/env node
"use strict";

/**
 * task-runner — a zero-dependency HTTP service that accepts instructions
 * and runs jobs 24/7 on the machine where it is deployed.
 *
 * Env:
 *   PORT           listen port (default 8080)
 *   TASK_TOKEN     shared token for all /api calls (required in prod)
 *   WORKSPACE      base dir (default: script dir)
 *   GEO_DIR        path to geo audit scripts, used for the {geo} placeholder
 *   JOBS_DIR       where job state/logs are stored (default WORKSPACE/jobs)
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PORT = Number(process.env.PORT || 8080);
const TOKEN = process.env.TASK_TOKEN || "change-me-before-deploy";
const WORKSPACE = process.env.WORKSPACE || __dirname;
const GEO_DIR = process.env.GEO_DIR || "";
const JOBS_DIR = process.env.JOBS_DIR || path.join(WORKSPACE, "jobs");

fs.mkdirSync(JOBS_DIR, { recursive: true });

const TASKS_FILE = path.join(WORKSPACE, "tasks.json");
const SCHED_FILE = path.join(WORKSPACE, "schedule.json");

let tasks = {};
try { tasks = JSON.parse(fs.readFileSync(TASKS_FILE, "utf8")); } catch (e) {
  console.error("tasks.json not loaded:", e.message);
}
let schedule = {};
try { schedule = JSON.parse(fs.readFileSync(SCHED_FILE, "utf8")); } catch (e) {
  schedule = {};
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").replace(/\./g, "-");
  } catch (e) {
    return "";
  }
}

function repl(s, ctx) {
  let out = String(s)
    .replace(/\{url\}/g, ctx.url || "")
    .replace(/\{geo\}/g, GEO_DIR)
    .replace(/\{workspace\}/g, WORKSPACE)
    .replace(/\{host\}/g, ctx.host || "");
  for (const k of Object.keys(ctx.params || {})) {
    out = out.split(`{${k}}`).join(ctx.params[k] == null ? "" : String(ctx.params[k]));
  }
  return out;
}

let queue = [];
let active = null;
let jobSeq = 0;

function loadJobs() {
  return fs.readdirSync(JOBS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(JOBS_DIR, f), "utf8")))
    .sort((a, b) => b.created - a.created);
}

function saveJob(job) {
  fs.writeFileSync(path.join(JOBS_DIR, job.id + ".json"), JSON.stringify(job));
}

function appendLog(job, line) {
  fs.appendFileSync(path.join(JOBS_DIR, job.id + ".log"), line + "\n");
}

function createJob(task, url, by, params) {
  const id = "job-" + Date.now() + "-" + (++jobSeq);
  const job = {
    id, task, url, by, params: params || {},
    status: "queued",
    created: Date.now(), started: null, finished: null, exitCode: null,
  };
  saveJob(job);
  queue.push(id);
  return job;
}

function runJob(id) {
  return new Promise((resolve) => {
    const job = loadJobs().find((j) => j.id === id);
    if (!job) return resolve();
    job.status = "running";
    job.started = Date.now();
    saveJob(job);
    const ctx = { url: job.url, host: hostOf(job.url), params: job.params || {} };
    const spec = tasks[job.task];
    if (!spec) {
      job.status = "failed"; job.exitCode = -1; job.finished = Date.now();
      job.error = "unknown task: " + job.task;
      saveJob(job);
      return resolve();
    }

    const cmd = repl(spec.cmd, ctx);
    const args = (spec.args || []).map((a) => repl(a, ctx));
    const cwd = spec.cwd ? repl(spec.cwd, ctx) : WORKSPACE;

    // 存下实际展开后的命令：全天候托管时必须能事后核验「到底跑的是什么」
    job.cmd = cmd;
    job.args = args;
    job.cwd = cwd;
    saveJob(job);

    appendLog(job, "> " + [cmd].concat(args).join(" "));
    const child = spawn(cmd, args, { cwd, shell: false });

    child.stdout.on("data", (d) => {
      job.output = (job.output || "") + d;
      appendLog(job, String(d).trimEnd());
    });
    child.stderr.on("data", (d) => {
      job.err = (job.err || "") + d;
      appendLog(job, String(d).trimEnd());
    });
    child.on("close", (code) => {
      job.exitCode = code;
      job.status = code === 0 ? "done" : "failed";
      job.finished = Date.now();
      saveJob(job);
      resolve();
    });
    child.on("error", (err) => {
      job.exitCode = -1;
      job.err = String(err);
      job.status = "failed";
      job.finished = Date.now();
      saveJob(job);
      resolve();
    });
  });
}

async function pump() {
  if (active) return;
  while (queue.length) {
    const id = queue.shift();
    active = id;
    await runJob(id);
    active = null;
  }
  if (queue.length) setImmediate(pump);
}

function pollSchedule() {
  for (const key of Object.keys(schedule)) {
    const s = schedule[key];
    if (!s || !s.enabled) continue;
    if (!s.nextRun) s.nextRun = Date.now();
    if (Date.now() >= s.nextRun) {
      const job = createJob(s.task, s.url, "schedule:" + key, s.params);
      appendLog(job, "scheduled run for '" + key + "'");
      s.lastRun = Date.now();
      s.nextRun = Date.now() + Math.max(1, Number(s.everyMinutes) || 60) * 60000;
      fs.writeFileSync(SCHED_FILE, JSON.stringify(schedule, null, 2));
    }
  }
  pump();
}

function send(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

function authorized(req, body) {
  const t = req.headers["x-task-token"] || (body && body.token);
  return t === TOKEN;
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://localhost");
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch (e) {}

    if (u.pathname === "/healthz") {
      return send(res, 200, { ok: true, uptimeSec: Math.round(process.uptime()) });
    }

    if (!authorized(req, body)) {
      return send(res, 401, { error: "unauthorized", hint: "set TASK_TOKEN env and send x-task-token header or body.token" });
    }

    if (u.pathname === "/api/run" && req.method === "POST") {
      if (!body.task) return send(res, 400, { error: "task required", available: Object.keys(tasks) });
      if (!tasks[body.task]) return send(res, 400, { error: "unknown task", available: Object.keys(tasks) });
      const job = createJob(body.task, body.url, "api", body.params);
      pump();
      return send(res, 202, { id: job.id, status: job.status });
    }

    if (u.pathname === "/api/schedule" && req.method === "POST") {
      if (!body.name || !body.task || !body.everyMinutes) {
        return send(res, 400, { error: "name/task/everyMinutes required", available: Object.keys(tasks) });
      }
      schedule[body.name] = {
        task: body.task, url: body.url || "", everyMinutes: Number(body.everyMinutes),
        params: body.params && typeof body.params === "object" ? body.params : {},
        enabled: body.enabled !== false, nextRun: Date.now(),
      };
      fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedule, null, 2));
      return send(res, 201, { name: body.name, nextRun: schedule[body.name].nextRun, params: schedule[body.name].params });
    }

    const m = u.pathname.match(/^\/api\/status\/([\w-]+)$/);
    if (m) {
      const job = loadJobs().find((j) => j.id === m[1]);
      if (!job) return send(res, 404, { error: "not found" });
      const out = {
        id: job.id, task: job.task, url: job.url, status: job.status,
        exitCode: job.exitCode, created: job.created, started: job.started, finished: job.finished,
      };
      if (job.output) out.outputTail = job.output.slice(-4000);
      if (job.err) out.errorTail = job.err.slice(-4000);
      if (job.error) out.error = job.error;
      return send(res, 200, out);
    }

    if (u.pathname === "/api/jobs") {
      return send(res, 200, loadJobs().slice(0, 50).map((j) => ({
        id: j.id, task: j.task, url: j.url, params: j.params, status: j.status, created: j.created, by: j.by,
      })));
    }

    return send(res, 404, { error: "not found" });
  });
});

server.listen(PORT, () => {
  console.log("[task-runner] listening on :" + PORT + " (token " + TOKEN.slice(0, 3) + "…)");
  console.log("[task-runner] tasks: " + Object.keys(tasks).join(", "));
});

// 回收僵尸任务：进程在任务中途被杀（断电/OOM/重启）时，任务会永远停在 running。
// 全天候托管必须能自愈，否则队列会被僵尸任务堵死且无人知道。
const STALE_MS = Number(process.env.STALE_JOB_MS || 30 * 60 * 1000);
function reapStaleJobs() {
  const cutoff = Date.now() - STALE_MS;
  let reaped = 0;
  for (const j of loadJobs()) {
    if (j.status !== "running" && j.status !== "queued") continue;
    if ((j.started || j.created || 0) > cutoff) continue;
    j.status = "failed";
    j.exitCode = -1;
    j.finished = Date.now();
    j.error = "stale: no completion recorded within " + Math.round(STALE_MS / 60000) + " min (runner likely restarted mid-job)";
    saveJob(j);
    appendLog(j, "!! reaped as stale: " + j.error);
    reaped++;
  }
  if (reaped) console.log("[task-runner] reaped " + reaped + " stale job(s)");
  return reaped;
}

setInterval(pollSchedule, 30000);
setInterval(reapStaleJobs, 60000);
pollSchedule();
reapStaleJobs();