import Link from "next/link";
import { Mail, Github } from "lucide-react";

export function SiteFooter() {
  return <footer className="site-footer">
    <div className="footer-inner">
      <div className="footer-top">
        <div className="footer-brand-block">
          <Link className="brand footer-brand" href="/"><img className="brand-logo" src="/logo.png" alt=""/><span>Migos AI</span></Link>
          <p>Migos AI turns two photos into a viral Hotel Lobby–style duo video. Upload your stars, keep the orange booth and hanging mic, and generate a share-ready rap performance for TikTok, Reels, and Shorts.</p>
          <div className="social-links"><span aria-hidden="true">𝕏</span><span aria-hidden="true"><Github size={18}/></span><Link href="/privacy-policy#contact-us" aria-label="Contact information"><Mail size={18}/></Link></div>
        </div>
        <div className="footer-col"><h3>Product</h3><Link href="/#features">Features</Link><Link href="/ai-rap-song-generator">AI Rap Song Generator</Link><Link href="/#how-it-works">How It Works</Link><Link href="/pricing">Pricing</Link></div>
        <div className="footer-col"><h3>Link</h3><Link href="/#faq">FAQ</Link><Link href="/privacy-policy">Privacy Policy</Link><Link href="/terms-of-service">Terms of Service</Link></div>
      </div>
      <div className="footer-bottom">© {new Date().getFullYear()} · Migos AI. All rights reserved.</div>
    </div>
  </footer>;
}
