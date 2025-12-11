import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import logo from './images/image.png'
import inventory from './data/inventory.json'

const catalogImages = import.meta.glob('./images/catalog/*', { eager: true, import: 'default', query: '?url' })
const fallbackImage = 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80'

const getProductImage = (item) => {
  if (item?.image) {
    const key = `./images/${item.image}`
    if (catalogImages[key]) {
      return catalogImages[key]
    }
    console.warn('Не найден файл изображения для', item.image)
  }
  return fallbackImage
}

const plural = (value, forms) => {
  const mod10 = value % 10
  const mod100 = value % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1]
  return forms[2]
}

const formatBrand = (brand) => (brand && brand !== '—' ? brand : 'бренд уточняется')

const Header = ({ cartCount, onCartOpen }) => (
  <header className="topbar container">
    <div className="brand">
      <img src={logo} alt="50 Квартал" className="brand__logo" />
      <div className="brand__text">
        <span className="brand__name">50 квартал</span>
        <span className="brand__tag">аренда студийного оборудования</span>
      </div>
    </div>
    <nav className="nav">
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav__link nav__link--active' : 'nav__link')}>
        <svg className="nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        Главная
      </NavLink>
      <NavLink to="/catalog" className={({ isActive }) => (isActive ? 'nav__link nav__link--active' : 'nav__link')}>
        <svg className="nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
        Каталог
      </NavLink>
    </nav>
    <div className="header__actions">
      <a className="header__contact" href="tel:+79990001122">
        <svg className="header__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
        +7 (999) 000-11-22
      </a>
      <button type="button" className="cart-button" onClick={onCartOpen}>
        <svg className="cart-button__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        Корзина
        <span className="cart-button__count">{cartCount}</span>
      </button>
    </div>
  </header>
)

const Hero = ({ heroStats }) => (
  <section className="hero">
    <div className="container hero__layout">
      <p className="eyebrow">Студийный свет · грип · текстиль</p>
      <h1>
        Соберём комплект <span className="accent">под ваш сет</span>
      </h1>
      <p className="lead">
        Мы держим в каталоге только рабочие позиции. Бронируйте освещение, грип и текстиль с выдачей в тот же день.
      </p>
      <div className="hero__actions">
        <Link className="button primary" to="/catalog">
          Перейти в каталог
        </Link>
        <span className="hero__note">Бишкек · доставка по запросу</span>
      </div>
      <ul className="hero__stats">
        {heroStats.map((stat) => (
          <li key={stat.label}>
            <span className="hero__stats-value">{stat.value}</span>
            <span className="hero__stats-label">{stat.label}</span>
          </li>
        ))}
      </ul>
    </div>
  </section>
)

const HomePage = ({ heroStats, items, onSelectItem, onAddToCart }) => (
  <main>
    <Hero heroStats={heroStats} />
    <section className="catalog catalog--home">
      <div className="container">
        <div className="section__heading">
          <p className="eyebrow">Популярное оборудование</p>
          <h2>Что берут чаще всего</h2>
        </div>
        <AutoSlider items={items} onSelectItem={onSelectItem} onAddToCart={onAddToCart} />
      </div>
    </section>
  </main>
)

