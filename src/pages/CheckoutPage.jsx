import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProductImage } from '../utils/imageLoader'
import { sendOrderToTelegram } from '../utils/telegram'

export const CheckoutPage = ({ items, onRemove, onClearCart }) => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState(false)

  useEffect(() => {
    // Some browsers (esp. mobile) may keep scroll position between route changes.
    requestAnimationFrame(() => {
      window.scrollTo(0, 0)
    })
  }, [])

  useEffect(() => {
    if (!submitSuccess) return

    // После успешной отправки iOS Safari часто оставляет пользователя внизу
    // (из-за сохранённой позиции скролла при перерисовке). Возвращаем к хедеру.
    const scrollToHeader = () => {
      const header = document.querySelector('header.topbar') || document.querySelector('header')
      if (header && typeof header.scrollIntoView === 'function') {
        header.scrollIntoView({ block: 'start' })
        return
      }
      window.scrollTo(0, 0)
    }

    requestAnimationFrame(scrollToHeader)
  }, [submitSuccess])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError(false)

    try {
      const success = await sendOrderToTelegram(formData, items)

      if (success) {
        setIsSubmitting(false)
        setSubmitSuccess(true)
        onClearCart()
      } else {
        setIsSubmitting(false)
        setSubmitError(true)
      }
    } catch (error) {
      console.error('Error submitting order:', error)
      setIsSubmitting(false)
      setSubmitError(error?.message || true)
    }
  }

  const isFormValid = formData.name.trim() && formData.phone.trim() && formData.address.trim()

  const totalCost = items.reduce((sum, { item, count, rentalPeriod }) => {
    const days = Math.ceil((new Date(rentalPeriod.dateTo) - new Date(rentalPeriod.dateFrom)) / (1000 * 60 * 60 * 24)) + 1
    const qty = Number.isFinite(Number(count)) ? Math.max(1, Math.floor(Number(count))) : 1
    return sum + days * (item.pricePerDay || 100) * qty
  }, 0)

  if (items.length === 0 && !submitSuccess) {
    return (
      <main className="checkout-page">
        <div className="container">
          <div className="checkout-page__empty">
            <h2>Корзина пуста</h2>
            <p>Добавьте товары в корзину для оформления заказа</p>
            <button className="button primary" onClick={() => navigate('/catalog')}>
              Перейти в каталог
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="checkout-page">
      <div className="container">
        {submitSuccess ? (
          <div className="checkout-success">
            <svg className="checkout-success__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <h2>Заявка успешно отправлена!</h2>
            <p className="checkout-success__message">
              Наш менеджер свяжется с вами в течение часа для подтверждения бронирования.
            </p>
            <div className="checkout-success__contact">
              <p>Или вы можете связаться с нами:</p>
              <a href="tel:+79990001122" className="checkout-success__phone">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                +7 (999) 000-11-22
              </a>
            </div>
            <button 
              className="button primary checkout-success__button" 
              onClick={() => {
                setSubmitSuccess(false)
                setFormData({
                  name: '',
                  phone: '',
                  address: '',
                })
                navigate('/')
              }}
            >
              Вернуться на главную
            </button>
          </div>
        ) : (
          <div className="checkout-page__content">
            <h2 className="checkout-page__title">Оформление заказа</h2>
            
            <div className="checkout-page__grid">
              <div className="checkout-page__items">
                <h3>Ваш заказ:</h3>
                <div className="checkout-items-list">
                  {items.map(({ item, count, rentalPeriod }, index) => {
                    const days = Math.ceil((new Date(rentalPeriod.dateTo) - new Date(rentalPeriod.dateFrom)) / (1000 * 60 * 60 * 24)) + 1
                    const qty = Number.isFinite(Number(count)) ? Math.max(1, Math.floor(Number(count))) : 1
                    const cost = days * (item.pricePerDay || 100) * qty
                    
                    return (
                      <div key={`${item.name}-${index}`} className="checkout-item">
                        <div className="checkout-item__image">
                          <img src={getProductImage(item)} alt={item.name} />
                        </div>
                        <div className="checkout-item__details">
                          <h5>{item.name}</h5>
                          <p className="checkout-item__period" style={{ marginTop: 6 }}>
                            Количество: <strong>{qty}</strong>
                          </p>
                          <p className="checkout-item__period">
                            {new Date(rentalPeriod.dateFrom).toLocaleDateString('ru-RU')} - {new Date(rentalPeriod.dateTo).toLocaleDateString('ru-RU')}
                            <br />
                            {rentalPeriod.timeFrom} - {rentalPeriod.timeTo}
                          </p>
                          <p className="checkout-item__cost">{days} дн. × {item.pricePerDay || 100} сом × {qty} = {cost} сом</p>
                        </div>
                        <button 
                          type="button" 
                          className="checkout-item__remove" 
                          onClick={() => onRemove(item.name)}
                          aria-label="Удалить товар"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div className="checkout-total">
                  <strong>Итого:</strong> <span>{totalCost} сом</span>
                </div>
              </div>

              <div className="checkout-page__form-wrapper">
                <form onSubmit={handleSubmit} className="checkout-page__form">
                  <h3>Контактные данные:</h3>
                  
                  <div className="form-group">
                    <label htmlFor="checkout-name">ФИО</label>
                    <input
                      type="text"
                      id="checkout-name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Иванов Иван Иванович"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="checkout-phone">Номер телефона</label>
                    <input
                      type="tel"
                      id="checkout-phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+996 (999) 000-000"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="checkout-address">Адрес доставки</label>
                    <input
                      type="text"
                      id="checkout-address"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder="Город, улица, дом"
                      required
                    />
                  </div>

                  {submitError && (
                    <div className="error-message">
                      ⚠️ {typeof submitError === 'string' ? submitError : 'Ошибка отправки. Проверьте настройки бота или попробуйте позже.'}
                    </div>
                  )}

                  <div className="checkout-page__actions">
                    <button type="button" className="button ghost" onClick={() => navigate(-1)}>
                      Назад
                    </button>
                    <button type="submit" className="button primary" disabled={!isFormValid || isSubmitting}>
                      {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
