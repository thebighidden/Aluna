import type { ProductCategory } from './styles.config';

export interface CampaignOptionChoice {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly prompt: string;
}

export interface CampaignOptionDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly defaultValue: string;
  readonly choices: readonly CampaignOptionChoice[];
}

export interface CampaignOptionGroup {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly options: readonly CampaignOptionDefinition[];
}

export type CampaignOptions = Record<string, string>;

const choice = (
  id: string,
  label: string,
  description: string,
  prompt: string,
): CampaignOptionChoice => ({ id, label, description, prompt });

const option = (
  id: string,
  label: string,
  description: string,
  defaultValue: string,
  choices: readonly CampaignOptionChoice[],
): CampaignOptionDefinition => ({ id, label, description, defaultValue, choices });

const SHARED_DIRECTION_GROUPS = [
  {
    id: 'art-direction',
    label: 'Art direction',
    description: 'Fine-tune the visual language without changing the product.',
    options: [
      option('campaignMood', 'Campaign mood', 'Overall emotional register.', 'scene-led', [
        choice(
          'scene-led',
          'Follow scene',
          'Use the selected preset naturally.',
          'Follow the selected scene mood.',
        ),
        choice(
          'quiet-luxury',
          'Quiet luxury',
          'Restrained and premium.',
          'Use a restrained quiet-luxury mood with sophisticated visual restraint.',
        ),
        choice(
          'bold-editorial',
          'Bold editorial',
          'Graphic and confident.',
          'Use a bold high-fashion editorial mood with confident visual tension.',
        ),
        choice(
          'warm-human',
          'Warm & human',
          'Approachable lifestyle feeling.',
          'Use an approachable, warm, human lifestyle mood without looking staged.',
        ),
        choice(
          'playful',
          'Playful',
          'Energetic and colorful.',
          'Use a playful, energetic campaign mood while retaining premium realism.',
        ),
        choice(
          'futuristic',
          'Futuristic',
          'Precise and progressive.',
          'Use a clean, progressive, futuristic mood with physically realistic materials.',
        ),
      ]),
      option('composition', 'Composition', 'Where the hero sits in the frame.', 'vary', [
        choice(
          'vary',
          'Vary each result',
          'Explore several layouts.',
          'Vary the composition meaningfully between results.',
        ),
        choice(
          'centered',
          'Centered hero',
          'Balanced and direct.',
          'Use a centered, symmetrical hero composition.',
        ),
        choice(
          'copy-left',
          'Copy space left',
          'Product weighted right.',
          'Place the hero toward camera-right with clean negative space on the left for copy.',
        ),
        choice(
          'copy-right',
          'Copy space right',
          'Product weighted left.',
          'Place the hero toward camera-left with clean negative space on the right for copy.',
        ),
        choice(
          'dynamic',
          'Dynamic diagonal',
          'More campaign energy.',
          'Use a controlled diagonal composition with premium campaign energy.',
        ),
        choice(
          'close-crop',
          'Close crop',
          'Immersive detail.',
          'Use an intentional close crop that keeps every important product feature visible.',
        ),
      ]),
      option('camera', 'Camera language', 'Lens and perspective character.', 'vary', [
        choice(
          'vary',
          'Vary each result',
          'A coherent range of lenses.',
          'Vary lens choice and camera distance while keeping perspective physically plausible.',
        ),
        choice(
          'portrait-85',
          '85 mm portrait',
          'Polished compression.',
          'Photograph with an 85 mm portrait or product lens and polished perspective compression.',
        ),
        choice(
          'natural-50',
          'Natural 50 mm',
          'Balanced and realistic.',
          'Photograph with a natural 50 mm perspective.',
        ),
        choice(
          'wide-35',
          'Editorial 35 mm',
          'Environmental storytelling.',
          'Use a refined 35 mm environmental editorial perspective without wide-angle distortion.',
        ),
        choice(
          'low-angle',
          'Low hero angle',
          'Confident and monumental.',
          'Use a subtle low hero angle without distorting the product.',
        ),
        choice(
          'overhead',
          'Overhead',
          'Graphic flat composition.',
          'Use a precise overhead camera with deliberate graphic spacing.',
        ),
      ]),
      option('lighting', 'Lighting', 'Primary light character.', 'scene-led', [
        choice(
          'scene-led',
          'Follow scene',
          'Use the preset lighting.',
          'Follow the selected scene lighting.',
        ),
        choice(
          'soft-studio',
          'Soft studio',
          'Large diffused sources.',
          'Use broad, soft professional studio lighting with natural shadow rolloff.',
        ),
        choice(
          'hard-flash',
          'Hard flash',
          'Sharp fashion energy.',
          'Use controlled direct-flash editorial lighting with intentional crisp shadows.',
        ),
        choice(
          'window-daylight',
          'Window daylight',
          'Natural and trustworthy.',
          'Use believable directional window daylight with neutral fill.',
        ),
        choice(
          'golden-hour',
          'Golden hour',
          'Warm directional light.',
          'Use warm golden-hour direction while keeping all product colors objectively accurate.',
        ),
        choice(
          'cinematic',
          'Cinematic contrast',
          'Deep controlled highlights.',
          'Use cinematic contrast, shaped highlights, and clean retained shadow detail.',
        ),
      ]),
      option('palette', 'Color world', 'Surrounding set palette.', 'scene-led', [
        choice(
          'scene-led',
          'Follow scene',
          'Use the preset palette.',
          'Follow the selected scene color palette.',
        ),
        choice(
          'warm-neutral',
          'Warm neutral',
          'Stone, oat, and cream.',
          'Use a warm neutral environment of stone, oat, and cream without tinting the product.',
        ),
        choice(
          'cool-neutral',
          'Cool neutral',
          'Silver, grey, and soft blue.',
          'Use a cool neutral environment without color contamination on the product.',
        ),
        choice(
          'monochrome',
          'Monochrome',
          'Tonal and graphic.',
          'Use a sophisticated monochrome surrounding palette distinct from the product color.',
        ),
        choice(
          'vibrant',
          'Vibrant contrast',
          'High-impact complementary color.',
          'Use one vibrant complementary set color while preserving exact product color.',
        ),
        choice(
          'dark-luxe',
          'Dark luxe',
          'Deep, glossy atmosphere.',
          'Use a dark luxury palette with precise highlights and visible product edges.',
        ),
      ]),
      option(
        'variationStrength',
        'Variation strength',
        'How far variants may explore.',
        'balanced',
        [
          choice(
            'controlled',
            'Controlled',
            'Small, polished differences.',
            'Keep variant differences controlled and catalogue-consistent.',
          ),
          choice(
            'balanced',
            'Balanced',
            'Distinct but campaign-coherent.',
            'Make variants clearly distinct while keeping one coherent campaign language.',
          ),
          choice(
            'adventurous',
            'Adventurous',
            'Broader art-direction exploration.',
            'Explore substantially different but commercially usable compositions and styling choices.',
          ),
        ],
      ),
    ],
  },
] as const satisfies readonly CampaignOptionGroup[];

