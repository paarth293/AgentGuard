import * as vscode from 'vscode';
import { createCheckpoint, getAllCheckpoints } from './checkpoint';
import { generateSyncPrompt } from './syncPrompt';
import { getChangedFiles, openDiffForFile, rejectFile, acceptFile } from './diffReview';
import { runHealthCheck, generateAgentBriefing } from './healthCheck';
import { DashboardPanel } from './dashboard/DashboardPanel';
import {
  generateRecallPrompt,
  addRule,
  removeRule,
  warmupModel,
  getDirectives,
} from './memory';

export function activate(context: vscode.ExtensionContext) {
  console.log('AgentGuard is now active');

  // Pre-warm the TrueMemory embedding model in the background so the first
  // memory operation is instant instead of waiting 20+ seconds for model download.
  warmupModel();

  // ─── Command 1: Save Checkpoint ───────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('agentguard.saveCheckpoint', async () => {
      const label = await vscode.window.showInputBox({
        prompt: 'Name this checkpoint (optional)',
        placeHolder: 'e.g., Before refactoring auth middleware',
        value: `Session ${new Date().toLocaleTimeString()}`
      });
      if (label !== undefined) {
        await createCheckpoint(label);
        DashboardPanel.createOrShow(context.extensionUri);
      }
    })
  );

  // ─── Command 2: Open Dashboard ────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('agentguard.openDashboard', () => {
      DashboardPanel.createOrShow(context.extensionUri);
    })
  );

  // ─── Command 3: Copy Sync Prompt ──────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('agentguard.copySyncPrompt', async () => {
      await generateSyncPrompt();
    })
  );

  // ─── Command 4: Review AI Changes ─────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('agentguard.reviewChanges', async () => {
      const checkpoints = getAllCheckpoints();
      if (checkpoints.length === 0) {
        vscode.window.showWarningMessage('AgentGuard: No checkpoint found. Save a checkpoint first.');
        return;
      }
      const latestCheckpoint = checkpoints[0];
      const changedFiles = await getChangedFiles(latestCheckpoint.commitHash);

      if (changedFiles.length === 0) {
        vscode.window.showInformationMessage('AgentGuard: No changes detected since last checkpoint.');
        return;
      }

      const items = changedFiles.map(f => ({
        label: `$(diff) ${f.filename}`,
        description: f.status,
        filename: f.filename
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a file to review',
        canPickMany: false
      });

      if (selected) {
        await openDiffForFile(selected.filename, latestCheckpoint.commitHash);
        const action = await vscode.window.showInformationMessage(
          `Review: ${selected.filename}`,
          'Accept ✅', 'Reject ❌'
        );
        if (action === 'Accept ✅') { await acceptFile(selected.filename); }
        if (action === 'Reject ❌') { await rejectFile(selected.filename, latestCheckpoint.commitHash); }
      }
    })
  );

  // ─── Command 5: Health Check ──────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('agentguard.healthCheck', async () => {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'AgentGuard: Running workspace health check...',
        cancellable: false
      }, async () => {
        try {
          const result = await runHealthCheck();
          const briefing = generateAgentBriefing(result);

          const action = await vscode.window.showInformationMessage(
            `Health Check: ${result.summary.toUpperCase()} — Click to copy agent briefing`,
            'Copy Briefing 📋', 'Open Dashboard'
          );

          if (action === 'Copy Briefing 📋') {
            await vscode.env.clipboard.writeText(briefing);
            vscode.window.showInformationMessage('📋 Briefing copied! Paste into Enter Pro before your session.');
          }
          if (action === 'Open Dashboard') {
            DashboardPanel.createOrShow(context.extensionUri);
          }
        } catch (err) {
          vscode.window.showErrorMessage(`AgentGuard: Health check failed — ${err}`);
        }
      });
    })
  );

  // ─── Command 6: Copy TrueMemory Recall Prompt ─────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('agentguard.copyMemoryPrompt', async () => {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'AgentGuard: Loading memory from TrueMemory...',
        cancellable: false
      }, async () => {
        const prompt = await generateRecallPrompt();  // ← now properly awaited
        await vscode.env.clipboard.writeText(prompt);
        vscode.window.showInformationMessage(
          '🧠 AgentGuard: TrueMemory recall prompt copied! Paste it into Enter Pro to restore context.'
        );
      });
    })
  );
}

export function deactivate() {}
