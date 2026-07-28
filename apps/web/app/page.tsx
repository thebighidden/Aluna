'use client';

/* eslint-disable @next/next/no-img-element */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';
import { LanguageToggle, useLanguagePreference } from './components/language-toggle';
import type { LocalizedText } from './components/language-toggle';

gsap.registerPlugin(ScrollTrigger);

const localized = (en: string, fr: string): LocalizedText => ({ en, fr });

const directions = [
  {
    index: '01',
    type: localized('Clothing / On-model', 'Vêtements / Sur mannequin'),
    title: localized('Worn, not staged', 'Porté, jamais posé'),
    image: '/images/aluna-shirt-model.png',
    className: 'aluna-work-card--serum',
  },
  {
    index: '02',
    type: localized('Footwear / Launch', 'Chaussures / Lancement'),
    title: localized('Electric motion', 'Mouvement électrique'),
    image: '/images/aluna-sneaker-campaign.png',
    className: 'aluna-work-card--sneaker',
  },
  {
    index: '03',
    type: localized('Cosmetics / Campaign', 'Cosmétiques / Campagne'),
    title: localized('Beauty in focus', 'La beauté en lumière'),
    image: '/images/aluna-makeup-model.png',
    className: 'aluna-work-card--beauty',
  },
];

const process = [
  {
    number: '01',
    title: localized('Bring your product', 'Importez votre produit'),
    copy: localized(
      'Drop in one clean packshot. Aluna reads its geometry, color, materials, label, and every detail that makes it yours.',
      'Ajoutez une photo produit nette. Aluna analyse sa forme, sa couleur, ses matières, son étiquette et chaque détail qui le rend unique.',
    ),
  },
  {
    number: '02',
    title: localized('Choose the world', 'Choisissez l’univers'),
    copy: localized(
      'Start from a directed scene, then shape the light, surface, mood, and format around the campaign you need.',
      'Partez d’une scène dirigée, puis façonnez la lumière, la surface, l’ambiance et le format de votre campagne.',
    ),
  },
  {
    number: '03',
    title: localized('Build the campaign', 'Créez la campagne'),
    copy: localized(
      'Generate a consistent image set for product pages, paid media, launches, and social—all from the same source.',
      'Créez une série cohérente pour vos fiches produit, publicités, lancements et réseaux sociaux, à partir d’une seule source.',
    ),
  },
];

const comparisons = [
  {
    id: 'fashion',
    category: localized('Clothing / Virtual model', 'Vêtements / Mannequin virtuel'),
    title: localized('From flat lay to campaign.', 'Du flat lay à la campagne.'),
    copy: localized(
      'Upload a simple photo of your garment. Aluna keeps the cut, color, fabric, stitching, and print while placing it naturally on a model.',
      'Importez une simple photo du vêtement. Aluna conserve la coupe, la couleur, la matière, les coutures et l’imprimé tout en le plaçant naturellement sur un mannequin.',
    ),
    before: '/images/aluna-shirt-before.png',
    after: '/images/aluna-shirt-model.png',
    beforeAlt: 'Black crescent T-shirt laid flat for a normal product photo',
    afterAlt: 'Young man wearing the same black crescent T-shirt in a fashion campaign',
  },
  {
    id: 'perfume',
    category: localized('Cosmetics / Pro studio', 'Cosmétiques / Studio pro'),
    title: localized('From countertop to studio.', 'Du comptoir au studio.'),
    copy: localized(
      'Start with an everyday phone snapshot. Aluna removes the background and rebuilds the lighting, surface, and atmosphere around the exact bottle.',
      'Partez d’une photo prise au téléphone. Aluna retire l’arrière-plan et recrée la lumière, la surface et l’atmosphère autour du flacon exact.',
    ),
    before: '/images/aluna-perfume-before.png',
    after: '/images/aluna-perfume-studio.png',
    beforeAlt: 'Ordinary phone snapshot of a perfume bottle on a bathroom counter',
    afterAlt: 'The same perfume bottle photographed in a professional violet studio',
  },
];

