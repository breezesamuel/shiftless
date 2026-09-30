#!/usr/bin/env node
"use strict";
/**
 * mcp-probe.js — 通过 stdio 直接驱动任意 MCP server，绕过 GUI 通道
 *
 * 用法:
 *   node mcp-probe.js                       列出可用工具（tools/list）
 *   node mcp-probe.js <toolName> '<json>'   调用工具并打印结果
 *
 * 例:
 *   node mcp-probe.js search_startups '{"query":"chinese saas","limit":5}'
 */
const { spawn } = require("child_process");

const SERVER = process.env.MCP_SERVER || "mcp-lootdrop";
const PROTOCOL = "2024-11-05";

function rpc(proc, msg) {
  proc.stdin.write(JSON.stringify(msg) + "\n");
}

function readResponses(proc, wanted, onResult) {
  let buf = "";
  proc.stdout.on("data", (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch (e) { continue; }
      if (msg.id && wanted.has(msg.id)) onResult(msg.id, msg);
    }
  });
}

function main() {
  const proc = spawn(SERVER, [], { stdio: ["pipe", "pipe", "pipe"], shell: process.platform === "win32" });
  const wanted = new Set([1, 2, 3]);
  const toolName = process.argv[2];
  let toolArgs = {};
  const raw = process.argv[3];
  if (raw) {
    if (raw.trim().startsWith("{")) {
      toolArgs = JSON.parse(raw);
    } else {
      for (const pair of raw.split("&")) {
        if (!pair) continue;
        const i = pair.indexOf("=");
        if (i < 0) continue;
        const k = pair.slice(0, i);
        let v = pair.slice(i + 1);
        if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
        else if (v === "true" || v === "false") v = v === "true";
        toolArgs[k] = v;
      }
    }
  }

  let stderrBuf = "";
  proc.stderr.on("data", (d) => { stderrBuf += d.toString(); });

  readResponses(proc, wanted, (id, msg) => {
    if (id === 1) {
      rpc(proc, { jsonrpc: "2.0", method: "notifications/initialized" });
      if (toolName && toolName !== "--list") {
        rpc(proc, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: toolName, arguments: toolArgs } });
      } else {
        rpc(proc, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
      }
      return;
    }
    if (id === 2) {
      const tools = (msg.result && msg.result.tools) || [];
      console.log(`可用工具 ${tools.length} 个:\n`);
      for (const t of tools) {
        console.log(`── ${t.name}`);
        console.log(`   ${(t.description || "").slice(0, 300)}`);
        const props = (t.inputSchema && t.inputSchema.properties) || {};
        const req = (t.inputSchema && t.inputSchema.required) || [];
        if (Object.keys(props).length) {
          console.log(`   参数: ${Object.keys(props).map((k) => k + (req.includes(k) ? "*" : "")).join(", ")}`);
        }
        console.log(``);
      }
      proc.kill();
      process.exit(0);
    }
    if (id === 3) {
      if (msg.error) {
        console.error("调用失败:", JSON.stringify(msg.error));
        if (stderrBuf.trim()) console.error("stderr:", stderrBuf.trim().slice(0, 800));
        proc.kill();
        process.exit(1);
      }
      const content = (msg.result && msg.result.content) || [];
      for (const c of content) {
        if (c.type === "text") console.log(c.text);
        else console.log(JSON.stringify(c));
      }
      proc.kill();
      process.exit(0);
    }
  });

  proc.on("error", (e) => {
    console.error("无法启动 MCP server:", e.message);
    process.exit(1);
  });

  rpc(proc, {
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: {
      protocolVersion: PROTOCOL,
      capabilities: {},
      clientInfo: { name: "mcp-probe", version: "1.0.0" },
    },
  });

  setTimeout(() => {
    console.error("超时。stderr:", stderrBuf.trim().slice(0, 500) || "(空)");
    proc.kill();
    process.exit(1);
  }, 60000);
}

main();
