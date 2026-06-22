import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

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

export async function generateSyncPrompt(): Promise<string | null> {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage('AgentGuard: No workspace folder open.');
    return null;
  }

  let changedFiles: string[] = [];
  
  try {
    const staged = await runCommand('git diff --name-only HEAD', root);
    const unstaged = await runCommand('git diff --name-only', root);
    const untracked = await runCommand('git ls-files --others --exclude-standard', root);
    
    const allChanged = [
      ...staged.split('\n'),
      ...unstaged.split('\n'),
      ...untracked.split('\n')
    ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i); // unique
    
    changedFiles = allChanged;
  } catch {
    const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 20);
    const picked = await vscode.window.showQuickPick(
      files.map(f => path.relative(root, f.fsPath)),
      { placeHolder: 'Select the files you manually changed', canPickMany: true }
    );
    changedFiles = picked || [];
  }

  if (changedFiles.length === 0) {
    vscode.window.showInformationMessage('AgentGuard: No changed files detected.');
    return null;
  }

  let prompt = `⚠️ SYNC NOTICE — Please read before continuing:\n\n`;
  prompt += `I have manually edited the following files since your last action:\n`;
  
  for (const file of changedFiles.slice(0, 5)) {
    const fullPath = path.join(root, file);
    prompt += `\n--- ${file} ---\n`;
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n').slice(0, 100).join('\n');
      prompt += `\`\`\`\n${lines}\n\`\`\`\n`;
    } catch {
      prompt += `[Could not read file content]\n`;
    }
  }

  prompt += `\nPlease discard any cached version of these files from your memory and use `;
  prompt += `the content above as the current source of truth before writing any new code.`;

  await vscode.env.clipboard.writeText(prompt);
  vscode.window.showInformationMessage(
    `📋 AgentGuard: Sync prompt copied to clipboard! Paste it into Enter Pro.`
  );
  return prompt;
}
