'use client';

/* eslint-disable @next/next/no-img-element */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';

gsap.registerPlugin(ScrollTrigger);

const directions = [
  {
    index: '01',
    type: 'Clothing / On-model',
    title: 'Worn, not staged',
    image: '/images/aluna-shirt-model.png',
    className: 'aluna-work-card--serum',
  },
  {
    index: '02',
    type: 'Footwear / Launch',
    title: 'Electric motion',
    image: '/images/aluna-sneaker-campaign.png',
    className: 'aluna-work-card--sneaker',
  },
  {
    index: '03',
    type: 'Cosmetics / Campaign',
    title: 'Beauty in focus',
    image: '/images/aluna-makeup-model.png',
    className: 'aluna-work-card--beauty',
  },
];

const process = [
  {
    number: '01',
    title: 'Bring your product',
    copy: 'Drop in one clean packshot. Aluna reads its geometry, color, materials, label, and every detail that makes it yours.',
  },
  {
    number: '02',
    title: 'Choose the world',
    copy: 'Start from a directed scene, then shape the light, surface, mood, and format around the campaign you need.',
  },
  {
    number: '03',
    title: 'Build the campaign',
    copy: 'Generate a consistent image set for product pages, paid media, launches, and social—all from the same source.',
  },
];

const comparisons = [
  {
    id: 'fashion',
    category: 'Clothing / Virtual model',
    title: 'From flat lay to campaign.',
    copy: 'Upload a simple photo of your garment. Aluna keeps the cut, color, fabric, stitching, and print while placing it naturally on an AI model.',
    before: '/images/aluna-shirt-before.png',
    after: '/images/aluna-shirt-model.png',
    beforeAlt: 'Black crescent T-shirt laid flat for a normal product photo',
    afterAlt: 'Young man wearing the same black crescent T-shirt in a fashion campaign',
  },
  {
    id: 'perfume',
    category: 'Cosmetics / Pro studio',
    title: 'From countertop to studio.',
    copy: 'Start with an everyday phone snapshot. Aluna removes the background and rebuilds the lighting, surface, and atmosphere around the exact bottle.',
    before: '/images/aluna-perfume-before.png',
    after: '/images/aluna-perfume-studio.png',
    beforeAlt: 'Ordinary phone snapshot of a perfume bottle on a bathroom counter',
    afterAlt: 'The same perfume bottle photographed in a professional violet studio',
  },
];

const faqs = [
  {
    question: 'Can Aluna put my clothing on an AI model?',
    answer:
      'Yes. Upload a clear flat lay, mannequin shot, or clean product photo. Choose an on-model direction and Aluna generates a styled model image while preserving the garment’s construction and artwork.',
  },
  {
    question: 'Will the color, logo, and print stay accurate?',
    answer:
      'Product fidelity is the priority. Aluna locks the garment silhouette, base color, materials, logo placement, and printed details into every prompt. You should still review final assets before publishing, especially products with very small text.',
  },
  {
    question: 'Do I need a professional source photo?',
    answer:
      'No. A well-lit phone photo can work. Keep the complete product visible, avoid heavy shadows or blur, and use the highest-resolution original you have.',
  },
  {
    question: 'Can it remove or replace the background?',
    answer:
      'Yes. Aluna can clean an ordinary background, create a neutral catalog cutout, or place the same product into a fully art-directed studio or lifestyle environment.',
  },
  {
    question: 'What can I create besides clothing?',
    answer:
      'The same workflow supports cosmetics, skincare, food, furniture, and electronics. Clothing is the lead experience, while category-specific scenes keep lighting and materials believable.',
  },
  {
    question: 'How many images can one product create?',
    answer:
      'You can generate multiple variants and campaign directions from one source, including product-page, social, advertising, and marketplace compositions.',
  },
];

function BeforeAfter({
  before,
  after,
  beforeAlt,
  afterAlt,
  label,
}: {
  before: string;
  after: string;
  beforeAlt: string;
  afterAlt: string;
  label: string;
}) {
  const [position, setPosition] = useState(50);

  return (
    <div className="aluna-compare-frame">
      <img className="aluna-compare-base" src={before} alt={beforeAlt} />
      <div className="aluna-compare-after" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <img src={after} alt={afterAlt} />
      </div>
      <span className="aluna-compare-label aluna-compare-label--before">Before</span>
      <span className="aluna-compare-label aluna-compare-label--after">After</span>
      <span className="aluna-compare-line" style={{ left: `${position}%` }} aria-hidden="true">
        <i>↔</i>
      </span>
      <input
        aria-label={`Compare before and after for ${label}`}
        type="range"
        min="0"
        max="100"
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
      />
    </div>
  );
}

