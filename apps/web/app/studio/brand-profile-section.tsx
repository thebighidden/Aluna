'use client';

/* eslint-disable @next/next/no-img-element */
import {
  BriefcaseBusiness,
  Check,
  Image as ImageIcon,
  LoaderCircle,
  Palette,
  Save,
  Sparkles,
  Target,
  Type,
  Upload,
  UsersRound,
} from 'lucide-react';
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { apiErrorMessage, authFetch } from '../lib/auth-client';

type Audience = {
  primaryAudience?: string;
  ageRange?: string;
  geography?: string;
  lifestyle?: string;
};

type ModelPreferences = {
  genderPresentation?: string;
  ageRange?: string;
  appearanceNotes?: string;
  diversityDirection?: string;
};

type BrandProfile = {
  id: string | null;
  brandName: string;
  businessType: string;
  businessSubcategory: string | null;
  website: string | null;
  description: string | null;
  slogan: string | null;
  markets: string[];
  languages: string[];
  audience: Audience;
  positioning: string | null;
  values: string[];
  tone: string[];
  primaryColor: string;
  secondaryColors: string[];
  accentColors: string[];
  primaryFont: string | null;
  secondaryFont: string | null;
  photographyStyles: string[];
  preferredEnvironments: string[];
  forbiddenEnvironments: string[];
  preferredModelAttributes: ModelPreferences;
  defaultChannels: string[];
  defaultAspectRatios: string[];
  defaultCampaignObjectives: string[];
  forbiddenVisualElements: string[];
  requiredVisualElements: string[];
  logoUrl: string | null;
  logoOriginalName?: string | null;
  onboardingComplete: boolean;
  version: number;
};

const businessTypes = [
  ['fashion', 'Fashion & apparel'],
  ['beauty-cosmetics', 'Beauty & cosmetics'],
  ['sports-nutrition', 'Sports nutrition'],
  ['health-wellness', 'Health & wellness'],
  ['food-beverage', 'Food & beverage'],
  ['jewelry', 'Jewelry'],
  ['furniture-home', 'Furniture & home'],
  ['electronics', 'Electronics'],
  ['other', 'Other'],
];

