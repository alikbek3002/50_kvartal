import { useNavigate } from 'react-router-dom'
import { getProductImage } from '../utils/imageLoader'

export const CartPage = ({ items, onRemove, onEditDate, onClearCart }) => {
  const navigate = useNavigate()

  const totalCost = items.reduce((sum, { item, count, rentalPeriod }) => {
    if (!rentalPeriod) return sum
    const days = Math.ceil((new Date(rentalPeriod.dateTo) - new Date(rentalPeriod.dateFrom)) / (1000 * 60 * 60 * 24)) + 1
    const qty = Number.isFinite(Number(count)) ? Math.max(1, Math.floor(Number(count))) : 1
    return sum + days * (item.pricePerDay || 100) * qty
  }, 0)

  const handleCheckout = () => {
    navigate('/checkout')
  }

  return (
    <div className="page-content">
      <div className="container">
        <div className="cart-page">
          {items.length > 0 && (
            <div className="cart-page__header">
              <button 
                className="button ghost" 
                onClick={() => navigate(-1)}
                type="button"
              >
                ← Назад
              </button>
              <h1>Корзина</h1>
            </div>
          )}

          {items.length === 0 ? (
            <div className="cart-page__empty">
              <p>Корзина пуста</p>
              <p className="cart-empty-subtitle">Добавьте позиции, чтобы оформить заявку</p>
              <button 
                className="button primary" 
                onClick={() => navigate('/catalog')}
                type="button"
              >
                Перейти в каталог
              </button>
            </div>
          ) : (
            <>
              <div className="cart-page__items">
                {items.map(({ item, count, rentalPeriod }, index) => {
                  const days = rentalPeriod 
                    ? Math.ceil((new Date(rentalPeriod.dateTo) - new Date(rentalPeriod.dateFrom)) / (1000 * 60 * 60 * 24)) + 1 
                    : 0
                  const qty = Number.isFinite(Number(count)) ? Math.max(1, Math.floor(Number(count))) : 1
                  const cost = days * (item.pricePerDay || 100) * qty
                  
                  return (
                    <div key={`${item.name}-${index}`} className="cart-page__item">
                      <div className="cart-page__item-image">
                        <img src={getProductImage(item)} alt={item.name} />
                      </div>
                      <div className="cart-page__item-body">
                        <h3>{item.name}</h3>
                        <p className="cart-page__item-cost" style={{ marginTop: -8, marginBottom: 10 }}>
                          Количество: <strong>{qty}</strong>
                        </p>
                        {rentalPeriod && (
                          <div className="cart-page__item-period">
                            <strong>Период аренды:</strong>
                            <p>
                              {new Date(rentalPeriod.dateFrom).toLocaleDateString('ru-RU')} - {new Date(rentalPeriod.dateTo).toLocaleDateString('ru-RU')}
                            </p>
                            <p className="cart-page__item-time">
                              {rentalPeriod.timeFrom} - {rentalPeriod.timeTo}
                            </p>
                          </div>
                        )}
                        <p className="cart-page__item-cost">
                          {days} дн. × {item.pricePerDay || 100} сом × {qty} = <strong>{cost} сом</strong>
                        </p>
                      </div>
                      <div className="cart-page__item-actions">
                        <button 
                          type="button" 
                          className="button ghost" 
                          onClick={() => onEditDate(item.name)}
                        >
                          Изменить даты
                        </button>
                        <button 
                          type="button" 
                          className="button ghost danger" 
                          onClick={() => onRemove(item.name)}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="cart-page__footer">
                <div className="cart-page__summary">
                  <div className="cart-page__total">
                    <span>Итого:</span>
                    <strong>{totalCost} сом</strong>
                  </div>
                  <p className="cart-page__note">Укажите контактные данные для оформления заказа</p>
                </div>
                <div className="cart-page__actions">
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => navigate('/catalog')}
                  >
                    Продолжить покупки
                  </button>
                  <button
                    type="button"
                    className="button primary"
                    onClick={handleCheckout}
                  >
                    Оформить заказ
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
