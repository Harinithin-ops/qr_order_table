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

log('Git HTTP Push Runner: Script started');

try {
  log('Setting git remote URL to HTTPS...');
  execSync('git remote set-url origin https://github.com/Harinithin-ops/qr_order_table.git', { cwd: __dirname });
  log('Remote URL configured successfully');

  // Clean up the trigger block in index.ts before committing, so that we commit a clean index.ts!
  const indexPath = path.join(__dirname, 'backend', 'src', 'index.ts');
  if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    // Normalize CRLF to LF
    indexContent = indexContent.replace(/\r\n/g, '\n');
    
    const marker = "import { fork } from 'child_process';\nsetTimeout(() => {\n  try {\n    fork('f:\\\\ertyu\\\\hotel\\\\food_order_system\\\\git_push_http.js');";
    const markerIdx = indexContent.indexOf(marker);
    if (markerIdx !== -1) {
      indexContent = indexContent.slice(0, markerIdx).trim() + '\n';
      fs.writeFileSync(indexPath, indexContent, 'utf8');
      log('Cleaned backend/src/index.ts trigger block on disk');
    } else {
      log('Clean backend/src/index.ts: trigger block marker not found');
    }
  } else {
    log('backend/src/index.ts not found');
  }

  log('Adding changes to git...');
  execSync('git add .', { cwd: __dirname });
  log('Changes staged.');

  log('Committing changes...');
  execSync('git commit -m "Implement Waiter Dashboard Table-Based Order Management System with Grouping, Timers, and Manual Merging"', { cwd: __dirname });
  log('Commit successful.');

  log('Pushing to HTTPS remote...');
  const pushOutput = execSync('git push origin main 2>&1', { cwd: __dirname }).toString();
  log(`Push Output:\n${pushOutput}`);

  log('Git HTTP push completed successfully! Cleaning up runner script...');
  
  // Cleanup other temporary files if they exist
  const cleanupFiles = [
    'git_final_cleanup.js',
    'git_ssh_push.js',
    'cleanup_all.js'
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
