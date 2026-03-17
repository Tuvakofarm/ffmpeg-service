import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

export const config = {
  port: parseInt(process.env.PORT || '8200', 10),
  apiKey: process.env.API_KEY || 'ffmpeg-local-service-key-2026',
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  useNvenc: process.env.USE_NVENC === 'true',
  workDir: process.env.WORK_DIR || path.join(__dirname, '..', 'work'),
  maxJobTimeoutMs: parseInt(process.env.MAX_JOB_TIMEOUT_MS || '600000', 10),
  cleanupAfterMs: parseInt(process.env.CLEANUP_AFTER_MS || '3600000', 10),
};

if (!fs.existsSync(config.workDir)) {
  fs.mkdirSync(config.workDir, { recursive: true });
}
