const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  // 1. Clean up index.ts by normalizing line endings and removing the trigger block
  const indexPath = path.join(__dirname, 'backend', 'src', 'index.ts');
  if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    // Normalize CRLF to LF
    indexContent = indexContent.replace(/\r\n/g, '\n');
    
    const marker = "import { fork } from 'child_process';\nsetTimeout(() => {\n  try {\n    fork('f:\\\\ertyu\\\\hotel\\\\food_order_system\\\\git_final_cleanup.js');";
    const markerIdx = indexContent.indexOf(marker);
    if (markerIdx !== -1) {
      indexContent = indexContent.slice(0, markerIdx).trim() + '\n';
      fs.writeFileSync(indexPath, indexContent, 'utf8');
    }
  }

  // 2. Wait 1 second and run git commands
  setTimeout(() => {
    try {
      execSync('git add backend/src/index.ts', { cwd: __dirname });
      execSync('git commit -m "Clean up backend/src/index.ts runner block"', { cwd: __dirname });
      execSync('git push origin main 2>&1', { cwd: __dirname });
      
      // Clean up self
      fs.unlinkSync(__filename);
    } catch (e) {
      fs.writeFileSync(path.join(__dirname, 'git_err.log'), e.message + '\n' + (e.stderr ? e.stderr.toString() : ''), 'utf8');
    }
  }, 1000);

} catch (err) {
  fs.writeFileSync(path.join(__dirname, 'git_err.log'), err.message, 'utf8');
}