const faqs = [
  {
    question: localized(
      'Can Aluna put my clothing on a model?',
      'Aluna peut-elle placer mon vêtement sur un mannequin ?',
    ),
    answer: localized(
      'Yes. Upload a clear flat lay, mannequin shot, or clean product photo. Choose an on-model direction and Aluna generates a styled model image while preserving the garment’s construction and artwork.',
      'Oui. Importez un flat lay net, une photo sur mannequin ou une photo produit propre. Choisissez une direction portée et Aluna crée une image stylisée tout en préservant la construction et les motifs du vêtement.',
    ),
  },
  {
    question: localized(
      'Will the color, logo, and print stay accurate?',
      'La couleur, le logo et l’imprimé resteront-ils fidèles ?',
    ),
    answer: localized(
      'Product fidelity is the priority. Aluna locks the garment silhouette, base color, materials, logo placement, and printed details into every prompt. You should still review final assets before publishing, especially products with very small text.',
      'La fidélité du produit est prioritaire. Aluna protège la silhouette, la couleur, les matières, l’emplacement du logo et les détails imprimés. Vérifiez toujours les visuels avant publication, surtout lorsque le produit contient de très petits textes.',
    ),
  },
  {
    question: localized(
      'Do I need a professional source photo?',
      'Ai-je besoin d’une photo source professionnelle ?',
    ),
    answer: localized(
      'No. A well-lit phone photo can work. Keep the complete product visible, avoid heavy shadows or blur, and use the highest-resolution original you have.',
      'Non. Une photo bien éclairée prise au téléphone peut suffire. Gardez le produit entièrement visible, évitez le flou et les ombres fortes, et utilisez l’original avec la meilleure résolution disponible.',
    ),
  },
  {
    question: localized(
      'Can it remove or replace the background?',
      'Peut-on retirer ou remplacer l’arrière-plan ?',
    ),
    answer: localized(
      'Yes. Aluna can clean an ordinary background, create a neutral catalog cutout, or place the same product into a fully art-directed studio or lifestyle environment.',
      'Oui. Aluna peut nettoyer un arrière-plan ordinaire, créer un détourage neutre pour catalogue ou placer le même produit dans un studio ou un décor lifestyle entièrement dirigé.',
    ),
  },
  {
    question: localized(
      'What can I create besides clothing?',
      'Que puis-je créer en dehors des vêtements ?',
    ),
    answer: localized(
      'The same workflow supports cosmetics, skincare, food, furniture, and electronics. Clothing is the lead experience, while category-specific scenes keep lighting and materials believable.',
      'Le même flux prend en charge les cosmétiques, les soins, l’alimentation, le mobilier et l’électronique. Les scènes adaptées à chaque catégorie conservent une lumière et des matières crédibles.',
    ),
  },
  {
    question: localized(
      'How many images can one product create?',
      'Combien d’images peut-on créer à partir d’un produit ?',
    ),
    answer: localized(
      'You can generate multiple variants and campaign directions from one source, including product-page, social, advertising, and marketplace compositions.',
      'Vous pouvez créer plusieurs variantes et directions de campagne depuis une seule source, pour les fiches produit, les réseaux sociaux, la publicité et les marketplaces.',
    ),
  },
];

