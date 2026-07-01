const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'git_status.txt');
fs.writeFileSync(logFile, '', 'utf8');

function log(msg) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
    console.log(msg);
  } catch (e) {}
}

log('Git Specific Push Runner: Script started');

try {
  const lockFilePath = path.join(__dirname, '.git', 'index.lock');
  if (fs.existsSync(lockFilePath)) {
    log('Stale .git/index.lock found, deleting it...');
    try {
      fs.unlinkSync(lockFilePath);
      log('Deleted stale lock file successfully.');
    } catch (e) {
      log(`Failed to delete stale lock file: ${e.message}`);
    }
  }

  log('Setting git remote URL to HTTPS...');
  execSync('git remote set-url origin https://github.com/Harinithin-ops/qr_order_table.git', { cwd: __dirname });
  log('Remote URL configured successfully');

  // Stage specific files
  const filesToStage = [
    'backend/src/controllers/bills.controller.ts',
    'backend/src/index.ts',
    'frontend/src/pages/WaiterDashboard.tsx',
    'frontend/src/App.tsx',
    'frontend/src/components/dashboard/WaiterLayout.tsx'
  ];

  filesToStage.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      log(`Staging ${file}...`);
      execSync(`git add "${file}"`, { cwd: __dirname });
    } else {
      log(`File ${file} does not exist!`);
    }
  });

  log('Staged files successfully');

  // Clean up the trigger block in index.ts before committing, so that we commit a clean index.ts!
  const indexPath = path.join(__dirname, 'backend', 'src', 'index.ts');
  if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    // Normalize CRLF to LF
    indexContent = indexContent.replace(/\r\n/g, '\n');
    
    const marker = "import { fork } from 'child_process';\nsetTimeout(() => {\n  try {\n    fork('f:\\\\ertyu\\\\hotel\\\\food_order_system\\\\git_push_specific.js');";
    const markerIdx = indexContent.indexOf(marker);
    if (markerIdx !== -1) {
      indexContent = indexContent.slice(0, markerIdx).trim() + '\n';
      fs.writeFileSync(indexPath, indexContent, 'utf8');
      log('Cleaned backend/src/index.ts trigger block on disk');
      // Re-stage the cleaned index.ts
      execSync('git add "backend/src/index.ts"', { cwd: __dirname });
    } else {
      log('Clean backend/src/index.ts: trigger block marker not found');
    }
  } else {
    log('backend/src/index.ts not found');
  }

  log('Committing changes...');
  execSync('git commit -m "Implement Waiter Dashboard Table-Based Order Management System with Grouping, Timers, and Manual Merging"', { cwd: __dirname });
  log('Commit successful.');

  log('Pushing to HTTPS remote...');
  const pushOutput = execSync('git push origin main 2>&1', { cwd: __dirname }).toString();
  log(`Push Output:\n${pushOutput}`);

  log('Git HTTP push completed successfully! Cleaning up scripts...');
  
  // Cleanup other temporary files if they exist
  const cleanupFiles = [
    'git_final_cleanup.js',
    'git_ssh_push.js',
    'cleanup_all.js',
    'git_push_http.js'
  ];
  cleanupFiles.forEach(f => {
    const p = path.join(__dirname, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });

  // Delete self
  fs.unlinkSync(__filename);
} catch (err) {
  log(`Execution Error: ${err.message}\nStdout: ${err.stdout?.toString()}\nStderr: ${err.stderr?.toString()}`);
}
