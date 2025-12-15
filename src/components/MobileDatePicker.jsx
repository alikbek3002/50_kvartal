import { useState, useEffect } from 'react'
import { useSwipeDownToClose } from '../utils/useSwipeDownToClose'

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]

const formatDate = (d) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseDate = (str) => {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const MobileDatePicker = ({ value, onChange, minDate, label, id }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => {
    const v = parseDate(value)
    return v || new Date()
  })

  const { targetRef, handleProps } = useSwipeDownToClose({
    onClose: () => setIsOpen(false),
    enabled: isOpen,
    threshold: 80
  })

  // Обновляем viewDate когда меняется value
  useEffect(() => {
    const v = parseDate(value)
    if (v) setViewDate(v)
  }, [value])

  const today = formatDate(new Date())
  const minDateStr = minDate || today

  const handleDayClick = (dateStr) => {
    if (dateStr < minDateStr) return // Прошедшие даты - не кликабельны
    onChange(dateStr)
    setIsOpen(false)
  }

  const prevMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  // Генерация дней месяца
  const generateDays = () => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    // День недели первого числа (0 = Вс, 1 = Пн, ...)
    let startDay = firstDay.getDay()
    // Преобразуем в формат Пн = 0
    startDay = startDay === 0 ? 6 : startDay - 1
    
    const days = []
    
    // Пустые ячейки до первого дня
    for (let i = 0; i < startDay; i++) {
      days.push({ empty: true, key: `empty-${i}` })
    }
    
    // Дни месяца
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = formatDate(new Date(year, month, d))
      const isPast = dateStr < minDateStr
      const isSelected = dateStr === value
      const isToday = dateStr === today
      
      days.push({
        day: d,
        dateStr,
        isPast,
        isSelected,
        isToday,
        key: dateStr
      })
    }
    
    return days
  }

  const displayValue = value
    ? parseDate(value)?.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Выберите дату'

  // Проверка - можно ли перейти на предыдущий месяц
  const canGoPrev = () => {
    const prevMonthLast = new Date(viewDate.getFullYear(), viewDate.getMonth(), 0)
    return formatDate(prevMonthLast) >= minDateStr
  }

  return (
    <div className="mobile-date-picker">
      <label htmlFor={id}>{label}</label>
      <button
        type="button"
        className="mobile-date-picker__trigger"
        onClick={() => setIsOpen(true)}
      >
        {displayValue}
      </button>

      {isOpen && (
        <div className="mobile-date-picker__overlay" onClick={() => setIsOpen(false)}>
          <div className="mobile-date-picker__modal" ref={targetRef} onClick={(e) => e.stopPropagation()}>
            {/* Grabber для свайпа вниз */}
            <div className="mobile-date-picker__grabber" {...handleProps}>
              <div className="mobile-date-picker__pill" />
            </div>
            <div className="mobile-date-picker__header">
              <button
                type="button"
                className="mobile-date-picker__nav"
                onClick={prevMonth}
                disabled={!canGoPrev()}
              >
                ‹
              </button>
              <span className="mobile-date-picker__title">
                {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
              </span>
              <button
                type="button"
                className="mobile-date-picker__nav"
                onClick={nextMonth}
              >
                ›
              </button>
            </div>

            <div className="mobile-date-picker__weekdays">
              {DAYS.map(d => (
                <span key={d} className="mobile-date-picker__weekday">{d}</span>
              ))}
            </div>

            <div className="mobile-date-picker__days">
              {generateDays().map(day => (
                day.empty ? (
                  <span key={day.key} className="mobile-date-picker__day mobile-date-picker__day--empty" />
                ) : (
                  <button
                    key={day.key}
                    type="button"
                    className={`mobile-date-picker__day${day.isPast ? ' mobile-date-picker__day--disabled' : ''}${day.isSelected ? ' mobile-date-picker__day--selected' : ''}${day.isToday ? ' mobile-date-picker__day--today' : ''}`}
                    onClick={() => handleDayClick(day.dateStr)}
                    disabled={day.isPast}
                  >
                    {day.day}
                  </button>
                )
              ))}
            </div>

            <button
              type="button"
              className="mobile-date-picker__close"
              onClick={() => setIsOpen(false)}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