const landingCopy = {
  en: {
    languageLabel: 'Choose language',
    navigationLabel: 'Main navigation',
    nav: {
      transformations: 'Before / After',
      process: 'Process',
      faq: 'FAQ',
      studio: 'Enter studio',
    },
    hero: {
      eyebrow: 'Fashion and product studio',
      titleLabel: 'One garment. Every world.',
      titleFirst: 'One garment.',
      titleSecond: 'Every',
      titleAccent: 'world.',
      copy: 'Turn one flat T-shirt photo into an on-model fashion campaign, while preserving the garment your customers will actually receive.',
      primaryAction: 'Create a campaign',
      secondaryAction: 'See before and after',
      firstMetaTitle: '01 input',
      firstMetaCopy: 'Any clean product shot',
      secondMetaTitle: 'On-model ready',
      secondMetaCopy: 'No physical shoot required',
      imageAlt: 'Young man wearing a black crescent T-shirt in an editorial campaign',
      imageLabel: 'Created with Aluna',
      imageCategory: 'Fashion / 001',
      noteFirst: 'On-model fashion photography.',
      noteSecond: 'Built from one product photo.',
    },
    tickerLabel: 'Aluna capabilities',
    ticker: ['Product pages', 'Paid social', 'Campaign launches', 'Marketplace'],
    transformations: {
      kicker: 'See the transformation',
      titleFirst: 'Your photo in.',
      titleAccent: 'Campaign out.',
      copy: 'Drag each slider to compare the everyday source photo with the finished Aluna generation.',
      before: 'Before',
      after: 'After',
      compareLabel: 'Compare before and after for',
    },
    work: {
      kicker: 'Selected directions / 2026',
      titleFirst: 'From packshot',
      titleSecond: 'to',
      titleAccent: 'campaign.',
      copy: 'One source image, art-directed into a world of sharp, shoppable visuals your brand can actually use.',
      view: 'View direction',
    },
    process: {
      kicker: 'A faster way to make',
      titleFirst: 'Less production.',
      titleSecond: 'More',
      titleAccent: 'possibility.',
    },
    fidelity: {
      imageAlt: 'Perfume bottle photographed in a professional violet studio',
      shape: 'Shape locked',
      material: 'Material true',
      color: 'Color matched',
      kicker: 'Fidelity is the feature',
      titleFirst: 'Creative freedom.',
      titleSecond: 'Product',
      titleAccent: 'truth.',
      copy: 'Aluna changes the world around your product—not the product itself. Silhouette, color, materials, logos, and printed details stay protected across every direction.',
      points: [
        'Exact form and proportions',
        'Protected marks and labels',
        'True-to-source color',
        'Commercial-grade lighting',
      ],
      action: 'Try it in the studio',
    },
    faq: {
      kicker: 'Questions, answered',
      titleFirst: 'The useful',
      titleAccent: 'details.',
      copy: 'Everything your team needs to know before turning a simple product photo into a campaign.',
    },
    final: {
      kicker: 'Ready when you are.',
      titleFirst: 'Your next campaign',
      titleSecond: 'starts with',
      titleAccent: 'one photo.',
      action: 'Open Aluna Studio',
    },
    footer: {
      copy: 'Product photography with fidelity built in.',
      copyright: '© 2026 Aluna Studio',
    },
  },
  fr: {
    languageLabel: 'Choisir la langue',
    navigationLabel: 'Navigation principale',
    nav: {
      transformations: 'Avant / Après',
      process: 'Processus',
      faq: 'FAQ',
      studio: 'Entrer dans le studio',
    },
    hero: {
      eyebrow: 'Studio de mode et de produit',
      titleLabel: 'Un vêtement. Tous les univers.',
      titleFirst: 'Un vêtement.',
      titleSecond: 'Tous les',
      titleAccent: 'univers.',
      copy: 'Transformez une simple photo de T-shirt en campagne portée, tout en préservant le vêtement que vos clients recevront réellement.',
      primaryAction: 'Créer une campagne',
      secondaryAction: 'Voir avant et après',
      firstMetaTitle: '01 source',
      firstMetaCopy: 'Toute photo produit nette',
      secondMetaTitle: 'Prêt à porter',
      secondMetaCopy: 'Aucun shooting physique requis',
      imageAlt: 'Jeune homme portant un T-shirt noir dans une campagne éditoriale',
      imageLabel: 'Créé avec Aluna',
      imageCategory: 'Mode / 001',
      noteFirst: 'Photographie de mode portée.',
      noteSecond: 'Créée depuis une photo produit.',
    },
    tickerLabel: 'Fonctionnalités Aluna',
    ticker: ['Fiches produit', 'Social ads', 'Lancements', 'Marketplaces'],
    transformations: {
      kicker: 'Voyez la transformation',
      titleFirst: 'Votre photo entre.',
      titleAccent: 'La campagne sort.',
      copy: 'Faites glisser chaque curseur pour comparer la photo source au visuel de campagne final.',
      before: 'Avant',
      after: 'Après',
      compareLabel: 'Comparer avant et après pour',
    },
    work: {
      kicker: 'Directions sélectionnées / 2026',
      titleFirst: 'Du packshot',
      titleSecond: 'à la',
      titleAccent: 'campagne.',
      copy: 'Une image source transformée en visuels précis, désirables et directement exploitables par votre marque.',
      view: 'Voir la direction',
    },
    process: {
      kicker: 'Une façon plus rapide de créer',
      titleFirst: 'Moins de production.',
      titleSecond: 'Plus de',
      titleAccent: 'possibilités.',
    },
    fidelity: {
      imageAlt: 'Flacon de parfum photographié dans un studio violet professionnel',
      shape: 'Forme verrouillée',
      material: 'Matière fidèle',
      color: 'Couleur respectée',
      kicker: 'La fidélité est essentielle',
      titleFirst: 'Liberté créative.',
      titleSecond: 'Vérité du',
      titleAccent: 'produit.',
      copy: 'Aluna change l’univers autour de votre produit, jamais le produit lui-même. La silhouette, la couleur, les matières, les logos et les détails imprimés restent protégés.',
      points: [
        'Forme et proportions exactes',
        'Marques et étiquettes protégées',
        'Couleur fidèle à la source',
        'Éclairage de qualité commerciale',
      ],
      action: 'Essayer dans le studio',
    },
    faq: {
      kicker: 'Vos questions, nos réponses',
      titleFirst: 'Les détails',
      titleAccent: 'utiles.',
      copy: 'Tout ce que votre équipe doit savoir avant de transformer une simple photo produit en campagne.',
    },
    final: {
      kicker: 'Quand vous êtes prêt.',
      titleFirst: 'Votre prochaine campagne',
      titleSecond: 'commence par',
      titleAccent: 'une photo.',
      action: 'Ouvrir Aluna Studio',
    },
    footer: {
      copy: 'La photographie produit avec une fidélité intégrée.',
      copyright: '© 2026 Aluna Studio',
    },
  },
} as const;

