import { useRef, useState, useEffect } from 'react'
import { getProductImage } from '../utils/imageLoader'
import { formatBrand } from '../utils/helpers'

export const AutoSlider = ({ items, onSelectItem, onAddToCart, onQuickRent }) => {
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
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault()
        viewport.scrollLeft += e.deltaX
      } else {
        e.preventDefault()
        viewport.scrollLeft += e.deltaY
      }
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
          {duplicatedItems.map((item, idx) => (
            <article
              key={`${item.name}-${idx}`}
              className={`product ${isMobile ? 'slider__card-mobile' : 'slider__card-marquee'}`}
              onClick={() => onSelectItem(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => handleKeyDown(event, item)}
            >
              <div className="product__thumb">
                <img src={getProductImage(item)} alt={item.name} loading="lazy" />
              </div>
              <div className="product__meta">
                <span className="badge">{formatBrand(item.brand)}</span>
                <span className="badge badge--ghost">{item.category}</span>
              </div>
              <h3>{item.name}</h3>
              <p className="product__price">{item.pricePerDay || 100} сом/сутки</p>
              <div className="product__actions">
                <button
                  className="button primary"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onQuickRent(item)
                  }}
                >
                  Быстрая аренда
                </button>
                <button
                  className="button ghost"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onAddToCart(item)
                  }}
                >
                  В корзину
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