export default function LandingPage() {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const context = gsap.context(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set('[data-animate]', { clearProps: 'all' });
        return;
      }

      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
      intro
        .from('.aluna-nav', { y: -24, opacity: 0, duration: 0.8 })
        .from(
          '.aluna-eyebrow, .aluna-hero-title .line, .aluna-hero-copy, .aluna-hero-actions',
          { y: 52, opacity: 0, duration: 0.95, stagger: 0.1 },
          '-=0.35',
        )
        .from(
          '.aluna-hero-media',
          { clipPath: 'inset(50% 50% 50% 50% round 40px)', scale: 0.92, duration: 1.25 },
          '-=1',
        )
        .from('.aluna-hero-note', { y: 20, opacity: 0, duration: 0.65 }, '-=0.45');

      gsap.to('.aluna-hero-media img', {
        yPercent: 10,
        ease: 'none',
        scrollTrigger: {
          trigger: '.aluna-hero',
          start: 'top top',
          end: 'bottom top',
          scrub: 0.8,
        },
      });

      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((element) => {
        gsap.from(element, {
          y: 64,
          opacity: 0,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: element,
            start: 'top 88%',
            once: true,
          },
        });
      });

      gsap.from('.aluna-work-card', {
        y: 90,
        opacity: 0,
        rotate: (index) => (index - 1) * 2,
        duration: 1.05,
        stagger: 0.14,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.aluna-work-grid',
          start: 'top 78%',
          once: true,
        },
      });

      gsap.to('.aluna-fidelity-image img', {
        scale: 1.08,
        ease: 'none',
        scrollTrigger: {
          trigger: '.aluna-fidelity',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      });
    }, root);

    return () => context.revert();
  }, []);

  return (
    <main className="aluna-site" ref={root}>
      <header className="aluna-nav" data-animate>
        <Link className="aluna-wordmark" href="/" aria-label="Aluna home">
          Aluna<span>&deg;</span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#transformations">Before / After</a>
          <a href="#process">Process</a>
          <a href="#faq">FAQ</a>
        </nav>
        <Link className="aluna-nav-cta" href="/studio/login">
          Enter studio
        </Link>
      </header>

      <section className="aluna-hero" id="top">
        <div className="aluna-hero-content">
          <p className="aluna-eyebrow" data-animate>
            <span />
            AI fashion and product studio
          </p>
          <h1 className="aluna-hero-title" aria-label="One garment. Every world.">
            <span className="line" data-animate>
              One garment.
            </span>
            <span className="line aluna-title-accent" data-animate>
              Every <em>world.</em>
            </span>
          </h1>
          <p className="aluna-hero-copy" data-animate>
            Turn one flat T-shirt photo into an on-model fashion campaign, while preserving the
            garment your customers will actually receive.
          </p>
          <div className="aluna-hero-actions" data-animate>
            <Link className="aluna-button aluna-button--dark" href="/studio/login">
              Create a campaign
            </Link>
            <a className="aluna-text-link" href="#transformations">
              See before and after
            </a>
          </div>
          <div className="aluna-hero-meta">
            <div>
              <strong>01 input</strong>
              <span>Any clean product shot</span>
            </div>
            <div>
              <strong>On-model ready</strong>
              <span>No physical shoot required</span>
            </div>
          </div>
        </div>

        <div className="aluna-hero-visual">
          <div className="aluna-hero-media" data-animate>
            <img
              src="/images/aluna-shirt-model.png"
              alt="Young man wearing a black crescent T-shirt in an editorial campaign"
            />
            <div className="aluna-image-tag">
              <span>Generated with Aluna</span>
              <strong>Fashion / 001</strong>
            </div>
          </div>
          <p className="aluna-hero-note" data-animate>
            On-model fashion photography.
            <br />
            Built from one product photo.
          </p>
        </div>
      </section>

      <div className="aluna-ticker" aria-label="Aluna capabilities">
        <div>
          <span>Product pages</span>
          <i>✦</i>
          <span>Paid social</span>
          <i>✦</i>
          <span>Campaign launches</span>
          <i>✦</i>
          <span>Marketplace</span>
          <i>✦</i>
          <span>Product pages</span>
          <i>✦</i>
          <span>Paid social</span>
          <i>✦</i>
          <span>Campaign launches</span>
          <i>✦</i>
          <span>Marketplace</span>
          <i>✦</i>
        </div>
      </div>

      <section className="aluna-transformations" id="transformations">
        <div className="aluna-transform-head" data-reveal>
          <p className="aluna-section-kicker">See the transformation</p>
          <h2>
            Your photo in.
            <br />
            <em>Campaign out.</em>
          </h2>
          <p>
            Drag each slider to compare the everyday source photo with the finished Aluna
            generation.
          </p>
        </div>
        <div className="aluna-comparison-list">
          {comparisons.map((comparison, index) => (
            <article
              className={`aluna-comparison ${index % 2 === 1 ? 'aluna-comparison--reverse' : ''}`}
              data-reveal
              key={comparison.id}
            >
              <BeforeAfter
                before={comparison.before}
                after={comparison.after}
                beforeAlt={comparison.beforeAlt}
                afterAlt={comparison.afterAlt}
                label={comparison.title}
              />
              <div className="aluna-comparison-copy">
                <span>0{index + 1}</span>
                <p>{comparison.category}</p>
                <h3>{comparison.title}</h3>
                <p>{comparison.copy}</p>
                <div>
                  <i>Source photo</i>
                  <b>→</b>
                  <i>Aluna generation</i>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="aluna-work" id="work">
        <div className="aluna-section-head" data-reveal>
          <p className="aluna-section-kicker">Selected directions / 2026</p>
          <h2>
            From packshot
            <br />
            to <em>campaign.</em>
          </h2>
          <p>
            One source image, art-directed into a world of sharp, shoppable visuals your brand can
            actually use.
          </p>
        </div>
        <div className="aluna-work-grid">
          {directions.map((direction) => (
            <article className={`aluna-work-card ${direction.className}`} key={direction.index}>
              <div className="aluna-work-image">
                <img src={direction.image} alt={`${direction.title} product campaign`} />
                <span>View direction</span>
              </div>
              <div className="aluna-work-caption">
                <span>{direction.index}</span>
                <div>
                  <p>{direction.type}</p>
                  <h3>{direction.title}</h3>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="aluna-process" id="process">
        <div className="aluna-process-intro" data-reveal>
          <p className="aluna-section-kicker">A faster way to make</p>
          <h2>
            Less production.
            <br />
            More <em>possibility.</em>
          </h2>
        </div>
        <div className="aluna-process-list">
          {process.map((step) => (
            <article data-reveal key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="aluna-fidelity" id="fidelity">
        <div className="aluna-fidelity-image">
          <img
            src="/images/aluna-perfume-studio.png"
            alt="Perfume bottle photographed in a professional violet studio"
          />
          <span className="aluna-scan aluna-scan--shape">Shape locked</span>
          <span className="aluna-scan aluna-scan--material">Material true</span>
          <span className="aluna-scan aluna-scan--color">Color matched</span>
        </div>
        <div className="aluna-fidelity-copy" data-reveal>
          <p className="aluna-section-kicker">Fidelity is the feature</p>
          <h2>
            Creative freedom.
            <br />
            Product <em>truth.</em>
          </h2>
          <p>
            Aluna changes the world around your product—not the product itself. Silhouette, color,
            materials, logos, and printed details stay protected across every direction.
          </p>
          <ul>
            <li>
              <span>01</span>Exact form and proportions
            </li>
            <li>
              <span>02</span>Protected marks and labels
            </li>
            <li>
              <span>03</span>True-to-source color
            </li>
            <li>
              <span>04</span>Commercial-grade lighting
            </li>
          </ul>
          <Link className="aluna-button aluna-button--lime" href="/studio/login">
            Try it in the studio
          </Link>
        </div>
      </section>

      <section className="aluna-faq" id="faq">
        <div className="aluna-faq-intro" data-reveal>
          <p className="aluna-section-kicker">Questions, answered</p>
          <h2>
            The useful
            <br />
            <em>details.</em>
          </h2>
          <p>
            Everything your team needs to know before turning a simple product photo into a
            campaign.
          </p>
        </div>
        <div className="aluna-faq-list">
          {faqs.map((faq, index) => (
            <details data-reveal key={faq.question}>
              <summary>
                <span>0{index + 1}</span>
                {faq.question}
                <i aria-hidden="true">+</i>
              </summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="aluna-final-cta">
        <div className="aluna-final-orb" aria-hidden="true" />
        <p data-reveal>Ready when you are.</p>
        <h2 data-reveal>
          Your next campaign
          <br />
          starts with <em>one photo.</em>
        </h2>
        <Link className="aluna-button aluna-button--light" href="/studio/login" data-reveal>
          Open Aluna Studio
        </Link>
      </section>

      <footer className="aluna-footer">
        <Link className="aluna-wordmark aluna-wordmark--light" href="/">
          Aluna<span>&deg;</span>
        </Link>
        <p>AI product photography with fidelity built in.</p>
        <div>
          <Link href="/studio/login">Studio login</Link>
          <Link href="/admin/login">Dashboard login</Link>
          <a href="#top">Back to top ↑</a>
        </div>
        <small>© 2026 Aluna Studio</small>
      </footer>
    </main>
  );
}
