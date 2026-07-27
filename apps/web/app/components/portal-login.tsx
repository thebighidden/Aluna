'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

type PortalLoginProps = {
  portal: 'studio' | 'dashboard';
};

const portalContent = {
  studio: {
    eyebrow: 'Creative workspace',
    title: 'Enter Aluna Studio.',
    description:
      'Create on-model fashion campaigns and professional product photography from one source image.',
    destination: '/studio',
    button: 'Continue to Studio',
    image: '/images/aluna-studio-login-fashion.png',
    imageAlt: 'Woman in an ivory jacket and violet tailoring in a professional fashion studio',
    imageLabel: 'Studio access / Fashion',
    alternateLabel: 'Admin access',
    alternateHref: '/admin/login',
  },
  dashboard: {
    eyebrow: 'Operations workspace',
    title: 'Enter the dashboard.',
    description:
      'Review generation activity, campaign performance, processing costs, and workspace health.',
    destination: '/admin',
    button: 'Continue to Dashboard',
    image: '/images/aluna-dashboard-login-operations.png',
    imageAlt: 'Professional camera and lighting equipment in a violet product photography studio',
    imageLabel: 'Operations / Live studio',
    alternateLabel: 'Studio access',
    alternateHref: '/studio/login',
  },
} as const;

export function PortalLogin({ portal }: PortalLoginProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const content = portalContent[portal];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    router.push(content.destination);
  };

  return (
    <main className={`portal-login portal-login--${portal}`}>
      <section className="portal-login-panel">
        <header>
          <Link className="portal-login-wordmark" href="/">
            Aluna<span>&deg;</span>
          </Link>
          <Link className="portal-login-back" href="/">
            Back to home
          </Link>
        </header>

        <div className="portal-login-content">
          <p className="portal-login-eyebrow">{content.eyebrow}</p>
          <h1>{content.title}</h1>
          <p className="portal-login-description">{content.description}</p>

          <form onSubmit={handleSubmit}>
            <label>
              Work email
              <input
                autoComplete="email"
                name="email"
                placeholder="you@company.com"
                required
                type="email"
              />
            </label>
            <label>
              Password
              <input
                autoComplete="current-password"
                minLength={4}
                name="password"
                placeholder="Enter your password"
                required
                type="password"
              />
            </label>
            <div className="portal-login-options">
              <label>
                <input name="remember" type="checkbox" />
                Remember me
              </label>
              <button type="button">Forgot password?</button>
            </div>
            <button className="portal-login-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Opening workspace…' : content.button}
            </button>
          </form>

          <p className="portal-login-demo">
            Demo access: any valid email and four-character password will continue.
          </p>
          <p className="portal-login-switch">
            Looking for the other workspace?{' '}
            <Link href={content.alternateHref}>{content.alternateLabel}</Link>
          </p>
        </div>

        <small>© 2026 Aluna Studio</small>
      </section>

      <section className="portal-login-visual" aria-label={content.imageLabel}>
        <img src={content.image} alt={content.imageAlt} />
        <div className="portal-login-visual-shade" />
        <div className="portal-login-visual-copy">
          <span>{content.imageLabel}</span>
          <p>
            One source.
            <br />
            Every campaign.
          </p>
        </div>
      </section>
    </main>
  );
}
