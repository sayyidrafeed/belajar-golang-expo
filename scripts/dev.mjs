import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { networkInterfaces } from 'node:os';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const mobileRoot = path.join(root, 'apps/mobile');
const require = createRequire(path.join(mobileRoot, 'package.json'));
const mobile = process.argv.includes('--mobile');
const lan = Object.values(networkInterfaces()).flat().find((address) =>
  address && address.family === 'IPv4' && !address.internal && address.address.startsWith('192.168.')
)?.address ?? Object.values(networkInterfaces()).flat().find((address) =>
  address && address.family === 'IPv4' && !address.internal
)?.address ?? '127.0.0.1';
const apiURL = process.env.EXPO_PUBLIC_API_URL || `http://${lan}:8080`;
const children = [];
let stopping = false;

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      if (process.platform === 'win32') child.kill('SIGTERM');
      else process.kill(-child.pid, 'SIGTERM');
    } catch (error) {
      if (error.code !== 'ESRCH') console.error(error.message);
    }
  }
  setTimeout(() => process.exit(code), 600);
}

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());

function start(command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: 'inherit', detached: process.platform !== 'win32' });
  children.push(child);
  child.on('error', (error) => { console.error(error.message); shutdown(1); });
  child.on('exit', (code) => { if (!stopping) shutdown(code || 0); });
  return child;
}

function checkPort(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`Port ${port} is occupied. Stop your earlier To-Dos dev session or use the existing one.`)));
    server.listen(port, '0.0.0.0', () => server.close(resolve));
  });
}

try {
  await Promise.all([checkPort(8080), checkPort(8081)]);
  console.log(`\nTo-Dos\nWeb: http://localhost:8081\nPhone API: ${apiURL}\nCtrl+C stops both servers.\n`);
  start('go', ['run', './cmd/api'], path.join(root, 'apps/api'), {
    API_ADDR: '0.0.0.0:8080',
    CORS_ORIGINS: process.env.CORS_ORIGINS || `http://localhost:8081,http://127.0.0.1:8081,http://${lan}:8081`,
  });
  let ready = false;
  for (let attempt = 0; attempt < 150 && !stopping; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:8080/health', { signal: AbortSignal.timeout(500) });
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error('Go API did not become ready. Check the error above.');
  start(process.execPath, [require.resolve('expo/bin/cli'), 'start', '--go', '--port', '8081', ...(mobile ? [] : ['--web'])], mobileRoot, {
    EXPO_PUBLIC_API_URL: apiURL,
  });
} catch (error) {
  console.error(error.message);
  shutdown(1);
}
