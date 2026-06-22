# AgentGuard — Product Requirements Document (PRD)

**Status:** Approved  
**Owner:** Paarth Gupta  
**Date:** 2026-06-22  
**Source request:** Produck Quackathon Track 03 (MCP Feedback Reports)  
**Implementing agent:** Enter Pro / Antigravity  

---

## 1. Raw Request

> Build a safety layer (VS Code Extension + Web Dashboard) called **AgentGuard** to solve the 5 core shortcomings found in Enter Pro:
> 1. **No Rollback UI:** No way to undo agent edits or restore a clean state.
> 2. **Memory Desync:** Agent context goes out of sync when files are edited manually.
> 3. **Forced Commits:** Edits are saved directly to disk without preview or approval.
> 4. **Blind Workspace Trust:** Agent runs broken environments without validation.
> 5. **No Long-term Memory:** Agent forgets rules and settings between sessions.

### 1.1 Session Replay & Telemetry Evidence

- **User Session Replay Link:** `https://tryproduck.com/api/mcp`
- **Feedback Tickets Pulled:**
  - `FP1: No Rollback UI` (Status: Confirmed)
  - `FP2: Memory Desync Loop` (Status: Confirmed)
  - `FP3: Forced Commits` (Status: Confirmed)
  - `FP4: Blind Workspace Trust` (Status: Confirmed)
  - `FP5: No Long-term Memory` (Status: Confirmed)

---

## 2. Aligned Understanding

### 2.1 Interpreted Intent
The developer needs a protective guardrail layer that runs alongside browser-based AI coding agents. This tool, **AgentGuard**, must track filesystem state, validate environment health, sync developer preferences, and present a side-by-side diff review UI so the developer can approve AI changes before they contaminate the local workspace.

### 2.2 User / Persona

| Persona | Goal | Pain point | Current workaround |
| --- | --- | --- | --- |
| Developer | Safely collaborate with AI agents without workspace corruption | AI writes bugs, overrides code, and forgets rules | Manual Git resets in bash; retyping rules |

### 2.3 Problem Statement
Autonomous coding agents operate with blind filesystem write privileges and stateless memory. This leads to three classes of errors:
1. **Safety Errors:** Overwriting code without diff review or easy rollbacks.
2. **Cognitive Errors:** Operating on stale file state after developer edits, causing loops.
3. **Environment Errors:** Running code in broken or insecure dependency environments.

### 2.4 Desired Outcome
A local developer dashboard (UI) integrated with Git and a file watcher that acts as the "eyes and ears" of the AI agent, providing a staging area, rollback history, env audits, and persistent memory.

---

## 3. Goals, Non-Goals, and Success Metrics

### 3.1 Goals
- **G1:** One-click rollback of workspace changes to pre-session snapshots.
- **G2:** Automatically detect manual edits and generate context sync prompts.
- **G3:** Provide a side-by-side Accept/Reject diff interface.
- **G4:** Run pre-session health checks (node_modules, packages, vulnerabilities).
- **G5:** Save persistent rules and preferences to a `parcel-memory.json` schema.

### 3.2 Non-Goals
- **NG1:** Replacing Git (we sit on top of Git).
- **NG2:** Blocking file writes at the OS level (we audit after-the-fact via diffs).

### 3.3 Success Metrics
- **Verification Latency:** Health check runs in under 3 seconds.
- **Rollback Accuracy:** 100% byte-for-byte rollback success.
- **Sync Prompts:** Generated in under 1 second after file saves.

---

## 4. Scope

### 4.1 In Scope

| Priority | Requirement | Rationale |
| --- | --- | --- |
| P0 | Git Checkpoint & Restore | Core safety net against agent failures |
| P0 | Sync Prompt Generator | Prevents memory desync loops |
| P0 | Workspace Health Check | Avoids running broken dependencies |
| P0 | Per-File Accept/Reject Review | Native code review staging workflow |
| P1 | Parcel Memory Preference Sync | Maintains long-term rules across sessions |
| P1 | Unified Web Dashboard UI | Beautiful visual timeline and control panel |

