// Тест отправки в Telegram
const TELEGRAM_BOT_TOKEN = '8285836095:AAHIqXYnToMIs8ud5eKaALS-4BbXQrpFWgA'
const TELEGRAM_CHAT_ID = '1222583683'

async function testTelegramBot() {
  const testMessage = `
🎬 <b>ТЕСТОВОЕ СООБЩЕНИЕ - 50 КВАРТАЛ</b>

✅ Бот успешно настроен и работает!

Это тестовый заказ для проверки:

👤 <b>Клиент:</b> Тестовый Клиент
📱 <b>Телефон:</b> +7 999 123 45 67
📍 <b>Адрес:</b> Бишкек, тестовый адрес

📅 <b>Период аренды:</b>
  С: 15.12.2025 в 10:00
  До: 17.12.2025 в 18:00

📦 <b>Оборудование:</b>
  • Godox SL-60W - 2 шт. (Свет)
  • Manfrotto 055 - 1 шт. (Грип)

<b>Всего позиций:</b> 3 шт.

🎉 Если ты видишь это сообщение - всё работает правильно!
  `.trim()

  try {
    console.log('Отправляю тестовое сообщение...')
    
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: testMessage,
          parse_mode: 'HTML',
        }),
      }
    )

    const data = await response.json()

    if (data.ok) {
      console.log('✅ Сообщение успешно отправлено!')
      console.log('Проверь свой Telegram!')
    } else {
      console.error('❌ Ошибка:', data)
    }
  } catch (error) {
    console.error('❌ Ошибка отправки:', error)
  }
}

// Запускаем тест
testTelegramBot()
