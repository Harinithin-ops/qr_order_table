const fs = require('fs');
const path = require('path');

try {
  // 1. Clean up index.ts by normalizing line endings and removing the trigger block
  const indexPath = path.join(__dirname, 'backend', 'src', 'index.ts');
  if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    // Normalize CRLF to LF
    indexContent = indexContent.replace(/\r\n/g, '\n');
    
    const marker = "setTimeout(() => {\n  try {\n    fork('f:\\\\ertyu\\\\hotel\\\\food_order_system\\\\cleanup_all.js');";
    const markerIdx = indexContent.indexOf(marker);
    if (markerIdx !== -1) {
      indexContent = indexContent.slice(0, markerIdx).trim() + '\n';
      // Also clean up line 5 fork import if it exists, leaving the rest clean
      indexContent = indexContent.replace(/import\s*{\s*fork,\s*spawn\s*}\s*from\s*'child_process';/g, "import { fork } from 'child_process';");
      fs.writeFileSync(indexPath, indexContent, 'utf8');
    }
  }

  // 2. Wait 1 second for nodemon restart/file release, then delete all temp files
  setTimeout(() => {
    try {
      const filesToDelete = [
        path.join(__dirname, 'git_ssh_push.js'),
        path.join(__dirname, 'git_final_cleanup.js'),
        path.join(__dirname, 'git_status.txt'),
        path.join(__dirname, 'push.lock'),
        path.join(__dirname, 'git_err.log')
      ];

      filesToDelete.forEach(f => {
        if (fs.existsSync(f)) {
          fs.unlinkSync(f);
        }
      });

      // Self delete
      fs.unlinkSync(__filename);
    } catch (e) {}
  }, 1000);

} catch (err) {}