### 4.2 Out of Scope
- Auto-injecting text directly into browser text boxes (due to browser sandbox limitations). We use copy-to-clipboard actions instead.

---

## 5. User Stories & Acceptance Criteria

### Story 1: Git Checkpoint & Restore
**As a** developer,  
**I want** to capture a snapshot of my project before the AI starts coding,  
**so that** I can instantly roll back if the AI breaks the build.

**Acceptance criteria:**
- WHEN the user clicks "Save Checkpoint", the system SHALL run `git commit -m "Checkpoint: ..."` silently.
- WHEN the user clicks "Restore", the system SHALL run `git reset --hard` to that checkpoint.

### Story 2: Memory Desync Prevention
**As a** developer,  
**I want** the system to detect when I edit a file manually,  
**so that** I can copy a sync prompt to update the AI's memory.

**Acceptance criteria:**
- WHEN a file is modified manually and saved, the watcher SHALL generate a context prompt.
- The prompt SHALL contain the current code and ask the AI to discard its cached state.

---

## 6. UX / Interaction Requirements

### 6.1 Primary Flow
1. Developer opens the **AgentGuard Web Dashboard**.
2. Runs **🩺 Health Check** to audit packages and env files.
3. Clicks **💾 Save Checkpoint** before starting the AI session.
4. AI modifies files. Dashboard updates to show a diff list.
5. Developer reviews the diffs side-by-side, clicking **Accept** or **Reject** on each file.
6. If the session fails, developer clicks **Restore Snapshot** to reset.

---

## 7. Technical Context for the Agent

### 7.1 Stack
- **Structure:** Single Page Web App (HTML/CSS/JS) simulating the Dashboard.
- **Styling:** Custom premium Dark Mode CSS (Outfit/Inter font, glassmorphism, glowing borders, vibrant gradients).
- **Backend Mocking:** Local storage and session variables simulating active file-watchers and git commands.

### 7.2 Relevant Files
- `index.html` — The main dashboard layout.
- `index.css` — The styling variables and animations.
- `app.js` — State management, diff renderings, and health checks.

### 7.3 Persistent Memory Contract
Persistent styling guidelines and rules are read from and saved to `.agentguard/parcel-memory.json`:
```json
{
  "rules": [
    "Always use arrow functions",
    "TailwindCSS styles must be responsive",
    "Strict type annotations in TypeScript"
  ],
  "sessionHistory": []
}
```

---

## 8. Agent Instructions & Prohibitions

### 8.1 Required Behavior
- Build a fully functional, premium UI mockup.
- Use mock data to demonstrate all 5 features (Timeline restore, Sync prompt copy, Diff reject/accept toggles, Health check audit, Rules settings).
- Include interactive animations (hover scales, fade-in lists, checking spinner).

### 8.2 Do Not Do
- Do not use plain alert boxes; build custom modal notifications inside the UI.
- Do not use TailwindCSS; use pure vanilla CSS with variables.

---

## 9. Implementation Phases

### Phase 1: Dashboard UI Scaffold (P0)
- Create `index.html` with sidebar, main panels, and timeline.
- Apply premium dark theme styling in `index.css`.

### Phase 2: Health Check & Memory Panel (P0)
- Add interactive "Run Health Check" audit simulation.
- Build the "Parcel Memory" rules list editor.

### Phase 3: Checkpoint & Diff Viewer (P0)
- Implement interactive checkpoint list (snapshots).
- Create a mock side-by-side file diff review editor with Accept/Reject buttons.

---

## 10. Testing & Evaluation Plan

### 10.1 Manual QA
- [ ] Verify that clicking "Reject" reverts the file state in the mock editor.
- [ ] Verify that clicking "Copy Sync Prompt" copies the correct text to the clipboard.
- [ ] Verify the responsive layout on desktop and mobile viewports.
