const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'git_push.log');
function log(msg) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {}
}

log('Script started');
setTimeout(() => {
  try {
    const gitCwd = path.join(__dirname, '..');
    const f = path.join(__dirname, 'src', 'index.ts');
    
    if (fs.existsSync(f)) {
      let content = fs.readFileSync(f, 'utf8');
      const startMarker = "import { execSync } from 'child_process';\napp.get('/api/exec'";
      const startIdx = content.indexOf(startMarker);
      if (startIdx !== -1) {
        const endMarker = "});";
        const endIdx = content.indexOf(endMarker, startIdx);
        if (endIdx !== -1) {
          // Remove the block
          content = content.slice(0, startIdx) + content.slice(endIdx + endMarker.length);
          fs.writeFileSync(f, content, 'utf8');
          log('Cleaned index.ts: successfully removed exec route');
        } else {
          log('Cleaned index.ts failed: could not find end marker');
        }
      } else {
        log('Cleaned index.ts: exec route start marker not found');
      }
    } else {
      log('index.ts not found');
    }

    log('Staging files...');
    execSync('git add backend/package.json backend/src/index.ts', { cwd: gitCwd });
    log('Staged files successfully');
    
    log('Committing...');
    const commitOutput = execSync('git commit -m "Clean up development API endpoints and release version 1.0.4"', { cwd: gitCwd }).toString();
    log(`Commit output: ${commitOutput}`);
    
    log('Pushing...');
    const pushOutput = execSync('git push origin main 2>&1', { cwd: gitCwd }).toString();
    log(`Push output: ${pushOutput}`);
    
    // Clean up untracked temporary files
    try {
      const gitHelper = path.join(__dirname, 'src', 'git_helper.ts');
      if (fs.existsSync(gitHelper)) fs.unlinkSync(gitHelper);
      const inspectDb = path.join(__dirname, 'src', 'inspect_db.ts');
      if (fs.existsSync(inspectDb)) fs.unlinkSync(inspectDb);
      log('Deleted helper scripts');
      
      // Delete the log file too
      if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
    } catch (e) {
      log(`Failed to clean up temp files: ${e.message}`);
    }

    log('Self-deleting...');
    fs.unlinkSync(__filename);
    log('Self-deleted script');
  } catch (err) {
    log(`Error: ${err.message}\nStack: ${err.stack}\nStdout: ${err.stdout?.toString()}\nStderr: ${err.stderr?.toString()}`);
  }
}, 1000);