const CatalogPage = ({ items, onSelectItem, onAddToCart, categoryChips }) => (
  <main>
    <section className="catalog catalog--page">
      <div className="container">
        <div className="section__heading">
          <p className="eyebrow">Каталог</p>
          <h2>Соберите комплект под задачу</h2>
        </div>
        <div className="catalog__chips">
          {categoryChips.map(([category, amount]) => (
            <span className="chip" key={category}>
              {category} · {amount} шт.
            </span>
          ))}
        </div>
        <div className="catalog__grid">
          {items.map((item) => (
            <article
              key={item.name}
              className="product"
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
              </div>
              <div className="product__meta">
                <span className="badge">{formatBrand(item.brand)}</span>
                <span className="badge badge--ghost">{item.category}</span>
              </div>
              <h3>{item.name}</h3>
              <div className="product__actions">
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
    </section>
  </main>
)

const AutoSlider = ({ items, onSelectItem, onAddToCart }) => {
  const trackRef = useRef(null)
  const [isPaused, setIsPaused] = useState(false)

  const handleKeyDown = (event, item) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelectItem(item)
    }
  }

  const duplicatedItems = [...items, ...items]

  return (
    <div
      className="slider slider--marquee"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="slider__viewport">
        <div
          ref={trackRef}
          className={`slider__track-marquee ${isPaused ? 'slider__track-marquee--paused' : ''}`}
        >
          {duplicatedItems.map((item, idx) => (
            <article
              key={`${item.name}-${idx}`}
              className="product slider__card-marquee"
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
              <p className="product__description">{item.category}</p>
              <div className="product__actions">
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

const ProductModal = ({ item, onClose, onAddToCart }) => {
  if (!item) return null
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
            <span className="modal-stock-note">Позиция доступна к бронированию</span>
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
          </dl>
          <div className="modal-actions">
            <button className="button primary modal-cta" type="button" onClick={() => onAddToCart(item)}>
              Добавить в корзину
            </button>
            <button className="button ghost modal-cta" type="button" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const CartDrawer = ({ isOpen, items, onClose, onIncrement, onDecrement, onRemove }) => {
  const [showCheckout, setShowCheckout] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    dateFrom: '',
    dateTo: '',
    timeFrom: '09:00',
    timeTo: '21:00',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate form submission
    setTimeout(() => {
      setIsSubmitting(false)
      setSubmitSuccess(true)
      setTimeout(() => {
        setShowCheckout(false)
        setSubmitSuccess(false)
        setFormData({
          name: '',
          phone: '',
          address: '',
          dateFrom: '',
          dateTo: '',
          timeFrom: '09:00',
          timeTo: '21:00',
        })
      }, 3000)
    }, 1500)
  }

  const isFormValid =
    formData.name.trim() &&
    formData.phone.trim() &&
    formData.address.trim() &&
    formData.dateFrom &&
    formData.dateTo

  if (!isOpen) return null

  return (
    <div className="cart-overlay" onClick={onClose}>
      <div className="cart-panel" onClick={(event) => event.stopPropagation()}>
        <div className="cart-panel__header">
          <h3>{showCheckout ? 'Оформление заказа' : 'Корзина'}</h3>
          <button className="cart-close" onClick={onClose} aria-label="Закрыть корзину" type="button">
            ×
          </button>
        </div>

        {showCheckout ? (
          <form className="checkout-form" onSubmit={handleSubmit}>
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
                    placeholder="+7 (999) 000-00-00"
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
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="checkout-date-from">Дата начала</label>
                    <input
                      type="date"
                      id="checkout-date-from"
                      name="dateFrom"
                      value={formData.dateFrom}
                      onChange={handleInputChange}
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="checkout-date-to">Дата окончания</label>
                    <input
                      type="date"
                      id="checkout-date-to"
                      name="dateTo"
                      value={formData.dateTo}
                      onChange={handleInputChange}
                      min={formData.dateFrom || new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="checkout-time-from">Время получения</label>
                    <input
                      type="time"
                      id="checkout-time-from"
                      name="timeFrom"
                      value={formData.timeFrom}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="checkout-time-to">Время возврата</label>
                    <input
                      type="time"
                      id="checkout-time-to"
                      name="timeTo"
                      value={formData.timeTo}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
                <div className="checkout-summary">
                  <h4>Ваш заказ:</h4>
                  <ul>
                    {items.map(({ item, count }) => (
                      <li key={item.name}>
                        {item.name} × {count}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="checkout-actions">
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => setShowCheckout(false)}
                  >
                    Назад
                  </button>
                  <button
                    type="submit"
                    className="button primary"
                    disabled={!isFormValid || isSubmitting}
                  >
                    {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
                  </button>
                </div>
              </>
            )}
          </form>
        ) : (
          <>
            {items.length === 0 ? (
              <p className="cart-empty">Добавьте позиции, чтобы оформить заявку.</p>
            ) : (
              <ul className="cart-list">
                {items.map(({ item, count }) => (
                  <li key={item.name} className="cart-item">
                    <div className="cart-item__thumb">
                      <img src={getProductImage(item)} alt={item.name} />
                    </div>
                    <div className="cart-item__body">
                      <h4>{item.name}</h4>
                      <p>{item.category}</p>
                      <div className="cart-item__actions">
                        <div className="cart-item__qty">
                          <button type="button" className="cart-qty" onClick={() => onDecrement(item.name)}>
                            −
                          </button>
                          <span>{count}</span>
                          <button type="button" className="cart-qty" onClick={() => onIncrement(item.name)}>
                            +
                          </button>
                        </div>
                        <button type="button" className="ghost-link" onClick={() => onRemove(item.name)}>
                          Удалить
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {items.length > 0 && (
              <div className="cart-panel__footer">
                <button
                  type="button"
                  className="button primary"
                  onClick={() => setShowCheckout(true)}
                >
                  Оформить заказ
                </button>
                <p className="modal-stock-note">Укажите даты и контактные данные</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const Footer = () => (
  <footer className="footer">
    <div className="container footer__grid">
      <div className="footer__brand">
        <div className="brand">
          <img src={logo} alt="50 Квартал" className="brand__logo" />
          <div className="brand__text">
            <span className="brand__name">50 квартал</span>
            <span className="brand__tag">свет · грип · звук</span>
          </div>
        </div>
        <p className="footer__desc">
          Профессиональное студийное оборудование в аренду. Собираем комплекты под рекламу, клипы, интервью и фотосессии.
        </p>
      </div>
      <div className="footer__column">
        <h4>Навигация</h4>
        <ul className="footer__links">
          <li><Link to="/">Главная</Link></li>
          <li><Link to="/catalog">Каталог</Link></li>
        </ul>
      </div>
      <div className="footer__column">
        <h4>Контакты</h4>
        <ul className="footer__contacts">
          <li>
            <svg className="footer__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <a href="tel:+79990001122">+7 (999) 000-11-22</a>
          </li>
          <li>
            <svg className="footer__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <a href="mailto:info@50kvartal.ru">info@50kvartal.ru</a>
          </li>
          <li>
            <svg className="footer__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>Бишкек</span>
          </li>
        </ul>
      </div>
      <div className="footer__column">
        <h4>Мы в соцсетях</h4>
        <div className="footer__socials">
          <a href="https://t.me/" className="footer__social" aria-label="Telegram">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
          </a>
          <a href="https://instagram.com/" className="footer__social" aria-label="Instagram">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
          </a>
          <a href="https://wa.me/79990001122" className="footer__social" aria-label="WhatsApp">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
    <div className="container footer__bottom">
      <span>© 2025 50 Квартал. Все права защищены.</span>
      <span>Работаем ежедневно с 9:00 до 21:00</span>
    </div>
  </footer>
)

function App() {
  const [selectedItem, setSelectedItem] = useState(null)
  const [cartItems, setCartItems] = useState([])
  const [isCartOpen, setIsCartOpen] = useState(false)

  const categoryTotals = useMemo(() => {
    return inventory.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1
      return acc
    }, {})
  }, [])

  const heroStats = useMemo(() => {
    const categoriesCount = Object.keys(categoryTotals).length
    return [
      { value: inventory.length, label: plural(inventory.length, ['позиция', 'позиции', 'позиций']) },
      { value: categoriesCount, label: plural(categoriesCount, ['категория', 'категории', 'категорий']) },
    ]
  }, [categoryTotals])

  const categoryChips = useMemo(() => Object.entries(categoryTotals).sort(([, a], [, b]) => b - a), [categoryTotals])

  const cartCount = cartItems.reduce((sum, entry) => sum + entry.count, 0)

  const addToCart = (item) => {
    setCartItems((prev) => {
      const existing = prev.find((entry) => entry.item.name === item.name)
      if (existing) {
        return prev.map((entry) => (entry.item.name === item.name ? { ...entry, count: entry.count + 1 } : entry))
      }
      return [...prev, { item, count: 1 }]
    })
  }

  const incrementCart = (name) => {
    setCartItems((prev) => prev.map((entry) => (entry.item.name === name ? { ...entry, count: entry.count + 1 } : entry)))
  }

  const decrementCart = (name) => {
    setCartItems((prev) =>
      prev
        .map((entry) => (entry.item.name === name ? { ...entry, count: entry.count - 1 } : entry))
        .filter((entry) => entry.count > 0),
    )
  }

  const removeFromCart = (name) => {
    setCartItems((prev) => prev.filter((entry) => entry.item.name !== name))
  }

  const closeModal = () => setSelectedItem(null)
  const openCart = () => setIsCartOpen(true)
  const closeCart = () => setIsCartOpen(false)

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        if (selectedItem) {
          closeModal()
        } else if (isCartOpen) {
          closeCart()
        }
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [selectedItem, isCartOpen])

  return (
    <div className="page">
      <Header cartCount={cartCount} onCartOpen={openCart} />
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              heroStats={heroStats}
              items={inventory}
              onSelectItem={setSelectedItem}
              onAddToCart={(item) => {
                addToCart(item)
                setIsCartOpen(true)
              }}
            />
          }
        />
        <Route
          path="/catalog"
          element={
            <CatalogPage
              items={inventory}
              onSelectItem={setSelectedItem}
              onAddToCart={(item) => {
                addToCart(item)
                setIsCartOpen(true)
              }}
              categoryChips={categoryChips}
            />
          }
        />
      </Routes>
      <Footer />
      <ProductModal
        item={selectedItem}
        onClose={closeModal}
        onAddToCart={(item) => {
          addToCart(item)
          setIsCartOpen(true)
          closeModal()
        }}
      />
      <CartDrawer
        isOpen={isCartOpen}
        items={cartItems}
        onClose={closeCart}
        onIncrement={incrementCart}
        onDecrement={decrementCart}
        onRemove={removeFromCart}
      />
    </div>
  )
}

export default App
