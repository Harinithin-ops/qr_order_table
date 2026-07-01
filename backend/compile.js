const { execSync } = require('child_process');
try {
  console.log('Running TypeScript compilation check...');
  const out = execSync('npx tsc --noEmit', { cwd: __dirname }).toString();
  console.log('COMPILATION SUCCESSFUL:\n', out);
} catch (e) {
  console.log('COMPILATION FAILED:\n', e.stdout?.toString() || e.message);
  if (e.stderr) {
    console.log('STDERR:\n', e.stderr.toString());
  }
}
