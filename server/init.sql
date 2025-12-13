-- Базовая схема. Этот файл можно безопасно запускать много раз.

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  brand TEXT,
  stock INTEGER NOT NULL DEFAULT 0,
  price_per_day NUMERIC(10, 2) NOT NULL DEFAULT 100,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Хранилище изображений в Postgres
CREATE TABLE IF NOT EXISTS images (
  id SERIAL PRIMARY KEY,
  filename TEXT,
  mime_type TEXT NOT NULL,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Бронирования (период аренды/резерва по товару)
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_product_id ON bookings(product_id);
CREATE INDEX IF NOT EXISTS idx_bookings_start_at ON bookings(start_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_end_at ON bookings(end_at DESC);

CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);

-- Мягкие миграции для уже существующих баз
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_per_day NUMERIC(10, 2) NOT NULL DEFAULT 100;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Индексы
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- Seed: добавляет товары из текущего каталога, если их ещё нет в БД.
-- Важно: НЕ обновляет существующие товары (чтобы не перетирать правки из будущей админки).
INSERT INTO products (name, description, category, brand, stock, price_per_day, image_url, is_active)
SELECT v.name, v.description, v.category, v.brand, v.stock, v.price_per_day, v.image_url, v.is_active
FROM (
  VALUES
    ('Super Viser Clamp End Jaw 2"', NULL, 'Грип и крепёж', NULL, 4, 100::NUMERIC, NULL, TRUE),
    ('Kupo KCP-636B Big Boom', NULL, 'Грип и крепёж', 'Kupo', 1, 100::NUMERIC, NULL, TRUE),
    ('Atomos NEON 17" 4 K HDR монитор / рекордер', NULL, 'Мониторы и контроль', 'Atomos', 1, 100::NUMERIC, NULL, TRUE),
    ('Набор ламп Aputure Accent B7C 8-Light Kit', NULL, 'Освещение', 'Aputure', 1, 100::NUMERIC, NULL, TRUE),
    ('Aputure Light Storm LS 600c Pro LED lamp - V-mount', NULL, 'Освещение', 'Aputure', 1, 100::NUMERIC, NULL, TRUE),
    ('Kupo CT-20M 20 inc h C-Stand (KUP-CT-20M)', NULL, 'Грип и крепёж', 'Kupo', 2, 100::NUMERIC, NULL, TRUE),
    ('Портативный свет Aputure MC RGB', NULL, 'Освещение', 'Aputure', 1, 100::NUMERIC, NULL, TRUE),
    ('Осветитель Aputure Storm 1200x Линза', NULL, 'Освещение', 'Aputure', 1, 100::NUMERIC, NULL, TRUE),
    ('Френеля Aputure F10 Fresnel Flashpoint', NULL, 'Модификаторы и текстиль', 'Aputure', 2, 100::NUMERIC, NULL, TRUE),
    ('Avenger A100', NULL, 'Грип и крепёж', 'Avenger', 2, 100::NUMERIC, NULL, TRUE),
    ('Штатив E- Image EG15A', NULL, 'Грип и крепёж', NULL, 1, 100::NUMERIC, NULL, TRUE),
    ('кронштейн Автогрип E-Image EI-A40', NULL, 'Грип и крепёж', 'E-Image', 1, 100::NUMERIC, NULL, TRUE),
    ('KUPO присоска KSC-06', NULL, 'Грип и крепёж', 'Kupo', 4, 100::NUMERIC, NULL, TRUE),
    ('Aputure Nova P300C RGBWW LED (70% brighter than Skypanel S30-c)', NULL, 'Освещение', 'Aputure', 1, 100::NUMERIC, NULL, TRUE),
    ('Aputure amaran F22c 2 x 2'' RGB LED Flexible Light Mat (V-Mount),', NULL, 'Освещение', 'Aputure', 1, 100::NUMERIC, NULL, TRUE),
    ('Распорка автополе Kupo KP-S1017PD Kupole', NULL, 'Грип и крепёж', 'Kupo', 1, 100::NUMERIC, NULL, TRUE),
    ('Рама 12''x12'' Modular Frame Manfrotto H1200M', NULL, 'Модификаторы и текстиль', 'Manfrotto', 1, 100::NUMERIC, NULL, TRUE),
    ('Avenger Двойное Полотно I920BDN 12х12'' (360х360см) black', NULL, 'Модификаторы и текстиль', 'Avenger', 1, 100::NUMERIC, NULL, TRUE),
    ('Avenger I920SDL Полотно для флага 12х12'' (360х360см)', NULL, 'Модификаторы и текстиль', 'Avenger', 1, 100::NUMERIC, NULL, TRUE),
    ('Grip Текстиль 6''x6'' BB COTON Т 6-BB-C', NULL, 'Модификаторы и текстиль', 'Grip Textile', 2, 100::NUMERIC, NULL, TRUE)
) AS v(name, description, category, brand, stock, price_per_day, image_url, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM products p WHERE p.name = v.name
);
