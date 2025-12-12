import { useState, useEffect } from 'react'

export const DateTimePicker = ({ isOpen, onClose, onSubmit, item, mode }) => {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [timeFrom, setTimeFrom] = useState('09:00')
  const [timeTo, setTimeTo] = useState('21:00')
  const [rentalDays, setRentalDays] = useState(0)
  const [totalPrice, setTotalPrice] = useState(0)

  // Блокировка скролла при открытом модальном окне
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Автоматический расчет стоимости при изменении дат
  useEffect(() => {
    if (dateFrom && dateTo && item) {
      const days = Math.ceil((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24)) + 1
      const price = days * (item.pricePerDay || 100)
      setRentalDays(days)
      setTotalPrice(price)
    } else {
      setRentalDays(0)
      setTotalPrice(0)
    }
  }, [dateFrom, dateTo, item])

  if (!isOpen || !item) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (dateFrom && dateTo) {
      onSubmit({
        dateFrom,
        dateTo,
        timeFrom,
        timeTo,
      })
      // Сброс формы
      setDateFrom('')
      setDateTo('')
      setTimeFrom('09:00')
      setTimeTo('21:00')
    }
  }

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const currentTime = now.toTimeString().slice(0, 5) // HH:MM формат
  
  // Получение минимального времени для сегодня
  const getMinTime = () => {
    if (dateFrom === today) {
      return currentTime
    }
    return '00:00'
  }

  // Проверка валидности формы с учетом времени
  const isFormValid = dateFrom && dateTo && (() => {
    if (dateFrom === today) {
      // Если выбрана сегодняшняя дата, проверяем что время не прошло
      return timeFrom >= currentTime
    }
    return true
  })()

  // Обработчик изменения даты начала
  const handleDateFromChange = (e) => {
    const newDateFrom = e.target.value
    setDateFrom(newDateFrom)
    
    // Если выбрана сегодняшняя дата, установить минимальное время
    if (newDateFrom === today && timeFrom < currentTime) {
      // Округляем до следующего часа
      const nextHour = String(now.getHours() + 1).padStart(2, '0')
      setTimeFrom(`${nextHour}:00`)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="datetime-picker" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Закрыть" type="button">
          ×
        </button>
        <h3 className="datetime-picker__title">
          {mode === 'quick' ? 'Быстрая аренда' : 'Добавить в корзину'}
        </h3>
        <p className="datetime-picker__subtitle">{item.name}</p>
        
        <form onSubmit={handleSubmit} className="datetime-picker__form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="date-from">Дата начала</label>
              <input
                type="date"
                id="date-from"
                value={dateFrom}
                onChange={handleDateFromChange}
                min={today}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="date-to">Дата окончания</label>
              <input
                type="date"
                id="date-to"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom || today}
                required
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="time-from">Время получения</label>
              <input
                type="time"
                id="time-from"
                value={timeFrom}
                onChange={(e) => setTimeFrom(e.target.value)}
                min={getMinTime()}
                required
              />
              {dateFrom === today && timeFrom < currentTime && (
                <span className="form-error">Выберите будущее время</span>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="time-to">Время возврата</label>
              <input
                type="time"
                id="time-to"
                value={timeTo}
                onChange={(e) => setTimeTo(e.target.value)}
                min={dateFrom === dateTo ? timeFrom : '00:00'}
                required
              />
            </div>
          </div>

          {rentalDays > 0 && (
            <div className="datetime-picker__summary">
              <p>Период аренды: {rentalDays} дн.</p>
              <p className="datetime-picker__price">Стоимость: {totalPrice} сом</p>
            </div>
          )}

          <div className="datetime-picker__actions">
            <button type="button" className="button ghost" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="button primary" disabled={!isFormValid}>
              Продолжить
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
