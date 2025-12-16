import { useEffect, useMemo, useState } from 'react'
import { getProductImages } from '../utils/imageLoader'
import { formatBrand, formatBookedUntil } from '../utils/helpers'
import { useSwipeDownToClose } from '../utils/useSwipeDownToClose'

export const ProductModal = ({ item, onClose, onAddToCart, onQuickRent }) => {
  const [isMobile, setIsMobile] = useState(false)
  const [activeTab, setActiveTab] = useState('specs')

  // Блокировка скролла при открытом модальном окне
  useEffect(() => {
    if (item) {
      document.body.classList.add('no-scroll')
    } else {
      document.body.classList.remove('no-scroll')
    }
    return () => {
      document.body.classList.remove('no-scroll')
    }
  }, [item])

  // Сбрасываем вкладку при смене товара
  useEffect(() => {
    setActiveTab('specs')
  }, [item?.id, item?.name])

  const images = useMemo(() => getProductImages(item), [item])
  const [imageIndex, setImageIndex] = useState(0)
  const [isViewerOpen, setIsViewerOpen] = useState(false)

  const { targetRef, handleProps } = useSwipeDownToClose({ onClose, enabled: Boolean(item) })
  const { targetRef: viewerTargetRef, handleProps: viewerHandleProps } = useSwipeDownToClose({
    onClose: () => setIsViewerOpen(false),
    enabled: Boolean(item) && isViewerOpen && isMobile,
    threshold: 90,
  })

  useEffect(() => {
    setImageIndex(0)
    setIsViewerOpen(false)
  }, [item?.id, item?.name])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const apply = () => setIsMobile(Boolean(mq.matches))
    apply()
    // Safari < 14 fallback: addListener/removeListener
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
    mq.addListener(apply)
    return () => mq.removeListener(apply)
  }, [])

  useEffect(() => {
    if (!isViewerOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsViewerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isViewerOpen])

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

  const currentImage = images[Math.min(imageIndex, Math.max(0, images.length - 1))]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={targetRef} className="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-grabber" aria-hidden="true" {...handleProps}>
          <div className="sheet-grabber__pill" />
        </div>
        <button className="modal-close" onClick={onClose} aria-label="Закрыть" type="button">
          ×
        </button>
        <div className="modal-media" {...(isMobile ? handleProps : {})}>
          <div className="modal-carousel">
            <img
              src={currentImage}
              alt={item.name}
              onClick={() => {
                if (!isMobile) return
                if (!currentImage) return
                setIsViewerOpen(true)
              }}
              onKeyDown={(e) => {
                if (!isMobile) return
                if (!currentImage) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setIsViewerOpen(true)
                }
              }}
              role={isMobile ? 'button' : undefined}
              tabIndex={isMobile ? 0 : undefined}
              aria-label={isMobile ? 'Открыть фото на весь экран' : undefined}
            />
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
        {isViewerOpen && isMobile && (
          <div className="image-viewer" onClick={() => setIsViewerOpen(false)} role="dialog" aria-modal="true">
            <div className="image-viewer__grabber" aria-hidden="true" {...viewerHandleProps}>
              <div className="image-viewer__pill" />
            </div>
            <button
              className="image-viewer__close"
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIsViewerOpen(false)
              }}
              aria-label="Закрыть фото"
            >
              ×
            </button>
            <img
              className="image-viewer__img"
              ref={viewerTargetRef}
              src={currentImage}
              alt={item.name}
              onClick={(e) => e.stopPropagation()}
              {...viewerHandleProps}
            />
          </div>
        )}
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

          {/* Tabs */}
          {!isMobile && (
            <>
              <div className="modal-tabs">
                <button
                  type="button"
                  className={`modal-tab ${activeTab === 'specs' ? 'modal-tab--active' : ''}`}
                  onClick={() => setActiveTab('specs')}
                >
                  Характеристики
                </button>
                <button
                  type="button"
                  className={`modal-tab ${activeTab === 'description' ? 'modal-tab--active' : ''}`}
                  onClick={() => setActiveTab('description')}
                >
                  Описание
                </button>
                <button
                  type="button"
                  className={`modal-tab ${activeTab === 'equipment' ? 'modal-tab--active' : ''}`}
                  onClick={() => setActiveTab('equipment')}
                >
                  Комплектация
                </button>
              </div>

              <div className="modal-tab-content">
                {activeTab === 'specs' && (
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
                    {item.specs && typeof item.specs === 'object' && Object.entries(item.specs).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {activeTab === 'description' && (
                  <div>
                    {item.description ? (
                      <p>{item.description}</p>
                    ) : (
                      <p className="modal-tab-content--empty">Описание пока не добавлено</p>
                    )}
                  </div>
                )}

                {activeTab === 'equipment' && (
                  <div>
                    {item.equipment && item.equipment.length > 0 ? (
                      <ul className="modal-equipment-list">
                        {item.equipment.map((eq, idx) => (
                          <li key={idx}>{eq}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="modal-tab-content--empty">Комплектация пока не указана</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Mobile: show simple content without tabs */}
          {isMobile && (
            <>
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
            </>
          )}

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
