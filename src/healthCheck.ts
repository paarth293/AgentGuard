import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

function getWorkspaceRoot(): string | null {
  const folders = vscode.workspace.workspaceFolders;
  return folders ? folders[0].uri.fsPath : null;
}

function runCommand(cmd: string, cwd: string, timeoutMs = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = cp.exec(cmd, { cwd }, (err, stdout, stderr) => {
      resolve(stdout.trim() || stderr.trim());
    });
    setTimeout(() => { proc.kill(); resolve('TIMEOUT'); }, timeoutMs);
  });
}

export interface HealthCheckResult {
  gitInitialized: boolean;
  nodeModulesExist: boolean;
  missingPackages: string[];
  vulnerabilities: { critical: number; high: number; moderate: number; low: number };
  envFileMissing: boolean;
  packageJsonExists: boolean;
  summary: 'healthy' | 'warnings' | 'critical';
}

export async function runHealthCheck(): Promise<HealthCheckResult> {
  const root = getWorkspaceRoot();
  if (!root) throw new Error('No workspace folder open');

  const result: HealthCheckResult = {
    gitInitialized: false,
    nodeModulesExist: false,
    missingPackages: [],
    vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 },
    envFileMissing: false,
    packageJsonExists: false,
    summary: 'healthy'
  };

  try {
    const gitCheck = await runCommand('git rev-parse --is-inside-work-tree 2>&1', root);
    result.gitInitialized = !gitCheck.toLowerCase().includes('fatal');
  } catch { result.gitInitialized = false; }

  result.packageJsonExists = fs.existsSync(path.join(root, 'package.json'));

  if (result.packageJsonExists) {
    result.nodeModulesExist = fs.existsSync(path.join(root, 'node_modules'));

    // Run dependency listing, vulnerability audit, and env checks concurrently to avoid serial blocking
    const checks = await Promise.all([
      result.nodeModulesExist ? runCommand('npm ls --depth=0 --json 2>&1', root, 5000) : Promise.resolve(''),
      runCommand('npm audit --json 2>&1', root, 5000)
    ]);

    const lsOutput = checks[0];
    const auditOutput = checks[1];

    if (result.nodeModulesExist && lsOutput && lsOutput !== 'TIMEOUT') {
      try {
        const parsed = JSON.parse(lsOutput);
        if (parsed.problems) {
          result.missingPackages = parsed.problems
            .filter((p: string) => p.includes('missing'))
            .map((p: string) => p.replace('npm warn missing: ', '').split('@')[0]);
        }
      } catch { }
    }

    if (auditOutput && auditOutput !== 'TIMEOUT') {
      try {
        const audit = JSON.parse(auditOutput);
        if (audit.metadata?.vulnerabilities) {
          result.vulnerabilities = {
            critical: audit.metadata.vulnerabilities.critical || 0,
            high: audit.metadata.vulnerabilities.high || 0,
            moderate: audit.metadata.vulnerabilities.moderate || 0,
            low: audit.metadata.vulnerabilities.low || 0
          };
        }
      } catch { }
    }

    const hasEnvExample = fs.existsSync(path.join(root, '.env.example'));
    const hasEnv = fs.existsSync(path.join(root, '.env'));
    result.envFileMissing = hasEnvExample && !hasEnv;
  }

  const hasCritical = !result.gitInitialized ||
    !result.nodeModulesExist ||
    result.missingPackages.length > 0 ||
    result.vulnerabilities.critical > 0;
  const hasWarnings = result.envFileMissing || result.vulnerabilities.high > 0;

  result.summary = hasCritical ? 'critical' : hasWarnings ? 'warnings' : 'healthy';
  return result;
}

export function generateAgentBriefing(result: HealthCheckResult): string {
  let briefing = `🔍 WORKSPACE HEALTH BRIEFING — Read this before writing any code:\n\n`;

  if (!result.gitInitialized) briefing += `❌ Git is NOT initialized in this project.\n`;
  else briefing += `✅ Git repository is initialized.\n`;

  if (!result.packageJsonExists) {
    briefing += `❌ No package.json found.\n`;
  } else {
    if (!result.nodeModulesExist) briefing += `❌ node_modules is MISSING — run npm install before proceeding.\n`;
    else briefing += `✅ node_modules exists.\n`;

    if (result.missingPackages.length > 0) {
      briefing += `❌ Missing packages: ${result.missingPackages.join(', ')} — run npm install.\n`;
    }

    const v = result.vulnerabilities;
    if (v.critical > 0) briefing += `🚨 ${v.critical} CRITICAL security vulnerabilities detected.\n`;
    if (v.high > 0) briefing += `⚠️ ${v.high} high-severity vulnerabilities detected.\n`;
    if (v.moderate > 0) briefing += `⚠️ ${v.moderate} moderate vulnerabilities detected.\n`;
    if (v.critical === 0 && v.high === 0 && v.moderate === 0) briefing += `✅ No significant security vulnerabilities.\n`;
  }

  if (result.envFileMissing) {
    briefing += `❌ .env file is MISSING (found .env.example) — do not reference env variables until .env is created.\n`;
  }

  briefing += `\nPlease account for all ❌ items above before writing any code.`;
  return briefing;
}
