import { NavLink } from 'react-router-dom'
import logo from '../images/image.png'

export const Header = ({ cartCount, onCartOpen }) => {
  return (
    <header className="topbar">
      <div className="container topbar__container">
        <div className="brand">
          <img src={logo} alt="50 Квартал" className="brand__logo" />
          <div className="brand__text">
            <span className="brand__tag">аренда студийного оборудования</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav__link nav__link--active' : 'nav__link')}>
            <svg className="nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className="nav__text">Главная</span>
          </NavLink>
          <NavLink to="/catalog" className={({ isActive }) => (isActive ? 'nav__link nav__link--active' : 'nav__link')}>
            <svg className="nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span className="nav__text">Каталог</span>
          </NavLink>
          <NavLink to="/cart" className={({ isActive }) => (isActive ? 'nav__link nav__link--active' : 'nav__link')}>
            <svg className="nav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span className="nav__text">Корзина</span>
            {cartCount > 0 && <span className="nav__badge">{cartCount}</span>}
          </NavLink>
        </nav>

        <div className="header__actions">
          <a className="header__contact" href="tel:+996772175330">
            <svg className="header__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <span className="header__contact-text">+996 772 175 330</span>
          </a>
        </div>
      </div>
    </header>
  )
}
