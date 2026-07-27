'use client';

import Link from 'next/link';
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';

const categories = ['Clothing', 'Cosmetics', 'Food', 'Jewelry', 'Furniture', 'Electronics'];

const scenes = [
  {
    id: 'studio',
    eyebrow: 'Clean & timeless',
    title: 'Soft Studio',
    description: 'Warm seamless backdrop with diffused editorial light.',
    tone: 'scene-studio',
  },
  {
    id: 'sunset',
    eyebrow: 'Warm & tactile',
    title: 'Golden Hour',
    description: 'Sculptural shadows and soft late-afternoon warmth.',
    tone: 'scene-sunset',
  },
  {
    id: 'bold',
    eyebrow: 'Graphic & modern',
    title: 'Color Story',
    description: 'A confident campaign set with bold tonal contrast.',
    tone: 'scene-bold',
  },
];

const resultTones = ['result-cream', 'result-violet', 'result-coral', 'result-sage'];

type GenerationState = 'idle' | 'analyzing' | 'generating' | 'done';

export default function StudioPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState('Cosmetics');
  const [scene, setScene] = useState('studio');
  const [variants, setVariants] = useState(4);
  const [imageUrl, setImageUrl] = useState<string>();
  const [fileName, setFileName] = useState<string>();
  const [generationState, setGenerationState] = useState<GenerationState>('idle');
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const selectedScene = useMemo(
    () => scenes.find((item) => item.id === scene) ?? scenes[0],
    [scene],
  );

  function acceptFile(file?: File) {
    if (!file || !file.type.startsWith('image/')) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
    setFileName(file.name);
    setGenerationState('idle');
    setCompleted(0);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFile(event.target.files?.[0]);
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    acceptFile(event.dataTransfer.files?.[0]);
  }

  function runDemo() {
    if (generationState === 'analyzing' || generationState === 'generating') return;
    setGenerationState('analyzing');
    setCompleted(0);

    window.setTimeout(() => {
      setGenerationState('generating');
      let count = 0;
      const timer = window.setInterval(() => {
        count += 1;
        setCompleted(count);
        if (count >= variants) {
          window.clearInterval(timer);
          setGenerationState('done');
        }
      }, 460);
    }, 800);
  }

  const isWorking = generationState === 'analyzing' || generationState === 'generating';
  const statusLabel =
    generationState === 'analyzing'
      ? 'Analyzing product details…'
      : generationState === 'generating'
        ? `Creating image ${Math.min(completed + 1, variants)} of ${variants}…`
        : generationState === 'done'
          ? `${variants} campaign images ready`
          : 'Generate campaign';

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">A</span>
          <span>Aluna</span>
          <span className="brand-badge">Studio</span>
        </Link>

        <nav className="nav-list" aria-label="Main navigation">
          <Link className="nav-item nav-item-active" href="/studio">
            <span className="nav-icon">✦</span>
            Create
          </Link>
          <button className="nav-item" type="button">
            <span className="nav-icon">▦</span>
            Library
            <span className="nav-count">12</span>
          </button>
          <Link className="nav-item" href="/admin">
            <span className="nav-icon">⌁</span>
            Admin
          </Link>
        </nav>

        <div className="sidebar-spacer" />

        <div className="mini-card">
          <div className="mini-orbit">✦</div>
          <p className="mini-title">Create with confidence</p>
          <p className="mini-copy">
            Your logos, labels, colors, and product details stay protected.
          </p>
          <button type="button">How fidelity works →</button>
        </div>

        <button className="nav-item" type="button">
          <span className="nav-icon">?</span>
          Help & guides
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="breadcrumb">Workspace / New generation</p>
            <h1>Product photo studio</h1>
          </div>
          <div className="topbar-actions">
            <div className="credit-pill">
              <span className="credit-dot">✦</span>
              <span>
                <strong>48</strong> credits
              </span>
            </div>
            <button className="icon-button" type="button" aria-label="Notifications">
              ◌
            </button>
            <button className="avatar" type="button" aria-label="Open profile">
              AM
            </button>
          </div>
        </header>

        <div className="workspace-body">
          <section className="controls-panel">
            <div className="panel-intro">
              <span className="status-dot" />
              <span>New campaign</span>
              <span className="autosave">Saved just now</span>
            </div>

            <div className="section-heading">
              <span className="step-number">01</span>
              <div>
                <h2>Add your product</h2>
                <p>Use a clear photo with the whole product visible.</p>
              </div>
            </div>

            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onFileChange}
            />
            <button
              className={`upload-zone ${imageUrl ? 'has-image' : ''}`}
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
            >
              {imageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Uploaded product preview" />
                  <span className="replace-image">Replace image</span>
                  <span className="file-name">{fileName}</span>
                </>
              ) : (
                <>
                  <span className="upload-icon">↑</span>
                  <strong>Drop your product photo here</strong>
                  <span>or click to browse</span>
                  <small>PNG, JPG or WEBP · Max 15 MB</small>
                </>
              )}
            </button>

            <label className="field-label">Product category</label>
            <div className="category-grid">
              {categories.map((item) => (
                <button
                  key={item}
                  className={category === item ? 'category-button active' : 'category-button'}
                  type="button"
                  onClick={() => setCategory(item)}
                >
                  <span className={`category-symbol symbol-${item.toLowerCase()}`} />
                  {item}
                </button>
              ))}
            </div>

            <div className="divider" />

            <div className="section-heading">
              <span className="step-number">02</span>
              <div>
                <h2>Choose the atmosphere</h2>
                <p>Pick a scene direction for this campaign.</p>
              </div>
            </div>

            <div className="scene-list">
              {scenes.map((item) => (
                <button
                  key={item.id}
                  className={scene === item.id ? 'scene-card active' : 'scene-card'}
                  type="button"
                  onClick={() => setScene(item.id)}
                >
                  <span className={`scene-art ${item.tone}`}>
                    <span className="scene-product" />
                  </span>
                  <span className="scene-copy">
                    <small>{item.eyebrow}</small>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </span>
                  <span className="radio-dot" />
                </button>
              ))}
            </div>

            <div className="variant-row">
              <div>
                <span className="field-label">Number of variants</span>
                <p>More options, more room to explore.</p>
              </div>
              <div className="stepper">
                <button
                  type="button"
                  aria-label="Decrease variants"
                  onClick={() => setVariants((value) => Math.max(1, value - 1))}
                >
                  −
                </button>
                <strong>{variants}</strong>
                <button
                  type="button"
                  aria-label="Increase variants"
                  onClick={() => setVariants((value) => Math.min(8, value + 1))}
                >
                  +
                </button>
              </div>
            </div>
          </section>

          <section className="preview-panel">
            <div className="preview-toolbar">
              <div>
                <span className="preview-kicker">Live preview</span>
                <strong>
                  {category} · {selectedScene?.title}
                </strong>
              </div>
              <span className="fidelity-chip">◈ Product fidelity on</span>
            </div>

            <div className={`preview-stage stage-${scene}`}>
              <div className="light-orb light-orb-one" />
              <div className="light-orb light-orb-two" />
              <div className="stage-shadow" />
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="hero-product-image"
                  src={imageUrl}
                  alt="Product in selected scene"
                />
              ) : (
                <div className="demo-product">
                  <span className="demo-cap" />
                  <span className="demo-bottle">
                    <span className="demo-label">
                      <small>MAISON</small>
                      <strong>ÉLAN</strong>
                      <span>Botanical serum</span>
                    </span>
                  </span>
                </div>
              )}
              <div className="preview-note">
                <span>Preview simulation</span>
                <p>Final lighting and composition are created during generation.</p>
              </div>
            </div>

            {generationState === 'done' && (
              <div className="results-section">
                <div className="results-heading">
                  <div>
                    <span>Latest generation</span>
                    <strong>{variants} images · just now</strong>
                  </div>
                  <button type="button">Download all</button>
                </div>
                <div className="result-grid">
                  {Array.from({ length: variants }, (_, index) => (
                    <div
                      className={`result-card ${resultTones[index % resultTones.length]}`}
                      key={index}
                    >
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl} alt={`Generated variant ${index + 1}`} />
                      ) : (
                        <div className="result-bottle">
                          <span />
                        </div>
                      )}
                      <div className="result-actions">
                        <span>0{index + 1}</span>
                        <button type="button" aria-label={`Download variant ${index + 1}`}>
                          ↓
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="generate-dock">
              <div className="cost-copy">
                <span>
                  {variants} image{variants > 1 ? 's' : ''}
                </span>
                <small>Uses {variants} credits</small>
              </div>
              <button
                className={`generate-button ${isWorking ? 'working' : ''}`}
                type="button"
                onClick={runDemo}
                disabled={isWorking}
              >
                <span>{isWorking ? '◌' : generationState === 'done' ? '↻' : '✦'}</span>
                {generationState === 'done' ? 'Generate again' : statusLabel}
              </button>
              {isWorking && (
                <div className="progress-track" aria-label={statusLabel}>
                  <span
                    style={{
                      width:
                        generationState === 'analyzing'
                          ? '18%'
                          : `${Math.max(25, (completed / variants) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
