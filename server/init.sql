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
  image_urls JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Мягкая миграция: несколько фото товара
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls JSONB;

-- Единицы товара (когда одного товара есть несколько штук)
CREATE TABLE IF NOT EXISTS product_units (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unit_no INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, unit_no)
);

CREATE INDEX IF NOT EXISTS idx_product_units_product_id ON product_units(product_id);

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
  unit_id INTEGER,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_product_id ON bookings(product_id);
CREATE INDEX IF NOT EXISTS idx_bookings_start_at ON bookings(start_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_end_at ON bookings(end_at DESC);

-- Заказы (подтверждение в Telegram)
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  telegram_chat_id TEXT,
  telegram_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);

-- Мягкие миграции: unit_id в bookings + FK
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS unit_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_bookings_unit_id ON bookings(unit_id);

DO $$
BEGIN
  ALTER TABLE bookings
    ADD CONSTRAINT bookings_unit_id_fkey
    FOREIGN KEY (unit_id)
    REFERENCES product_units(id)
    ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Мягкие миграции: product_units доп. поля
ALTER TABLE product_units ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE product_units ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Создать недостающие unit'ы на основе stock (и активировать/деактивировать по stock)
INSERT INTO product_units (product_id, unit_no, is_active)
SELECT p.id, gs.unit_no, TRUE
FROM products p
JOIN LATERAL generate_series(1, GREATEST(p.stock, 0)) AS gs(unit_no) ON TRUE
LEFT JOIN product_units u ON u.product_id = p.id AND u.unit_no = gs.unit_no
WHERE u.id IS NULL;

UPDATE product_units u
SET is_active = (u.unit_no <= GREATEST((SELECT p.stock FROM products p WHERE p.id = u.product_id), 0))
WHERE TRUE;

-- Если есть старые брони без unit_id — назначаем unit #1 (исторически пересечений не было)
INSERT INTO product_units (product_id, unit_no, is_active)
SELECT DISTINCT b.product_id, 1, TRUE
FROM bookings b
LEFT JOIN product_units u ON u.product_id = b.product_id AND u.unit_no = 1
WHERE b.unit_id IS NULL AND u.id IS NULL;

-- Проставляем unit_id для старых броней (иначе они блокируют все единицы в проверке доступности)
UPDATE bookings b
SET unit_id = u.id
FROM product_units u
WHERE b.unit_id IS NULL
  AND u.product_id = b.product_id
  AND u.unit_no = 1;

UPDATE bookings b
SET unit_id = (
  SELECT u.id
  FROM product_units u
  WHERE u.product_id = b.product_id
  ORDER BY u.unit_no ASC
  LIMIT 1
)
WHERE b.unit_id IS NULL;

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
WHERE
  -- IMPORTANT: seed only into an empty DB (otherwise it pollutes an already curated catalog)
  NOT EXISTS (SELECT 1 FROM products p0 LIMIT 1)
  AND NOT EXISTS (
    SELECT 1
    FROM products p
    WHERE lower(trim(p.name)) = lower(trim(v.name))
  );
