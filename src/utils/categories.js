export const MAIN_CATEGORY_OPERATOR = 'Операторское оборудование'
export const MAIN_CATEGORY_LIGHT = 'Свет'
export const MAIN_CATEGORY_GRIP = 'Грип и крепёж'

export const YELLOW_SUBCATEGORY_STANDS = 'Стенды (Систенты)'
export const YELLOW_SUBCATEGORY_CLAMPS = 'Зажимы'
export const YELLOW_SUBCATEGORY_FROST_FRAMES = 'Фрост рамы'

export const MAIN_CATEGORIES = [MAIN_CATEGORY_OPERATOR, MAIN_CATEGORY_LIGHT, MAIN_CATEGORY_GRIP]
export const YELLOW_SUBCATEGORIES = [
  YELLOW_SUBCATEGORY_STANDS,
  YELLOW_SUBCATEGORY_CLAMPS,
  YELLOW_SUBCATEGORY_FROST_FRAMES,
]

const toText = (value) => String(value ?? '').trim()
const toKey = (value) => toText(value).toLowerCase()

const normalizeNameKey = (value) =>
  toKey(value)
    .replace(/["'“”«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const YELLOW_STANDS_KEYS = new Set(
  [
    'kupo master high cine stand 543m (a100)',
    'kupo c-stand 40',
    'kupo c-stand 20',
    'kupo autopole 1 - 1.70m',
    'kupo autopole 2.10m',
    'kupo kcp-636b big boom (журавль/выносная штанга)',
    // Variants that exist in current catalog/DB
    'kupo kcp-636b big boom',
    'kupo ct-20m 20 inc h c-stand (kup-ct-20m)',
    'распорка автополе kupo kp-s1017pd kupole',
    'avenger a100',
  ].map(normalizeNameKey)
)

const YELLOW_CLAMPS_KEYS = new Set(
  [
    'kupo 4in super viser clamp end jaw',
    'kupo super clamp',
    'kupo grip head',
    // Variant that exists in current catalog/DB
    'super viser clamp end jaw 2"',
    'super viser clamp end jaw 2',
  ].map(normalizeNameKey)
)

const YELLOW_FROST_FRAMES_KEYS = new Set(
  [
    'kupo butterfly рама 8x8 (включая silk 1.6, grid cloth 1/4, 1/8, black & silver)',
    'фростовая рама 100x100 (216) (250)',
    'флаг floppy cutter 100x100',
    'фростовая рама 60x60 (250)',
    'флаг floppy cutter 60x60',
    'рама 12x12 modular frame manfrotto h1200m',
    "рама 12'x12' modular frame manfrotto h1200m",
    "avenger двойное полотно i920bdn 12х12' (360х360см) black",
    "avenger i920sdl полотно для флага 12х12' (360х360см)",
    "grip текстиль 6'x6' bb coton т 6-bb-c",
  ].map(normalizeNameKey)
)

export function resolveMainCategory(item) {
  return toText(item?.mainCategory || item?.category)
}

export function resolveSubCategory(item) {
  return toText(item?.subCategory)
}

export function isYellowMainCategory(value) {
  return toText(value) === MAIN_CATEGORY_GRIP
}

// Frontend fallback in case backend doesn't provide mainCategory/subCategory yet.
export function deriveCategoryMeta(item) {
  const rawCategory = toKey(item?.category)
  const nameKey = normalizeNameKey(item?.name)

  if (!rawCategory) {
    return { mainCategory: '', subCategory: '' }
  }

  // Strict mapping by existing DB category → 3 main categories.
  if (rawCategory === 'освещение') {
    return { mainCategory: MAIN_CATEGORY_LIGHT, subCategory: '' }
  }

  if (rawCategory === 'мониторы и контроль') {
    return { mainCategory: MAIN_CATEGORY_OPERATOR, subCategory: '' }
  }

  if (rawCategory === 'грип и крепёж' || rawCategory === 'модификаторы и текстиль') {
    const mainCategory = MAIN_CATEGORY_GRIP

    // “Модификаторы и текстиль” всегда считаем фрост-рамами в жёлтом.
    if (rawCategory === 'модификаторы и текстиль') {
      return { mainCategory, subCategory: YELLOW_SUBCATEGORY_FROST_FRAMES }
    }

    if (YELLOW_CLAMPS_KEYS.has(nameKey)) {
      return { mainCategory, subCategory: YELLOW_SUBCATEGORY_CLAMPS }
    }

    if (YELLOW_FROST_FRAMES_KEYS.has(nameKey)) {
      return { mainCategory, subCategory: YELLOW_SUBCATEGORY_FROST_FRAMES }
    }

    if (YELLOW_STANDS_KEYS.has(nameKey)) {
      return { mainCategory, subCategory: YELLOW_SUBCATEGORY_STANDS }
    }

    // If it's yellow but not in the strict list, put it into stands to avoid empty subcategory.
    return { mainCategory, subCategory: YELLOW_SUBCATEGORY_STANDS }
  }

  // Fallback: still keep the app usable.
  return { mainCategory: '', subCategory: '' }
}

export function getEffectiveMainCategory(item) {
  return resolveMainCategory(item) || deriveCategoryMeta(item).mainCategory
}

export function getEffectiveSubCategory(item) {
  return resolveSubCategory(item) || deriveCategoryMeta(item).subCategory
}
