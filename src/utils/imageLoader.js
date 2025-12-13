import { API_URL } from '../config'

const catalogImages = import.meta.glob('../images/catalog/*', { eager: true, import: 'default', query: '?url' })
const fallbackImage = 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80'

const normalizeUrl = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (API_URL && (trimmed.startsWith('/api/') || trimmed.startsWith('/uploads/'))) {
    return `${API_URL}${trimmed}`
  }
  return trimmed
}

export const getProductImages = (item) => {
  const rawList = item?.imageUrls || item?.image_urls
  if (Array.isArray(rawList) && rawList.length) {
    const urls = rawList.map(normalizeUrl).filter(Boolean)
    if (urls.length) return urls
  }

  const single = normalizeUrl(item?.imageUrl || item?.image_url)
  if (single) return [single]

  if (item?.image) {
    const key = `../images/${item.image}`
    if (catalogImages[key]) {
      return [catalogImages[key]]
    }
    console.warn('Не найден файл изображения для', item.image)
  }

  return [fallbackImage]
}

export const getProductImage = (item) => {
  return getProductImages(item)[0]
}
