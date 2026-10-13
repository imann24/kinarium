import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
if (!existsSync('dist/index.html')) {
  const build = spawn(pnpm, ['exec','vite','build'], { stdio:'inherit' });
  const code = await new Promise(resolve => build.on('exit',resolve));
  if (code !== 0) process.exit(typeof code === 'number' ? code : 1);
}
const children = [spawn(pnpm, ['dev:server'], { stdio:'inherit' }), spawn(pnpm, ['dev:client'], { stdio:'inherit' })];
let stopping = false;
function stop(code = 0) { if(stopping) return; stopping=true; for(const child of children) child.kill('SIGTERM'); process.exitCode=code; }
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>stop());
for(const child of children) { child.on('error',error=>{console.error(error.message);stop(1);}); child.on('exit',code=>{if(!stopping)stop(code??0);}); }
