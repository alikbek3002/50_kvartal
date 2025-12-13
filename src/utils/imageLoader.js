import { API_URL } from '../config'

const catalogImages = import.meta.glob('../images/catalog/*', { eager: true, import: 'default', query: '?url' })
const fallbackImage = 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80'

export const getProductImage = (item) => {
  const directUrl = item?.imageUrl || item?.image_url
  if (typeof directUrl === 'string' && directUrl.trim()) {
    const value = directUrl.trim()
    // If backend stores relative URLs (recommended), prefix with API_URL when present.
    if (API_URL && (value.startsWith('/api/') || value.startsWith('/uploads/'))) {
      return `${API_URL}${value}`
    }
    return value
  }

  if (item?.image) {
    const key = `../images/${item.image}`
    if (catalogImages[key]) {
      return catalogImages[key]
    }
    console.warn('Не найден файл изображения для', item.image)
  }
  return fallbackImage
}
