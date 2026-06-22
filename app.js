/* ============================================================
   AgentGuard — Interactive Dashboard Logic
   Simulates all 5 safety features from the PRD (FP1–FP5)
   ============================================================ */

(() => {
  "use strict";

  // Acquire VS Code API once — calling acquireVsCodeApi() more than once throws
  const vscode = (typeof acquireVsCodeApi === "function") ? acquireVsCodeApi() : null;

  /* ---------- Tiny helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>',
    restore: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.5 2.8"/><path d="M3 4v4h4"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    branch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="9" r="3"/><path d="M6 9v6M18 12a6 6 0 0 1-6 6"/></svg>',
  };

  /* ============================================================
     STATE
     ============================================================ */
  const STORAGE_KEY = "agentguard.state.v1";

  const seed = () => ({
    checkpoints: [
      { id: cpid(), label: "Initial project scaffold", files: 38, branch: "main", at: minsAgo(94), current: false },
      { id: cpid(), label: "Auth flow refactor", files: 41, branch: "main", at: minsAgo(58), current: false },
      { id: cpid(), label: "Before agent: dashboard build", files: 44, branch: "ag/session-12", at: minsAgo(21), current: true },
    ],
    drift: [
      { id: 1, file: "src/components/Toolbar.tsx", note: "Button removed manually · function kept", lines: 12, selected: true },
      { id: 2, file: "src/hooks/useExport.ts", note: "Edited 3 lines · agent unaware", lines: 3, selected: false },
    ],
    diffs: [
      {
        file: "src/components/Toolbar.tsx", add: 6, del: 4, status: "pending",
        old: [
          "export const Toolbar = () => {",
          "  return (",
          "    <div className=\"toolbar\">",
          "      <ExportButton />",
          "    </div>",
          "  );",
          "};",
        ],
        new: [
          "export const Toolbar = () => {",
          "  return (",
          "    <div className=\"toolbar\">",
          "      <ExportButton />",
          "      <ShareButton />",
          "      <SettingsButton />",
          "    </div>",
          "  );",
          "};",
        ],
        oldMark: [3], newMark: [4, 5],
      },
      {
        file: "src/hooks/useExport.ts", add: 3, del: 1, status: "pending",
        old: [
          "export const useExport = () => {",
          "  const run = () => download(data);",
          "  return { run };",
          "};",
        ],
        new: [
          "export const useExport = () => {",
          "  const run = async () => {",
          "    await validate(data);",
          "    return download(data);",
          "  };",
          "  return { run };",
          "};",
        ],
        oldMark: [1], newMark: [1, 2, 3],
      },
      {
        file: "src/api/client.ts", add: 2, del: 0, status: "pending",
        old: [
          "const client = axios.create({",
          "  baseURL: API_URL,",
          "});",
        ],
        new: [
          "const client = axios.create({",
          "  baseURL: API_URL,",
          "  timeout: 10000,",
          "  retries: 3,",
          "});",
        ],
        oldMark: [], newMark: [2, 3],
      },
    ],
    audit: [
      { key: "node", label: "node_modules integrity", desc: "Installed packages match lockfile", result: "pass" },
      { key: "lock", label: "package-lock.json drift", desc: "No uncommitted dependency changes", result: "warn", warnMsg: "1 package out of sync (react-dom)" },
      { key: "env", label: ".env variables present", desc: "All required env keys resolved", result: "pass" },
      { key: "vuln", label: "Vulnerability scan", desc: "npm audit · known CVEs", result: "fail", failMsg: "2 high-severity issues found" },
      { key: "build", label: "TypeScript compile probe", desc: "tsc --noEmit dry run", result: "pass" },
      { key: "port", label: "Dev port availability", desc: "Port 5173 is free", result: "pass" },
    ],
    // rules are now { id: number, content: string } objects synced from TrueMemory
    rules: [
      { id: -1, content: "Always use arrow functions, never function declarations" },
      { id: -2, content: "TailwindCSS styles must be responsive (mobile-first)" },
      { id: -3, content: "Strict type annotations in TypeScript — no implicit any" },
    ],
    activity: [
      { dot: "g", txt: "<b>Checkpoint saved</b> — dashboard build", t: "21m" },
      { dot: "a", txt: "<b>Manual edit detected</b> in Toolbar.tsx", t: "18m" },
      { dot: "v", txt: "<b>3 diffs staged</b> for review", t: "12m" },
      { dot: "c", txt: "<b>Memory synced</b> — 3 rules loaded", t: "9m" },
    ],
  });

  function cpid() { return "cp_" + Math.random().toString(36).slice(2, 8); }
  function minsAgo(m) { return Date.now() - m * 60000; }
  function fmtAgo(ts) {
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + "m ago";
    const h = Math.floor(m / 60);
    return h + "h " + (m % 60) + "m ago";
  }

  // Always start from seed — never restore stale fake data from localStorage.
  // Real data is pushed by the backend via sync-state messages after load.
  let state = seed();
  function load() {
    return seed();
  }
  function save() {
    // No-op: we no longer persist to localStorage to avoid stale seed data
    // overriding real backend state on next load.
  }

  let activeDiff = 0;

  /* ============================================================
     TOAST + MODAL
     ============================================================ */
  function toast(title, sub, type = "success") {
    const stack = $("#toastStack");
    const ico = { success: ICON.check, info: ICON.info, warn: ICON.warn, error: ICON.x }[type] || ICON.info;
    const t = el("div", `toast toast--${type}`,
      `<div class="toast__ico">${ico}</div>
       <div class="toast__body"><strong>${title}</strong>${sub ? `<small>${sub}</small>` : ""}</div>
       <span class="toast__bar"></span>`);
    stack.appendChild(t);
    setTimeout(() => {
      t.classList.add("out");
      t.addEventListener("animationend", () => t.remove(), { once: true });
    }, 3200);
  }

  let modalResolver = null;
  function confirmModal({ title, body, confirm = "Confirm", danger = true, icon = ICON.warn }) {
    const overlay = $("#modalOverlay");
    $("#modalTitle").textContent = title;
    $("#modalBody").textContent = body;
    $("#modalConfirm").textContent = confirm;
    $("#modalIcon").innerHTML = icon;
    $("#modalIcon").style.background = danger ? "rgba(251,113,133,.15)" : "rgba(139,92,246,.18)";
    $("#modalIcon").style.color = danger ? "var(--red)" : "var(--violet-2)";
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    return new Promise((res) => { modalResolver = res; });
  }
  function closeModal(result) {
    const overlay = $("#modalOverlay");
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    if (modalResolver) { modalResolver(result); modalResolver = null; }
  }
  $("#modalConfirm").addEventListener("click", () => closeModal(true));
  $("#modalCancel").addEventListener("click", () => closeModal(false));
  $("#modalOverlay").addEventListener("click", (e) => { if (e.target.id === "modalOverlay") closeModal(false); });

  /* ============================================================
     NAVIGATION
     ============================================================ */
  const VIEW_META = {
    overview:    { title: "Mission Control", sub: "Real-time safety telemetry for your AI coding agent." },
    checkpoints: { title: "Checkpoints", sub: "Snapshot timeline and one-click rollback — FP1." },
    sync:        { title: "Memory Sync", sub: "Detect manual edits and re-align the agent — FP2." },
    diff:        { title: "Diff Review", sub: "Approve or reject every change before it hits disk — FP3." },
    health:      { title: "Health Check", sub: "Pre-flight environment audit — FP4." },
    memory:      { title: "Parcel Memory", sub: "Persistent rules across all sessions — FP5." },
  };

  function go(view) {
    $$(".nav__item").forEach((b) => b.classList.toggle("is-active", b.dataset.view === view));
    $$(".view").forEach((v) => v.classList.toggle("is-active", v.dataset.view === view));
    const m = VIEW_META[view];
    $("#viewTitle").textContent = m.title;
    $("#viewSubtitle").textContent = m.sub;
  }
  $$(".nav__item").forEach((b) => b.addEventListener("click", () => go(b.dataset.view)));

  /* ============================================================
     OVERVIEW renderers
     ============================================================ */
  const COVERAGE = [
    { fp: "FP1", title: "No Rollback UI", fix: "Checkpoint timeline + instant restore" },
    { fp: "FP2", title: "Memory Desync", fix: "Manual-edit watcher + sync prompts" },
    { fp: "FP3", title: "Forced Commits", fix: "Per-file accept / reject staging" },
    { fp: "FP4", title: "Blind Workspace Trust", fix: "Pre-flight environment health audit" },
    { fp: "FP5", title: "No Long-term Memory", fix: "Persistent parcel-memory.json rules" },
  ];

  function renderCoverage() {
    const ul = $("#coverageList");
    ul.innerHTML = "";
    COVERAGE.forEach((c) => {
      ul.appendChild(el("li", "",
        `<span class="coverage__ico">${ICON.check}</span>
         <div class="coverage__txt"><strong>${c.title}</strong><small>${c.fix}</small></div>
         <span class="coverage__fp">${c.fp}</span>`));
    });
  }

  function renderActivity() {
    const ul = $("#activityFeed");
    ul.innerHTML = "";
    state.activity.forEach((a, i) => {
      const li = el("li", "",
        `<span class="activity__dot activity__dot--${a.dot}"></span>
         <span class="activity__txt">${a.txt}</span>
         <span class="activity__time">${a.t}</span>`);
      li.style.animationDelay = i * 60 + "ms";
      ul.appendChild(li);
    });
  }

  function pushActivity(txt, dot = "v") {
    state.activity.unshift({ dot, txt, t: "now" });
    state.activity = state.activity.slice(0, 8);
    renderActivity();
    save();
  }

  function renderStats() {
    $("#statSnapshots").textContent = state.checkpoints.length;
    const pending = state.diffs.filter((d) => d.status === "pending").length;
    $("#statDiffs").textContent = pending;
    $("#statRules").textContent = state.rules.length;
  }

  /* ============================================================
     FP1 — CHECKPOINTS / ROLLBACK
     ============================================================ */
  function renderTimeline() {
    const ol = $("#timeline");
    ol.innerHTML = "";
    [...state.checkpoints].reverse().forEach((cp, i) => {
      const li = el("li", "tl-item" + (cp.current ? " tl-item--current" : ""));
      li.style.animationDelay = i * 70 + "ms";
      li.innerHTML = `
        <div class="tl-item__node"><span></span></div>
        <div class="tl-item__body">
          <div class="tl-item__info">
            <h4>${cp.label} ${cp.current ? '<span class="tag-now">current</span>' : ""}</h4>
            <div class="tl-meta">
              <span>${ICON.clock} ${fmtAgo(cp.at)}</span>
              <span>${ICON.branch} ${cp.branch}</span>
              <span>${ICON.file} ${cp.files} files</span>
            </div>
          </div>
          ${cp.current
            ? `<button class="btn btn--small" disabled style="opacity:.5;cursor:default">You are here</button>`
            : `<button class="btn btn--small btn--ghost" data-restore="${cp.id}">${ICON.restore}<span>Restore</span></button>`}
        </div>`;
      ol.appendChild(li);
    });
    $$("[data-restore]").forEach((b) => b.addEventListener("click", () => restoreCheckpoint(b.dataset.restore)));
  }

  function getLatestHash() {
    const cp = state.checkpoints[0];
    return cp ? cp.commitHash : "HEAD";
  }

  function addCheckpoint() {
    if (vscode) {
      vscode.postMessage({ command: "save-checkpoint" });
    }
  }

  async function restoreCheckpoint(id) {
    const cp = state.checkpoints.find((c) => c.id === id);
    if (!cp) return;
    const ok = await confirmModal({
      title: "Restore this checkpoint?",
      body: `Workspace will hard-reset to "${cp.label}" (${fmtAgo(cp.at)}). All changes after this point are discarded.`,
      confirm: "Restore now",
      icon: ICON.restore,
    });
    if (!ok) return;

    if (vscode) {
      vscode.postMessage({ command: "restore-checkpoint", hash: cp.commitHash, label: cp.label });
    }
  }

  $("#checkpointBtn").addEventListener("click", addCheckpoint);
  $("#checkpointBtn2").addEventListener("click", addCheckpoint);

  /* ============================================================
     FP2 — MEMORY SYNC
     ============================================================ */
  function renderDrift() {
    const ul = $("#driftList");
    ul.innerHTML = "";
    $("#desyncCount").textContent = state.drift.length + " drifted";
    state.drift.forEach((d, i) => {
      const li = el("li", "drift-item" + (d.selected ? " is-selected" : ""));
      li.style.animationDelay = i * 60 + "ms";
      li.innerHTML = `
        <span class="drift-item__ico">${ICON.warn}</span>
        <div class="drift-item__info"><strong>${d.file}</strong><small>${d.note}</small></div>
        <span class="drift-item__badge">~${d.lines} lines</span>`;
      li.addEventListener("click", () => { state.drift.forEach((x) => (x.selected = false)); d.selected = true; renderDrift(); renderSyncPrompt(); });
      ul.appendChild(li);
    });
  }

  function renderSyncPrompt() {
    const d = state.drift.find((x) => x.selected) || state.drift[0];
    const box = $("#syncPrompt").querySelector("code");
    if (!d) { box.textContent = "No desynced files. Agent context is in sync."; return; }
    box.textContent =
`[AGENTGUARD · CONTEXT SYNC]

The file below was edited MANUALLY after your last turn.
Your cached version is STALE. Do NOT re-introduce removed code.

File: ${d.file}
Change: ${d.note}

ACTION REQUIRED:
1. Discard your cached copy of ${d.file}.
2. Re-read the current on-disk version before editing.
3. Preserve the manual edit; only change what I explicitly request.

Acknowledge with "context refreshed" before writing code.`;
  }

  $("#copySyncBtn").addEventListener("click", async () => {
    if (vscode) {
      vscode.postMessage({ command: "execCommand", cmd: "agentguard.copySyncPrompt" });
    } else {
      const text = $("#syncPrompt").querySelector("code").textContent;
      try {
        await navigator.clipboard.writeText(text);
        toast("Sync prompt copied", "Paste it into your agent chat", "success");
      } catch (e) {
        const ta = el("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); ta.remove();
        toast("Sync prompt copied", "Paste it into your agent chat", "success");
      }
    }
  });

  $("#simEditBtn").addEventListener("click", () => {
    if (vscode) {
      vscode.postMessage({ command: "refresh" });
      toast("Syncing status", "Reading manual edits from workspace...", "info");
    } else {
      const pool = [
        { file: "src/pages/Settings.tsx", note: "Removed deprecated prop · agent unaware", lines: 5 },
        { file: "src/utils/format.ts", note: "Renamed helper manually", lines: 2 },
        { file: "src/store/session.ts", note: "Edited reducer · 7 lines", lines: 7 },
      ];
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (state.drift.some((d) => d.file === pick.file)) { toast("Already tracked", pick.file + " is in the drift list", "info"); return; }
      state.drift.forEach((d) => (d.selected = false));
      state.drift.unshift({ id: Date.now(), ...pick, selected: true });
      save();
      renderDrift();
      renderSyncPrompt();
      pushActivity("<b>Manual edit detected</b> in " + pick.file, "a");
      toast("Manual edit detected", pick.file + " drifted from agent memory", "warn");
    }
  });

  /* ============================================================
     FP3 — DIFF REVIEW
     ============================================================ */
  function renderFileList() {
    const ul = $("#fileList");
    ul.innerHTML = "";
    const pending = state.diffs.filter((d) => d.status === "pending").length;
    $("#pendingCount").textContent = pending;
    state.diffs.forEach((d, i) => {
      const li = el("li", "file-item" + (i === activeDiff ? " is-active" : "") + (d.status !== "pending" ? " is-done" : ""));
      li.style.animationDelay = i * 50 + "ms";
      li.innerHTML = `
        <span class="file-item__stat file-item__stat--${d.status}"></span>
        <span class="file-item__name">${d.file}</span>
        <span class="file-item__diff"><span class="add">+${d.add}</span> <span class="del">-${d.del}</span></span>`;
      li.addEventListener("click", () => {
        activeDiff = i;
        renderFileList();
        renderDiffView();
        if (vscode) {
          vscode.postMessage({ command: "open-diff", file: d.file, hash: getLatestHash() });
        }
      });
      ul.appendChild(li);
    });
  }

  function codeBlock(lines, marks, type) {
    return lines.map((ln, i) =>
      `<span class="code-line${marks.includes(i) ? " " + type : ""}"><span class="ln">${i + 1}</span>${escapeHtml(ln)}</span>`
    ).join("");
  }
  function escapeHtml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function renderDiffView() {
    const d = state.diffs[activeDiff];
    const acceptBtn = $("#acceptOneBtn"), rejectBtn = $("#rejectOneBtn");
    if (!d) {
      $("#diffFilePath").textContent = "—";
      $("#diffOld").innerHTML = `<div class="diff-empty">${ICON.check}<br>All changes reviewed</div>`;
      $("#diffNew").innerHTML = "";
      acceptBtn.disabled = rejectBtn.disabled = true;
      acceptBtn.style.opacity = rejectBtn.style.opacity = ".4";
      return;
    }
    $("#diffFilePath").textContent = d.file;
    $("#diffOld").querySelector("code").innerHTML = codeBlock(d.old, d.oldMark, "del");
    $("#diffNew").querySelector("code").innerHTML = codeBlock(d.new, d.newMark, "add");
    const reviewed = d.status !== "pending";
    acceptBtn.disabled = rejectBtn.disabled = reviewed;
    acceptBtn.style.opacity = rejectBtn.style.opacity = reviewed ? ".4" : "1";
  }

  function decide(idx, status) {
    const d = state.diffs[idx];
    if (!d || d.status !== "pending") return;

    if (vscode) {
      if (status === "accepted") {
        vscode.postMessage({ command: "accept-file", file: d.file });
      } else {
        vscode.postMessage({ command: "reject-file", file: d.file, hash: getLatestHash() });
      }
    }
  }

  $("#acceptOneBtn").addEventListener("click", () => decide(activeDiff, "accepted"));
  $("#rejectOneBtn").addEventListener("click", () => decide(activeDiff, "rejected"));
  $("#acceptAllBtn").addEventListener("click", () => {
    const n = state.diffs.filter((d) => d.status === "pending").length;
    if (!n) { toast("Nothing pending", "All diffs already reviewed", "info"); return; }
    if (vscode) {
      vscode.postMessage({ command: "accept-all" });
    }
  });
  $("#rejectAllBtn").addEventListener("click", async () => {
    const n = state.diffs.filter((d) => d.status === "pending").length;
    if (!n) { toast("Nothing pending", "All diffs already reviewed", "info"); return; }
    const ok = await confirmModal({ title: "Reject all pending changes?", body: `${n} agent edits will be discarded and reverted to the checkpoint.`, confirm: "Reject all" });
    if (!ok) return;
    if (vscode) {
      vscode.postMessage({ command: "reject-all", hash: getLatestHash() });
    }
  });

  /* ============================================================
     FP4 — HEALTH CHECK
     ============================================================ */
  const R = 52, CIRC = 2 * Math.PI * R; // ~327
  function setGauge(pct) {
    const fill = $("#gaugeFill");
    fill.style.strokeDashoffset = CIRC - (CIRC * pct) / 100;
  }

  function renderAuditIdle() {
    const ul = $("#auditList");
    ul.innerHTML = "";
    state.audit.forEach((a) => {
      ul.appendChild(el("li", "audit-item",
        `<span class="audit-item__ico pending" data-key="${a.key}">${ICON.clock}</span>
         <div class="audit-item__info"><strong>${a.label}</strong><small>${a.desc}</small></div>
         <span class="audit-item__status" style="color:var(--text-3)">queued</span>`));
    });
  }

  let healthRunning = false;
  async function runHealth() {
    if (healthRunning) return;
    healthRunning = true;
    $("#runHealthBtn").disabled = true;
    $("#auditMeta").textContent = "scanning…";
    $("#gaugeVerdict").textContent = "Scanning workspace…";
    setGauge(0);
    $("#gaugeNum").textContent = "0";

    const items = $$("#auditList .audit-item");
    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      const ico = $(".audit-item__ico", row);
      const status = $(".audit-item__status", row);
      ico.className = "audit-item__ico checking";
      ico.innerHTML = '<span class="spinner"></span>';
      status.textContent = "checking";
      status.style.color = "var(--indigo)";
    }

    if (vscode) {
      vscode.postMessage({ command: "run-health" });
    } else {
      await wait(1000);
      healthRunning = false;
      $("#runHealthBtn").disabled = false;
    }
  }
  function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
  $("#runHealthBtn").addEventListener("click", runHealth);

  /* ============================================================
     FP5 — PARCEL MEMORY
     ============================================================ */
  function renderRules() {
    const ul = $("#rulesList");
    ul.innerHTML = "";
    $("#rulesCount").textContent = state.rules.length + " rule" + (state.rules.length === 1 ? "" : "s");
    state.rules.forEach((r, i) => {
      // r is now { id, content } — id is the TrueMemory DB row id
      const content = (typeof r === "object" && r.content) ? r.content : String(r);
      const dbId    = (typeof r === "object" && r.id)      ? r.id      : -1;
      const li = el("li", "rule-item");
      li.style.animationDelay = i * 50 + "ms";
      li.innerHTML = `
        <span class="rule-item__num">${i + 1}</span>
        <span class="rule-item__txt">${escapeHtml(content)}</span>
        <button class="rule-item__del" title="Delete rule" data-dbid="${dbId}" data-del="${i}">${ICON.trash}</button>`;
      ul.appendChild(li);
    });
    $$("[data-del]").forEach((b) => b.addEventListener("click", () => {
      const i    = +b.dataset.del;
      const dbId = +b.dataset.dbid;
      const removed = state.rules.splice(i, 1)[0];
      const label = (typeof removed === "object" && removed.content) ? removed.content : String(removed);
      save(); renderRules(); renderMemoryJson(); renderStats();
      toast("Rule removed", label.slice(0, 40) + (label.length > 40 ? "\u2026" : ""), "info");
      // Notify extension to delete from TrueMemory (only if it's a real DB row)
      if (dbId > 0 && vscode) {
        vscode.postMessage({ command: "remove-rule", id: dbId });
      }
    }));
  }

  function renderMemoryJson() {
    const box = $("#memoryJson").querySelector("code");
    const obj = {
      source: "~/.truememory/memories.db",
      rules: state.rules.map((r) => (typeof r === "object" && r.content) ? r.content : r),
      sessionHistory: state.checkpoints.slice(-3).map((c) => ({
        timestamp: new Date(c.at).toISOString(),
        summary: c.label,
      })),
    };
    box.innerHTML = highlightJson(JSON.stringify(obj, null, 2));
  }

  function highlightJson(json) {
    return escapeHtml(json)
      .replace(/&quot;([^&]+)&quot;(\s*:)/g, '<span class="k">&quot;$1&quot;</span>$2')
      .replace(/:\s*&quot;([^&]*)&quot;/g, ': <span class="s">&quot;$1&quot;</span>')
      .replace(/([{}\[\],])/g, '<span class="p">$1</span>');
  }

  $("#ruleForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#ruleInput");
    const val = input.value.trim();
    if (!val) return;
    if (state.rules.some((r) => {
      const c = (typeof r === "object" && r.content) ? r.content : String(r);
      return c.toLowerCase() === val.toLowerCase();
    })) {
      toast("Duplicate rule", "That rule already exists", "warn");
      return;
    }
    // Optimistically add with id=-1 (will be replaced when TrueMemory confirms)
    state.rules.push({ id: -1, content: val });
    input.value = "";
    save(); renderRules(); renderMemoryJson(); renderStats();
    pushActivity("<b>Rule added</b> to TrueMemory", "v");
    toast("Rule saved", "Persisted to ~/.truememory/memories.db", "success");
    // Tell the extension to store this in TrueMemory
    if (vscode) {
      vscode.postMessage({ command: "add-rule", content: val });
    }
  });

  /* ============================================================
     TRUEMEMORY & WORKSPACE STATE BRIDGE
     ============================================================ */
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg) return;

    if (msg.type === "sync-state") {
      const data = msg.data;
      if (data.checkpoints) state.checkpoints = data.checkpoints;
      if (data.diffs) state.diffs = data.diffs;
      // Always replace drift from backend (even if empty array — [] is truthy so check with Array.isArray)
      if (Array.isArray(data.drift)) state.drift = data.drift;
      if (data.rules) state.rules = data.rules;

      if (data.health) {
        const h = data.health;
        state.audit = [
          { key: "node", label: "node_modules integrity", desc: "Installed packages match lockfile", result: h.nodeModulesExist ? "pass" : "fail", failMsg: "node_modules is missing" },
          { key: "lock", label: "package-lock.json drift", desc: "No uncommitted dependency changes", result: h.missingPackages.length === 0 ? "pass" : "fail", failMsg: `Missing packages: ${h.missingPackages.join(', ')}` },
          { key: "env", label: ".env variables present", desc: "All required env keys resolved", result: h.envFileMissing ? "warn" : "pass", warnMsg: ".env file is missing (found .env.example)" },
          { key: "vuln", label: "Vulnerability scan", desc: "npm audit · known CVEs", result: (h.vulnerabilities.critical > 0) ? "fail" : (h.vulnerabilities.high > 0 ? "warn" : "pass"), failMsg: `${h.vulnerabilities.critical} critical, ${h.vulnerabilities.high} high vulnerabilities found` },
          { key: "build", label: "TypeScript compile probe", desc: "tsc --noEmit dry run", result: h.packageJsonExists ? "pass" : "fail", failMsg: "package.json not found" },
          { key: "port", label: "Git initialization", desc: "Git repository initialized", result: h.gitInitialized ? "pass" : "fail", failMsg: "Git repository not initialized" },
        ];

        let score = 0;
        const weight = 100 / state.audit.length;
        state.audit.forEach((a) => {
          if (a.result === "pass") score += weight;
          else if (a.result === "warn") score += weight * 0.5;
        });
        const final = Math.round(score);
        $("#statHealth").textContent = final;
        setGauge(final);
        $("#gaugeNum").textContent = final;
        const chip = $("#healthChip");
        let verdict;
        if (final >= 85) { verdict = "Healthy — safe to run the agent"; chip.textContent = "healthy"; chip.className = "chip chip--green"; }
        else if (final >= 60) { verdict = "Degraded — fix warnings before long sessions"; chip.textContent = "degraded"; chip.className = "chip chip--amber"; }
        else { verdict = "At risk — resolve failures before running"; chip.textContent = "at risk"; chip.className = "chip chip--red"; }
        $("#gaugeVerdict").textContent = verdict;

        healthRunning = false;
        $("#runHealthBtn").disabled = false;
        $("#auditMeta").textContent = "completed " + new Date().toLocaleTimeString();
        pushActivity(`<b>Health check</b> — score ${final}%`, final >= 85 ? "g" : "a");
        toast("Health check complete", verdict, final >= 85 ? "success" : "warn");
      }

      save();
      renderTimeline();
      renderDrift();
      renderSyncPrompt();
      renderFileList();
      renderDiffView();
      renderRules();
      renderMemoryJson();
      renderStats();
    } else if (msg.type === "truememory-directives") {
      if (Array.isArray(msg.data)) {
        state.rules = msg.data.map((d) => ({ id: d.id, content: d.content }));
        save();
        renderRules();
        renderMemoryJson();
        renderStats();
        const badge = $("#statRules");
        if (badge) badge.textContent = state.rules.length;
      }
    }
  });

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    renderCoverage();
    renderActivity();
    renderStats();
    renderTimeline();
    renderDrift();
    renderSyncPrompt();
    renderFileList();
    renderDiffView();
    renderAuditIdle();
    renderRules();
    renderMemoryJson();
    // gauge resting state from saved health
    const h = parseInt($("#statHealth").textContent, 10) || 0;
    setGauge(0);
    $("#gaugeNum").textContent = "0";
    // keyboard: Esc closes modal
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(false); });
    toast("AgentGuard online", "All 5 safety guards active — TrueMemory connected", "success");
  }

  init();
})();
