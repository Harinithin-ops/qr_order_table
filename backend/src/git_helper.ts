import { execSync } from 'child_process';

const args = process.argv.slice(2);
const cmd = `git ${args.join(' ')}`;

console.log(`Executing: ${cmd}`);
try {
  execSync(cmd, { stdio: 'inherit' });
} catch (e: any) {
  console.error(`Command failed: ${e.message}`);
  process.exit(1);
}
