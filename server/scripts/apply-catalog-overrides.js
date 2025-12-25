import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATEGORIES = {
  OPERATOR: 'Операторское оборудование',
  LIGHT: 'Свет',
  STANDS: 'Стенды (Систенты)',
  CLAMPS: 'Зажимы',
  FROST: 'Фрост рамы',
};

const VALID_CATEGORIES = new Set(Object.values(CATEGORIES));

function toText(value) {
  return String(value ?? '').trim();
}

function normalizeNameKey(value) {
  return toText(value)
    .toLowerCase()
    .replace(/["'“”«»]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\u00A0/g, ' ')
    .trim();
}

function tokenize(key) {
  return new Set(
    normalizeNameKey(key)
      .split(/[^a-z0-9а-яё]+/giu)
      .map((t) => t.trim())
      .filter(Boolean)
  );
}

function jaccard(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function parseArgs(argv) {
  const args = new Set(argv);
  return {
    apply: args.has('--apply'),
    dryRun: args.has('--dry-run') || !args.has('--apply'),
    file:
      argv.find((a) => a.startsWith('--file='))?.slice('--file='.length) ||
      path.join(__dirname, 'catalog-overrides.json'),
  };
}

async function syncProductUnitsForStock(client, productId, stock) {
  const normalizedStock = Number.isFinite(Number(stock)) ? Math.max(0, Math.floor(Number(stock))) : 0;

  if (normalizedStock > 0) {
    await client.query(
      `INSERT INTO product_units (product_id, unit_no, is_active)
       SELECT $1, gs, TRUE
       FROM generate_series(1, $2) gs
       ON CONFLICT (product_id, unit_no)
       DO UPDATE SET is_active = EXCLUDED.is_active`,
      [productId, normalizedStock]
    );
  }

  await client.query(
    `UPDATE product_units
     SET is_active = (unit_no <= $2)
     WHERE product_id = $1`,
    [productId, normalizedStock]
  );
}

function findBestMatch(needle, products) {
  const needleKey = normalizeNameKey(needle);
  if (!needleKey) return null;

  // 1) exact match
  const exact = products.byKey.get(needleKey);
  if (exact) return { product: exact, score: 1, method: 'exact' };

  // 2) contains match (safe only if unique)
  const contains = [];
  for (const p of products.list) {
    const k = p._key;
    if (!k) continue;
    if (k.includes(needleKey) || needleKey.includes(k)) contains.push(p);
  }
  if (contains.length === 1) return { product: contains[0], score: 0.92, method: 'contains' };

  // 3) token similarity (require clear winner)
  let best = null;
  let bestScore = 0;
  let second = 0;
  for (const p of products.list) {
    const score = jaccard(needleKey, p._key);
    if (score > bestScore) {
      second = bestScore;
      bestScore = score;
      best = p;
    } else if (score > second) {
      second = score;
    }
  }

  // Threshold + separation to avoid wrong updates
  if (best && bestScore >= 0.72 && bestScore - second >= 0.12) {
    return { product: best, score: bestScore, method: 'jaccard' };
  }

  return null;
}

async function main() {
  const { apply, dryRun, file } = parseArgs(process.argv.slice(2));

  const databaseUrl = toText(process.env.DATABASE_URL);
  if (!databaseUrl) {
    console.error('Нет DATABASE_URL. Задай переменную окружения Railway Postgres и повтори.');
    process.exit(1);
  }

  const filePath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const overrides = JSON.parse(raw);

  if (!Array.isArray(overrides) || overrides.length === 0) {
    console.error('Файл overrides пустой или неверного формата:', filePath);
    process.exit(1);
  }

  for (const item of overrides) {
    const category = toText(item?.category);
    if (category && !VALID_CATEGORIES.has(category)) {
      console.error('Неизвестная категория в overrides:', category, 'для', item?.name);
      process.exit(1);
    }
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, name, category, stock, price_per_day AS "pricePerDay"
       FROM products
       ORDER BY id ASC`
    );

    const list = result.rows.map((p) => ({ ...p, _key: normalizeNameKey(p.name) }));
    const byKey = new Map();
    for (const p of list) {
      if (!p._key) continue;
      if (!byKey.has(p._key)) byKey.set(p._key, p);
    }

    const products = { list, byKey };

    const planned = [];
    const unmatched = [];

    for (const rule of overrides) {
      const names = [rule?.name, ...(Array.isArray(rule?.aliases) ? rule.aliases : [])]
        .map(toText)
        .filter(Boolean);
      if (names.length === 0) continue;

      let match = null;
      for (const candidateName of names) {
        match = findBestMatch(candidateName, products);
        if (match) break;
      }

      if (!match) {
        unmatched.push({ name: toText(rule?.name), category: toText(rule?.category) });
        continue;
      }

      const nextCategory = toText(rule?.category);
      const nextStockRaw = rule?.stock;
      const nextPriceRaw = rule?.pricePerDay;

      const nextStock = nextStockRaw === undefined || nextStockRaw === null || nextStockRaw === '' ? null : Number(nextStockRaw);
      const nextPrice = nextPriceRaw === undefined || nextPriceRaw === null || nextPriceRaw === '' ? null : Number(nextPriceRaw);

      planned.push({
        id: match.product.id,
        name: match.product.name,
        matchedBy: match.method,
        score: match.score,
        from: {
          category: match.product.category,
          stock: match.product.stock,
          pricePerDay: match.product.pricePerDay,
        },
        to: {
          category: nextCategory || match.product.category,
          stock: nextStock,
          pricePerDay: nextPrice,
        },
      });
    }

    const toUpdate = planned.filter((p) => {
      const categoryChanged = p.to.category && p.to.category !== toText(p.from.category);
      const stockChanged = p.to.stock !== null && Number(p.to.stock) !== Number(p.from.stock);
      const priceChanged = p.to.pricePerDay !== null && Number(p.to.pricePerDay) !== Number(p.from.pricePerDay);
      return categoryChanged || stockChanged || priceChanged;
    });

    console.log(`Найдено товаров в БД: ${list.length}`);
    console.log(`Совпало по overrides: ${planned.length}`);
    console.log(`Будет обновлено: ${toUpdate.length}`);
    console.log(`Не найдено: ${unmatched.length}`);

    if (unmatched.length) {
      console.log('\nНе найдено (проверь названия в БД):');
      for (const u of unmatched.slice(0, 50)) console.log(`- ${u.name} → ${u.category}`);
      if (unmatched.length > 50) console.log(`... и ещё ${unmatched.length - 50}`);
    }

    if (dryRun) {
      console.log('\nDRY RUN: изменения не применены. Чтобы применить: добавь --apply');
      return;
    }

    await client.query('BEGIN');

    for (const row of toUpdate) {
      const updates = [];
      const values = [];
      let i = 1;

      if (row.to.category && row.to.category !== toText(row.from.category)) {
        updates.push(`category = $${i++}`);
        values.push(row.to.category);
      }

      if (row.to.stock !== null && Number(row.to.stock) !== Number(row.from.stock)) {
        updates.push(`stock = $${i++}`);
        values.push(Math.max(0, Math.floor(Number(row.to.stock))));
      }

      if (row.to.pricePerDay !== null && Number(row.to.pricePerDay) !== Number(row.from.pricePerDay)) {
        updates.push(`price_per_day = $${i++}`);
        values.push(Number(row.to.pricePerDay));
      }

      if (updates.length === 0) continue;

      updates.push(`updated_at = NOW()`);
      values.push(row.id);

      await client.query(`UPDATE products SET ${updates.join(', ')} WHERE id = $${i}`, values);

      if (row.to.stock !== null && Number(row.to.stock) !== Number(row.from.stock)) {
        await syncProductUnitsForStock(client, row.id, row.to.stock);
      }
    }

    await client.query('COMMIT');
    console.log('\nГотово: изменения применены.');
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('Ошибка:', e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
