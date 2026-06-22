import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

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

export interface FileChange {
  filename: string;
  status: 'modified' | 'added' | 'deleted';
}

export async function getChangedFiles(checkpointHash: string): Promise<FileChange[]> {
  const root = getWorkspaceRoot();
  if (!root) return [];

  try {
    const output = await runCommand(
      `git diff --name-status ${checkpointHash}`,
      root
    );
    return output.split('\n').filter(Boolean).map(line => {
      const parts = line.split('\t');
      const statusCode = parts[0];
      const filename = parts[1];
      const status = statusCode === 'A' ? 'added' : statusCode === 'D' ? 'deleted' : 'modified';
      return { filename, status };
    });
  } catch {
    return [];
  }
}

export async function openDiffForFile(filename: string, checkpointHash: string): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;

  let oldContent = '';
  try {
    oldContent = await runCommand(`git show ${checkpointHash}:${filename}`, root);
  } catch {
    oldContent = ''; 
  }

  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `agentguard_before_${path.basename(filename)}`);
  fs.writeFileSync(tmpFile, oldContent, 'utf8');

  const beforeUri = vscode.Uri.file(tmpFile);
  const afterUri = vscode.Uri.file(path.join(root, filename));

  await vscode.commands.executeCommand(
    'vscode.diff',
    beforeUri,
    afterUri,
    `AgentGuard Review: ${filename} (Before ↔ After)`
  );
}

export async function rejectFile(filename: string, checkpointHash: string): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;

  try {
    await runCommand(`git checkout ${checkpointHash} -- "${filename}"`, root);
    vscode.window.showInformationMessage(`❌ AgentGuard: Rejected changes to ${filename}`);
  } catch (err) {
    vscode.window.showErrorMessage(`AgentGuard: Could not reject ${filename} — ${err}`);
  }
}

export async function acceptFile(filename: string): Promise<void> {
  vscode.window.showInformationMessage(`✅ AgentGuard: Accepted changes to ${filename}`);
}

export interface DetailedDiff {
  file: string;
  add: number;
  del: number;
  status: 'pending' | 'accepted' | 'rejected';
  old: string[];
  new: string[];
  oldMark: number[];
  newMark: number[];
}

export async function getFileDiffDetail(filename: string, checkpointHash: string): Promise<DetailedDiff> {
  const root = getWorkspaceRoot();
  if (!root) {
    return { file: filename, add: 0, del: 0, status: 'pending', old: [], new: [], oldMark: [], newMark: [] };
  }
  try {
    // Run git diff with full context (-U10000) to get the whole file's diff
    const diffOut = await runCommand(`git diff -U10000 ${checkpointHash} -- "${filename}"`, root);
    const lines = diffOut.split(/\r?\n/);
    const oldLines: string[] = [];
    const newLines: string[] = [];
    const oldMark: number[] = [];
    const newMark: number[] = [];
    let addCount = 0;
    let delCount = 0;

    let headersDone = false;
    for (const line of lines) {
      if (!headersDone) {
        if (line.startsWith('@@')) {
          headersDone = true;
        }
        continue;
      }
      if (line.startsWith('\\')) {
        continue; // ignore No newline at end of file
      }
      if (line.startsWith('-')) {
        oldMark.push(oldLines.length);
        oldLines.push(line.substring(1));
        delCount++;
      } else if (line.startsWith('+')) {
        newMark.push(newLines.length);
        newLines.push(line.substring(1));
        addCount++;
      } else {
        // unchanged line (starts with space or empty)
        const content = line.startsWith(' ') ? line.substring(1) : line;
        oldLines.push(content);
        newLines.push(content);
      }
    }

    // Fallback if no diff changes found (files are identical)
    if (oldLines.length === 0 && newLines.length === 0) {
      try {
        const content = fs.readFileSync(path.join(root, filename), 'utf8');
        const contentLines = content.split(/\r?\n/);
        return {
          file: filename,
          add: 0,
          del: 0,
          status: 'pending',
          old: contentLines,
          new: contentLines,
          oldMark: [],
          newMark: []
        };
      } catch {}
    }

    return {
      file: filename,
      add: addCount,
      del: delCount,
      status: 'pending',
      old: oldLines,
      new: newLines,
      oldMark,
      newMark
    };
  } catch (err) {
    return { file: filename, add: 0, del: 0, status: 'pending', old: [], new: [], oldMark: [], newMark: [] };
  }
}
