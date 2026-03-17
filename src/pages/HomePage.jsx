import Hero from '../components/home/Hero'
import ProcessSteps from '../components/home/ProcessSteps'
import Advantages from '../components/home/Advantages'
import Reviews from '../components/home/Reviews'
import WhatsAppSection from '../components/home/WhatsAppSection'
import FinalCTA from '../components/home/FinalCTA'
import Seo from '../components/seo/Seo.jsx'
import { buildStaticRouteSeo, SITE_URL } from '../../shared/seo.js'

export default function HomePage() {
  const seo = buildStaticRouteSeo({ pathname: '/', origin: SITE_URL })

  return (
    <>
      <Seo {...seo} />
      <Hero />
      <ProcessSteps />
      <Advantages />
      <Reviews />
      <WhatsAppSection />
      <FinalCTA />
    </>
  )
}
