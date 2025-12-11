import { useState } from 'react'

export const DateTimePicker = ({ isOpen, onClose, onSubmit, item, mode }) => {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [timeFrom, setTimeFrom] = useState('09:00')
  const [timeTo, setTimeTo] = useState('21:00')

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

  const today = new Date().toISOString().split('T')[0]
  const isFormValid = dateFrom && dateTo

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
                onChange={(e) => setDateFrom(e.target.value)}
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
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="time-to">Время возврата</label>
              <input
                type="time"
                id="time-to"
                value={timeTo}
                onChange={(e) => setTimeTo(e.target.value)}
                required
              />
            </div>
          </div>

          {dateFrom && dateTo && (
            <div className="datetime-picker__summary">
              <p>Период аренды: {Math.ceil((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24)) + 1} дн.</p>
              <p className="datetime-picker__price">Стоимость: {(Math.ceil((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24)) + 1) * (item.pricePerDay || 100)} сом</p>
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
