import { useState, useEffect } from 'react'
import { getProductImage } from '../utils/imageLoader'
import { sendOrderToTelegram } from '../utils/telegram'

export const CheckoutModal = ({ isOpen, items, onClose, onRemove, onClearCart }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState(false)

  // Блокировка скролла при открытом модальном окне
  useEffect(() => {
    if (isOpen) {
      // Прокручиваем страницу вверх перед блокировкой
      window.scrollTo(0, 0)
      
      // Сохраняем текущую позицию прокрутки
      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.body.style.width = '100%'
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
      document.documentElement.style.position = 'relative'
      document.documentElement.style.height = '100%'
      
      // Блокируем touchmove на body для мобильных устройств
      const preventScroll = (e) => {
        if (!e.target.closest('.checkout-modal')) {
          e.preventDefault()
        }
      }
      document.addEventListener('touchmove', preventScroll, { passive: false })
      
      return () => {
        document.removeEventListener('touchmove', preventScroll)
      }
    } else {
      // Восстанавливаем прокрутку при закрытии
      const scrollY = document.body.style.top
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.width = ''
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
      document.documentElement.style.position = ''
      document.documentElement.style.height = ''
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1)
      }
    }
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.width = ''
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
      document.documentElement.style.position = ''
      document.documentElement.style.height = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError(false)

    // Прокручиваем модальное окно вверх при отправке
    const modal = document.querySelector('.checkout-modal')
    if (modal) {
      modal.scrollTop = 0
    }

    try {
      const success = await sendOrderToTelegram(formData, items)

      if (success) {
        setIsSubmitting(false)
        setSubmitSuccess(true)
        onClearCart()
        
        // Прокручиваем к началу чтобы показать сообщение об успехе
        if (modal) {
          modal.scrollTop = 0
        }
        
        setTimeout(() => {
          setSubmitSuccess(false)
          setFormData({
            name: '',
            phone: '',
            address: '',
          })
          onClose()
        }, 3000)
      } else {
        setIsSubmitting(false)
        setSubmitError(true)
      }
    } catch (error) {
      console.error('Error submitting order:', error)
      setIsSubmitting(false)
      setSubmitError(true)
    }
  }

  const isFormValid = formData.name.trim() && formData.phone.trim() && formData.address.trim()

  const totalCost = items.reduce((sum, { item, rentalPeriod }) => {
    const days = Math.ceil((new Date(rentalPeriod.dateTo) - new Date(rentalPeriod.dateFrom)) / (1000 * 60 * 60 * 24)) + 1
    return sum + days * (item.pricePerDay || 100)
  }, 0)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="checkout-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Закрыть" type="button">
          ×
        </button>
        
        {submitSuccess ? (
          <div className="checkout-success">
            <svg className="checkout-success__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <h4>Заявка отправлена!</h4>
            <p>Менеджер свяжется с вами в ближайшее время для подтверждения бронирования.</p>
          </div>
        ) : (
          <>
            <h3 className="checkout-modal__title">Оформление заказа</h3>
            
            <form onSubmit={handleSubmit} className="checkout-modal__form">
              <h4>Контактные данные:</h4>
              
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
                  ⚠️ Ошибка отправки. Проверьте настройки бота или попробуйте позже.
                </div>
              )}
            </form>

            <div className="checkout-modal__items">
              <h4>Ваш заказ:</h4>
              <div className="checkout-items-list">
                {items.map(({ item, count, rentalPeriod }, index) => {
                  const days = Math.ceil((new Date(rentalPeriod.dateTo) - new Date(rentalPeriod.dateFrom)) / (1000 * 60 * 60 * 24)) + 1
                  const cost = days * (item.pricePerDay || 100)
                  
                  return (
                    <div key={`${item.name}-${index}`} className="checkout-item">
                      <div className="checkout-item__image">
                        <img src={getProductImage(item)} alt={item.name} />
                      </div>
                      <div className="checkout-item__details">
                        <h5>{item.name}</h5>
                        <p className="checkout-item__period">
                          {new Date(rentalPeriod.dateFrom).toLocaleDateString('ru-RU')} - {new Date(rentalPeriod.dateTo).toLocaleDateString('ru-RU')}
                          <br />
                          {rentalPeriod.timeFrom} - {rentalPeriod.timeTo}
                        </p>
                        <p className="checkout-item__cost">{days} дн. × {item.pricePerDay || 100} сом = {cost} сом</p>
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

            <div className="checkout-modal__actions">
              <button type="button" className="button ghost" onClick={onClose}>
                Отмена
              </button>
              <button type="submit" className="button primary" disabled={!isFormValid || isSubmitting} onClick={handleSubmit}>
                {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
