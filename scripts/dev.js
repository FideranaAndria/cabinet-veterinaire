const path = require('node:path');
const concurrently = require('concurrently');

if (process.platform === 'win32') {
  const systemRoot = process.env.SystemRoot || process.env.WINDIR;

  if (systemRoot) {
    const system32 = path.join(systemRoot, 'System32');
    const pathEntries = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
    const hasSystem32 = pathEntries.some((entry) => path.resolve(entry).toLowerCase() === system32.toLowerCase());

    if (!hasSystem32) {
      process.env.PATH = [system32, ...pathEntries].join(path.delimiter);
    }
  }
}

const { result } = concurrently(
  [
    { command: 'npm run dev --workspace server', name: 'API', prefixColor: 'cyan' },
    { command: 'npm run dev --workspace client', name: 'WEB', prefixColor: 'green' },
  ],
  { killOthersOn: ['failure'], prefix: 'name', handleInput: false },
);

result.catch(() => {
  process.exitCode = 1;
});