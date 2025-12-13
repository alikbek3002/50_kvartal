import { useEffect } from 'react'
import { getProductImage } from '../utils/imageLoader'
import { formatBrand, formatBookedUntil } from '../utils/helpers'

export const ProductModal = ({ item, onClose, onAddToCart, onQuickRent }) => {
  // Блокировка скролла при открытом модальном окне
  useEffect(() => {
    if (item) {
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
        if (!e.target.closest('.modal-card')) {
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
  }, [item])

  if (!item) return null
  const stock = Number.isFinite(Number(item?.stock)) ? Number(item.stock) : 0
  const availableNow = Number.isFinite(Number(item?.availableNow)) ? Number(item.availableNow) : stock
  const nextAvailableAt = item?.nextAvailableAt
  const isOutOfStock = stock <= 0
  const isAllBusyNow = !isOutOfStock && availableNow <= 0
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Закрыть" type="button">
          ×
        </button>
        <div className="modal-media">
          <img src={getProductImage(item)} alt={item.name} />
        </div>
        <div className="modal-details">
          <div className="modal-tags">
            <span className="badge">{formatBrand(item.brand)}</span>
            <span className="badge badge--ghost">{item.category}</span>
          </div>
          <h3>{item.name}</h3>
          <div className="modal-status">
            <span className="modal-stock-note">
              {isOutOfStock
                ? 'Нет в наличии'
                : isAllBusyNow
                  ? nextAvailableAt
                    ? `Сейчас занято · свободно с ${formatBookedUntil(nextAvailableAt)}`
                    : 'Сейчас занято'
                  : `Доступно сейчас: ${Math.max(0, availableNow)} из ${stock}`}
            </span>
            <span className="modal-price">{item.pricePerDay || 100} сом/сутки</span>
          </div>
          <p className="modal-copy">
            Устройство проходит сервис перед выдачей: проверяем крепёж, оптику и комплект кабелей. Сообщите даты и мы подготовим
            оборудование.
          </p>
          <dl className="modal-specs">
            <div>
              <dt>Категория</dt>
              <dd>{item.category}</dd>
            </div>
            <div>
              <dt>Бренд</dt>
              <dd>{formatBrand(item.brand)}</dd>
            </div>
            <div>
              <dt>Цена аренды</dt>
              <dd>{item.pricePerDay || 100} сом/сутки</dd>
            </div>
          </dl>
          <div className="modal-actions">
            <button className="button primary modal-cta" type="button" onClick={() => onQuickRent(item)} disabled={isOutOfStock}>
              Быстрая аренда
            </button>
            <button className="button ghost modal-cta" type="button" onClick={() => onAddToCart(item)} disabled={isOutOfStock}>
              Добавить в корзину
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
