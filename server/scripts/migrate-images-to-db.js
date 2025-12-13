import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// Optional .env support for local dev
try {
  await import('dotenv/config');
} catch {
  // ok
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, '..', '..');
const uploadsDir = path.join(projectRoot, 'uploads');
const inventoryPath = path.join(projectRoot, 'src', 'data', 'inventory.json');
const imagesBaseDir = path.join(projectRoot, 'src', 'images');

function extToMime(ext) {
  switch (String(ext || '').toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function isAlreadyDbUrl(value) {
  const v = String(value || '').trim();
  return v.includes('/api/images/');
}

function normalizeUploadFilenameFromUrl(url) {
  const value = String(url || '').trim();
  const index = value.lastIndexOf('/uploads/');
  if (index === -1) return null;
  const part = value.slice(index + '/uploads/'.length);
  const filename = part.split('?')[0].split('#')[0];
  return filename ? decodeURIComponent(filename) : null;
}

async function ensureDbReady(pool) {
  // init schema if needed
  const initSqlPath = path.join(projectRoot, 'server', 'init.sql');
  const sql = await fs.readFile(initSqlPath, 'utf8');
  await pool.query(sql);
}

async function insertImage(pool, { filename, mimeType, buffer }) {
  const inserted = await pool.query(
    `INSERT INTO images (filename, mime_type, data)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [filename ?? null, mimeType || 'application/octet-stream', buffer]
  );
  return inserted.rows[0].id;
}

async function updateProductImageUrl(pool, productId, url) {
  await pool.query(
    `UPDATE products
     SET image_url = $1, updated_at = NOW()
     WHERE id = $2`,
    [url, productId]
  );
}

async function updateProductImageUrlByName(pool, name, url) {
  await pool.query(
    `UPDATE products
     SET image_url = $1, updated_at = NOW()
     WHERE name = $2`,
    [url, name]
  );
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Aborting.');
    process.exitCode = 1;
    return;
  }

  const pool = new pg.Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  const cacheBySource = new Map();

  let insertedCount = 0;
  let updatedFromInventoryCount = 0;
  let migratedExistingCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    await ensureDbReady(pool);

    // 1) Import bundled catalog images (src/images/*) and attach to products by name
    let inventory = [];
    try {
      const raw = await fs.readFile(inventoryPath, 'utf8');
      const parsed = JSON.parse(raw);
      inventory = Array.isArray(parsed) ? parsed : [];
    } catch {
      inventory = [];
    }

    for (const item of inventory) {
      const name = String(item?.name || '').trim();
      const relImage = String(item?.image || '').trim();
      if (!name || !relImage) continue;

      const filePath = path.join(imagesBaseDir, relImage);
      let buffer;
      try {
        buffer = await fs.readFile(filePath);
      } catch {
        continue;
      }

      const sourceKey = `file:${filePath}`;
      let imageId = cacheBySource.get(sourceKey);
      if (!imageId) {
        const mimeType = extToMime(path.extname(filePath));
        imageId = await insertImage(pool, {
          filename: path.basename(filePath),
          mimeType,
          buffer,
        });
        cacheBySource.set(sourceKey, imageId);
        insertedCount += 1;
      }

      const url = `/api/images/${imageId}`;
      await updateProductImageUrlByName(pool, name, url);
      updatedFromInventoryCount += 1;
    }

    // 2) Migrate any existing product image_url into DB images and rewrite to /api/images/:id
    const products = await pool.query(
      `SELECT id, image_url AS "imageUrl"
       FROM products
       WHERE image_url IS NOT NULL AND image_url <> ''`
    );

    for (const row of products.rows) {
      const productId = row.id;
      const imageUrl = String(row.imageUrl || '').trim();
      if (!imageUrl) continue;
      if (isAlreadyDbUrl(imageUrl)) {
        skippedCount += 1;
        continue;
      }

      try {
        const cached = cacheBySource.get(`url:${imageUrl}`);
        if (cached) {
          await updateProductImageUrl(pool, productId, `/api/images/${cached}`);
          migratedExistingCount += 1;
          continue;
        }

        let buffer = null;
        let mimeType = null;
        let filename = null;

        const uploadFilename = normalizeUploadFilenameFromUrl(imageUrl);
        if (uploadFilename) {
          const fullPath = path.join(uploadsDir, uploadFilename);
          buffer = await fs.readFile(fullPath);
          filename = uploadFilename;
          mimeType = extToMime(path.extname(uploadFilename));
        } else if (/^https?:\/\//i.test(imageUrl)) {
          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
          mimeType = response.headers.get('content-type') || null;
          try {
            const url = new URL(imageUrl);
            filename = path.basename(url.pathname);
          } catch {
            filename = null;
          }
          if (!mimeType) mimeType = extToMime(path.extname(filename || ''));
        } else {
          // Attempt to resolve relative paths like 'catalog/image1.jpeg'
          const candidate = path.join(imagesBaseDir, imageUrl.replace(/^\//, ''));
          buffer = await fs.readFile(candidate);
          filename = path.basename(candidate);
          mimeType = extToMime(path.extname(candidate));
        }

        if (!buffer || !buffer.length) {
          skippedCount += 1;
          continue;
        }

        const imageId = await insertImage(pool, { filename, mimeType, buffer });
        cacheBySource.set(`url:${imageUrl}`, imageId);
        insertedCount += 1;

        await updateProductImageUrl(pool, productId, `/api/images/${imageId}`);
        migratedExistingCount += 1;
      } catch (e) {
        errorCount += 1;
        console.error(`Failed to migrate product ${productId} image (${imageUrl}):`, e?.message || e);
      }
    }

    console.log('Done.');
    console.log(
      JSON.stringify(
        {
          insertedImages: insertedCount,
          updatedFromInventory: updatedFromInventoryCount,
          migratedExistingProducts: migratedExistingCount,
          skipped: skippedCount,
          errors: errorCount,
        },
        null,
        2
      )
    );
  } finally {
    await pool.end().catch(() => undefined);
  }
}

await main();
