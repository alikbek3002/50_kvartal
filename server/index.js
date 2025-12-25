import express from 'express';
import multer from 'multer';
import cors from 'cors';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

// Optional .env support for local dev
try {
  await import('dotenv/config');
} catch {
  // ok: dotenv isn't required on Railway
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Default to DB storage for images (override with IMAGE_STORAGE=fs if ever needed)
const IMAGE_STORAGE = String(process.env.IMAGE_STORAGE || 'db').toLowerCase();

// Railway/Reverse proxy (нужно для корректного req.protocol при HTTPS)
app.set('trust proxy', 1);

// Настройка CORS
// If CORS_ORIGINS is set (comma-separated list), only allow those origins.
// Otherwise allow all origins (safe for public read-only endpoints; admin endpoints still require token).
const corsOriginsRaw = String(process.env.CORS_ORIGINS || '').trim();
const corsAllowedOrigins = corsOriginsRaw
  ? corsOriginsRaw.split(',').map((s) => s.trim()).filter(Boolean)
  : null;

app.use(
  cors({
    origin(origin, callback) {
      // allow non-browser requests (no Origin header)
      if (!origin) return callback(null, true);
      if (!corsAllowedOrigins) return callback(null, true);
      return callback(null, corsAllowedOrigins.includes(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })
);
app.use(express.json());

// Создаем папку для загрузок если её нет (нужно только для IMAGE_STORAGE=fs)
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function imageFileFilter(req, file, cb) {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Только изображения разрешены!'));
}

const uploadFs = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFileFilter,
});

const uploadDb = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFileFilter,
});

const MAIN_CATEGORY_OPERATOR = 'Операторское оборудование';
const MAIN_CATEGORY_LIGHT = 'Свет';
const MAIN_CATEGORY_GRIP = 'Грип и крепёж';

const YELLOW_SUBCATEGORY_STANDS = 'Стенды (Систенты)';
const YELLOW_SUBCATEGORY_CLAMPS = 'Зажимы';
const YELLOW_SUBCATEGORY_FROST_FRAMES = 'Фрост рамы';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeNameKey(value) {
  return normalizeKey(value)
    .replace(/["'“”«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const YELLOW_STANDS_KEYS = new Set(
  [
    'Kupo Master High Cine Stand 543M (A100)',
    'Kupo C-Stand 40',
    'Kupo C-Stand 20',
    'Kupo Autopole 1 - 1.70m',
    'Kupo Autopole 2.10m',
    'Kupo KCP-636B Big Boom (журавль/выносная штанга)',
    // Variants in current catalog/DB
    'Kupo KCP-636B Big Boom',
    'Kupo CT-20M 20 inc h C-Stand (KUP-CT-20M)',
    'Распорка автополе Kupo KP-S1017PD Kupole',
    'Avenger A100',
  ].map(normalizeNameKey)
);

const YELLOW_CLAMPS_KEYS = new Set(
  [
    'Kupo 4in Super Viser Clamp End Jaw',
    'Kupo Super Clamp',
    'Kupo Grip Head',
    // Variant in current catalog/DB
    'Super Viser Clamp End Jaw 2"',
    'Super Viser Clamp End Jaw 2',
  ].map(normalizeNameKey)
);

const YELLOW_FROST_FRAMES_KEYS = new Set(
  [
    'Купо Butterfly Рама 8x8 (включая Silk 1.6, Grid Cloth 1/4, 1/8, Black & Silver)',
    'Kupo Butterfly Рама 8x8 (включая Silk 1.6, Grid Cloth 1/4, 1/8, Black & Silver)',
    'Фростовая рама 100x100 (216) (250)',
    'Флаг Floppy Cutter 100x100',
    'Фростовая рама 60x60 (250)',
    'Флаг Floppy Cutter 60x60',
    // Variants in current catalog/DB
    "Рама 12'x12' Modular Frame Manfrotto H1200M",
    "Avenger Двойное Полотно I920BDN 12х12' (360х360см) black",
    "Avenger I920SDL Полотно для флага 12х12' (360х360см)",
    "Grip Текстиль 6'x6' BB COTON Т 6-BB-C",
  ].map(normalizeNameKey)
);

function deriveCategoryMeta(product) {
  const rawCategory = normalizeKey(product?.category);
  const nameKey = normalizeNameKey(product?.name);

  if (!rawCategory) {
    return { mainCategory: null, subCategory: null, color: null };
  }

  // If category is already one of the 3 main categories (admin uses a static select), accept as-is.
  if (rawCategory === normalizeKey(MAIN_CATEGORY_OPERATOR)) {
    return { mainCategory: MAIN_CATEGORY_OPERATOR, subCategory: null, color: 'green' };
  }
  if (rawCategory === normalizeKey(MAIN_CATEGORY_LIGHT)) {
    return { mainCategory: MAIN_CATEGORY_LIGHT, subCategory: null, color: 'blue' };
  }
  // For MAIN_CATEGORY_GRIP we still compute yellow subCategory below.

  // Strict mapping by DB category → 3 main categories.
  if (rawCategory === 'освещение') {
    return { mainCategory: MAIN_CATEGORY_LIGHT, subCategory: null, color: 'blue' };
  }

  if (rawCategory === 'мониторы и контроль') {
    return { mainCategory: MAIN_CATEGORY_OPERATOR, subCategory: null, color: 'green' };
  }

  if (rawCategory === 'грип и крепёж' || rawCategory === 'модификаторы и текстиль') {
    const mainCategory = MAIN_CATEGORY_GRIP;

    // Textiles/modifiers in this project belong to yellow frost frames.
    if (rawCategory === 'модификаторы и текстиль') {
      return { mainCategory, subCategory: YELLOW_SUBCATEGORY_FROST_FRAMES, color: 'yellow' };
    }

    if (YELLOW_CLAMPS_KEYS.has(nameKey)) {
      return { mainCategory, subCategory: YELLOW_SUBCATEGORY_CLAMPS, color: 'yellow' };
    }

    if (YELLOW_FROST_FRAMES_KEYS.has(nameKey)) {
      return { mainCategory, subCategory: YELLOW_SUBCATEGORY_FROST_FRAMES, color: 'yellow' };
    }

    if (YELLOW_STANDS_KEYS.has(nameKey)) {
      return { mainCategory, subCategory: YELLOW_SUBCATEGORY_STANDS, color: 'yellow' };
    }

    return { mainCategory, subCategory: YELLOW_SUBCATEGORY_STANDS, color: 'yellow' };
  }

  // Fallback
  return { mainCategory: null, subCategory: null, color: null };
}

function uploadImageMiddleware(req, res, next) {
  const mw = IMAGE_STORAGE === 'db' ? uploadDb.single('image') : uploadFs.single('image');
  return mw(req, res, next);
}

// Подключение к PostgreSQL
const hasDbConfig = Boolean((process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) || process.env.PGHOST);
const requireDb = process.env.REQUIRE_DB
  ? String(process.env.REQUIRE_DB).toLowerCase() === 'true'
  : process.env.NODE_ENV === 'production';

const pool = hasDbConfig
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : null;

let dbReady = false;
let dbInitError = null;

function normalizeImageUrls(value, fallbackSingle) {
  const pushUrl = (list, url) => {
    const cleaned = typeof url === 'string' ? url.trim() : '';
    if (!cleaned) return;
    list.push(cleaned);
  };

  const urls = [];
  if (Array.isArray(value)) {
    for (const v of value) pushUrl(urls, v);
  } else if (typeof value === 'string' && value.trim()) {
    const raw = value.trim();
    // Try JSON first
    if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('"') && raw.endsWith('"'))) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const v of parsed) pushUrl(urls, v);
        } else {
          pushUrl(urls, parsed);
        }
      } catch {
        // fall back to split
        for (const v of raw.split(/[\n,]+/g)) pushUrl(urls, v);
      }
    } else {
      for (const v of raw.split(/[\n,]+/g)) pushUrl(urls, v);
    }
  } else if (value && typeof value === 'object') {
    // If a JSON object was passed by mistake, ignore.
  }

  if (urls.length === 0) {
    pushUrl(urls, fallbackSingle);
  }

  // De-dup preserving order and cap to a reasonable number.
  const seen = new Set();
  const unique = [];
  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    unique.push(u);
    if (unique.length >= 12) break;
  }
  return unique;
}

