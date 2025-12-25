import { useState, useMemo } from 'react'
import { getProductImage } from '../utils/imageLoader'
import { formatBrand, formatBookedUntil } from '../utils/helpers'
import { MAIN_CATEGORY_GRIP, YELLOW_SUBCATEGORIES, getEffectiveMainCategory, getEffectiveSubCategory, isYellowMainCategory } from '../utils/categories'

export const CatalogPage = ({ items, onSelectItem, onAddToCart, onQuickRent, categoryChips, cartItems = [] }) => {
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedSubCategory, setSelectedSubCategory] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const toSearchString = (value) => String(value ?? '').toLowerCase()

  const filteredItems = useMemo(() => {
    let result = items

    if (selectedCategory) {
      result = result.filter((item) => getEffectiveMainCategory(item) === selectedCategory)

      if (selectedCategory === MAIN_CATEGORY_GRIP && selectedSubCategory) {
        result = result.filter((item) => getEffectiveSubCategory(item) === selectedSubCategory)
      }
    }

    if (searchQuery.trim()) {
      const query = toSearchString(searchQuery.trim())
      result = result.filter((item) => {
        const name = toSearchString(item?.name)
        const category = toSearchString(getEffectiveMainCategory(item) || item?.category)
        const subCategory = toSearchString(getEffectiveSubCategory(item))
        const brand = toSearchString(item?.brand)
        return name.includes(query) || category.includes(query) || subCategory.includes(query) || brand.includes(query)
      })
    }

    return result
  }, [items, selectedCategory, selectedSubCategory, searchQuery])

  const availableYellowSubcategories = useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) return []
    const present = new Set()
    for (const item of items) {
      if (!isYellowMainCategory(getEffectiveMainCategory(item))) continue
      const sub = getEffectiveSubCategory(item)
      if (sub) present.add(sub)
    }
    return YELLOW_SUBCATEGORIES.filter((s) => present.has(s))
  }, [items])

  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return []
    
    const query = toSearchString(searchQuery.trim())
    const matches = items
      .filter((item) => toSearchString(item?.name).includes(query))
      .slice(0, 5)
    
    return matches
  }, [items, searchQuery])

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
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
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
                setSelectedSubCategory(null)
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
                  setSelectedSubCategory(null)
                }}
              >
                {category}
              </button>
            ))}
          </div>

          {selectedCategory === MAIN_CATEGORY_GRIP && availableYellowSubcategories.length > 0 && (
            <div className="catalog__chips">
              <span className="catalog__chips-label">
                Подкатегории:
              </span>
              <button
                className={`chip ${!selectedSubCategory ? 'chip--active' : ''}`}
                onClick={() => setSelectedSubCategory(null)}
              >
                Все
              </button>
              {availableYellowSubcategories.map((sub) => (
                <button
                  key={sub}
                  className={`chip ${selectedSubCategory === sub ? 'chip--active' : ''}`}
                  onClick={() => setSelectedSubCategory(sub)}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}

          <div className="catalog__grid">
            {filteredItems.map((item) => {
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
                key={item.id ?? item.name}
                className={`product ${isInCart ? 'product--in-cart' : ''} ${isBookedNow ? 'product--booked' : ''}`}
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
                  {isYellowMainCategory(getEffectiveMainCategory(item)) && getEffectiveSubCategory(item) && (
                    <span className="badge badge--ghost">{getEffectiveSubCategory(item)}</span>
                  )}
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
