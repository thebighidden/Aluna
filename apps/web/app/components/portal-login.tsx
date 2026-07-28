'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { LanguageToggle, useLanguagePreference } from './language-toggle';

type PortalLoginProps = {
  portal: 'studio' | 'dashboard';
};

const portalMedia = {
  studio: {
    destination: '/studio',
    image: '/images/aluna-dashboard-login-operations.png',
    alternateHref: '/admin/login',
  },
  dashboard: {
    destination: '/admin',
    image: '/images/aluna-studio-login-fashion.png',
    alternateHref: '/studio/login',
  },
} as const;

const portalCopy = {
  en: {
    languageLabel: 'Choose language',
    back: 'Back to home',
    email: 'Work email',
    emailPlaceholder: 'you@company.com',
    password: 'Password',
    passwordPlaceholder: 'Enter your password',
    remember: 'Remember me',
    forgot: 'Forgot password?',
    opening: 'Opening workspace…',
    demo: 'Demo access: any valid email and four-character password will continue.',
    switchLead: 'Looking for the other workspace?',
    copyright: '© 2026 Aluna Studio',
    visualHeadline: (
      <>
        One source.
        <br />
        Every campaign.
      </>
    ),
    studio: {
      eyebrow: 'Creative workspace',
      title: 'Enter Aluna Studio.',
      description:
        'Create on-model fashion campaigns and professional product photography from one source image.',
      button: 'Continue to Studio',
      imageAlt: 'Professional camera and lighting equipment in a violet product photography studio',
      imageLabel: 'Studio setup / Camera',
      alternateLabel: 'Admin access',
    },
    dashboard: {
      eyebrow: 'Operations workspace',
      title: 'Enter the dashboard.',
      description:
        'Review generation activity, campaign performance, processing costs, and workspace health.',
      button: 'Continue to Dashboard',
      imageAlt: 'Woman in an ivory jacket and violet tailoring in a professional fashion studio',
      imageLabel: 'Campaign / Fashion',
      alternateLabel: 'Studio access',
    },
  },
  fr: {
    languageLabel: 'Choisir la langue',
    back: 'Retour à l’accueil',
    email: 'E-mail professionnel',
    emailPlaceholder: 'vous@entreprise.com',
    password: 'Mot de passe',
    passwordPlaceholder: 'Saisissez votre mot de passe',
    remember: 'Se souvenir de moi',
    forgot: 'Mot de passe oublié ?',
    opening: 'Ouverture de l’espace…',
    demo: 'Accès démo : utilisez un e-mail valide et un mot de passe de quatre caractères minimum.',
    switchLead: 'Vous cherchez l’autre espace ?',
    copyright: '© 2026 Aluna Studio',
    visualHeadline: (
      <>
        Une source.
        <br />
        Toutes vos campagnes.
      </>
    ),
    studio: {
      eyebrow: 'Espace créatif',
      title: 'Entrez dans Aluna Studio.',
      description:
        'Créez des campagnes de mode portées et des photographies produit professionnelles depuis une seule image source.',
      button: 'Continuer vers le Studio',
      imageAlt: 'Appareil photo professionnel et éclairages dans un studio produit violet',
      imageLabel: 'Studio / Prise de vue',
      alternateLabel: 'Accès administration',
    },
    dashboard: {
      eyebrow: 'Espace opérations',
      title: 'Entrez dans le dashboard.',
      description:
        'Suivez l’activité, les performances des campagnes, les coûts de traitement et la santé de l’espace.',
      button: 'Continuer vers le dashboard',
      imageAlt: 'Femme portant une veste ivoire et une tenue violette dans un studio de mode',
      imageLabel: 'Campagne / Mode',
      alternateLabel: 'Accès Studio',
    },
  },
} as const;

export function PortalLogin({ portal }: PortalLoginProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [language, setLanguage] = useLanguagePreference();
  const media = portalMedia[portal];
  const commonCopy = portalCopy[language];
  const content = commonCopy[portal];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    router.push(media.destination);
  };

  return (
    <main className={`portal-login portal-login--${portal}`}>
      <section className="portal-login-panel">
        <header>
          <Link className="portal-login-wordmark" href="/">
            Aluna<span>&deg;</span>
          </Link>
          <div className="portal-login-header-actions">
            <LanguageToggle
              language={language}
              label={commonCopy.languageLabel}
              onChange={setLanguage}
            />
            <Link className="portal-login-back" href="/">
              {commonCopy.back}
            </Link>
          </div>
        </header>

        <div className="portal-login-content">
          <p className="portal-login-eyebrow">{content.eyebrow}</p>
          <h1>{content.title}</h1>
          <p className="portal-login-description">{content.description}</p>

          <form onSubmit={handleSubmit}>
            <label>
              {commonCopy.email}
              <input
                autoComplete="email"
                name="email"
                placeholder={commonCopy.emailPlaceholder}
                required
                type="email"
              />
            </label>
            <label>
              {commonCopy.password}
              <input
                autoComplete="current-password"
                minLength={4}
                name="password"
                placeholder={commonCopy.passwordPlaceholder}
                required
                type="password"
              />
            </label>
            <div className="portal-login-options">
              <label>
                <input name="remember" type="checkbox" />
                {commonCopy.remember}
              </label>
              <button type="button">{commonCopy.forgot}</button>
            </div>
            <button className="portal-login-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? commonCopy.opening : content.button}
            </button>
          </form>

          <p className="portal-login-demo">{commonCopy.demo}</p>
          <p className="portal-login-switch">
            {commonCopy.switchLead} <Link href={media.alternateHref}>{content.alternateLabel}</Link>
          </p>
        </div>

        <small>{commonCopy.copyright}</small>
      </section>

      <section className="portal-login-visual" aria-label={content.imageLabel}>
        <img src={media.image} alt={content.imageAlt} />
        <div className="portal-login-visual-shade" />
        <div className="portal-login-visual-copy">
          <span>{content.imageLabel}</span>
          <p>{commonCopy.visualHeadline}</p>
        </div>
      </section>
    </main>
  );
}
