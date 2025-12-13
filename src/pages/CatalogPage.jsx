import { useState, useMemo } from 'react'
import { getProductImage } from '../utils/imageLoader'
import { formatBrand, formatBookedUntil } from '../utils/helpers'

export const CatalogPage = ({ items, onSelectItem, onAddToCart, onQuickRent, categoryChips, cartItems = [] }) => {
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filteredItems = useMemo(() => {
    let result = items

    if (selectedCategory) {
      result = result.filter(item => item.category === selectedCategory)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.brand.toLowerCase().includes(query)
      )
    }

    return result
  }, [items, selectedCategory, searchQuery])

  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return []
    
    const query = searchQuery.toLowerCase()
    const matches = items.filter(item =>
      item.name.toLowerCase().includes(query)
    ).slice(0, 5)
    
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
            <button
              className={`chip ${!selectedCategory ? 'chip--active' : ''}`}
              onClick={() => setSelectedCategory(null)}
            >
              Все товары · {items.length} шт.
            </button>
            {categoryChips.map(([category, amount]) => (
              <button
                className={`chip ${selectedCategory === category ? 'chip--active' : ''}`}
                key={category}
                onClick={() => setSelectedCategory(category)}
              >
                {category} · {amount} шт.
              </button>
            ))}
          </div>

          <div className="catalog__grid">
            {filteredItems.map((item) => {
              const isInCart = cartItems.some(cartItem => cartItem.item.name === item.name)
              const stock = Number.isFinite(Number(item?.stock)) ? Number(item.stock) : 0
              const availableNow = Number.isFinite(Number(item?.availableNow)) ? Number(item.availableNow) : stock
              const nextAvailableAt = item?.nextAvailableAt
              const isOutOfStock = stock <= 0
              const isAllBusyNow = !isOutOfStock && availableNow <= 0
              return (
              <article
                key={item.id ?? item.name}
                className={`product ${isInCart ? 'product--in-cart' : ''} ${isAllBusyNow ? 'product--booked' : ''}`}
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
                  {(isOutOfStock || isAllBusyNow) && (
                    <div className="product__booked-badge">
                      {isOutOfStock
                        ? 'Нет в наличии'
                        : nextAvailableAt
                          ? `Свободно с ${formatBookedUntil(nextAvailableAt)}`
                          : 'Сейчас занято'}
                    </div>
                  )}
                </div>
                <div className="product__meta">
                  <span className="badge">{formatBrand(item.brand)}</span>
                  <span className="badge badge--ghost">{item.category}</span>
                  {!isOutOfStock && (
                    <span className="badge badge--ghost">Свободно: {Math.max(0, availableNow)} из {stock}</span>
                  )}
                </div>
                <h3>{item.name}</h3>
                <p className="product__price">{item.pricePerDay || 100} сом/сутки</p>
                <div className="product__actions">
                  <button
                    className="button primary"
                    type="button"
                    disabled={isOutOfStock}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (isOutOfStock) return
                      onQuickRent(item)
                    }}
                  >
                    Быстрая аренда
                  </button>
                  <button
                    className="button ghost"
                    type="button"
                    disabled={isOutOfStock}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (isOutOfStock) return
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