async function initDb() {
  if (!pool) {
    throw new Error('DATABASE_URL is not set (DB is not configured)');
  }
  const initSqlPath = path.join(__dirname, 'init.sql');
  const sql = fs.readFileSync(initSqlPath, 'utf8');
  await pool.query(sql);
}

async function startDb() {
  if (!hasDbConfig) {
    dbInitError = new Error('DATABASE_URL is not set');
    console.warn('DB disabled: DATABASE_URL is not set. Set it in env or server/.env. Products/admin API will return 503 until configured.');
    return;
  }

  try {
    await initDb();
    dbReady = true;
    dbInitError = null;
    console.log('DB ready');
  } catch (error) {
    dbInitError = error;
    console.error('DB init failed:', error);
    if (requireDb) {
      process.exit(1);
    }
  }
}

function requireDbReady(req, res, next) {
  if (!pool) {
    return res.status(503).json({ error: 'DB is not configured (DATABASE_URL is missing)' });
  }
  if (!dbReady) {
    return res.status(503).json({ error: 'DB is not ready yet' });
  }
  next();
}

function requireAdmin(req, res, next) {
  const adminToken = getEffectiveAdminToken();
  if (!adminToken) return next();

  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (token !== adminToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

function getEffectiveAdminToken() {
  const direct = String(process.env.ADMIN_TOKEN || '').trim();
  if (direct) return direct;

  // DX fallback: if ADMIN_USERNAME/PASSWORD are set but ADMIN_TOKEN is missing,
  // derive a stable token from them so the admin panel can still work.
  const username = String(process.env.ADMIN_USERNAME || '').trim();
  const password = String(process.env.ADMIN_PASSWORD || '').trim();
  if (!username || !password) return null;

  return crypto.createHash('sha256').update(`${username}:${password}`).digest('hex');
}

function safeTimingEqual(a, b) {
  const left = Buffer.from(String(a ?? ''), 'utf8');
  const right = Buffer.from(String(b ?? ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    const configuredUsername = process.env.ADMIN_USERNAME;
    const configuredPassword = process.env.ADMIN_PASSWORD;
    const adminToken = getEffectiveAdminToken();

    if (!configuredUsername || !configuredPassword) {
      return res.status(500).json({ error: 'Admin auth is not configured (ADMIN_USERNAME/ADMIN_PASSWORD missing)' });
    }

    if (!adminToken) {
      return res.status(500).json({ error: 'Admin auth is not configured (ADMIN_TOKEN missing)' });
    }

    const usernameOk = safeTimingEqual(username, configuredUsername);
    const passwordOk = safeTimingEqual(password, configuredPassword);

    if (!usernameOk || !passwordOk) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    return res.json({ token: adminToken });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/admin/products', requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: 'DB is not configured (DATABASE_URL is missing)' });
    }
    if (!dbReady) {
      return res.status(503).json({ error: 'DB is not ready yet' });
    }
    const result = await pool.query(
      `SELECT
        p.id,
        p.name,
        p.description,
        p.category,
        p.brand,
        p.stock,
        p.image_url AS "imageUrl",
        p.image_urls AS "imageUrls",
        p.price_per_day AS "pricePerDay",
        p.equipment AS "equipment",
        p.specs AS "specs",
        p.is_active AS "isActive",
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt",
        COALESCE(s.total_units, 0) AS "totalUnits",
        COALESCE(s.busy_units_now, 0) AS "busyUnitsNow",
        GREATEST(0, COALESCE(s.total_units, 0) - COALESCE(s.busy_units_now, 0)) AS "availableNow",
        s.next_available_at AS "nextAvailableAt"
      FROM products p
      LEFT JOIN LATERAL (
        SELECT
          (
            SELECT COUNT(*)
            FROM product_units u
            WHERE u.product_id = p.id AND u.is_active = TRUE
          ) AS total_units,
          (
            SELECT COUNT(DISTINCT b.unit_id)
            FROM bookings b
            JOIN product_units u ON u.id = b.unit_id AND u.is_active = TRUE
            WHERE b.product_id = p.id
              AND b.start_at <= NOW()
              AND b.end_at > NOW()
          ) AS busy_units_now,
          (
            SELECT MIN(b.end_at)
            FROM bookings b
            JOIN product_units u ON u.id = b.unit_id AND u.is_active = TRUE
            WHERE b.product_id = p.id
              AND b.start_at <= NOW()
              AND b.end_at > NOW()
          ) AS next_available_at
      ) s ON TRUE
      ORDER BY p.created_at DESC`
    );

    const enriched = result.rows.map((row) => {
      const meta = deriveCategoryMeta(row);
      return {
        ...row,
        mainCategory: meta.mainCategory,
        subCategory: meta.subCategory,
        categoryColor: meta.color,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Ошибка получения товаров (admin):', error);
    res.status(500).json({ error: 'Ошибка при получении товаров' });
  }
});

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

async function ensureProductUnits(client, productId) {
  const row = await client.query(`SELECT stock FROM products WHERE id = $1`, [productId]);
  if (!row.rowCount) return;
  await syncProductUnitsForStock(client, productId, row.rows[0].stock);
}

const SEED_PRODUCTS = [
  { name: 'Super Viser Clamp End Jaw 2"', description: null, category: 'Грип и крепёж', brand: null, stock: 1, pricePerDay: 100, imageUrl: null, isActive: true },
  { name: 'Kupo KCP-636B Big Boom', description: null, category: 'Грип и крепёж', brand: 'Kupo', stock: 1, pricePerDay: 100, imageUrl: null, isActive: true },
  { name: 'Atomos NEON 17" 4 K HDR монитор / рекордер', description: null, category: 'Мониторы и контроль', brand: 'Atomos', stock: 1, pricePerDay: 100, imageUrl: null, isActive: true },
  { name: 'Набор ламп Aputure Accent B7C 8-Light Kit', description: null, category: 'Освещение', brand: 'Aputure', stock: 1, pricePerDay: 100, imageUrl: null, isActive: true },
  { name: 'Aputure Light Storm LS 600c Pro LED lamp - V-mount', description: null, category: 'Освещение', brand: 'Aputure', stock: 1, pricePerDay: 100, imageUrl: null, isActive: true },
  { name: 'Kupo CT-20M 20 inc h C-Stand (KUP-CT-20M)', description: null, category: 'Грип и крепёж', brand: 'Kupo', stock: 1, pricePerDay: 100, imageUrl: null, isActive: true },
  { name: 'Портативный свет Aputure MC RGB', description: null, category: 'Освещение', brand: 'Aputure', stock: 1, pricePerDay: 100, imageUrl: null, isActive: true },
  { name: 'Осветитель Aputure Storm 1200x Линза', description: null, category: 'Освещение', brand: 'Aputure', stock: 1, pricePerDay: 100, imageUrl: null, isActive: true },
  { name: 'Френеля Aputure F10 Fresnel Flashpoint', description: null, category: 'Модификаторы и текстиль', brand: 'Aputure', stock: 1, pricePerDay: 100, imageUrl: null, isActive: true },
  { name: 'Avenger A100', description: null, category: 'Грип и крепёж', brand: 'Avenger', stock: 1, pricePerDay: 100, imageUrl: null, isActive: true },
  { name: 'Штатив E- Image EG15A', description: null, category: 'Грип и крепёж', brand: null, stock: 1, pricePerDay: 100, imageUrl: null, isActive: true },
  { name: 'кронштейн Автогрип E-Image EI-A40', description: null, category: 'Грип и крепёж', brand: 'E-Image', stock: 1, pricePerDay: 100, imageUrl: null, isActive: true },
  { name: 'KUPO присоска KSC-06', description: null, category: 'Грип и крепёж', brand: 'Kupo', stock: 1, pricePerDay: 100, imageUrl: null, isActive: true },
  { name: 'Aputure Nova P300C RGBWW LED (70% brighter than Skypanel S30-c)', description: null, category: 'Освещение', brand: 'Aputure', stock: 1, pricePerDay: 100, imageUrl: null, isActive: true },
  { name: 'Aputure amaran F22c 2 x 2\'\' RGB LED Flexible Light Mat (V-Mount),', description: null, category: 'Освещение', brand: 'Aputure', stock: 1, pricePerDay: 100, imageUrl: null, isActive: true },
  { name: 'Распорка автополе Kupo KP-S1017PD Kupole', description: null, category: 'Грип и крепёж', brand: 'Kupo', stock: 1, pricePerDay: 100, imageUrl: null, isActive: true },
  { name: 'Рама 12\'\'x12\'\' Modular Frame Manfrotto H1200M', description: null, category: 'Модификаторы и текстиль', brand: 'Manfrotto', stock: 1, pricePerDay: 100, imageUrl: null, isActive: true },
  { name: 'Avenger Двойное Полотно I920BDN 12х12\'\' (360х360см) black', description: null, category: 'Модификаторы и текстиль', brand: 'Avenger', stock: 1, pricePerDay: 100, imageUrl: null, isActive: true },
  { name: 'Avenger I920SDL Полотно для флага 12х12\'\' (360х360см)', description: null, category: 'Модификаторы и текстиль', brand: 'Avenger', stock: 1, pricePerDay: 100, imageUrl: null, isActive: true },
  { name: 'Grip Текстиль 6\'\'x6\'\' BB COTON Т 6-BB-C', description: null, category: 'Модификаторы и текстиль', brand: 'Grip Textile', stock: 1, pricePerDay: 100, imageUrl: null, isActive: true },
];

async function restoreSeedCatalog(client) {
  let inserted = 0;
  let updated = 0;

  // Ensure schema pieces exist (safe to run multiple times)
  await client.query(
    `CREATE TABLE IF NOT EXISTS product_units (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      unit_no INTEGER NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(product_id, unit_no)
    )`
  );
  await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS unit_id INTEGER`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_product_units_product_id ON product_units(product_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_bookings_unit_id ON bookings(unit_id)`);

  // Restore products by name (insert if missing; update key fields if exists)
  for (const p of SEED_PRODUCTS) {
    const existing = await client.query(`SELECT id FROM products WHERE name = $1 ORDER BY id ASC LIMIT 1`, [p.name]);
    if (!existing.rowCount) {
      const created = await client.query(
        `INSERT INTO products (name, description, category, brand, stock, price_per_day, image_url, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [p.name, p.description, p.category, p.brand, p.stock, p.pricePerDay, p.imageUrl, p.isActive]
      );
      inserted += 1;
      await syncProductUnitsForStock(client, created.rows[0].id, p.stock);
      continue;
    }

    const productId = existing.rows[0].id;
    await client.query(
      `UPDATE products
       SET
         category = $2,
         brand = $3,
         stock = $4,
         price_per_day = $5,
         is_active = TRUE,
         updated_at = NOW()
       WHERE id = $1`,
      [productId, p.category, p.brand, p.stock, p.pricePerDay]
    );
    updated += 1;
    await syncProductUnitsForStock(client, productId, p.stock);
  }

  return { inserted, updated };
}

function coalesceItemsByPeriod(items) {
  const map = new Map();
  for (const it of items) {
    const key = `${it.productId}|${it.startAt}|${it.endAt}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...it });
    } else {
      prev.quantity += it.quantity;
    }
  }
  return Array.from(map.values());
}

async function findFreeUnitIdsForPeriod(client, productId, startAtIso, endAtIso, { lock = false } = {}) {
  const result = await client.query(
    `SELECT u.id
     FROM product_units u
     WHERE u.product_id = $1
       AND u.is_active = TRUE
       AND NOT EXISTS (
         SELECT 1
         FROM bookings b
         WHERE b.product_id = $1
           AND (b.unit_id = u.id OR b.unit_id IS NULL)
           AND NOT ($3 <= b.start_at OR $2 >= b.end_at)
       )
     ORDER BY u.unit_no ASC
     ${lock ? 'FOR UPDATE' : ''}`,
    [productId, startAtIso, endAtIso]
  );
  return result.rows.map((r) => r.id);
}

async function getActiveUnitsCount(client, productId) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM product_units
     WHERE product_id = $1 AND is_active = TRUE`,
    [productId]
  );
  return result.rows?.[0]?.count ?? 0;
}

async function checkCapacity(client, items) {
  for (const it of items) {
    const total = await getActiveUnitsCount(client, it.productId);
    if (total <= 0) {
      return { ok: false, productId: it.productId, available: 0, total: 0 };
    }
    const freeUnitIds = await findFreeUnitIdsForPeriod(client, it.productId, it.startAt, it.endAt);
    if (freeUnitIds.length < it.quantity) {
      return { ok: false, productId: it.productId, available: freeUnitIds.length, total };
    }
  }
  return { ok: true };
}

async function allocateUnitIdsForBooking(client, { productId, startAt, endAt, quantity }) {
  await ensureProductUnits(client, productId);
  const total = await getActiveUnitsCount(client, productId);
  if (total <= 0) return { ok: false, available: 0, total: 0, unitIds: [] };

  const freeUnitIds = await findFreeUnitIdsForPeriod(client, productId, startAt, endAt, { lock: true });
  if (freeUnitIds.length < quantity) {
    return { ok: false, available: freeUnitIds.length, total, unitIds: [] };
  }
  return { ok: true, available: freeUnitIds.length, total, unitIds: freeUnitIds.slice(0, quantity) };
}

// Раздача статических файлов
app.use('/uploads', express.static(uploadsDir));

// Отдача картинок из БД
app.get('/api/images/:id', requireDbReady, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, mime_type, data
       FROM images
       WHERE id = $1`,
      [id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const row = result.rows[0];
    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(row.data);
  } catch (error) {
    console.error('Ошибка отдачи картинки:', error);
    return res.status(500).json({ error: 'Ошибка при отдаче картинки' });
  }
});

