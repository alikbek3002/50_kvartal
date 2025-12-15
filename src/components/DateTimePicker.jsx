import { useEffect, useMemo, useState } from 'react'
import { API_URL } from '../config'

export const DateTimePicker = ({ isOpen, onClose, onSubmit, item, mode, existingPeriod }) => {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [timeFrom, setTimeFrom] = useState('09:00')
  const [timeTo, setTimeTo] = useState('21:00')
  const [now, setNow] = useState(() => new Date())
  const [quantity, setQuantity] = useState(1)
  const [availability, setAvailability] = useState({ loading: false, available: null, total: null, error: '' })
  const [rentalDays, setRentalDays] = useState(0)
  const [totalPrice, setTotalPrice] = useState(0)

  const formatLocalDate = (d) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Обновляем текущее время пока открыт календарь (нужно для ограничения "сегодня" по времени)
  useEffect(() => {
    if (!isOpen) return
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30 * 1000)
    return () => clearInterval(id)
  }, [isOpen])

  // Заполнение форм существующими данными при редактировании
  useEffect(() => {
    if (isOpen && mode === 'edit' && existingPeriod) {
      // Только в режиме редактирования заполняем существующими данными
      setDateFrom(existingPeriod.dateFrom)
      setDateTo(existingPeriod.dateTo)
      setTimeFrom(existingPeriod.timeFrom)
      setTimeTo(existingPeriod.timeTo)
      const q = Number.isFinite(Number(existingPeriod.quantity)) ? Math.max(1, Math.floor(Number(existingPeriod.quantity))) : 1
      setQuantity(q)
    } else if (isOpen) {
      // В других режимах сбрасываем форму
      setDateFrom('')
      setDateTo('')
      setTimeFrom('09:00')
      setTimeTo('21:00')
      setQuantity(1)
    }
  }, [isOpen, mode, existingPeriod])

  // Блокировка скролла при открытом модальном окне
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('no-scroll')
    } else {
      document.body.classList.remove('no-scroll')
    }
    return () => {
      document.body.classList.remove('no-scroll')
    }
  }, [isOpen])

  const stock = Number.isFinite(Number(item?.stock)) ? Number(item.stock) : 0
  const hasAvailabilityV2 =
    item &&
    (Object.prototype.hasOwnProperty.call(item, 'availableNow') ||
      Object.prototype.hasOwnProperty.call(item, 'busyUnitsNow') ||
      Object.prototype.hasOwnProperty.call(item, 'nextAvailableAt'))
  const fallbackAvailableNow = Number.isFinite(Number(item?.availableNow)) ? Number(item.availableNow) : stock

  const buildLocalDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null
    const value = new Date(`${dateStr}T${timeStr}:00`)
    if (Number.isNaN(value.getTime())) return null
    return value
  }

  const startIso = useMemo(() => {
    const dt = buildLocalDateTime(dateFrom, timeFrom)
    return dt ? dt.toISOString() : ''
  }, [dateFrom, timeFrom])

  const endIso = useMemo(() => {
    const dt = buildLocalDateTime(dateTo, timeTo)
    return dt ? dt.toISOString() : ''
  }, [dateTo, timeTo])

  // Проверяем реальную доступность по выбранному периоду (через бэкенд)
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function loadAvailability() {
      if (!isOpen || !item?.id) return
      if (!API_URL) {
        setAvailability({ loading: false, available: null, total: null, error: '' })
        return
      }
      if (!startIso || !endIso) {
        setAvailability({ loading: false, available: null, total: null, error: '' })
        return
      }

      setAvailability((prev) => ({ ...prev, loading: true, error: '' }))
      try {
        const url = `${API_URL}/api/availability?productId=${encodeURIComponent(item.id)}&startAt=${encodeURIComponent(startIso)}&endAt=${encodeURIComponent(endIso)}`
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' })
        const data = await response.json().catch(() => null)
        if (!response.ok) {
          const message = typeof data === 'object' && data && (data.error || data.message)
            ? String(data.error || data.message)
            : `HTTP ${response.status}`
          throw new Error(message)
        }
        if (cancelled) return
        const available = Number.isFinite(Number(data?.available)) ? Number(data.available) : null
        const total = Number.isFinite(Number(data?.total)) ? Number(data.total) : null
        setAvailability({ loading: false, available, total, error: '' })
      } catch (err) {
        if (cancelled) return
        if (err?.name === 'AbortError') return
        setAvailability({ loading: false, available: null, total: null, error: err?.message || 'Ошибка проверки доступности' })
      }
    }

    loadAvailability()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [API_URL, endIso, isOpen, item?.id, startIso])

  const maxQuantity = useMemo(() => {
    const byPeriod = Number.isFinite(Number(availability.available)) ? Number(availability.available) : null
    const base = byPeriod !== null ? byPeriod : hasAvailabilityV2 ? fallbackAvailableNow : stock
    return Math.max(0, Math.floor(Number(base) || 0))
  }, [availability.available, fallbackAvailableNow, hasAvailabilityV2, stock])

  useEffect(() => {
    // clamp quantity to the max we know
    if (!isOpen) return
    if (maxQuantity <= 0) {
      setQuantity(1)
      return
    }
    setQuantity((prev) => Math.min(Math.max(1, Number(prev) || 1), maxQuantity))
  }, [isOpen, maxQuantity])

  // Автоматический расчет стоимости при изменении дат/кол-ва
  useEffect(() => {
    if (dateFrom && dateTo && item) {
      const days = Math.ceil((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24)) + 1
      const qty = Number.isFinite(Number(quantity)) ? Math.max(1, Math.floor(Number(quantity))) : 1
      const price = days * (item.pricePerDay || 100) * qty
      setRentalDays(days)
      setTotalPrice(price)
    } else {
      setRentalDays(0)
      setTotalPrice(0)
    }
  }, [dateFrom, dateTo, item, quantity])

  const isEditMode = mode === 'edit'
  // IMPORTANT: use LOCAL date, not UTC (toISOString), иначе на iOS "сегодня" может быть вчера/завтра
  const today = formatLocalDate(now)
  const currentTime = now.toTimeString().slice(0, 5) // HH:MM (local)

  const normalizeTime = (value) => {
    const v = String(value || '').trim()
    // Expect "HH:MM"; if something else slips in, return empty so we can ignore it.
    return /^\d{2}:\d{2}$/.test(v) ? v : ''
  }

  const maxTime = (a, b) => (a && b ? (a >= b ? a : b) : a || b)

  const minTimeFrom = !isEditMode && dateFrom === today ? currentTime : '00:00'
  const minTimeTo = dateFrom && dateTo && dateFrom === dateTo ? timeFrom : '00:00'

  // Жёстко не даём выставить прошедшее время для сегодняшней даты (кроме edit)
  useEffect(() => {
    // IMPORTANT: hooks must be called unconditionally; guard inside the effect.
    if (!isOpen || !item) return

    const tf = normalizeTime(timeFrom)
    const tt = normalizeTime(timeTo)

    if (!isEditMode && dateFrom === today && tf && tf < currentTime) {
      setTimeFrom(currentTime)
      // если возврат в тот же день — тоже подтянем
      if (dateTo === dateFrom && (tt && tt < currentTime)) {
        setTimeTo(currentTime)
      }
      return
    }

    if (dateTo && dateFrom && dateTo === dateFrom && tf && tt && tt < tf) {
      setTimeTo(tf)
    }
  }, [currentTime, dateFrom, dateTo, isEditMode, isOpen, timeFrom, timeTo, today])

  if (!isOpen || !item) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (dateFrom && dateTo) {
      if (!isEditMode && dateFrom === today && timeFrom < currentTime) return
      if (dateFrom === dateTo && timeTo < timeFrom) return
      const resolvedQty = Number.isFinite(Number(quantity)) ? Math.max(1, Math.floor(Number(quantity))) : 1
      onSubmit({
        dateFrom,
        dateTo,
        timeFrom,
        timeTo,
        quantity: resolvedQty,
      })
    }
  }

  // Получение минимального времени для сегодня
  const getMinTime = () => {
    if (!isEditMode && dateFrom === today) {
      return currentTime
    }
    return '00:00'
  }

  // Проверка валидности формы с учетом времени
  const isFormValid = dateFrom && dateTo && (() => {
    if (!isEditMode && dateFrom === today) {
      // Если выбрана сегодняшняя дата, проверяем что время не прошло
      return timeFrom >= currentTime
    }
    if (dateFrom === dateTo) return timeTo >= timeFrom
    return true
  })() && (maxQuantity > 0)

  // Обработчик изменения даты начала
  const handleDateFromChange = (e) => {
    const newDateFrom = e.target.value
    setDateFrom(newDateFrom)
    
    // Если выбрана сегодняшняя дата, установить минимальное время
    if (!isEditMode && newDateFrom === today && timeFrom < currentTime) {
      setTimeFrom(currentTime)
    }
  }

  const handleTimeFromChange = (e) => {
    const next = normalizeTime(e.target.value) || e.target.value
    if (!isEditMode && dateFrom === today) {
      const clamped = maxTime(normalizeTime(next), currentTime) || next
      setTimeFrom(clamped)
      if (dateTo === dateFrom && normalizeTime(timeTo) && normalizeTime(timeTo) < clamped) {
        setTimeTo(clamped)
      }
      return
    }
    setTimeFrom(next)
    if (dateTo === dateFrom && normalizeTime(timeTo) && normalizeTime(timeTo) < next) {
      setTimeTo(next)
    }
  }

  const handleTimeToChange = (e) => {
    const next = normalizeTime(e.target.value) || e.target.value
    if (dateTo === dateFrom) {
      const clamped = maxTime(normalizeTime(next), normalizeTime(timeFrom)) || next
      setTimeTo(clamped)
      return
    }
    setTimeTo(next)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="datetime-picker" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Закрыть" type="button">
          ×
        </button>
        <h3 className="datetime-picker__title">
          {mode === 'quick' ? 'Быстрая аренда' : mode === 'edit' ? 'Изменить даты аренды' : 'Добавить в корзину'}
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
                onChange={handleTimeFromChange}
                min={minTimeFrom || getMinTime()}
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
                onChange={handleTimeToChange}
                min={minTimeTo}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="qty">Количество (свободно: {availability.loading ? '...' : maxQuantity}{Number.isFinite(Number(availability.total)) ? ` из ${availability.total}` : ''})</label>
              <input
                type="number"
                id="qty"
                value={quantity}
                min={1}
                max={Math.max(1, maxQuantity || 1)}
                onChange={(e) => setQuantity(e.target.value)}
                required
                disabled={maxQuantity <= 0}
              />
              {availability.error && (
                <span className="form-error">{availability.error}</span>
              )}
              {!availability.error && maxQuantity <= 0 && (
                <span className="form-error">На выбранный период нет свободных единиц</span>
              )}
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
