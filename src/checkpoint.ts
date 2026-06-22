import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logSession } from './memory';

export interface Checkpoint {
  id: string;
  label: string;
  timestamp: string;
  commitHash: string;
  filesChanged: number;
}

function getWorkspaceRoot(): string | null {
  const folders = vscode.workspace.workspaceFolders;
  return folders ? folders[0].uri.fsPath : null;
}

function runCommand(cmd: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cp.exec(cmd, { cwd }, (err, stdout, stderr) => {
      if (err) reject(stderr || err.message);
      else resolve(stdout.trim());
    });
  });
}

function getCheckpointStorePath(root: string): string {
  return path.join(root, '.agentguard', 'checkpoints.json');
}

export function loadCheckpoints(root: string): Checkpoint[] {
  const storePath = getCheckpointStorePath(root);
  if (!fs.existsSync(storePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(storePath, 'utf8'));
  } catch {
    return [];
  }
}

function saveCheckpoints(root: string, checkpoints: Checkpoint[]) {
  const storePath = getCheckpointStorePath(root);
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(checkpoints, null, 2));
}

export async function createCheckpoint(label?: string): Promise<Checkpoint | null> {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage('AgentGuard: No workspace folder open.');
    return null;
  }

  // Check if git repo exists
  try {
    await runCommand('git rev-parse --is-inside-work-tree', root);
  } catch {
    vscode.window.showErrorMessage('AgentGuard: Not a Git repository. Run "git init" first.');
    return null;
  }

  const checkpointLabel = label || `Checkpoint ${new Date().toLocaleTimeString()}`;
  
  try {
    await runCommand('git add -A', root);
    const commitMsg = `AgentGuard: ${checkpointLabel}`;
    await runCommand(`git commit -m "${commitMsg}" --allow-empty`, root);
    const hash = await runCommand('git rev-parse HEAD', root);
    
    // Count changed files
    let filesChanged = 0;
    const allChangedFiles: string[] = [];
    try {
      const diffOut = await runCommand('git diff HEAD~1 --name-only', root);
      const lines = diffOut.split('\n').filter(Boolean);
      filesChanged = lines.length;
      allChangedFiles.push(...lines);
    } catch { filesChanged = 0; }

    const checkpoint: Checkpoint = {
      id: Date.now().toString(),
      label: checkpointLabel,
      timestamp: new Date().toISOString(),
      commitHash: hash,
      filesChanged
    };

    const checkpoints = loadCheckpoints(root);
    checkpoints.unshift(checkpoint); // newest first
    saveCheckpoints(root, checkpoints);

    // Also log this to the persistent memory database log!
    await logSession(`Created Checkpoint: "${checkpointLabel}"`, allChangedFiles);

    vscode.window.showInformationMessage(`✅ AgentGuard: Checkpoint saved — "${checkpointLabel}"`);
    return checkpoint;
  } catch (err) {
    vscode.window.showErrorMessage(`AgentGuard: Failed to save checkpoint — ${err}`);
    return null;
  }
}

export async function restoreCheckpoint(commitHash: string, label: string): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;

  const confirm = await vscode.window.showWarningMessage(
    `Restore to "${label}"? All changes after this checkpoint will be lost.`,
    { modal: true },
    'Yes, Restore'
  );
  if (confirm !== 'Yes, Restore') return;

  try {
    // Reset files in workspace
    await runCommand(`git reset --hard ${commitHash}`, root);
    
    // Log the restore event to the persistent database log
    await logSession(`Restored workspace to checkpoint: "${label}"`, []);

    vscode.window.showInformationMessage(`🔙 AgentGuard: Restored to "${label}"`);
  } catch (err) {
    vscode.window.showErrorMessage(`AgentGuard: Restore failed — ${err}`);
  }
}

export function getAllCheckpoints(): Checkpoint[] {
  const root = getWorkspaceRoot();
  if (!root) return [];
  return loadCheckpoints(root);
}
