import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { restoreCheckpoint, getAllCheckpoints, createCheckpoint } from '../checkpoint';
import { getDirectives, addRule, removeRule } from '../memory';
import { runHealthCheck } from '../healthCheck';
import { getChangedFiles, getFileDiffDetail, openDiffForFile, rejectFile, acceptFile } from '../diffReview';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;
    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._panel.reveal(column);
      DashboardPanel.currentPanel._update();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'agentguardDashboard',
      'AgentGuard Dashboard',
      column,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(extensionUri.fsPath)
        ]
      }
    );
    DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._update();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the Webview (button clicks, form submits)
    this._panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'save-checkpoint': {
          const label = message.label || `Session ${new Date().toLocaleTimeString()}`;
          await createCheckpoint(label);
          await this.syncState();
          break;
        }

        case 'restore-checkpoint': {
          await restoreCheckpoint(message.hash, message.label);
          await this.syncState();
          break;
        }

        case 'run-health': {
          await this.syncState();
          break;
        }

        case 'open-diff': {
          if (message.file && message.hash) {
            await openDiffForFile(message.file, message.hash);
          }
          break;
        }

        case 'accept-file': {
          if (message.file) {
            await acceptFile(message.file);
            await this.syncState();
          }
          break;
        }

        case 'reject-file': {
          if (message.file && message.hash) {
            await rejectFile(message.file, message.hash);
            await this.syncState();
          }
          break;
        }

        case 'accept-all': {
          const cps = getAllCheckpoints();
          if (cps.length > 0) {
            const latest = cps[0];
            const changed = await getChangedFiles(latest.commitHash);
            for (const f of changed) {
              await acceptFile(f.filename);
            }
          }
          await this.syncState();
          break;
        }

        case 'reject-all': {
          if (message.hash) {
            const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (root) {
              const cp = require('child_process');
              await new Promise<void>((resolve) => {
                cp.exec(`git checkout ${message.hash} -- .`, { cwd: root }, () => {
                  vscode.window.showInformationMessage('❌ AgentGuard: Discarded all pending edits');
                  resolve();
                });
              });
            }
            await this.syncState();
          }
          break;
        }

        case 'refresh': {
          await this.syncState();
          break;
        }

        case 'execCommand': {
          await vscode.commands.executeCommand(message.cmd);
          await this.syncState();
          break;
        }

        // ── TrueMemory rule management from dashboard UI ──────────────────
        case 'add-rule': {
          if (message.content && message.content.trim()) {
            await addRule(message.content.trim());
            await this.syncState();
          }
          break;
        }

        case 'remove-rule': {
          if (typeof message.id === 'number') {
            await removeRule(message.id);
            await this.syncState();
          }
          break;
        }
      }
    }, null, this._disposables);
  }

  /**
   * Reload the webview HTML and push the initial state sync.
   */
  private async _update() {
    this._panel.webview.html = this._getHtml();
    // Push sync-state to the webview after the DOM is ready (slight delay)
    setTimeout(() => this.syncState(), 500);
  }

  /**
   * Fetch all real state data and push it to the webview.
   */
  public async syncState() {
    // 1. Checkpoints
    const realCheckpoints = getAllCheckpoints();
    
    // 2. Health check
    let healthResult = null;
    try {
      healthResult = await runHealthCheck();
    } catch {}

    // 3. Changed files & detailed diffs against latest checkpoint
    let diffs: any[] = [];
    let drift: any[] = [];
    if (realCheckpoints.length > 0) {
      const latest = realCheckpoints[0];
      const changed = await getChangedFiles(latest.commitHash);
      for (const f of changed) {
        const detail = await getFileDiffDetail(f.filename, latest.commitHash);
        diffs.push(detail);
      }
    }

    // 4. Drift status (comparing working tree against HEAD)
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (root) {
      try {
        const output = await new Promise<string>((resolve) => {
          const cp = require('child_process');
          cp.exec('git diff --numstat HEAD', { cwd: root }, (err: any, stdout: string) => {
            resolve(stdout || '');
          });
        });
        const lines = output.split('\n').filter(Boolean);
        drift = lines.map((line, idx) => {
          const parts = line.split('\t');
          const add = parseInt(parts[0], 10) || 0;
          const del = parseInt(parts[1], 10) || 0;
          const file = parts[2];
          return {
            id: idx + 1,
            file,
            note: `Uncommitted changes: +${add} -${del}`,
            lines: add + del,
            selected: idx === 0
          };
        });
      } catch {}
    }

    // 5. Memory directives
    const directives = await getDirectives();

    // Send state payload
    this._panel.webview.postMessage({
      type: 'sync-state',
      data: {
        checkpoints: realCheckpoints.map((cp, idx) => ({
          id: cp.id,
          label: cp.label,
          files: cp.filesChanged,
          branch: 'main',
          at: new Date(cp.timestamp).getTime(),
          current: idx === 0,
          commitHash: cp.commitHash
        })),
        diffs,
        drift,
        health: healthResult,
        rules: directives.map(d => ({ id: d.id, content: d.content }))
      }
    });
  }

  private _getHtml(): string {
    const webview = this._panel.webview;
    const extensionPath = this._extensionUri.fsPath;

    // Read the index.html from disk
    const htmlPath = path.join(extensionPath, 'index.html');
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Convert local file paths to webview-compatible resource URIs
    const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(extensionPath, 'index.css')));
    const jsUri = webview.asWebviewUri(vscode.Uri.file(path.join(extensionPath, 'app.js')));

    // Replace the relative links with the webview-safe URIs
    htmlContent = htmlContent.replace('href="index.css"', `href="${cssUri}"`);
    htmlContent = htmlContent.replace('src="app.js"', `src="${jsUri}"`);

    return htmlContent;
  }

  public dispose() {
    DashboardPanel.currentPanel = undefined;
    this._panel.dispose();
    this._disposables.forEach(d => d.dispose());
  }
}
