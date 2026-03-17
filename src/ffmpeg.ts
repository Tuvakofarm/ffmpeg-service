import { spawn } from 'child_process';

export function runFfmpeg(command: string, timeoutMs: number, onProgress?: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const parts = parseCommand(command);
    const exe = parts[0];
    const args = parts.slice(1);
    const proc = spawn(exe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    let duration: number | null = null;

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      if (!duration) {
        const m = text.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
        if (m) duration = parseInt(m[1])*3600 + parseInt(m[2])*60 + parseInt(m[3]) + parseInt(m[4])/100;
      }
      if (duration && onProgress) {
        const m = text.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
        if (m) {
          const cur = parseInt(m[1])*3600 + parseInt(m[2])*60 + parseInt(m[3]) + parseInt(m[4])/100;
          onProgress(Math.min(cur / duration, 0.99));
        }
      }
    });
    proc.stdout.on('data', () => {});
    const timer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('FFmpeg timed out')); }, timeoutMs);
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error('FFmpeg exit ' + code + ': ' + stderr.slice(-500)));
    });
    proc.on('error', (err) => { clearTimeout(timer); reject(new Error('FFmpeg spawn: ' + err.message)); });
  });
}

function parseCommand(cmd: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQ = false;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (ch === '"') inQ = !inQ;
    else if (ch === ' ' && !inQ) { if (current) { args.push(current); current = ''; } }
    else current += ch;
  }
  if (current) args.push(current);
  return args;
}
