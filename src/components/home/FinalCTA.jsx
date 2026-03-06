import { Link } from 'react-router-dom'

const PRIMARY_WHATSAPP_URL = 'https://wa.me/821056650943'

export default function FinalCTA() {
  return (
    <section className="final-cta-section">
      <div className="section-inner">
        <h2 className="final-cta-title reveal">Готовы выбрать автомобиль из Кореи?</h2>
        <p className="final-cta-subtitle reveal reveal-delay-1">
          Начните поиск автомобиля мечты в нашем каталоге или свяжитесь с нами для консультации.
        </p>

        <div className="final-cta-btns reveal reveal-delay-2">
          <Link to="/catalog" className="btn-cta-primary">
            Открыть каталог
          </Link>
          <a href={PRIMARY_WHATSAPP_URL} target="_blank" rel="noreferrer" className="btn-cta-secondary">
            Связаться с нами
          </a>
        </div>
      </div>
    </section>
  )
}