function BeforeAfter({
  before,
  after,
  beforeAlt,
  afterAlt,
  label,
  beforeLabel,
  afterLabel,
  compareLabel,
}: {
  before: string;
  after: string;
  beforeAlt: string;
  afterAlt: string;
  label: string;
  beforeLabel: string;
  afterLabel: string;
  compareLabel: string;
}) {
  const [position, setPosition] = useState(50);

  return (
    <div className="aluna-compare-frame">
      <img className="aluna-compare-base" src={before} alt={beforeAlt} />
      <div className="aluna-compare-after" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <img src={after} alt={afterAlt} />
      </div>
      <span className="aluna-compare-label aluna-compare-label--before">{beforeLabel}</span>
      <span className="aluna-compare-label aluna-compare-label--after">{afterLabel}</span>
      <span className="aluna-compare-line" style={{ left: `${position}%` }} aria-hidden="true">
        <i>↔</i>
      </span>
      <input
        aria-label={`${compareLabel} ${label}`}
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
  const [language, setLanguage] = useLanguagePreference();
  const copy = landingCopy[language];

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
        <nav aria-label={copy.navigationLabel}>
          <a href="#transformations">{copy.nav.transformations}</a>
          <a href="#process">{copy.nav.process}</a>
          <a href="#faq">{copy.nav.faq}</a>
        </nav>
        <div className="aluna-nav-actions">
          <LanguageToggle language={language} label={copy.languageLabel} onChange={setLanguage} />
          <Link className="aluna-nav-cta" href="/studio/login">
            {copy.nav.studio}
          </Link>
        </div>
      </header>

      <section className="aluna-hero" id="top">
        <div className="aluna-hero-content">
          <p className="aluna-eyebrow" data-animate>
            <span />
            {copy.hero.eyebrow}
          </p>
          <h1 className="aluna-hero-title" aria-label={copy.hero.titleLabel}>
            <span className="line" data-animate>
              {copy.hero.titleFirst}
            </span>
            <span className="line aluna-title-accent" data-animate>
              {copy.hero.titleSecond} <em>{copy.hero.titleAccent}</em>
            </span>
          </h1>
          <p className="aluna-hero-copy" data-animate>
            {copy.hero.copy}
          </p>
          <div className="aluna-hero-actions" data-animate>
            <Link className="aluna-button aluna-button--dark" href="/studio/login">
              {copy.hero.primaryAction}
            </Link>
            <a className="aluna-text-link" href="#transformations">
              {copy.hero.secondaryAction}
            </a>
          </div>
          <div className="aluna-hero-meta">
            <div>
              <strong>{copy.hero.firstMetaTitle}</strong>
              <span>{copy.hero.firstMetaCopy}</span>
            </div>
            <div>
              <strong>{copy.hero.secondMetaTitle}</strong>
              <span>{copy.hero.secondMetaCopy}</span>
            </div>
          </div>
        </div>

        <div className="aluna-hero-visual">
          <div className="aluna-hero-media" data-animate>
            <img src="/images/aluna-shirt-model.png" alt={copy.hero.imageAlt} />
            <div className="aluna-image-tag">
              <span>{copy.hero.imageLabel}</span>
              <strong>{copy.hero.imageCategory}</strong>
            </div>
          </div>
          <p className="aluna-hero-note" data-animate>
            {copy.hero.noteFirst}
            <br />
            {copy.hero.noteSecond}
          </p>
        </div>
      </section>

      <div className="aluna-ticker" aria-label={copy.tickerLabel}>
        <div>
          {[...copy.ticker, ...copy.ticker].map((item, index) => (
            <span className="aluna-ticker-item" key={`${item}-${index}`}>
              <span>{item}</span>
              <i>✦</i>
            </span>
          ))}
        </div>
      </div>

      <section className="aluna-transformations" id="transformations">
        <div className="aluna-transform-head" data-reveal>
          <p className="aluna-section-kicker">{copy.transformations.kicker}</p>
          <h2>
            {copy.transformations.titleFirst}
            <br />
            <em>{copy.transformations.titleAccent}</em>
          </h2>
          <p>{copy.transformations.copy}</p>
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
                label={comparison.title[language]}
                beforeLabel={copy.transformations.before}
                afterLabel={copy.transformations.after}
                compareLabel={copy.transformations.compareLabel}
              />
              <div className="aluna-comparison-copy">
                <span>0{index + 1}</span>
                <p>{comparison.category[language]}</p>
                <h3>{comparison.title[language]}</h3>
                <p>{comparison.copy[language]}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="aluna-work" id="work">
        <div className="aluna-section-head" data-reveal>
          <p className="aluna-section-kicker">{copy.work.kicker}</p>
          <h2>
            {copy.work.titleFirst}
            <br />
            {copy.work.titleSecond} <em>{copy.work.titleAccent}</em>
          </h2>
          <p>{copy.work.copy}</p>
        </div>
        <div className="aluna-work-grid">
          {directions.map((direction) => (
            <article className={`aluna-work-card ${direction.className}`} key={direction.index}>
              <div className="aluna-work-image">
                <img src={direction.image} alt={`${direction.title[language]} product campaign`} />
                <span>{copy.work.view}</span>
              </div>
              <div className="aluna-work-caption">
                <span>{direction.index}</span>
                <div>
                  <p>{direction.type[language]}</p>
                  <h3>{direction.title[language]}</h3>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="aluna-process" id="process">
        <div className="aluna-process-intro" data-reveal>
          <p className="aluna-section-kicker">{copy.process.kicker}</p>
          <h2>
            {copy.process.titleFirst}
            <br />
            {copy.process.titleSecond} <em>{copy.process.titleAccent}</em>
          </h2>
        </div>
        <div className="aluna-process-list">
          {process.map((step) => (
            <article data-reveal key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title[language]}</h3>
              <p>{step.copy[language]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="aluna-fidelity" id="fidelity">
        <div className="aluna-fidelity-image">
          <img src="/images/aluna-perfume-studio.png" alt={copy.fidelity.imageAlt} />
          <span className="aluna-scan aluna-scan--shape">{copy.fidelity.shape}</span>
          <span className="aluna-scan aluna-scan--material">{copy.fidelity.material}</span>
          <span className="aluna-scan aluna-scan--color">{copy.fidelity.color}</span>
        </div>
        <div className="aluna-fidelity-copy" data-reveal>
          <p className="aluna-section-kicker">{copy.fidelity.kicker}</p>
          <h2>
            {copy.fidelity.titleFirst}
            <br />
            {copy.fidelity.titleSecond} <em>{copy.fidelity.titleAccent}</em>
          </h2>
          <p>{copy.fidelity.copy}</p>
          <ul>
            {copy.fidelity.points.map((point, index) => (
              <li key={point}>
                <span>0{index + 1}</span>
                {point}
              </li>
            ))}
          </ul>
          <Link className="aluna-button aluna-button--lime" href="/studio/login">
            {copy.fidelity.action}
          </Link>
        </div>
      </section>

      <section className="aluna-faq" id="faq">
        <div className="aluna-faq-intro" data-reveal>
          <p className="aluna-section-kicker">{copy.faq.kicker}</p>
          <h2>
            {copy.faq.titleFirst}
            <br />
            <em>{copy.faq.titleAccent}</em>
          </h2>
          <p>{copy.faq.copy}</p>
        </div>
        <div className="aluna-faq-list">
          {faqs.map((faq, index) => (
            <details data-reveal key={faq.question.en}>
              <summary>
                <span>0{index + 1}</span>
                {faq.question[language]}
                <i aria-hidden="true">+</i>
              </summary>
              <p>{faq.answer[language]}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="aluna-final-cta">
        <div className="aluna-final-orb" aria-hidden="true" />
        <p data-reveal>{copy.final.kicker}</p>
        <h2 data-reveal>
          {copy.final.titleFirst}
          <br />
          {copy.final.titleSecond} <em>{copy.final.titleAccent}</em>
        </h2>
        <Link className="aluna-button aluna-button--light" href="/studio/login" data-reveal>
          {copy.final.action}
        </Link>
      </section>

      <footer className="aluna-footer">
        <Link className="aluna-wordmark aluna-wordmark--light" href="/">
          Aluna<span>&deg;</span>
        </Link>
        <p>{copy.footer.copy}</p>
        <small>{copy.footer.copyright}</small>
      </footer>
    </main>
  );
}