function list(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function lineList(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function BrandProfileSection({ fallbackName }: { fallbackName: string }) {
  const logoInput = useRef<HTMLInputElement>(null);
  const logoObjectUrl = useRef<string | undefined>(undefined);
  const [profile, setProfile] = useState<BrandProfile>();
  const [logoPreview, setLogoPreview] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await authFetch('/brand-profile');
        if (!response.ok) throw new Error(await apiErrorMessage(response));
        const payload = (await response.json()) as { profile: BrandProfile };
        if (cancelled) return;
        setProfile(payload.profile);
        if (payload.profile.logoUrl) {
          const logoResponse = await authFetch(payload.profile.logoUrl);
          if (logoResponse.ok && !cancelled) {
            const url = URL.createObjectURL(await logoResponse.blob());
            logoObjectUrl.current = url;
            setLogoPreview(url);
          }
        }
      } catch (caught) {
        if (!cancelled)
          setError(caught instanceof Error ? caught.message : 'Could not open the Brand Profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
      if (logoObjectUrl.current) URL.revokeObjectURL(logoObjectUrl.current);
    };
  }, []);

  function set<K extends keyof BrandProfile>(key: K, value: BrandProfile[K]) {
    setProfile((current) => (current ? { ...current, [key]: value } : current));
    setMessage(undefined);
  }

  function setAudience(key: keyof Audience, value: string) {
    if (!profile) return;
    set('audience', { ...profile.audience, [key]: value });
  }

  function setModelPreference(key: keyof ModelPreferences, value: string) {
    if (!profile) return;
    set('preferredModelAttributes', { ...profile.preferredModelAttributes, [key]: value });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const response = await authFetch('/brand-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profile,
          website: profile.website?.trim() || null,
          id: undefined,
          logoUrl: undefined,
          logoOriginalName: undefined,
          logoKey: undefined,
          version: undefined,
          createdAt: undefined,
          updatedAt: undefined,
          onboardingComplete: true,
        }),
      });
      if (!response.ok) throw new Error(await apiErrorMessage(response));
      const payload = (await response.json()) as { profile: BrandProfile };
      setProfile(payload.profile);
      setMessage(`Brand Profile saved as version ${payload.profile.version}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the Brand Profile.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(undefined);
    try {
      const body = new FormData();
      body.append('logo', file);
      const response = await authFetch('/brand-profile/logo', { method: 'POST', body });
      if (!response.ok) throw new Error(await apiErrorMessage(response));
      const payload = (await response.json()) as { profile: BrandProfile };
      setProfile(payload.profile);
      if (logoObjectUrl.current) URL.revokeObjectURL(logoObjectUrl.current);
      const url = URL.createObjectURL(file);
      logoObjectUrl.current = url;
      setLogoPreview(url);
      setMessage('Official logo uploaded securely.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not upload the logo.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  if (loading) {
    return (
      <div className="studio-content studio-brand-loading">
        <LoaderCircle className="is-spinning" />
        <p>Loading your brand intelligence</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="studio-content studio-error">{error ?? 'Brand Profile unavailable.'}</div>
    );
  }

  return (
    <div className="studio-content studio-brand-profile">
      <div className="studio-page-heading studio-section-heading">
        <div>
          <span className="studio-kicker">Brand intelligence</span>
          <h1>Teach Aluna your brand.</h1>
          <p>
            These rules guide every Creative Director plan. Product fidelity always remains the
            highest priority.
          </p>
        </div>
        <div className="studio-brand-version">
          <Check size={15} />
          {profile.version ? `Version ${profile.version}` : 'New profile'}
        </div>
      </div>

      {error && <div className="studio-brand-message is-error">{error}</div>}
      {message && <div className="studio-brand-message is-success">{message}</div>}

      <form onSubmit={save}>
        <section className="studio-brand-card studio-brand-identity">
          <header>
            <ImageIcon size={19} />
            <div>
              <span>01 · Identity</span>
              <h2>Your official brand assets</h2>
            </div>
          </header>
          <div className="studio-brand-logo-row">
            <button
              type="button"
              className="studio-brand-logo"
              onClick={() => logoInput.current?.click()}
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Official brand logo" />
              ) : (
                <Upload size={24} />
              )}
            </button>
            <div>
              <strong>{profile.logoOriginalName || 'Upload your official logo'}</strong>
              <p>
                PNG, JPG or WEBP · maximum 5 MB. Aluna will not ask the image model to redraw it.
              </p>
              <button type="button" onClick={() => logoInput.current?.click()} disabled={uploading}>
                {uploading ? 'Uploading…' : logoPreview ? 'Replace logo' : 'Choose logo'}
              </button>
            </div>
            <input
              ref={logoInput}
              type="file"
              hidden
              accept="image/png,image/jpeg,image/webp"
              onChange={uploadLogo}
            />
          </div>
          <div className="studio-brand-fields two-columns">
            <label>
              <span>Brand name</span>
              <input
                value={profile.brandName || fallbackName}
                onChange={(event) => set('brandName', event.target.value)}
                required
                minLength={2}
                maxLength={80}
              />
            </label>
            <label>
              <span>Official slogan</span>
              <input
                value={profile.slogan ?? ''}
                onChange={(event) => set('slogan', event.target.value)}
                placeholder="Performance, measured."
                maxLength={180}
              />
            </label>
            <label className="full-width">
              <span>Website</span>
              <input
                type="url"
                value={profile.website ?? ''}
                onChange={(event) => set('website', event.target.value)}
                placeholder="https://yourbrand.com"
              />
            </label>
          </div>
        </section>

        <section className="studio-brand-card">
          <header>
            <BriefcaseBusiness size={19} />
            <div>
              <span>02 · Business context</span>
              <h2>What you sell and where you belong</h2>
            </div>
          </header>
          <div className="studio-brand-fields two-columns">
            <label>
              <span>Business type</span>
              <select
                value={profile.businessType}
                onChange={(event) => set('businessType', event.target.value)}
              >
                {businessTypes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Specific category</span>
              <input
                value={profile.businessSubcategory ?? ''}
                onChange={(event) => set('businessSubcategory', event.target.value)}
                placeholder="Creatine and sports supplements"
              />
            </label>
            <label className="full-width">
              <span>Brand description</span>
              <textarea
                value={profile.description ?? ''}
                onChange={(event) => set('description', event.target.value)}
                placeholder="Describe the products, customer, market, and what makes the brand different."
                maxLength={1200}
              />
            </label>
            <label className="full-width">
              <span>Positioning</span>
              <textarea
                value={profile.positioning ?? ''}
                onChange={(event) => set('positioning', event.target.value)}
                placeholder="Premium evidence-led performance nutrition for everyday athletes."
                maxLength={500}
              />
            </label>
          </div>
        </section>

        <section className="studio-brand-card">
          <header>
            <UsersRound size={19} />
            <div>
              <span>03 · Audience</span>
              <h2>Who the campaign must speak to</h2>
            </div>
          </header>
          <div className="studio-brand-fields two-columns">
            <label>
              <span>Primary audience</span>
              <input
                value={profile.audience.primaryAudience ?? ''}
                onChange={(event) => setAudience('primaryAudience', event.target.value)}
                placeholder="Active men and women"
              />
            </label>
            <label>
              <span>Age range</span>
              <input
                value={profile.audience.ageRange ?? ''}
                onChange={(event) => setAudience('ageRange', event.target.value)}
                placeholder="20–40"
              />
            </label>
            <label>
              <span>Geography</span>
              <input
                value={profile.audience.geography ?? ''}
                onChange={(event) => setAudience('geography', event.target.value)}
                placeholder="Morocco, France, Europe"
              />
            </label>
            <label>
              <span>Lifestyle and interests</span>
              <input
                value={profile.audience.lifestyle ?? ''}
                onChange={(event) => setAudience('lifestyle', event.target.value)}
                placeholder="Fitness, performance, modern wellness"
              />
            </label>
          </div>
        </section>

        <section className="studio-brand-card">
          <header>
            <Palette size={19} />
            <div>
              <span>04 · Visual identity</span>
              <h2>Colors and typography</h2>
            </div>
          </header>
          <div className="studio-brand-fields three-columns">
            <label>
              <span>Primary color</span>
              <div className="studio-color-input">
                <input
                  type="color"
                  value={profile.primaryColor}
                  onChange={(event) => set('primaryColor', event.target.value.toUpperCase())}
                />
                <input
                  value={profile.primaryColor}
                  onChange={(event) => set('primaryColor', event.target.value.toUpperCase())}
                  pattern="#[0-9A-Fa-f]{6}"
                />
              </div>
            </label>
            <label>
              <span>Secondary colors</span>
              <input
                value={profile.secondaryColors.join(', ')}
                onChange={(event) => set('secondaryColors', list(event.target.value))}
                placeholder="#F5F5F0, #111111"
              />
            </label>
            <label>
              <span>Accent colors</span>
              <input
                value={profile.accentColors.join(', ')}
                onChange={(event) => set('accentColors', list(event.target.value))}
                placeholder="#CBFF37"
              />
            </label>
            <label>
              <span>Primary font</span>
              <input
                value={profile.primaryFont ?? ''}
                onChange={(event) => set('primaryFont', event.target.value)}
                placeholder="Clarity City"
              />
            </label>
            <label>
              <span>Secondary font</span>
              <input
                value={profile.secondaryFont ?? ''}
                onChange={(event) => set('secondaryFont', event.target.value)}
                placeholder="Editorial serif"
              />
            </label>
          </div>
        </section>

        <section className="studio-brand-card">
          <header>
            <Sparkles size={19} />
            <div>
              <span>05 · Brand character</span>
              <h2>Voice and visual language</h2>
            </div>
          </header>
          <div className="studio-brand-fields two-columns">
            <label>
              <span>Brand values · comma separated</span>
              <input
                value={profile.values.join(', ')}
                onChange={(event) => set('values', list(event.target.value))}
                placeholder="Performance, honesty, discipline"
              />
            </label>
            <label>
              <span>Tone · comma separated</span>
              <input
                value={profile.tone.join(', ')}
                onChange={(event) => set('tone', list(event.target.value))}
                placeholder="Scientific, energetic, premium"
              />
            </label>
            <label>
              <span>Photography styles</span>
              <textarea
                value={profile.photographyStyles.join('\n')}
                onChange={(event) => set('photographyStyles', lineList(event.target.value))}
                placeholder={
                  'Dark performance studio\nClean sports science\nNatural athlete lifestyle'
                }
              />
            </label>
            <label>
              <span>Preferred environments</span>
              <textarea
                value={profile.preferredEnvironments.join('\n')}
                onChange={(event) => set('preferredEnvironments', lineList(event.target.value))}
                placeholder={'Performance gym\nSports science studio\nRecovery lounge'}
              />
            </label>
            <label>
              <span>Forbidden environments</span>
              <textarea
                value={profile.forbiddenEnvironments.join('\n')}
                onChange={(event) => set('forbiddenEnvironments', lineList(event.target.value))}
                placeholder={'Domestic kitchen\nRestaurant\nCooking scene'}
              />
            </label>
            <label>
              <span>Required visual elements</span>
              <textarea
                value={profile.requiredVisualElements.join('\n')}
                onChange={(event) => set('requiredVisualElements', lineList(event.target.value))}
                placeholder={'Clean copy space\nAthletic credibility'}
              />
            </label>
            <label className="full-width">
              <span>Forbidden visual elements</span>
              <textarea
                value={profile.forbiddenVisualElements.join('\n')}
                onChange={(event) => set('forbiddenVisualElements', lineList(event.target.value))}
                placeholder={'Medical claims\nIngredient explosions\nNeon sci-fi clichés'}
              />
            </label>
          </div>
        </section>

        <section className="studio-brand-card">
          <header>
            <Target size={19} />
            <div>
              <span>06 · Campaign defaults</span>
              <h2>Starting rules for every new campaign</h2>
            </div>
          </header>
          <div className="studio-brand-fields two-columns">
            <label>
              <span>Markets</span>
              <input
                value={profile.markets.join(', ')}
                onChange={(event) => set('markets', list(event.target.value))}
                placeholder="Morocco, France"
              />
            </label>
            <label>
              <span>Languages</span>
              <input
                value={profile.languages.join(', ')}
                onChange={(event) => set('languages', list(event.target.value))}
                placeholder="en, fr"
              />
            </label>
            <label>
              <span>Channels</span>
              <input
                value={profile.defaultChannels.join(', ')}
                onChange={(event) => set('defaultChannels', list(event.target.value))}
                placeholder="Instagram, website, marketplace"
              />
            </label>
            <label>
              <span>Aspect ratios</span>
              <input
                value={profile.defaultAspectRatios.join(', ')}
                onChange={(event) => set('defaultAspectRatios', list(event.target.value))}
                placeholder="1:1, 4:5, 9:16"
              />
            </label>
            <label className="full-width">
              <span>Campaign objectives</span>
              <input
                value={profile.defaultCampaignObjectives.join(', ')}
                onChange={(event) => set('defaultCampaignObjectives', list(event.target.value))}
                placeholder="Product launch, awareness, conversion"
              />
            </label>
          </div>
        </section>

        <section className="studio-brand-card">
          <header>
            <Type size={19} />
            <div>
              <span>07 · Casting defaults</span>
              <h2>People who represent the brand</h2>
            </div>
          </header>
          <div className="studio-brand-fields two-columns">
            <label>
              <span>Gender presentation</span>
              <input
                value={profile.preferredModelAttributes.genderPresentation ?? ''}
                onChange={(event) => setModelPreference('genderPresentation', event.target.value)}
                placeholder="Men and women"
              />
            </label>
            <label>
              <span>Age range</span>
              <input
                value={profile.preferredModelAttributes.ageRange ?? ''}
                onChange={(event) => setModelPreference('ageRange', event.target.value)}
                placeholder="25–40"
              />
            </label>
            <label>
              <span>Appearance direction</span>
              <textarea
                value={profile.preferredModelAttributes.appearanceNotes ?? ''}
                onChange={(event) => setModelPreference('appearanceNotes', event.target.value)}
                placeholder="Natural athletic build, credible rather than extreme."
              />
            </label>
            <label>
              <span>Diversity direction</span>
              <textarea
                value={profile.preferredModelAttributes.diversityDirection ?? ''}
                onChange={(event) => setModelPreference('diversityDirection', event.target.value)}
                placeholder="Represent the target market naturally across the campaign."
              />
            </label>
          </div>
        </section>

        <div className="studio-brand-savebar">
          <div>
            <strong>Creative Director ready</strong>
            <span>Saving creates an immutable version used by future campaigns.</span>
          </div>
          <button type="submit" disabled={saving}>
            {saving ? <LoaderCircle className="is-spinning" size={18} /> : <Save size={18} />}
            {saving ? 'Saving profile…' : 'Save Brand Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
