export const MAIN_CATEGORY_OPERATOR = 'Операторское оборудование'
export const MAIN_CATEGORY_LIGHT = 'Свет'
export const CATEGORY_STANDS = 'Стенды (Систенты)'
export const CATEGORY_CLAMPS = 'Зажимы'
export const CATEGORY_FROST_FRAMES = 'Фрост рамы'

export const MAIN_CATEGORIES = [
  MAIN_CATEGORY_OPERATOR,
  CATEGORY_STANDS,
  CATEGORY_CLAMPS,
  CATEGORY_FROST_FRAMES,
  MAIN_CATEGORY_LIGHT,
]

function toText(value) {
  return String(value ?? '').trim()
}

function toKey(value) {
  return toText(value).toLowerCase()
}

export function resolveMainCategory(item) {
  return toText(item?.mainCategory || item?.category)
}

export function deriveCategoryMeta(item) {
  const rawCategory = toKey(item?.category)

  if (!rawCategory) {
    return { mainCategory: '' }
  }

  // Прямое соответствие категорий
  if (rawCategory === toKey(MAIN_CATEGORY_OPERATOR)) return { mainCategory: MAIN_CATEGORY_OPERATOR }
  if (rawCategory === toKey(MAIN_CATEGORY_LIGHT)) return { mainCategory: MAIN_CATEGORY_LIGHT }
  if (rawCategory === toKey(CATEGORY_STANDS)) return { mainCategory: CATEGORY_STANDS }
  if (rawCategory === toKey(CATEGORY_CLAMPS)) return { mainCategory: CATEGORY_CLAMPS }
  if (rawCategory === toKey(CATEGORY_FROST_FRAMES)) return { mainCategory: CATEGORY_FROST_FRAMES }

  return { mainCategory: '' }
}

export function getEffectiveMainCategory(item) {
  return resolveMainCategory(item) || deriveCategoryMeta(item).mainCategory
}