const CLOTHING_DIRECTION_GROUPS = [
  {
    id: 'presentation',
    label: 'Garment presentation',
    description: 'Choose how the garment should appear in the campaign.',
    options: [
      option('presentation', 'Presentation', 'How the garment is shown.', 'on-model', [
        choice(
          'on-model',
          'On a model',
          'A complete fashion campaign.',
          'Present the garment naturally on an adult fashion model.',
        ),
        choice(
          'ghost-mannequin',
          'Ghost mannequin',
          'Clean e-commerce form.',
          'Present the garment on an invisible ghost mannequin with anatomically natural volume.',
        ),
        choice(
          'flat-lay',
          'Styled flat lay',
          'Premium overhead styling.',
          'Present the garment as a carefully styled premium flat lay.',
        ),
      ]),
    ],
  },
  {
    id: 'model-casting',
    label: 'Model casting',
    description: 'Direct the fictional adult cast. Every generated identity remains unique.',
    options: [
      option(
        'modelGender',
        'Gender presentation',
        'Customer-facing model presentation.',
        'varied',
        [
          choice(
            'varied',
            'Varied',
            'A different presentation per result.',
            'Vary adult gender presentation across the generated cast.',
          ),
          choice('female', 'Female', 'Woman model.', 'Use an adult woman fashion model.'),
          choice('male', 'Male', 'Man model.', 'Use an adult man fashion model.'),
          choice(
            'nonbinary',
            'Non-binary',
            'Androgynous presentation.',
            'Use an adult non-binary model with an androgynous fashion presentation.',
          ),
        ],
      ),
      option('modelAge', 'Age range', 'All available ranges are adults.', '25-34', [
        choice(
          '18-24',
          '18–24',
          'Young adult.',
          'Cast a clearly adult model between 18 and 24 years old.',
        ),
        choice(
          '25-34',
          '25–34',
          'Contemporary core demographic.',
          'Cast an adult model between 25 and 34 years old.',
        ),
        choice(
          '35-49',
          '35–49',
          'Established adult.',
          'Cast an adult model between 35 and 49 years old.',
        ),
        choice('50-plus', '50+', 'Mature adult.', 'Cast a confident adult model aged 50 or older.'),
        choice(
          'varied',
          'Varied adults',
          'Different adult ages.',
          'Vary the clearly adult age across the generated cast.',
        ),
      ]),
      option('modelHeritage', 'Appearance / heritage', 'Visual casting direction.', 'global-mix', [
        choice(
          'global-mix',
          'Global mix',
          'Diverse casting across variants.',
          'Use globally diverse casting across the variants.',
        ),
        choice(
          'african',
          'African',
          'African or Afro-diasporic appearance.',
          'Cast a model with African or Afro-diasporic appearance.',
        ),
        choice(
          'east-asian',
          'East Asian',
          'East Asian appearance.',
          'Cast a model with East Asian appearance.',
        ),
        choice(
          'south-asian',
          'South Asian',
          'South Asian appearance.',
          'Cast a model with South Asian appearance.',
        ),
        choice(
          'mena',
          'Middle Eastern / North African',
          'MENA appearance.',
          'Cast a model with Middle Eastern or North African appearance.',
        ),
        choice(
          'latin',
          'Latin American',
          'Latin American appearance.',
          'Cast a model with Latin American appearance.',
        ),
        choice(
          'european',
          'European',
          'European appearance.',
          'Cast a model with European appearance.',
        ),
        choice(
          'mixed',
          'Mixed heritage',
          'Mixed-heritage appearance.',
          'Cast a model with a distinctive mixed-heritage appearance.',
        ),
      ]),
      option('bodyBuild', 'Body build', 'Inclusive body direction.', 'varied', [
        choice(
          'varied',
          'Varied',
          'Different realistic builds.',
          'Vary realistic adult body builds across the cast.',
        ),
        choice('slim', 'Slim', 'Slim natural build.', 'Use a naturally slim adult model.'),
        choice(
          'athletic',
          'Athletic',
          'Athletic natural build.',
          'Use an athletic adult model without exaggerated musculature.',
        ),
        choice(
          'average',
          'Average',
          'Everyday realistic build.',
          'Use an everyday average adult body build.',
        ),
        choice('curvy', 'Curvy', 'Curvy natural build.', 'Use a naturally curvy adult model.'),
        choice(
          'plus',
          'Plus size',
          'Plus-size representation.',
          'Use a confident plus-size adult model.',
        ),
      ]),
      option('hairDirection', 'Hair', 'Hair and head styling.', 'varied', [
        choice(
          'varied',
          'Varied',
          'Different styling per result.',
          'Vary polished, culturally appropriate hair styling across the cast.',
        ),
        choice('short', 'Short', 'Short contemporary cut.', 'Use a contemporary short hairstyle.'),
        choice('long', 'Long', 'Long styled hair.', 'Use long, naturally styled hair.'),
        choice(
          'curls',
          'Natural curls',
          'Natural textured curls.',
          'Use naturally textured curls with realistic detail.',
        ),
        choice(
          'braids',
          'Braids',
          'Refined braided style.',
          'Use a refined, culturally appropriate braided hairstyle.',
        ),
        choice('shaved', 'Shaved', 'Closely shaved styling.', 'Use a closely shaved hairstyle.'),
        choice(
          'headscarf',
          'Headscarf',
          'Elegant modest styling.',
          'Use an elegant, naturally draped headscarf that does not hide the garment.',
        ),
      ]),
      option('expression', 'Expression', 'Model attitude.', 'confident', [
        choice(
          'confident',
          'Confident',
          'Calm campaign confidence.',
          'Use a calm, self-assured campaign expression.',
        ),
        choice('relaxed', 'Relaxed', 'Natural and candid.', 'Use a relaxed, unforced expression.'),
        choice(
          'joyful',
          'Joyful',
          'Warm genuine energy.',
          'Use a warm, genuinely joyful expression without exaggerated posing.',
        ),
        choice(
          'editorial',
          'Editorial serious',
          'High-fashion restraint.',
          'Use a composed, serious high-fashion editorial expression.',
        ),
        choice(
          'varied',
          'Varied',
          'Different expression per result.',
          'Vary natural campaign-ready expressions between variants.',
        ),
      ]),
      option(
        'castingDiversity',
        'Cast uniqueness',
        'How identities change across results.',
        'unique-each',
        [
          choice(
            'unique-each',
            'New model every result',
            'Maximum customer-level uniqueness.',
            'Use a completely different fictional adult identity in every variant.',
          ),
          choice(
            'cohesive-cast',
            'Cohesive campaign cast',
            'Different people, one casting language.',
            'Use different fictional adults who share a coherent campaign casting language.',
          ),
          choice(
            'wide-diversity',
            'Wide diversity',
            'Maximum visual range.',
            'Use a deliberately broad and inclusive cast with strongly differentiated identities.',
          ),
        ],
      ),
    ],
  },
  {
    id: 'model-performance',
    label: 'Model performance',
    description: 'Control body language and how much of the campaign world is visible.',
    options: [
      option('pose', 'Pose', 'Body language and movement.', 'varied', [
        choice(
          'varied',
          'Vary each result',
          'A campaign pose sequence.',
          'Vary natural fashion poses across results.',
        ),
        choice(
          'standing',
          'Standing',
          'Clean hero stance.',
          'Use a natural standing fashion pose that reveals the full garment.',
        ),
        choice(
          'walking',
          'Walking',
          'Candid motion.',
          'Use a believable mid-step walking pose with accurate garment drape.',
        ),
        choice(
          'seated',
          'Seated',
          'Relaxed editorial pose.',
          'Use a refined seated pose without hiding important garment details.',
        ),
        choice(
          'dynamic',
          'Dynamic',
          'Expressive campaign motion.',
          'Use controlled dynamic movement with anatomically correct limbs and fabric behavior.',
        ),
      ]),
      option('framing', 'Framing', 'How much of the model is visible.', 'three-quarter', [
        choice(
          'full-body',
          'Full body',
          'Head-to-toe campaign frame.',
          'Use a full-body composition with the entire outfit and model visible.',
        ),
        choice(
          'three-quarter',
          'Three-quarter',
          'Balanced fashion framing.',
          'Use a three-quarter fashion composition that prioritizes the garment.',
        ),
        choice(
          'waist-up',
          'Waist up',
          'Closer product focus.',
          'Use a waist-up frame with the garment fully readable.',
        ),
        choice(
          'garment-closeup',
          'Garment close-up',
          'Fabric and construction focus.',
          'Use a close fashion crop focused on the garment while keeping its key construction legible.',
        ),
        choice(
          'varied',
          'Vary each result',
          'Multiple campaign crops.',
          'Vary commercially useful framing between results.',
        ),
      ]),
    ],
  },
] as const satisfies readonly CampaignOptionGroup[];

