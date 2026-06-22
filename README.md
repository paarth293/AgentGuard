# 🛡️ AgentGuard — AI Coding Safety Layer

> **Quackathon Track 03 Submission** — Built in 48 hours using the Produck feedback loop on Enter Pro.

AgentGuard is a **VS Code extension** that gives developers visibility, control, and memory over AI coding agent sessions. It was designed and built based on **5 real friction points** captured via the Produck Chrome extension while using Enter Pro.

---

## 🎥 Demo Video
**[Watch the 2-minute Walkthrough on Google Drive](https://drive.google.com/file/d/1eDtXt9HHi5ztSz9OJiIKtuH4yFRrCKzC/view?usp=sharing)**

---

## 🦆 The Produck Loop

| Step | What we did |
|------|-------------|
| **Listen** | Used Enter Pro at `enter.converge.ai` and captured 5 friction points via the Produck Chrome extension |
| **Diagnose** | Connected to Produck MCP (`tryproduck.com/api/mcp`), called `search_feedback` to pull all 5 tickets with session context |
| **Decide** | Used the `user-alignment` skill from [tryproduck/produck-skills](https://github.com/paarth293/produck-skills) to generate a structured PRD |
| **Ship** | Built this VS Code extension implementing all 5 PRD features |

---

## 🔗 Related Submission Files

- 📋 [PRD.md](https://github.com/paarth293/produck-skills/blob/pr2/enter-pro-mockup/submissions/enter-pro/PRD.md)
- 🦆 [FEEDBACK.md](https://github.com/paarth293/produck-skills/blob/pr2/enter-pro-mockup/submissions/enter-pro/FEEDBACK.md)
- 🖥️ [High-Fidelity Mockup](https://github.com/paarth293/produck-skills/blob/pr2/enter-pro-mockup/submissions/enter-pro/mockup/index.html)
- 📦 [produck-skills fork (PR2)](https://github.com/paarth293/produck-skills/pull/11)

---

## 🛡️ Features — 5 Safety Fixes for Enter Pro

| Feature | Fixes | Produck ID |
|---------|-------|------------|
| **Checkpoint & Rollback** | No recovery path after bad agent edits | `8c2df628` |
| **Memory Sync** | Agent re-introduces manually deleted code | `b7a6931b` |
| **Diff Review** (per-file accept/reject) | Agent blindly commits everything | `adc70843` |
| **Workspace Health Check** | Agent codes on broken environments | `4ac21a1b` |
| **Parcel Memory** (TrueMemory SQLite) | Agent forgets rules every session | `e6489944` |

---

## 🚀 How to Run

### Prerequisites
- VS Code
- Node.js 18+
- Python 3.9+ with `truememory` installed
- Git initialized in your workspace

### Setup
```bash
# 1. Clone this repo
git clone https://github.com/paarth293/agentguard.git
cd agentguard

# 2. Install dependencies
npm install

# 3. Install Python memory bridge dependencies
pip install truememory

# 4. Open in VS Code and press F5
# This launches the Extension Development Host
```

### Using AgentGuard
Once F5 is pressed, a new VS Code window opens (Extension Development Host). In that window:
1. Open any git repository folder
2. Click the **AgentGuard shield icon** in the sidebar
3. The full dashboard opens with 5 tabs

---

## 🏗️ Architecture

```
AgentGuard VS Code Extension
├── src/
│   ├── extension.ts          # Entry point, command registration
│   ├── checkpoint.ts         # Git-backed snapshot system
│   ├── healthCheck.ts        # Workspace environment auditor
│   ├── diffReview.ts         # Per-file accept/reject panel
│   ├── memory.ts             # Async bridge to TrueMemory DB
│   ├── memory_bridge.py      # Python CLI bridge to SQLite
│   └── dashboard/
│       └── DashboardPanel.ts # Webview panel controller
├── index.html                # Dashboard UI (5 tabs)
├── index.css                 # Dashboard styles
├── app.js                    # Dashboard frontend logic
└── package.json
```

**Tech stack:**
- TypeScript (VS Code Extension API)
- Python (TrueMemory SQLite bridge)
- Vanilla HTML/CSS/JS (Dashboard webview)
- SQLite via TrueMemory (`~/.truememory/memories.db`)
- Git (checkpoint and diff operations)

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| [`src/extension.ts`](src/extension.ts) | Extension activation, command palette registration |
| [`src/checkpoint.ts`](src/checkpoint.ts) | Save/restore git-backed workspace snapshots |
| [`src/healthCheck.ts`](src/healthCheck.ts) | Pre-flight workspace health audit |
| [`src/memory.ts`](src/memory.ts) | Async TrueMemory DB interface |
| [`src/memory_bridge.py`](src/memory_bridge.py) | Python bridge for SQLite operations |
| [`app.js`](app.js) | Dashboard webview UI logic |
| [`index.html`](index.html) | Dashboard HTML structure |

---

## 🏆 Hackathon Context

Built for **Quackathon Track 03: Product — I can do it better**

- **Product tested:** Enter Pro (https://enter.converge.ai) — Quackathon sponsor
- **Feedback tool:** Produck Chrome extension + Produck MCP
- **Skill used:** `user-alignment` from `tryproduck/produck-skills`
- **PRs submitted:** [View on GitHub](https://github.com/paarth293/produck-skills)
