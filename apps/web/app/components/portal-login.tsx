'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { LanguageToggle, useLanguagePreference } from './language-toggle';
import { login } from '../lib/auth-client';

type PortalLoginProps = {
  portal: 'studio' | 'dashboard';
};

const portalMedia = {
  studio: {
    destination: '/studio',
    image: '/images/aluna-dashboard-login-operations.png',
  },
  dashboard: {
    destination: '/admin',
    image: '/images/aluna-studio-login-fashion.png',
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
    },
    dashboard: {
      eyebrow: 'Operations workspace',
      title: 'Enter the dashboard.',
      description:
        'Review generation activity, campaign performance, processing costs, and workspace health.',
      button: 'Continue to Dashboard',
      imageAlt: 'Woman in an ivory jacket and violet tailoring in a professional fashion studio',
      imageLabel: 'Campaign / Fashion',
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
    demo: 'L’accès démo est prêt avec un compte propriétaire préconfiguré.',
    useDemo: 'Utiliser le compte démo',
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
  ar: {
    languageLabel: 'اختار اللغة',
    back: 'رجع للرئيسية',
    email: 'إيميل الخدمة',
    emailPlaceholder: 'you@company.com',
    password: 'كلمة السر',
    passwordPlaceholder: 'دخل كلمة السر',
    remember: 'بقا فاكرني',
    forgot: 'نسيتي كلمة السر؟',
    opening: 'كنفتحو مساحة الخدمة…',
    demo: 'حساب الديمو واجد باش تجرب المنصة.',
    useDemo: 'استعمل حساب الديمو',
    switchLead: 'كتقلب على المساحة الأخرى؟',
    copyright: '© 2026 Aluna Studio',
    visualHeadline: (
      <>
        صورة وحدة.
        <br />
        كل الحملات.
      </>
    ),
    studio: {
      eyebrow: 'مساحة الإبداع',
      title: 'دخل لـ Aluna Studio.',
      description: 'صايب حملات موضة فوق موديل وتصاور منتوجات احترافية من صورة أصلية وحدة.',
      button: 'كمّل للستوديو',
      imageAlt: 'كاميرا وضو احترافيين فستوديو بنفسجي لتصوير المنتوجات',
      imageLabel: 'الستوديو / الكاميرا',
      alternateLabel: 'دخول الإدارة',
    },
    dashboard: {
      eyebrow: 'مساحة التسيير',
      title: 'دخل للداشبورد.',
      description: 'تابع الصور، أداء الحملات، مصاريف الخدمة وصحة مساحة العمل ديالك.',
      button: 'كمّل للداشبورد',
      imageAlt: 'موديل لابسة جاكيطة بيضاء ولباس بنفسجي فستوديو موضة احترافي',
      imageLabel: 'حملة / موضة',
      alternateLabel: 'دخول الستوديو',
    },
  },
} as const;

export function PortalLogin({ portal }: PortalLoginProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string>();
  const [language, setLanguage] = useLanguagePreference();
  const media = portalMedia[portal];
  const commonCopy = portalCopy[language];
  const content = commonCopy[portal];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(undefined);
    try {
      await login(email, password, remember);
      router.push(media.destination);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Could not sign in');
      setIsSubmitting(false);
    }
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
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <div className="portal-login-options">
              <label>
                <input
                  checked={remember}
                  name="remember"
                  type="checkbox"
                  onChange={(event) => setRemember(event.target.checked)}
                />
                {commonCopy.remember}
              </label>
              <button type="button">{commonCopy.forgot}</button>
            </div>
            <button className="portal-login-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? commonCopy.opening : content.button}
            </button>
          </form>

          {error && (
            <p className="portal-login-error" role="alert">
              {error}
            </p>
          )}
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
