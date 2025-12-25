import { useRef, useState, useEffect } from 'react'
import { getProductImage } from '../utils/imageLoader'
import { formatBrand, formatBookedUntil } from '../utils/helpers'
import { getEffectiveMainCategory } from '../utils/categories'

export const AutoSlider = ({ items, onSelectItem, onAddToCart, onQuickRent, cartItems = [] }) => {
  const trackRef = useRef(null)
  const viewportRef = useRef(null)
  const [isPaused, setIsPaused] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Поддержка прокрутки колесом мыши
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || isMobile) return

    const handleWheel = (e) => {
      // Реагируем только на явную горизонтальную прокрутку
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault()
        viewport.scrollLeft += e.deltaX
      }
      // Вертикальную прокрутку не перехватываем - даем странице прокручиваться
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [isMobile])

  const handleKeyDown = (event, item) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelectItem(item)
    }
  }

  const duplicatedItems = isMobile ? items : [...items, ...items]

  return (
    <div
      className={`slider ${isMobile ? 'slider--mobile' : 'slider--marquee'}`}
      onMouseEnter={() => !isMobile && setIsPaused(true)}
      onMouseLeave={() => !isMobile && setIsPaused(false)}
    >
      <div className="slider__viewport" ref={viewportRef}>
        <div
          ref={trackRef}
          className={`${isMobile ? 'slider__track-mobile' : 'slider__track-marquee'} ${isPaused && !isMobile ? 'slider__track-marquee--paused' : ''}`}
        >
          {duplicatedItems.map((item, idx) => {
            const isInCart = cartItems.some(cartItem => cartItem.item.name === item.name)
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
            <article
              key={`${item.name}-${idx}`}
              className={`product ${isMobile ? 'slider__card-mobile' : 'slider__card-marquee'} ${isInCart ? 'product--in-cart' : ''} ${isBookedNow ? 'product--booked' : ''}`}
              onClick={() => onSelectItem(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => handleKeyDown(event, item)}
            >
              <div className="product__thumb">
                <img src={getProductImage(item)} alt={item.name} loading="lazy" />
                {isInCart && <div className="product__in-cart-badge">В корзине</div>}
                {(isOutOfStock || isBookedNow) && (
                  <div className="product__booked-badge">
                    {isOutOfStock
                      ? 'Нет в наличии'
                      : hasAvailabilityV2
                        ? nextAvailableAt
                          ? `Бронь до ${formatBookedUntil(nextAvailableAt)}`
                          : 'Забронировано'
                        : bookedUntilLegacy
                          ? `Забронировано до ${formatBookedUntil(bookedUntilLegacy)}`
                          : 'Забронировано'}
                  </div>
                )}
              </div>
              <div className="product__meta">
                <span className="badge">{formatBrand(item.brand)}</span>
                <span className="badge badge--ghost">{getEffectiveMainCategory(item) || item.category}</span>
                {!isOutOfStock && hasAvailabilityV2 && (
                  <span className="badge badge--ghost">Свободно: {Math.max(0, availableNow)} из {stock}</span>
                )}
              </div>
              <h3>{item.name}</h3>
              <p className="product__price">{item.pricePerDay || 100} сом/сутки</p>
              <div className="product__actions">
                <button
                  className="button primary"
                  type="button"
                  disabled={isOutOfStock || (!hasAvailabilityV2 && isBookedNow)}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (isOutOfStock || (!hasAvailabilityV2 && isBookedNow)) return
                    onQuickRent(item)
                  }}
                >
                  Быстрая аренда
                </button>
                <button
                  className="button ghost"
                  type="button"
                  disabled={isOutOfStock || (!hasAvailabilityV2 && isBookedNow)}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (isOutOfStock || (!hasAvailabilityV2 && isBookedNow)) return
                    onAddToCart(item)
                  }}
                >
                  В корзину
                </button>
              </div>
            </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