export function campaignOptionGroups(category: ProductCategory): readonly CampaignOptionGroup[] {
  return category === 'clothing'
    ? [...CLOTHING_DIRECTION_GROUPS, ...SHARED_DIRECTION_GROUPS]
    : SHARED_DIRECTION_GROUPS;
}

export function defaultCampaignOptions(category: ProductCategory): CampaignOptions {
  return Object.fromEntries(
    campaignOptionGroups(category).flatMap((group) =>
      group.options.map((definition) => [definition.id, definition.defaultValue]),
    ),
  );
}

export function normalizeCampaignOptions(
  category: ProductCategory,
  value: unknown,
): CampaignOptions {
  const definitions = campaignOptionGroups(category).flatMap((group) => group.options);
  const defaults = defaultCampaignOptions(category);
  if (value === undefined || value === null) return defaults;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('options must be a JSON object');
  }

  const supplied = value as Record<string, unknown>;
  const known = new Set(definitions.map((definition) => definition.id));
  const unknown = Object.keys(supplied).filter((key) => !known.has(key));
  if (unknown.length)
    throw new Error(
      `Unknown creative option${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}`,
    );

  for (const definition of definitions) {
    const selected = supplied[definition.id];
    if (selected === undefined) continue;
    if (
      typeof selected !== 'string' ||
      !definition.choices.some((candidate) => candidate.id === selected)
    ) {
      throw new Error(
        `Invalid ${definition.label.toLowerCase()} option. Choose: ${definition.choices
          .map((candidate) => candidate.id)
          .join(', ')}`,
      );
    }
    defaults[definition.id] = selected;
  }
  return defaults;
}

export function parseCampaignOptions(
  category: ProductCategory,
  serialized?: string,
): CampaignOptions {
  if (!serialized?.trim()) return defaultCampaignOptions(category);
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error('options must contain valid JSON');
  }
  return normalizeCampaignOptions(category, parsed);
}

export function composeCampaignOptionsPrompt(
  category: ProductCategory,
  options: CampaignOptions,
): string {
  const presentation = options.presentation ?? 'on-model';
  const lines = campaignOptionGroups(category).flatMap((group) => {
    if (category === 'clothing' && presentation !== 'on-model' && group.id.includes('model-')) {
      return [];
    }
    return group.options.map((definition) => {
      const selected = definition.choices.find(
        (candidate) => candidate.id === (options[definition.id] ?? definition.defaultValue),
      );
      return selected?.prompt;
    });
  });

  return `CUSTOM CREATIVE DIRECTION:\n${lines
    .filter((line): line is string => Boolean(line))
    .map((line) => `- ${line}`)
    .join('\n')}`;
}
