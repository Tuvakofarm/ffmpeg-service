import Fastify from 'fastify';
import * as fs from 'fs';
import { config } from './config';
import { createJob, getJob, getJobOutputPath } from './jobs';

const app = Fastify({ logger: true });

app.addHook('onRequest', async (request, reply) => {
  if (request.url === '/health') return;
  const authHeader = request.headers.authorization;
  if (!authHeader) { reply.code(401).send({ error: 'Missing Authorization header' }); return; }
  const key = authHeader.replace(/^Apikey\s+/i, '').trim();
  if (key !== config.apiKey) { reply.code(403).send({ error: 'Invalid API key' }); return; }
});

app.get('/health', async () => ({ status: 'ok', nvenc: config.useNvenc, ffmpeg: config.ffmpegPath }));

app.post('/jobs', async (request) => {
  const body = request.body as any;
  if (!body?.files?.length || !body?.command) return { error: 'files and command required' };
  const job = createJob(body.files, body.command, body.output_extension || 'mp4');
  return { job_id: job.id, status: job.status };
});

app.post('/jobs/upload', async (request) => {
  const body = request.body as any;
  if (!body?.files?.length) return { error: 'files required' };
  const command = body.full_command || body.command;
  if (!command) return { error: 'full_command or command required' };
  const job = createJob(body.files, command, body.output_extension || 'mp4');
  return { job_id: job.id, status: job.status };
});

app.get('/jobs/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const job = getJob(id);
  if (!job) { reply.code(404).send({ error: 'Job not found' }); return; }
  return { job_id: job.id, status: job.status, progress: job.progress, error: job.error,
    created_at: job.createdAt.toISOString(), ended_at: job.finishedAt?.toISOString() || null };
});

app.get('/jobs/:id/download', async (request, reply) => {
  const { id } = request.params as { id: string };
  const p = getJobOutputPath(id);
  if (!p || !fs.existsSync(p)) { reply.code(404).send({ error: 'Output not found' }); return; }
  const buffer = fs.readFileSync(p);
  reply.header('content-type', 'video/mp4');
  reply.header('content-length', buffer.length);
  reply.send(buffer);
});

app.listen({ port: config.port, host: '0.0.0.0' }, (err, address) => {
  if (err) { console.error('Failed:', err); process.exit(1); }
  console.log('FFmpeg service on ' + address + ' | NVENC: ' + config.useNvenc);
});
