import Link from '@/components/i18n/localized-link';
import { creditPacks } from '@/content/pricing';
import { FLYING_CAR_CONFIG, getFlyingCarCost } from '@/lib/flyingcar';
import './generator.css';

export function FlyingCarCredits() {
  const cost = getFlyingCarCost(FLYING_CAR_CONFIG.defaultDuration);
  return <section className="pricing section-width" id="pricing">
    <div className="fc-section-heading split"><h2>FLYING CAR VIDEO PRICING. SHARED CREDITS.</h2><p>A {FLYING_CAR_CONFIG.defaultDuration}-second video costs {cost} credits. Choose your length in the creator to see the exact cost. These are the same credit packs used across LobbyDuo.</p></div>
    <div className="fc-pricing-grid fc-credit-grid">{creditPacks.map(pack => <article key={pack.id} className={pack.recommended ? 'featured' : ''}>
      {pack.id === 'business' && <span className="best">BEST UNIT PRICE</span>}
      <p className="fc-eyebrow">{pack.name.toUpperCase()}</p><strong>${pack.price.toFixed(2)}</strong><span>{pack.credits.toLocaleString()} credits</span><p className="pack-blurb">{pack.description}</p>
      <Link href="/pricing" className={pack.recommended ? 'amber-button' : 'outline-button'}>View credit pack</Link>
    </article>)}</div>
    <div className="pricing-trust"><span>✓ One-time credit packs · no subscription</span><span>✓ {FLYING_CAR_CONFIG.minDuration}–{FLYING_CAR_CONFIG.maxSupportedDuration} second 9:16 MP4, silent</span><span>✓ One account and shared credit balance</span><span>✓ Failed renders return the credits automatically</span><span>✓ No watermark</span></div>
  </section>;
}
