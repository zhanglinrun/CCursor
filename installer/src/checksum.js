/**
 * product.json checksum 更新
 */
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { relative, join } from 'path';
import { createBackup } from './backup.js';

function computeHash(source) {
  return createHash('sha256')
    .update(source)
    .digest('base64')
    .replace(/=+$/, '');
}

export function prepareChecksumUpdate(paths, source, modifiedFiles, log, read = readFileSync) {
  const product = JSON.parse(source);
  if (!product.checksums) {
    log?.('  No checksums in product.json');
    return { source, updated: 0 };
  }

  let updated = 0;
  for (const file of modifiedFiles) {
    const key = relative(join(paths.appRoot, 'out'), file).replace(/\\/g, '/');
    if (product.checksums[key]) {
      product.checksums[key] = computeHash(read(file));
      updated++;
      log?.(`  Checksum: ${key}`);
    }
  }

  return { source: updated > 0 ? JSON.stringify(product, null, 2) + '\n' : source, updated };
}

export function updateChecksums(paths, modifiedFiles, tag, log) {
  const original = readFileSync(paths.productJson, 'utf-8');
  const { source, updated } = prepareChecksumUpdate(paths, original, modifiedFiles, log);
  if (updated > 0) {
    // 备份 product.json (按 tag 作用域,不同 patch 步骤的备份独立存在)
    createBackup(paths.productJson, tag, log);
    writeFileSync(paths.productJson, source);
  }

  return updated;
}
