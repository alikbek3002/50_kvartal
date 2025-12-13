import { useEffect, useMemo, useState } from 'react'
import { getProductImages } from '../utils/imageLoader'
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

  const images = useMemo(() => getProductImages(item), [item])
  const [imageIndex, setImageIndex] = useState(0)

  useEffect(() => {
    setImageIndex(0)
  }, [item?.id, item?.name])

  if (!item) return null
  const stock = Number.isFinite(Number(item?.stock)) ? Number(item.stock) : 0
  const hasAvailabilityV2 =
    item &&
    (Object.prototype.hasOwnProperty.call(item, 'availableNow') ||
      Object.prototype.hasOwnProperty.call(item, 'busyUnitsNow') ||
      Object.prototype.hasOwnProperty.call(item, 'nextAvailableAt'))
  const availableNow = Number.isFinite(Number(item?.availableNow)) ? Number(item.availableNow) : stock
  const busyUnitsNow = Number.isFinite(Number(item?.busyUnitsNow)) ? Number(item.busyUnitsNow) : 0
  const nextAvailableAt = item?.nextAvailableAt
  const bookedUntilLegacy = item?.bookedUntil
  const isOutOfStock = stock <= 0
  const isBookedNow = hasAvailabilityV2
    ? !isOutOfStock && busyUnitsNow > 0
    : !isOutOfStock && bookedUntilLegacy && new Date(bookedUntilLegacy).getTime() > Date.now()
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Закрыть" type="button">
          ×
        </button>
        <div className="modal-media">
          <div className="modal-carousel">
            <img src={images[Math.min(imageIndex, images.length - 1)]} alt={item.name} />
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  className="modal-carousel__button modal-carousel__button--prev"
                  onClick={() => setImageIndex((prev) => (prev - 1 + images.length) % images.length)}
                  aria-label="Предыдущее фото"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="modal-carousel__button modal-carousel__button--next"
                  onClick={() => setImageIndex((prev) => (prev + 1) % images.length)}
                  aria-label="Следующее фото"
                >
                  ›
                </button>
                <div className="modal-carousel__counter">{imageIndex + 1} / {images.length}</div>
              </>
            )}
          </div>
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
                : hasAvailabilityV2
                  ? isBookedNow
                    ? nextAvailableAt
                      ? `Бронь до ${formatBookedUntil(nextAvailableAt)}`
                      : 'Забронировано'
                    : `Доступно сейчас: ${Math.max(0, availableNow)} из ${stock}`
                  : isBookedNow
                    ? bookedUntilLegacy
                      ? `Забронировано до ${formatBookedUntil(bookedUntilLegacy)}`
                      : 'Забронировано'
                    : 'Доступно'}
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
            <button
              className="button primary modal-cta"
              type="button"
              onClick={() => onQuickRent(item)}
              disabled={isOutOfStock || (!hasAvailabilityV2 && isBookedNow)}
            >
              Быстрая аренда
            </button>
            <button
              className="button ghost modal-cta"
              type="button"
              onClick={() => onAddToCart(item)}
              disabled={isOutOfStock || (!hasAvailabilityV2 && isBookedNow)}
            >
              Добавить в корзину
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
