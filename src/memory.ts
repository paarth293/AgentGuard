/**
 * AgentGuard Memory Module — TrueMemory Integration
 * ===================================================
 * Bridges the AgentGuard VS Code extension to the real TrueMemory local
 * SQLite database (~/.truememory/memories.db) via a Python subprocess.
 *
 * All functions are async because they spawn a Python child process.
 * The bridge script (src/memory_bridge.py) uses the `truememory` library.
 *
 * When the TrueMemory MCP server is running, any memories stored here
 * will be automatically injected into your AI agent sessions.
 */

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Types mirroring TrueMemory DB rows
// ─────────────────────────────────────────────────────────────────────────────

export interface Directive {
  id: number;
  content: string;
  timestamp: string;
}

export interface SessionMemory {
  id: number;
  content: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface RecallResult {
  directives: Directive[];
  sessions: SessionMemory[];
  search_results: Array<{ id: number; content: string; score: number }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: bridge runner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Absolute path to memory_bridge.py (lives in src/, sibling of this file).
 * At runtime __dirname is out/, so we go up one level to reach src/.
 */
function bridgePath(): string {
  return path.join(__dirname, '..', 'src', 'memory_bridge.py');
}

/**
 * Run memory_bridge.py with the given arguments and return the parsed JSON
 * output.  Rejects on non-zero exit OR if the bridge returns { error: ... }.
 *
 * @param args   CLI arguments after the script name (e.g. ['add-directive', 'text'])
 * @param timeoutMs  Maximum wait time (default 90 s to allow model download on first call)
 */
function runBridge(args: string[], timeoutMs = 90_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // Shell-quote each argument to handle spaces / special chars
    const quotedArgs = args.map(a => `"${a.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
    const cmd = `python "${bridgePath()}" ${quotedArgs.join(' ')}`;

    cp.exec(cmd, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      const raw = (stdout || '').trim();

      // Always try to parse stdout first — bridge writes JSON even on errors
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && 'error' in parsed) {
            reject(new Error(parsed.error as string));
          } else {
            resolve(parsed);
          }
          return;
        } catch {
          // stdout not valid JSON — fall through to error handling
        }
      }

      if (err) {
        reject(new Error(stderr || err.message));
      } else {
        reject(new Error(`Bridge returned unexpected output: ${raw || stderr}`));
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pre-warm the TrueMemory embedding model.
 * Call once on extension activate (fire-and-forget — never throws).
 * Prevents a 20-second delay on the first real memory operation.
 */
export async function warmupModel(): Promise<void> {
  try {
    await runBridge(['warmup'], 120_000);
    console.log('AgentGuard: TrueMemory model ready');
  } catch (e) {
    // Non-fatal — model will warm on first use instead
    console.warn('AgentGuard: Memory warmup skipped —', e);
  }
}

/**
 * Add a persistent coding rule / directive to the TrueMemory database.
 * Directives are always injected at the start of every AI session.
 */
export async function addRule(rule: string): Promise<void> {
  try {
    await runBridge(['add-directive', rule]);
  } catch (err) {
    vscode.window.showErrorMessage(`AgentGuard Memory: Could not save rule — ${err}`);
  }
}

/**
 * Delete a directive from TrueMemory by its database row ID.
 * @param memoryId  The integer `id` field from TrueMemory (not an array index)
 */
export async function removeRule(memoryId: number): Promise<void> {
  try {
    await runBridge(['delete-memory', String(memoryId)]);
  } catch (err) {
    vscode.window.showErrorMessage(`AgentGuard Memory: Could not remove rule — ${err}`);
  }
}

/**
 * Log a coding session (checkpoint / AI session summary) to TrueMemory.
 * Non-fatal — errors are logged to console but do not interrupt the workflow.
 */
export async function logSession(summary: string, filesChanged: string[]): Promise<void> {
  try {
    const content = filesChanged.length > 0
      ? `${summary} — Files: ${filesChanged.join(', ')}`
      : summary;
    const metadata = JSON.stringify({ filesChanged, source: 'agentguard-checkpoint' });
    await runBridge(['add-memory', content, metadata]);
  } catch (e) {
    console.error('AgentGuard Memory: Failed to log session:', e);
  }
}

/**
 * Retrieve all active directives from TrueMemory.
 * Returns an empty array if the bridge fails (safe degradation).
 */
export async function getDirectives(): Promise<Directive[]> {
  try {
    const data = await runBridge(['get-directives']);
    return Array.isArray(data) ? (data as Directive[]) : [];
  } catch {
    return [];
  }
}

/**
 * Retrieve database statistics from TrueMemory.
 */
export async function getStats(): Promise<unknown> {
  try {
    return await runBridge(['get-stats']);
  } catch {
    return null;
  }
}

/**
 * Build a full recall prompt for pasting into Enter Pro.
 * Pulls directives + recent sessions + semantic search from TrueMemory.
 */
export async function generateRecallPrompt(): Promise<string> {
  try {
    const data = await runBridge(
      ['recall', 'coding preferences guidelines recent session history']
    ) as RecallResult;

    let prompt = `🧠 PERSISTENT WORKSPACE MEMORY (AgentGuard × TrueMemory)\n`;
    prompt += `Database: ~/.truememory/memories.db\n\n`;

    if (data.directives && data.directives.length > 0) {
      prompt += `── Coding Directives (always follow) ──\n`;
      data.directives.forEach((d, i) => {
        prompt += `${i + 1}. ${d.content}\n`;
      });
    } else {
      prompt += `── No directives saved yet. Add rules in the AgentGuard dashboard. ──\n`;
    }

    if (data.sessions && data.sessions.length > 0) {
      prompt += `\n── Recent Session History ──\n`;
      data.sessions.slice(0, 3).forEach(s => {
        const ts = new Date(s.timestamp).toLocaleString();
        prompt += `• [${ts}] ${s.content}\n`;
      });
    }

    prompt += `\nAcknowledge this memory context before writing any code.`;
    return prompt;
  } catch (e) {
    return `🧠 AgentGuard Memory: Could not retrieve TrueMemory context (${e}).\nProceeding without persistent memory.`;
  }
}
