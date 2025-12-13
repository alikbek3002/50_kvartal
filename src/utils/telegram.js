import { API_URL } from '../config'

/**
 * Отправляет заказ в Telegram
 * @param {Object} formData - Данные формы
 * @param {Array} items - Товары в корзине
 * @returns {Promise<boolean>} - Успешно ли отправлено
 */
export async function sendOrderToTelegram(formData, items) {
  try {
    if (!API_URL) {
      console.error('API_URL is not configured')
      return false
    }

    const payloadItems = items.map(({ item, count, rentalPeriod }) => {
      const startLocal = new Date(`${rentalPeriod.dateFrom}T${rentalPeriod.timeFrom}:00`)
      const endLocal = new Date(`${rentalPeriod.dateTo}T${rentalPeriod.timeTo}:00`)
      return {
        productId: item.id,
        quantity: count || 1,
        startAt: startLocal.toISOString(),
        endAt: endLocal.toISOString(),
      }
    })

    const response = await fetch(`${API_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: {
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
        },
        items: payloadItems,
      }),
    })

    const data = await response.json().catch(() => null)
    if (!response.ok) {
      const message = typeof data === 'object' && data && (data.error || data.message)
        ? String(data.error || data.message)
        : `HTTP ${response.status}`
      throw new Error(message)
    }

    return Boolean(data?.success)
  } catch (error) {
    console.error('Error sending to Telegram:', error)
    throw error
  }
}
