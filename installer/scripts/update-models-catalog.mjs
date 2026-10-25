// Explicit release-maintenance command, never run by install or extension activation.
// Refreshes the one canonical asset consumed by both builds; no user config is accessed.
import { randomUUID } from 'node:crypto';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const SOURCE = 'https://models.dev/api.json';
const MAX_BYTES = 16 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const asset = fileURLToPath(new URL('../assets/models-catalog.json', import.meta.url));
const tempDir = fileURLToPath(new URL('../../Temp', import.meta.url));
const temporary = join(tempDir, `models-catalog-${randomUUID()}.tmp`);
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const positive = value => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
let body;
try {
  const response = await fetch(SOURCE, {
    headers: { Accept: 'application/json' },
    signal: controller.signal,
    redirect: 'error',
    credentials: 'omit',
  });
  if (!response.ok) throw new Error(`models.dev: HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Catalog exceeds size limit');
  if (!response.body) throw new Error('Catalog response is empty');
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw new Error('Catalog exceeds size limit');
      chunks.push(value);
    }
    body = Buffer.concat(chunks, bytes).toString('utf8');
  } finally {
    void reader.cancel().catch(() => {});
  }
} finally {
  clearTimeout(timer);
  controller.abort();
}

const catalog = JSON.parse(body);
if (!record(catalog)) throw new Error('Catalog must be an object');
let providerCount = 0;
let modelCount = 0;
let rawModelCount = 0;
for (const [key, provider] of Object.entries(catalog)) {
  if (!key.trim() || !record(provider) || !record(provider.models)) continue;
  let count = 0;
  for (const [id, model] of Object.entries(provider.models)) {
    rawModelCount++;
    if (id.trim() && record(model) && record(model.limit) && positive(model.limit.context)
      && (model.limit.output === undefined || positive(model.limit.output))) count++;
  }
  if (count) providerCount++;
  modelCount += count;
}
if (!modelCount) throw new Error('Catalog contains no usable models');
const updatedAt = new Date().toISOString();
const content = JSON.stringify({ version: 1, source: SOURCE, updatedAt, catalog }) + '\n';
if (Buffer.byteLength(content) > MAX_BYTES) throw new Error('Snapshot exceeds size limit');
await mkdir(tempDir, { recursive: true });
try {
  const file = await open(temporary, 'wx', 0o600);
  try {
    await file.writeFile(content, 'utf8');
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(temporary, asset);
} finally {
  await rm(temporary, { force: true });
}
console.log(JSON.stringify({ source: SOURCE, updatedAt, providerCount, modelCount, rawModelCount, bytes: Buffer.byteLength(content), asset }));
