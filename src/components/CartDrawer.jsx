import { useEffect } from 'react'
import { getProductImage } from '../utils/imageLoader'

export const CartDrawer = ({ isOpen, items, onClose, onRemove, onCheckout, onEditDate }) => {
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

  const totalCost = items.reduce((sum, { item, rentalPeriod }) => {
    if (!rentalPeriod) return sum
    const days = Math.ceil((new Date(rentalPeriod.dateTo) - new Date(rentalPeriod.dateFrom)) / (1000 * 60 * 60 * 24)) + 1
    return sum + days * (item.pricePerDay || 100)
  }, 0)

  return (
    <div className="cart-overlay" onClick={onClose}>
      <div className="cart-panel" onClick={(event) => event.stopPropagation()}>
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
                const days = rentalPeriod 
                  ? Math.ceil((new Date(rentalPeriod.dateTo) - new Date(rentalPeriod.dateFrom)) / (1000 * 60 * 60 * 24)) + 1 
                  : 0
                const cost = days * (item.pricePerDay || 100)
                
                return (
                  <li key={`${item.name}-${index}`} className="cart-item">
                    <div className="cart-item__thumb">
                      <img src={getProductImage(item)} alt={item.name} />
                    </div>
                    <div className="cart-item__body">
                      <h4>{item.name}</h4>
                      {rentalPeriod && (
                        <p className="cart-item__period">
                          {new Date(rentalPeriod.dateFrom).toLocaleDateString('ru-RU')} - {new Date(rentalPeriod.dateTo).toLocaleDateString('ru-RU')}
                          <br />
                          <small>{rentalPeriod.timeFrom} - {rentalPeriod.timeTo}</small>
                        </p>
                      )}
                      <p className="cart-item__cost">{days} дн. × {item.pricePerDay || 100} сом = {cost} сом</p>
                      <div className="cart-item__actions">
                        <button type="button" className="ghost-link" onClick={() => onEditDate(item.name)}>
                          Изменить даты
                        </button>
                        <button type="button" className="ghost-link" onClick={() => onRemove(item.name)}>
                          Удалить
                        </button>
                      </div>
                    </div>
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
