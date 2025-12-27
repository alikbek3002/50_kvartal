import { useState, useMemo, useEffect, useRef } from 'react'
import { getProductImage } from '../utils/imageLoader'
import { formatBrand, formatBookedUntil } from '../utils/helpers'
import { getEffectiveMainCategory } from '../utils/categories'

export const CatalogPage = ({ items, onSelectItem, onAddToCart, onQuickRent, categoryChips, cartItems = [] }) => {
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchTimeoutRef = useRef(null)
  const suggestionsTimeoutRef = useRef(null)

  // Debounce search query
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
      if (suggestionsTimeoutRef.current) clearTimeout(suggestionsTimeoutRef.current)
    }
  }, [])

  const toSearchString = (value) => String(value ?? '').toLowerCase()

  const filteredItems = useMemo(() => {
    let result = items

    if (selectedCategory) {
      result = result.filter((item) => getEffectiveMainCategory(item) === selectedCategory)
    }

    if (debouncedSearchQuery.trim()) {
      const query = toSearchString(debouncedSearchQuery.trim())
      result = result.filter((item) => {
        const name = toSearchString(item?.name)
        const category = toSearchString(getEffectiveMainCategory(item) || item?.category)
        const brand = toSearchString(item?.brand)
        return name.includes(query) || category.includes(query) || brand.includes(query)
      })
    }

    return result
  }, [items, selectedCategory, debouncedSearchQuery])

  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return []
    
    const query = toSearchString(searchQuery.trim())
    const matches = items
      .filter((item) => toSearchString(item?.name).includes(query))
      .slice(0, 5)
    
    return matches
  }, [items, searchQuery, toSearchString])

  return (
    <main>
      <section className="catalog catalog--page">
        <div className="container">
          <div className="section__heading">
            <p className="eyebrow">Каталог</p>
            <h2>Соберите комплект под задачу</h2>
          </div>

          <div className="catalog__search-wrapper">
            <div className="catalog__search">
              <input
                type="text"
                placeholder="Поиск оборудования..."
                value={searchQuery}
                autoComplete="off"
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                  if (suggestionsTimeoutRef.current) {
                    clearTimeout(suggestionsTimeoutRef.current)
                  }
                  suggestionsTimeoutRef.current = setTimeout(() => setShowSuggestions(false), 200)
                }}
                className="catalog__search-input"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="catalog__suggestions">
                  {suggestions.map((item) => (
                    <div
                      key={item.id ?? item.name}
                      className="catalog__suggestion"
                      onClick={() => {
                        onSelectItem(item)
                        setSearchQuery('')
                        setShowSuggestions(false)
                      }}
                    >
                      <img src={getProductImage(item)} alt={item.name} />
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="catalog__chips">
            <span className="catalog__chips-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              Категории:
            </span>
            <button
              className={`chip ${!selectedCategory ? 'chip--active' : ''}`}
              onClick={() => {
                setSelectedCategory(null)
              }}
            >
              Все
            </button>
            {categoryChips.map(([category]) => (
              <button
                className={`chip ${selectedCategory === category ? 'chip--active' : ''}`}
                key={category}
                onClick={() => {
                  setSelectedCategory(category)
                }}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="catalog__grid">
            {filteredItems.map((item) => {
              const isInCart = cartItems.some(cartItem => 
                cartItem.item.id === item.id || 
                (cartItem.item.name === item.name && !cartItem.item.id && !item.id)
              )
              
              const itemData = useMemo(() => {
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
                
                return {
                  stock,
                  hasAvailabilityV2,
                  availableNow,
                  busyUnitsNow,
                  nextAvailableAt,
                  bookedUntilLegacy,
                  isOutOfStock,
                  isBookedNow
                }
              }, [item])
              return (
              <article
                key={item.id ?? item.name}
                className={`product ${isInCart ? 'product--in-cart' : ''} ${itemData.isBookedNow ? 'product--booked' : ''}`}
                onClick={() => onSelectItem(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectItem(item)
                  }
                }}
              >
                <div className="product__thumb">
                  <img src={getProductImage(item)} alt={item.name} loading="lazy" />
                  {isInCart && <div className="product__in-cart-badge">В корзине</div>}
                  {(itemData.isOutOfStock || itemData.isBookedNow) && (
                    <div className="product__booked-badge">
                      {itemData.isOutOfStock
                        ? 'Нет в наличии'
                        : itemData.hasAvailabilityV2
                          ? itemData.nextAvailableAt
                            ? `Бронь до ${formatBookedUntil(itemData.nextAvailableAt)}`
                            : 'Забронировано'
                          : itemData.bookedUntilLegacy
                            ? `Забронировано до ${formatBookedUntil(itemData.bookedUntilLegacy)}`
                            : 'Забронировано'}
                    </div>
                  )}
                </div>
                <div className="product__meta">
                  <span className="badge">{formatBrand(item.brand)}</span>
                  <span className="badge badge--ghost">{getEffectiveMainCategory(item) || item.category}</span>
                </div>
                <h3>{item.name}</h3>
                <p className="product__price">{item.pricePerDay || 100} сом/сутки</p>
                <div className="product__actions">
                  <button
                    className="button primary"
                    type="button"
                    disabled={itemData.isOutOfStock || (!itemData.hasAvailabilityV2 && itemData.isBookedNow)}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (itemData.isOutOfStock || (!itemData.hasAvailabilityV2 && itemData.isBookedNow)) return
                      onQuickRent(item)
                    }}
                  >
                    Быстрая аренда
                  </button>
                  <button
                    className="button ghost"
                    type="button"
                    disabled={itemData.isOutOfStock || (!itemData.hasAvailabilityV2 && itemData.isBookedNow)}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (itemData.isOutOfStock || (!itemData.hasAvailabilityV2 && itemData.isBookedNow)) return
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

          {filteredItems.length === 0 && (
            <div className="catalog__empty">
              <p>По вашему запросу ничего не найдено</p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
