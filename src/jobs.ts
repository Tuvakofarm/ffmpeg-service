import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { config } from './config';
import { downloadFile } from './storage';
import { runFfmpeg } from './ffmpeg';

export type JobStatus = 'queued' | 'processing' | 'finished' | 'failed';

export interface Job {
  id: string; status: JobStatus; progress: number; command: string;
  files: string[]; outputExtension: string; outputPath: string | null;
  error: string | null; createdAt: Date; finishedAt: Date | null;
}

const jobs = new Map<string, Job>();
let processing = false;
const queue: string[] = [];

export function createJob(files: string[], command: string, ext: string): Job {
  const job: Job = {
    id: uuidv4(), status: 'queued', progress: 0, command, files,
    outputExtension: ext || 'mp4', outputPath: null, error: null,
    createdAt: new Date(), finishedAt: null,
  };
  jobs.set(job.id, job);
  queue.push(job.id);
  processQueue();
  return job;
}

export function getJob(id: string): Job | undefined { return jobs.get(id); }
export function getJobOutputPath(id: string): string | null {
  const j = jobs.get(id);
  return (j && j.status === 'finished' && j.outputPath) ? j.outputPath : null;
}

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;
  const jobId = queue.shift()!;
  const job = jobs.get(jobId);
  if (!job) { processing = false; processQueue(); return; }
  job.status = 'processing';
  const jobDir = path.join(config.workDir, job.id);
  fs.mkdirSync(jobDir, { recursive: true });
  try {
    const inputPaths: string[] = [];
    for (let i = 0; i < job.files.length; i++) {
      const p = path.join(jobDir, 'input_' + i + '.mp4');
      console.log('[' + job.id + '] Downloading file ' + i + '...');
      await downloadFile(job.files[i], p);
      inputPaths.push(p);
    }
    const outputPath = path.join(jobDir, 'output.' + job.outputExtension);
    let cmd = job.command;
    cmd = cmd.replace(/\{input\}/g, inputPaths[0]);
    cmd = cmd.replace(/\{output\}/g, outputPath);
    if (config.useNvenc) cmd = cmd.replace(/\blibx264\b/g, 'h264_nvenc');
    if (cmd.startsWith('ffmpeg ')) cmd = config.ffmpegPath + cmd.slice(6);
    console.log('[' + job.id + '] Running: ' + cmd.substring(0, 200) + '...');
    await runFfmpeg(cmd, config.maxJobTimeoutMs, (p) => { job.progress = p; });
    if (!fs.existsSync(outputPath)) throw new Error('No output file');
    job.outputPath = outputPath;
    job.status = 'finished';
    job.progress = 1;
    job.finishedAt = new Date();
    console.log('[' + job.id + '] Finished (' + fs.statSync(outputPath).size + ' bytes)');
  } catch (err: any) {
    job.status = 'failed';
    job.error = err.message || String(err);
    job.finishedAt = new Date();
    console.error('[' + job.id + '] Failed: ' + job.error);
  }
  processing = false;
  processQueue();
}

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (job.finishedAt && now - job.finishedAt.getTime() > config.cleanupAfterMs) {
      const d = path.join(config.workDir, id);
      try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
      jobs.delete(id);
      console.log('[cleanup] Removed ' + id);
    }
  }
}, 60000);
