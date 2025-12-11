import { Link } from 'react-router-dom'

export const Hero = ({ heroStats }) => (
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
