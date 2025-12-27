import { Link } from 'react-router-dom'
import logo from '../images/image.png'
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL } from '../config'

export const Footer = () => (
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
            <a href={CONTACT_PHONE_TEL}>{CONTACT_PHONE_DISPLAY}</a>
          </li>
          <li>
            <svg className="footer__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <a
              href="https://2gis.kg/bishkek/geo/15763234350980545/74.515023,42.833620"
              target="_blank"
              rel="noreferrer"
            >
              Бишкек, Улица Айдын-Кол, 45
            </a>
          </li>
        </ul>
      </div>
      <div className="footer__column">
        <h4>Мы в соцсетях</h4>
        <div className="footer__socials">
          <a href="https://www.instagram.com/50kvartal/" className="footer__social" aria-label="Instagram" target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
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
