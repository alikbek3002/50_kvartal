import { useEffect, useMemo, useState } from 'react'
import { getProductImage } from '../utils/imageLoader'
import { useSwipeDownToClose } from '../utils/useSwipeDownToClose'

export const CartDrawer = ({ isOpen, items, onClose, onRemove, onCheckout, onEditDate }) => {
  const { targetRef, handleProps } = useSwipeDownToClose({ onClose, enabled: Boolean(isOpen) })
  const [expandedKey, setExpandedKey] = useState(null)

  // Блокировка скролла при открытой корзине
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

  if (!isOpen) return null

  const itemKeys = useMemo(() => items.map(({ item }, index) => `${item?.name ?? 'item'}-${index}`), [items])

  const toggleExpanded = (key) => {
    setExpandedKey((prev) => (prev === key ? null : key))
  }

  const totalCost = items.reduce((sum, { item, rentalPeriod }) => {
    if (!rentalPeriod) return sum
    const days = Math.ceil((new Date(rentalPeriod.dateTo) - new Date(rentalPeriod.dateFrom)) / (1000 * 60 * 60 * 24)) + 1
    return sum + days * (item.pricePerDay || 100)
  }, 0)

  return (
    <div className="cart-overlay" onClick={onClose}>
      <div ref={targetRef} className="cart-panel" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-grabber" aria-hidden="true" {...handleProps}>
          <div className="sheet-grabber__pill" />
        </div>
        <div className="cart-panel__header">
          <h3>Корзина</h3>
          <button className="cart-close" onClick={onClose} aria-label="Закрыть корзину" type="button">
            ×
          </button>
        </div>

        {items.length === 0 ? (
          <p className="cart-empty">Добавьте позиции, чтобы оформить заявку.</p>
        ) : (
          <>
            <ul className="cart-list">
              {items.map(({ item, count, rentalPeriod }, index) => {
                const key = itemKeys[index] ?? `${item?.name ?? 'item'}-${index}`
                const days = rentalPeriod 
                  ? Math.ceil((new Date(rentalPeriod.dateTo) - new Date(rentalPeriod.dateFrom)) / (1000 * 60 * 60 * 24)) + 1 
                  : 0
                const cost = days * (item.pricePerDay || 100)
                const isExpanded = expandedKey === key
                
                return (
                  <li key={key} className={`cart-item ${isExpanded ? 'is-expanded' : ''}`}>
                    <button
                      type="button"
                      className="cart-item__summary"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleExpanded(key)
                      }}
                      aria-expanded={isExpanded}
                    >
                      <div className="cart-item__thumb">
                        <img src={getProductImage(item)} alt={item.name} />
                      </div>
                      <div className="cart-item__body">
                        <h4 className="cart-item__title">{item.name}</h4>
                        <p className="cart-item__period">
                          {rentalPeriod
                            ? (
                              <>
                                {new Date(rentalPeriod.dateFrom).toLocaleDateString('ru-RU')} - {new Date(rentalPeriod.dateTo).toLocaleDateString('ru-RU')}
                                <br />
                                <small>{rentalPeriod.timeFrom} - {rentalPeriod.timeTo}</small>
                              </>
                            )
                            : 'Укажите период аренды'}
                        </p>
                      </div>
                      <span className="cart-item__chevron" aria-hidden="true">›</span>
                    </button>

                    {isExpanded && (
                      <div className="cart-item__details">
                        <p className="cart-item__cost">{days} дн. × {item.pricePerDay || 100} сом = {cost} сом</p>
                        <div className="cart-item__actions">
                          <button
                            type="button"
                            className="ghost-link"
                            onClick={(e) => {
                              e.stopPropagation()
                              onEditDate(item.name)
                            }}
                          >
                            Изменить даты
                          </button>
                          <button
                            type="button"
                            className="ghost-link"
                            onClick={(e) => {
                              e.stopPropagation()
                              onRemove(item.name)
                            }}
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="cart-panel__footer">
              <div className="cart-total">
                <strong>Итого:</strong>
                <span>{totalCost} сом</span>
              </div>
              <button
                type="button"
                className="button primary"
                onClick={onCheckout}
              >
                Оформить заказ
              </button>
              <p className="modal-stock-note">Укажите контактные данные</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