// Admin: восстановить первоначальные товары (seed) и синхронизировать единицы по stock
app.post('/api/admin/catalog/restore', requireAdmin, requireDbReady, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await restoreSeedCatalog(client);
    await client.query('COMMIT');
    return res.json({ success: true, ...result });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('Ошибка восстановления каталога:', error);
    return res.status(500).json({ error: 'Ошибка восстановления каталога' });
  } finally {
    client.release();
  }
});

// Admin: hide "seed" products that were auto-inserted by init.sql
// This fixes the common situation when a curated catalog already exists, but seed products keep appearing after redeploys.
app.post('/api/admin/catalog/cleanup-seed', requireAdmin, requireDbReady, async (req, res) => {
  const client = await pool.connect();
  try {
    const seedNames = SEED_PRODUCTS.map((p) => p.name);

    await client.query('BEGIN');

    // Deactivate only products that look like default seed:
    // - name in seed list
    // - no images stored (image_url + image_urls empty)
    // This reduces risk of hiding a real curated product that happens to share a name.
    const updated = await client.query(
      `UPDATE products
       SET is_active = FALSE, updated_at = NOW()
       WHERE is_active = TRUE
         AND name = ANY($1::text[])
         AND COALESCE(NULLIF(trim(image_url), ''), '') = ''
         AND image_urls IS NULL
       RETURNING id`,
      [seedNames]
    );

    const activeCount = await client.query(`SELECT COUNT(*)::int AS count FROM products WHERE is_active = TRUE`);
    await client.query('COMMIT');

    return res.json({
      success: true,
      deactivated: updated.rowCount || 0,
      activeNow: activeCount.rows?.[0]?.count ?? 0,
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('Ошибка очистки seed каталога:', error);
    return res.status(500).json({ error: 'Ошибка очистки каталога' });
  } finally {
    client.release();
  }
});

// API для загрузки изображения
app.post('/api/upload', requireAdmin, uploadImageMiddleware, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    if (IMAGE_STORAGE === 'db') {
      if (!pool || !dbReady) {
        return res.status(503).json({ error: 'DB is not ready for image uploads' });
      }

      const originalName = req.file.originalname || null;
      const mimeType = req.file.mimetype || 'application/octet-stream';
      const buffer = req.file.buffer;
      if (!buffer || !buffer.length) {
        return res.status(400).json({ error: 'Пустой файл' });
      }

      const inserted = await pool.query(
        `INSERT INTO images (filename, mime_type, data)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [originalName, mimeType, buffer]
      );

      const id = inserted.rows[0].id;
      const imageUrl = `${req.protocol}://${req.get('host')}/api/images/${id}`;
      return res.json({ success: true, url: imageUrl, id });
    }

    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    return res.json({
      success: true,
      url: imageUrl,
      filename: req.file.filename,
    });
  } catch (error) {
    console.error('Ошибка загрузки:', error);
    res.status(500).json({ error: 'Ошибка при загрузке файла' });
  }
});

// API для добавления товара
app.post('/api/products', requireAdmin, async (req, res) => {
  const client = pool ? await pool.connect() : null;
  try {
    if (!pool || !client) {
      return res.status(503).json({ error: 'DB is not configured (DATABASE_URL is missing)' });
    }
    if (!dbReady) {
      return res.status(503).json({ error: 'DB is not ready yet' });
    }
    const {
      name,
      description,
      category,
      brand,
      stock,
      image_url,
      imageUrl,
      image_urls,
      imageUrls,
      price_per_day,
      pricePerDay,
      price,
      equipment,
      specs,
      is_active,
      isActive,
    } = req.body;

    const resolvedImageUrl = image_url ?? imageUrl ?? null;
    const resolvedImageUrls = normalizeImageUrls(image_urls ?? imageUrls, resolvedImageUrl);
    const imageUrlPrimary = resolvedImageUrls[0] ?? resolvedImageUrl ?? null;
    // На UPDATE не затираем цену дефолтом 100, если поле не передали.
    const resolvedPricePerDay = price_per_day ?? pricePerDay ?? price;
    const resolvedStock = stock ?? 0;
    const resolvedIsActive = is_active ?? isActive ?? true;
    const resolvedEquipment = Array.isArray(equipment) ? equipment : null;
    const resolvedSpecs = specs && typeof specs === 'object' ? specs : null;
    
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO products (name, description, category, brand, stock, image_url, image_urls, price_per_day, equipment, specs, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10::jsonb, $11)
       RETURNING *`,
      [
        name,
        description ?? null,
        category ?? null,
        brand ?? null,
        resolvedStock,
        imageUrlPrimary,
        JSON.stringify(resolvedImageUrls),
        resolvedPricePerDay,
        resolvedEquipment ? JSON.stringify(resolvedEquipment) : null,
        resolvedSpecs ? JSON.stringify(resolvedSpecs) : null,
        Boolean(resolvedIsActive),
      ]
    );

    await syncProductUnitsForStock(client, result.rows[0].id, resolvedStock);
    await client.query('COMMIT');
    
    res.json({ success: true, product: result.rows[0] });
  } catch (error) {
    try {
      await client?.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('Ошибка создания товара:', error);
    res.status(500).json({ error: 'Ошибка при создании товара' });
  } finally {
    client?.release();
  }
});

// API для получения всех товаров
app.get('/api/products', async (req, res) => {
  try {
    if (!pool || !dbReady) {
      return res.status(503).json({
        error: 'maintenance',
        message: 'Ведутся технические работы',
      });
    }
    const result = await pool.query(
      `SELECT
        p.id,
        p.name,
        p.description,
        p.category,
        p.brand,
        p.stock,
        p.image_url AS "imageUrl",
        p.image_urls AS "imageUrls",
        p.price_per_day AS "pricePerDay",
        p.equipment AS "equipment",
        p.specs AS "specs",
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt",
        COALESCE(s.total_units, 0) AS "totalUnits",
        COALESCE(s.busy_units_now, 0) AS "busyUnitsNow",
        GREATEST(0, COALESCE(s.total_units, 0) - COALESCE(s.busy_units_now, 0)) AS "availableNow",
        s.next_available_at AS "nextAvailableAt"
      FROM products p
      LEFT JOIN LATERAL (
        SELECT
          (
            SELECT COUNT(*)
            FROM product_units u
            WHERE u.product_id = p.id AND u.is_active = TRUE
          ) AS total_units,
          (
            SELECT COUNT(DISTINCT b.unit_id)
            FROM bookings b
            JOIN product_units u ON u.id = b.unit_id AND u.is_active = TRUE
            WHERE b.product_id = p.id
              AND b.start_at <= NOW()
              AND b.end_at > NOW()
          ) AS busy_units_now,
          (
            SELECT MIN(b.end_at)
            FROM bookings b
            JOIN product_units u ON u.id = b.unit_id AND u.is_active = TRUE
            WHERE b.product_id = p.id
              AND b.start_at <= NOW()
              AND b.end_at > NOW()
          ) AS next_available_at
      ) s ON TRUE
      WHERE p.is_active = TRUE
      ORDER BY p.created_at DESC`
    );

    const enriched = result.rows.map((row) => {
      const meta = deriveCategoryMeta(row);
      return {
        ...row,
        mainCategory: meta.mainCategory,
        subCategory: meta.subCategory,
        categoryColor: meta.color,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Ошибка получения товаров:', error);
    res.status(503).json({
      error: 'maintenance',
      message: 'Ведутся технические работы',
    });
  }
});

// Public: availability for a product in a given period (quantity-based booking support)
// Returns how many active units are free for [startAt, endAt).
app.get('/api/availability', requireDbReady, async (req, res) => {
  try {
    const productId = Number(req.query?.productId);
    const startAtRaw = String(req.query?.startAt || '').trim();
    const endAtRaw = String(req.query?.endAt || '').trim();

    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ error: 'productId is required' });
    }
    if (!startAtRaw || !endAtRaw) {
      return res.status(400).json({ error: 'startAt and endAt are required' });
    }

    const start = new Date(startAtRaw);
    const end = new Date(endAtRaw);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid startAt/endAt' });
    }
    if (end.getTime() <= start.getTime()) {
      return res.status(400).json({ error: 'endAt must be after startAt' });
    }

    const client = await pool.connect();
    try {
      await ensureProductUnits(client, productId);
      const total = await getActiveUnitsCount(client, productId);
      if (total <= 0) return res.json({ productId, available: 0, total: 0 });

      const freeUnitIds = await findFreeUnitIdsForPeriod(client, productId, start.toISOString(), end.toISOString());
      return res.json({ productId, available: freeUnitIds.length, total });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ошибка получения доступности:', error);
    return res.status(500).json({ error: 'Ошибка при получении доступности' });
  }
});

function requireTelegramConfig() {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = String(process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token || !chatId) {
    const missing = [!token ? 'TELEGRAM_BOT_TOKEN' : null, !chatId ? 'TELEGRAM_CHAT_ID' : null].filter(Boolean).join(', ');
    const err = new Error(`Telegram is not configured (${missing} missing)`);
    err.code = 'TELEGRAM_NOT_CONFIGURED';
    throw err;
  }
  return { token, chatId };
}

async function telegramApi(token, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!data || !data.ok) {
    const desc = data?.description ? String(data.description) : `HTTP ${response.status}`;
    throw new Error(`Telegram API error: ${desc}`);
  }
  return data.result;
}

function formatDateTimeRu(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// NOTE: old "any overlap blocks" logic replaced by capacity-based checks (stock can be > 1)

// Public: создать заказ -> отправить в Telegram с кнопками Accept/Decline
app.post('/api/orders', requireDbReady, async (req, res) => {
  const client = await pool.connect();
  try {
    const { token, chatId } = requireTelegramConfig();

    const { customer, items } = req.body || {};
    const customerName = String(customer?.name || '').trim();
    const customerPhone = String(customer?.phone || '').trim();
    const customerAddress = String(customer?.address || '').trim();

    if (!customerName || !customerPhone || !customerAddress) {
      return res.status(400).json({ error: 'Invalid customer data' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }

    const normalizedItemsRaw = items.map((it) => {
      const productId = Number(it?.productId);
      const quantity = Number.isFinite(Number(it?.quantity)) ? Math.max(1, Number(it.quantity)) : 1;
      const start = new Date(it?.startAt);
      const end = new Date(it?.endAt);
      if (!Number.isFinite(productId) || productId <= 0) throw new Error('Invalid productId');
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error('Invalid startAt/endAt');
      if (end.getTime() <= start.getTime()) throw new Error('endAt must be after startAt');
      return { productId, quantity, startAt: start.toISOString(), endAt: end.toISOString() };
    });

    const normalizedItems = coalesceItemsByPeriod(normalizedItemsRaw);

    await client.query('BEGIN');

    // Проверка доступности по количеству (чтобы не слать менеджеру заведомо невозможный заказ)
    for (const it of normalizedItems) {
      await ensureProductUnits(client, it.productId);
    }
    const capacityCheck = await checkCapacity(client, normalizedItems);
    if (!capacityCheck.ok) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Некоторые товары уже заняты на этот период',
        productId: capacityCheck.productId,
        available: capacityCheck.available,
        total: capacityCheck.total,
      });
    }

    const orderInserted = await client.query(
      `INSERT INTO orders (customer_name, customer_phone, customer_address, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id`,
      [customerName, customerPhone, customerAddress]
    );
    const orderId = orderInserted.rows[0].id;

    for (const it of normalizedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, start_at, end_at, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, it.productId, it.startAt, it.endAt, it.quantity]
      );
    }

    // Подтянем имена товаров для сообщения
    const itemsWithNames = await client.query(
      `SELECT
        oi.product_id AS "productId",
        oi.start_at AS "startAt",
        oi.end_at AS "endAt",
        oi.quantity AS "quantity",
        p.name AS "name",
        p.category AS "category"
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = $1
      ORDER BY oi.id ASC`,
      [orderId]
    );

    const itemsText = itemsWithNames.rows
      .map((row) => {
        const period = `${formatDateTimeRu(row.startAt)} — ${formatDateTimeRu(row.endAt)}`;
        const qty = row.quantity && row.quantity > 1 ? ` × ${row.quantity}` : '';
        return `  • ${row.name}${qty} (${row.category || '—'})\n    📅 ${period}`;
      })
      .join('\n\n');

    const message = [
      `🎬 <b>НОВЫЙ ЗАКАЗ - 50 КВАРТАЛ</b>`,
      ``,
      `🆔 <b>Order #${orderId}</b>`,
      `👤 <b>Клиент:</b> ${customerName}`,
      `📱 <b>Телефон:</b> ${customerPhone}`,
      `📍 <b>Адрес:</b> ${customerAddress}`,
      ``,
      `📦 <b>Оборудование:</b>`,
      itemsText || '—',
      ``,
      `<b>Статус:</b> ⏳ ожидание`,
    ].join('\n');

    const tgResult = await telegramApi(token, 'sendMessage', {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Accept', callback_data: `accept:${orderId}` },
            { text: '❌ Decline', callback_data: `decline:${orderId}` },
          ],
        ],
      },
    });

    await client.query(
      `UPDATE orders
       SET telegram_chat_id = $1, telegram_message_id = $2, updated_at = NOW()
       WHERE id = $3`,
      [String(tgResult.chat?.id ?? chatId), String(tgResult.message_id ?? ''), orderId]
    );

    await client.query('COMMIT');
    return res.json({ success: true, orderId });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('Ошибка создания заказа:', error);
    if (error?.code === 'TELEGRAM_NOT_CONFIGURED') {
      return res.status(500).json({ error: error.message });
    }

    // Surface Telegram API errors to client for easier production diagnostics.
    // Example: "Telegram API error: Bad Request: chat not found"
    if (String(error?.message || '').startsWith('Telegram API error:')) {
      return res.status(502).json({ error: String(error.message) });
    }
    if (String(error?.message || '').includes('Invalid')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Ошибка при создании заказа' });
  } finally {
    client.release();
  }
});

