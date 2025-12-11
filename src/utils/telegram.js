// Конфигурация Telegram бота
const TELEGRAM_BOT_TOKEN = '8285836095:AAHIqXYnToMIs8ud5eKaALS-4BbXQrpFWgA'
const TELEGRAM_CHAT_ID = '1222583683'

/**
 * Отправляет заказ в Telegram
 * @param {Object} formData - Данные формы
 * @param {Array} items - Товары в корзине
 * @returns {Promise<boolean>} - Успешно ли отправлено
 */
export async function sendOrderToTelegram(formData, items) {
  try {
    // Формируем список товаров с периодами аренды
    const itemsList = items
      .map(({ item, count, rentalPeriod }) => {
        const days = rentalPeriod 
          ? Math.ceil((new Date(rentalPeriod.dateTo) - new Date(rentalPeriod.dateFrom)) / (1000 * 60 * 60 * 24)) + 1 
          : 0
        const cost = days * (item.pricePerDay || 100)
        const period = rentalPeriod 
          ? `\n    📅 ${formatDate(rentalPeriod.dateFrom)} (${rentalPeriod.timeFrom}) - ${formatDate(rentalPeriod.dateTo)} (${rentalPeriod.timeTo})\n    💰 ${days} дн. × ${item.pricePerDay || 100} сом = ${cost} сом`
          : ''
        return `  • ${item.name} (${item.category})${period}`
      })
      .join('\n\n')

    // Подсчитываем общую стоимость
    const totalCost = items.reduce((sum, { item, rentalPeriod }) => {
      if (!rentalPeriod) return sum
      const days = Math.ceil((new Date(rentalPeriod.dateTo) - new Date(rentalPeriod.dateFrom)) / (1000 * 60 * 60 * 24)) + 1
      return sum + days * (item.pricePerDay || 100)
    }, 0)

    // Формируем сообщение
    const message = `
🎬 <b>НОВЫЙ ЗАКАЗ - 50 КВАРТАЛ</b>

👤 <b>Клиент:</b> ${formData.name}
📱 <b>Телефон:</b> ${formData.phone}
📍 <b>Адрес:</b> ${formData.address}

📦 <b>Оборудование:</b>
${itemsList}

<b>Всего позиций:</b> ${items.length} шт.
<b>Общая стоимость:</b> ${totalCost} сом
    `.trim()

    // Отправляем в Telegram
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    )

    const data = await response.json()

    if (!data.ok) {
      console.error('Telegram API error:', data)
      return false
    }

    return true
  } catch (error) {
    console.error('Error sending to Telegram:', error)
    return false
  }
}

/**
 * Форматирует дату в читаемый формат
 * @param {string} dateString - Дата в формате YYYY-MM-DD
 * @returns {string} - Отформатированная дата
 */
function formatDate(dateString) {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}
