import { Hero } from '../components/Hero'
import { AutoSlider } from '../components/AutoSlider'

export const HomePage = ({ heroStats, items, onSelectItem, onAddToCart, onQuickRent }) => (
  <main>
    <Hero heroStats={heroStats} />
    <section className="catalog catalog--home">
      <div className="container">
        <div className="section__heading">
          <p className="eyebrow">Популярное оборудование</p>
          <h2>Что берут чаще всего</h2>
        </div>
        <AutoSlider items={items} onSelectItem={onSelectItem} onAddToCart={onAddToCart} onQuickRent={onQuickRent} />
      </div>
    </section>
  </main>
)