// Telegram webhook: обработка нажатий Accept/Decline
app.post('/api/telegram/webhook', requireDbReady, async (req, res) => {
  try {
    const secret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
    if (secret) {
      const headerSecret = String(req.get('x-telegram-bot-api-secret-token') || '').trim();
      if (headerSecret !== secret) {
        return res.status(401).json({ ok: false });
      }
    }

    const { token } = requireTelegramConfig();
    const update = req.body || {};
    const cb = update.callback_query;
    if (!cb) return res.json({ ok: true });

    try {
      const from = cb.from?.username || cb.from?.id || 'unknown';
      const dataPreview = String(cb.data || '').slice(0, 80);
      console.log('[telegram] callback_query:', { from, data: dataPreview });
    } catch {
      // ignore logging failures
    }

    const callbackId = cb.id;
    const data = String(cb.data || '');
    const message = cb.message;

    const [action, orderIdRaw] = data.split(':');
    const orderId = Number(orderIdRaw);
    if (!['accept', 'decline'].includes(action) || !Number.isFinite(orderId) || orderId <= 0) {
      await telegramApi(token, 'answerCallbackQuery', {
        callback_query_id: callbackId,
        text: 'Некорректная команда',
        show_alert: false,
      });
      return res.json({ ok: true });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderRow = await client.query(
        `SELECT id, status, customer_name AS "customerName", customer_phone AS "customerPhone", customer_address AS "customerAddress"
         FROM orders
         WHERE id = $1
         FOR UPDATE`,
        [orderId]
      );

      if (!orderRow.rowCount) {
        await client.query('ROLLBACK');
        await telegramApi(token, 'answerCallbackQuery', {
          callback_query_id: callbackId,
          text: 'Заказ не найден',
          show_alert: true,
        });
        return res.json({ ok: true });
      }

      const currentStatus = String(orderRow.rows[0].status || 'pending');
      if (currentStatus !== 'pending') {
        await client.query('ROLLBACK');
        await telegramApi(token, 'answerCallbackQuery', {
          callback_query_id: callbackId,
          text: `Заказ уже обработан: ${currentStatus}`,
          show_alert: false,
        });
        return res.json({ ok: true });
      }

      if (action === 'decline') {
        await client.query(`UPDATE orders SET status = 'declined', updated_at = NOW() WHERE id = $1`, [orderId]);
        await client.query('COMMIT');

        await telegramApi(token, 'answerCallbackQuery', {
          callback_query_id: callbackId,
          text: 'Отклонено',
          show_alert: false,
        });

        if (message?.chat?.id && message?.message_id) {
          await telegramApi(token, 'editMessageReplyMarkup', {
            chat_id: message.chat.id,
            message_id: message.message_id,
            reply_markup: { inline_keyboard: [] },
          });
          await telegramApi(token, 'editMessageText', {
            chat_id: message.chat.id,
            message_id: message.message_id,
            text: `${message.text}\n\n<b>Статус:</b> ❌ отклонено`,
            parse_mode: 'HTML',
          });
        }

        return res.json({ ok: true });
      }

      // accept
      const orderItems = await client.query(
        `SELECT product_id AS "productId", start_at AS "startAt", end_at AS "endAt", quantity AS "quantity"
         FROM order_items
         WHERE order_id = $1
         ORDER BY id ASC`,
        [orderId]
      );

      const normalizedItemsRaw = orderItems.rows.map((r) => ({
        productId: Number(r.productId),
        startAt: new Date(r.startAt).toISOString(),
        endAt: new Date(r.endAt).toISOString(),
        quantity: Number.isFinite(Number(r.quantity)) ? Math.max(1, Number(r.quantity)) : 1,
      }));

      const normalizedItems = coalesceItemsByPeriod(normalizedItemsRaw);

      // Аллокация unit'ов и создание броней (учитываем количество)
      for (const it of normalizedItems) {
        const allocation = await allocateUnitIdsForBooking(client, it);
        if (!allocation.ok) {
          await client.query('ROLLBACK');
          await telegramApi(token, 'answerCallbackQuery', {
            callback_query_id: callbackId,
            text: 'Нельзя принять: недостаточно свободных единиц на выбранный период',
            show_alert: true,
          });
          return res.json({ ok: true });
        }

        for (const unitId of allocation.unitIds) {
          await client.query(
            `INSERT INTO bookings (product_id, unit_id, start_at, end_at)
             VALUES ($1, $2, $3, $4)`,
            [it.productId, unitId, it.startAt, it.endAt]
          );
        }
      }

      await client.query(`UPDATE orders SET status = 'accepted', updated_at = NOW() WHERE id = $1`, [orderId]);
      await client.query('COMMIT');

      await telegramApi(token, 'answerCallbackQuery', {
        callback_query_id: callbackId,
        text: 'Принято, бронь создана',
        show_alert: false,
      });

      if (message?.chat?.id && message?.message_id) {
        await telegramApi(token, 'editMessageReplyMarkup', {
          chat_id: message.chat.id,
          message_id: message.message_id,
          reply_markup: { inline_keyboard: [] },
        });
        await telegramApi(token, 'editMessageText', {
          chat_id: message.chat.id,
          message_id: message.message_id,
          text: `${message.text}\n\n<b>Статус:</b> ✅ принято (бронь создана)`,
          parse_mode: 'HTML',
        });
      }

      return res.json({ ok: true });
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
      console.error('Telegram webhook error:', err);
      await telegramApi(token, 'answerCallbackQuery', {
        callback_query_id: callbackId,
        text: 'Ошибка обработки',
        show_alert: true,
      }).catch(() => {});
      return res.json({ ok: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Telegram webhook outer error:', error);
    return res.json({ ok: true });
  }
});

// API для обновления товара
app.put('/api/products/:id', requireAdmin, async (req, res) => {
  const client = pool ? await pool.connect() : null;
  try {
    if (!pool || !client) {
      return res.status(503).json({ error: 'DB is not configured (DATABASE_URL is missing)' });
    }
    if (!dbReady) {
      return res.status(503).json({ error: 'DB is not ready yet' });
    }
    const { id } = req.params;
    const {
      name,
      description,
      category,
      brand,
      stock,
      image_url,
      imageUrl,
      image_urls,
      imageUrls,
      price_per_day,
      pricePerDay,
      price,
      equipment,
      specs,
      is_active,
      isActive,
    } = req.body;

    const resolvedImageUrl = image_url ?? imageUrl ?? null;
    const resolvedImageUrls = normalizeImageUrls(image_urls ?? imageUrls, resolvedImageUrl);
    const imageUrlPrimary = resolvedImageUrls[0] ?? resolvedImageUrl ?? null;
    const resolvedPricePerDay = price_per_day ?? pricePerDay ?? price ?? 100;
    const resolvedStock = stock ?? 0;
    const resolvedIsActive = is_active ?? isActive;
    const resolvedEquipment = Array.isArray(equipment) ? equipment : null;
    const resolvedSpecs = specs && typeof specs === 'object' ? specs : null;
    
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE products
       SET
         name = $1,
         description = $2,
         category = $3,
         brand = $4,
         stock = $5,
         image_url = $6,
         image_urls = $7::jsonb,
         price_per_day = COALESCE($8, price_per_day),
         equipment = $9::jsonb,
         specs = $10::jsonb,
         is_active = COALESCE($11, is_active),
         updated_at = NOW()
       WHERE id = $12
       RETURNING *`,
      [
        name,
        description ?? null,
        category ?? null,
        brand ?? null,
        resolvedStock,
        imageUrlPrimary,
        JSON.stringify(resolvedImageUrls),
        resolvedPricePerDay,
        resolvedEquipment ? JSON.stringify(resolvedEquipment) : null,
        resolvedSpecs ? JSON.stringify(resolvedSpecs) : null,
        resolvedIsActive,
        id,
      ]
    );

    if (result.rowCount) {
      await syncProductUnitsForStock(client, result.rows[0].id, resolvedStock);
    }

    await client.query('COMMIT');
    
    res.json({ success: true, product: result.rows[0] });
  } catch (error) {
    try {
      await client?.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('Ошибка обновления товара:', error);
    res.status(500).json({ error: 'Ошибка при обновлении товара' });
  } finally {
    client?.release();
  }
});

// API для удаления товара
app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: 'DB is not configured (DATABASE_URL is missing)' });
    }
    if (!dbReady) {
      return res.status(503).json({ error: 'DB is not ready yet' });
    }
    const id = Number(req.params?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const existing = await pool.query(`SELECT id, is_active AS "isActive" FROM products WHERE id = $1`, [id]);
    if (!existing.rowCount) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Safety: prevent deleting a visible product from the catalog by mistake.
    if (existing.rows[0].isActive === true) {
      return res.status(409).json({
        error: 'Нельзя удалить активный товар. Сначала выключите "Активен" (скройте товар), затем попробуйте удалить снова.',
      });
    }

    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    return res.json({ success: true });
  } catch (error) {
    console.error('Ошибка удаления товара:', error);
    // Postgres FK violation (e.g. order_items -> products)
    if (error?.code === '23503') {
      return res.status(409).json({
        error:
          'Нельзя удалить товар: он уже участвует в заказах (история заказов). Удаление запрещено, чтобы не ломать данные. Оставьте товар скрытым.',
      });
    }
    res.status(500).json({ error: 'Ошибка при удалении товара' });
  }
});

// Admin: создать бронь на товар (период start/end)
app.post('/api/admin/bookings', requireAdmin, requireDbReady, async (req, res) => {
  const client = await pool.connect();
  try {
    const { productId, startAt, endAt, quantity } = req.body || {};

    const resolvedProductId = Number(productId);
    if (!Number.isFinite(resolvedProductId) || resolvedProductId <= 0) {
      return res.status(400).json({ error: 'productId is required' });
    }

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid startAt/endAt' });
    }
    if (end.getTime() <= start.getTime()) {
      return res.status(400).json({ error: 'endAt must be after startAt' });
    }

    const requestedQty = Number.isFinite(Number(quantity)) ? Math.max(1, Math.floor(Number(quantity))) : 1;

    await client.query('BEGIN');

    const productExists = await client.query('SELECT 1 FROM products WHERE id = $1 FOR UPDATE', [resolvedProductId]);
    if (!productExists.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }

    const allocation = await allocateUnitIdsForBooking(client, {
      productId: resolvedProductId,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      quantity: requestedQty,
    });

    if (!allocation.ok) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Недостаточно свободных единиц на этот период',
        available: allocation.available,
        total: allocation.total,
      });
    }

    const insertedRows = [];
    for (const unitId of allocation.unitIds) {
      const inserted = await client.query(
        `INSERT INTO bookings (product_id, unit_id, start_at, end_at)
         VALUES ($1, $2, $3, $4)
         RETURNING id, product_id AS "productId", unit_id AS "unitId", start_at AS "startAt", end_at AS "endAt", created_at AS "createdAt"`,
        [resolvedProductId, unitId, start.toISOString(), end.toISOString()]
      );
      insertedRows.push(inserted.rows[0]);
    }

    await client.query('COMMIT');
    return res.json({ success: true, bookings: insertedRows });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('Ошибка создания брони:', error);
    return res.status(500).json({ error: 'Ошибка при создании брони' });
  } finally {
    client.release();
  }
});

// Admin: статусы единиц товара (какая штука занята и до какого времени)
app.get('/api/admin/product-units', requireAdmin, requireDbReady, async (req, res) => {
  try {
    const productId = Number(req.query?.productId);
    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ error: 'productId is required' });
    }

    const result = await pool.query(
      `SELECT
        u.id AS "unitId",
        u.unit_no AS "unitNo",
        u.is_active AS "isActive",
        (
          SELECT b.end_at
          FROM bookings b
          WHERE b.unit_id = u.id
            AND b.start_at <= NOW()
            AND b.end_at > NOW()
          ORDER BY b.end_at ASC
          LIMIT 1
        ) AS "busyUntil"
      FROM product_units u
      WHERE u.product_id = $1
        AND u.is_active = TRUE
      ORDER BY u.unit_no ASC`,
      [productId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения единиц товара:', error);
    return res.status(500).json({ error: 'Ошибка при получении единиц товара' });
  }
});

// Admin: список броней по товару
app.get('/api/admin/bookings', requireAdmin, requireDbReady, async (req, res) => {
  try {
    const productId = Number(req.query?.productId);
    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ error: 'productId is required' });
    }

    const result = await pool.query(
      `SELECT
        b.id,
        b.product_id AS "productId",
        b.unit_id AS "unitId",
        u.unit_no AS "unitNo",
        b.start_at AS "startAt",
        b.end_at AS "endAt",
        b.created_at AS "createdAt"
      FROM bookings b
      LEFT JOIN product_units u ON u.id = b.unit_id
      WHERE b.product_id = $1
      ORDER BY u.unit_no NULLS LAST, b.start_at ASC`,
      [productId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения броней:', error);
    return res.status(500).json({ error: 'Ошибка при получении броней' });
  }
});

// Admin: удалить бронь
app.delete('/api/admin/bookings/:id', requireAdmin, requireDbReady, async (req, res) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    await client.query('BEGIN');
    const deleted = await client.query(
      `DELETE FROM bookings
       WHERE id = $1
       RETURNING id, product_id AS "productId", unit_id AS "unitId", start_at AS "startAt", end_at AS "endAt"`,
      [id]
    );
    if (!deleted.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }
    await client.query('COMMIT');
    return res.json({ success: true, deleted: deleted.rows[0] });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('Ошибка удаления брони:', error);
    return res.status(500).json({ error: 'Ошибка при удалении брони' });
  } finally {
    client.release();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    db: {
      configured: Boolean(pool),
      ready: dbReady,
      requireDb,
      error: dbInitError ? String(dbInitError.message || dbInitError) : null,
    },
  });
});

// Root (для быстрой проверки в браузере)
app.get('/', (req, res) => {
  res.json({
    service: '50kvartal-api',
    health: '/health',
    products: '/api/products',
    adminLogin: '/api/admin/login',
  });
});

if (requireDb) {
  await startDb();
} else {
  // не блокируем запуск в dev
  startDb();
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
