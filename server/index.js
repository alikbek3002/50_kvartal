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

// Railway/Reverse proxy (нужно для корректного req.protocol при HTTPS)
app.set('trust proxy', 1);

// Настройка CORS
app.use(cors());
app.use(express.json());

// Создаем папку для загрузок если её нет
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Только изображения разрешены!'));
  }
});

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
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return next();

  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (token !== adminToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
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
    const adminToken = process.env.ADMIN_TOKEN;

    if (!configuredUsername || !configuredPassword || !adminToken) {
      return res.status(500).json({ error: 'Admin auth is not configured' });
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
    const result = await pool.query(
      `SELECT
        id,
        name,
        description,
        category,
        brand,
        stock,
        image_url AS "imageUrl",
        price_per_day AS "pricePerDay",
        is_active AS "isActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM products
      ORDER BY created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения товаров (admin):', error);
    res.status(500).json({ error: 'Ошибка при получении товаров' });
  }
});

// Раздача статических файлов
app.use('/uploads', express.static(uploadsDir));

// API для загрузки изображения
app.post('/api/upload', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ 
      success: true, 
      url: imageUrl,
      filename: req.file.filename 
    });
  } catch (error) {
    console.error('Ошибка загрузки:', error);
    res.status(500).json({ error: 'Ошибка при загрузке файла' });
  }
});

// API для добавления товара
app.post('/api/products', requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: 'DB is not configured (DATABASE_URL is missing)' });
    }
    const {
      name,
      description,
      category,
      brand,
      stock,
      image_url,
      imageUrl,
      price_per_day,
      pricePerDay,
      price,
    } = req.body;

    const resolvedImageUrl = image_url ?? imageUrl ?? null;
    const resolvedPricePerDay = price_per_day ?? pricePerDay ?? price ?? 100;
    const resolvedStock = stock ?? 0;
    
    const result = await pool.query(
      `INSERT INTO products (name, description, category, brand, stock, image_url, price_per_day)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, description ?? null, category ?? null, brand ?? null, resolvedStock, resolvedImageUrl, resolvedPricePerDay]
    );
    
    res.json({ success: true, product: result.rows[0] });
  } catch (error) {
    console.error('Ошибка создания товара:', error);
    res.status(500).json({ error: 'Ошибка при создании товара' });
  }
});

// API для получения всех товаров
app.get('/api/products', async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: 'DB is not configured (DATABASE_URL is missing)' });
    }
    const result = await pool.query(
      `SELECT
        id,
        name,
        description,
        category,
        brand,
        stock,
        image_url AS "imageUrl",
        price_per_day AS "pricePerDay",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM products
      WHERE is_active = TRUE
      ORDER BY created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения товаров:', error);
    res.status(500).json({ error: 'Ошибка при получении товаров' });
  }
});

// API для обновления товара
app.put('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: 'DB is not configured (DATABASE_URL is missing)' });
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
      price_per_day,
      pricePerDay,
      price,
      is_active,
      isActive,
    } = req.body;

    const resolvedImageUrl = image_url ?? imageUrl ?? null;
    const resolvedPricePerDay = price_per_day ?? pricePerDay ?? price ?? 100;
    const resolvedStock = stock ?? 0;
    const resolvedIsActive = is_active ?? isActive;
    
    const result = await pool.query(
      `UPDATE products
       SET
         name = $1,
         description = $2,
         category = $3,
         brand = $4,
         stock = $5,
         image_url = $6,
         price_per_day = $7,
         is_active = COALESCE($8, is_active),
         updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        name,
        description ?? null,
        category ?? null,
        brand ?? null,
        resolvedStock,
        resolvedImageUrl,
        resolvedPricePerDay,
        resolvedIsActive,
        id,
      ]
    );
    
    res.json({ success: true, product: result.rows[0] });
  } catch (error) {
    console.error('Ошибка обновления товара:', error);
    res.status(500).json({ error: 'Ошибка при обновлении товара' });
  }
});

// API для удаления товара
app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: 'DB is not configured (DATABASE_URL is missing)' });
    }
    const { id } = req.params;
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка удаления товара:', error);
    res.status(500).json({ error: 'Ошибка при удалении товара' });
  }
});

// Health check
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

if (requireDb) {
  await startDb();
} else {
  // не блокируем запуск в dev
  startDb();
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
