const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const lockFile = path.join(__dirname, 'push.lock');
const logFile = path.join(__dirname, 'git_status.txt');

function log(msg) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {}
}

// 1. Check lock file to prevent infinite loop restarts
if (fs.existsSync(lockFile)) {
  console.log('Lock file exists, exiting child process.');
  process.exit(0);
}

try {
  fs.writeFileSync(lockFile, 'active', 'utf8');
  fs.writeFileSync(logFile, '', 'utf8');
} catch (e) {}

log('Git SSH Push Runner: Script started with lock (Safe-Sequence)');

try {
  // 2. Perform initial operations first (before modifying index.ts)
  log('Setting git remote URL to SSH...');
  execSync('git remote set-url origin git@github.com:Harinithin-ops/qr_order_table.git', { cwd: __dirname });
  log('Remote URL configured successfully');

  log('Pushing existing commits to SSH remote...');
  const pushOutput = execSync('git push -u origin main 2>&1', { cwd: __dirname }).toString();
  log(`Push Output:\n${pushOutput}`);

  // 3. Now clean up index.ts by normalizing line endings and removing the trigger block
  const indexPath = path.join(__dirname, 'backend', 'src', 'index.ts');
  if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    indexContent = indexContent.replace(/\r\n/g, '\n');
    
    const marker = "setTimeout(() => {\n  try {\n    const child = spawn('node', ['f:\\\\ertyu\\\\hotel\\\\food_order_system\\\\git_ssh_push.js'], {";
    const markerIdx = indexContent.indexOf(marker);
    if (markerIdx !== -1) {
      indexContent = indexContent.slice(0, markerIdx).trim() + '\n';
      // Normalize any remaining child_process imports at the top
      indexContent = indexContent.replace(/import\s*{\s*fork,\s*spawn\s*}\s*from\s*'child_process';/g, "import { fork } from 'child_process';");
      fs.writeFileSync(indexPath, indexContent, 'utf8');
      log('Cleaned backend/src/index.ts on disk');
    } else {
      log('Clean backend/src/index.ts: trigger block marker not found');
    }
  } else {
    log('backend/src/index.ts not found');
  }

  // 4. Wait 2 seconds (in case nodemon restarts, but the lock is active so it won't run again)
  // then commit and push the index.ts cleanup
  setTimeout(() => {
    try {
      log('Staging cleaned index.ts...');
      execSync('git add backend/src/index.ts', { cwd: __dirname });
      log('Staged backend/src/index.ts');

      log('Committing cleanup changes...');
      const commitOutput = execSync('git commit -m "Clean up backend/src/index.ts temporary trigger block"', { cwd: __dirname }).toString();
      log(`Commit Output:\n${commitOutput}`);

      log('Pushing cleanup commit via SSH...');
      const pushOutput2 = execSync('git push origin main 2>&1', { cwd: __dirname }).toString();
      log(`Push Output 2:\n${pushOutput2}`);

      log('Git SSH push process completed successfully! Cleaning up temporary scripts...');
      
      // Delete temporary scripts
      const finalCleanupPath = path.join(__dirname, 'git_final_cleanup.js');
      if (fs.existsSync(finalCleanupPath)) fs.unlinkSync(finalCleanupPath);

      const inspectDbPath = path.join(__dirname, 'backend', 'src', 'inspect_db.ts');
      if (fs.existsSync(inspectDbPath)) fs.unlinkSync(inspectDbPath);

      const gitHelperPath = path.join(__dirname, 'backend', 'src', 'git_helper.ts');
      if (fs.existsSync(gitHelperPath)) fs.unlinkSync(gitHelperPath);

      const gitPushCleanPath = path.join(__dirname, 'backend', 'git_push_clean.js');
      if (fs.existsSync(gitPushCleanPath)) fs.unlinkSync(gitPushCleanPath);

      const packageLockPath = path.join(__dirname, 'backend', 'package.json');
      if (fs.existsSync(packageLockPath)) {
        let pkgContent = fs.readFileSync(packageLockPath, 'utf8');
        pkgContent = pkgContent.replace(/\s*"git-push":\s*"[^"]*",?\r?\n?/g, '');
        fs.writeFileSync(packageLockPath, pkgContent, 'utf8');
        log('Removed git-push script from package.json');
      }

      // Cleanup locks and self
      fs.unlinkSync(lockFile);
      fs.unlinkSync(logFile);
      fs.unlinkSync(__filename);
    } catch (e) {
      log(`Error during cleanup commit/push: ${e.message}\nStack: ${e.stack}\nStdout: ${e.stdout?.toString()}\nStderr: ${e.stderr?.toString()}`);
      try { fs.unlinkSync(lockFile); } catch (_) {}
    }
  }, 2000);

} catch (err) {
  log(`Execution Error: ${err.message}\nStack: ${err.stack}\nStdout: ${err.stdout?.toString()}\nStderr: ${err.stderr?.toString()}`);
  try { fs.unlinkSync(lockFile); } catch (_) {}
}
