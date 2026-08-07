export const BUSINESS_TYPES = [
  'fashion',
  'beauty-cosmetics',
  'sports-nutrition',
  'health-wellness',
  'food-beverage',
  'jewelry',
  'furniture-home',
  'electronics',
  'other',
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BRAND_PROFILE_LIMITS = {
  listItems: 12,
  colorItems: 8,
  description: 1_200,
  shortText: 160,
} as const;
