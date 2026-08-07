import { Injectable, NotFoundException } from '@nestjs/common';
import { BrandProfile } from '@prisma/client';
import { basename } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UpdateBrandProfileDto } from './dto/update-brand-profile.dto';

export type BrandProfileSnapshot = ReturnType<BrandProfileService['snapshot']>;

@Injectable()
export class BrandProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async get(userId: string, fallbackName: string) {
    const profile = await this.prisma.brandProfile.findUnique({ where: { userId } });
    if (!profile) return { exists: false, profile: this.defaults(fallbackName) };
    return { exists: true, profile: this.serialize(profile) };
  }

  async getPersisted(userId: string): Promise<BrandProfile | null> {
    return this.prisma.brandProfile.findUnique({ where: { userId } });
  }

  async update(userId: string, fallbackName: string, dto: UpdateBrandProfileDto) {
    const existing = await this.prisma.brandProfile.findUnique({ where: { userId } });
    const data = this.clean(dto);
    const profile = await this.prisma.$transaction(async (transaction) => {
      const next = existing
        ? await transaction.brandProfile.update({
            where: { userId },
            data: { ...data, version: { increment: 1 } },
          })
        : await transaction.brandProfile.create({
            data: {
              userId,
              brandName: dto.brandName?.trim() || fallbackName,
              businessType: dto.businessType ?? 'other',
              ...data,
            },
          });
      await transaction.brandProfileVersion.create({
        data: {
          brandProfileId: next.id,
          version: next.version,
          snapshot: this.snapshot(next),
        },
      });
      return next;
    });
    return { exists: true, profile: this.serialize(profile) };
  }

  async saveLogo(userId: string, fallbackName: string, file: Express.Multer.File) {
    let profile = await this.prisma.brandProfile.findUnique({ where: { userId } });
    if (!profile) {
      profile = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.brandProfile.create({
          data: { userId, brandName: fallbackName, businessType: 'other' },
        });
        await transaction.brandProfileVersion.create({
          data: {
            brandProfileId: created.id,
            version: created.version,
            snapshot: this.snapshot(created),
          },
        });
        return created;
      });
    }
    const key = await this.storage.putBrandAsset(
      userId,
      `logo-${profile.version + 1}-${basename(file.originalname)}`,
      file.buffer,
      file.mimetype,
    );
    const updated = await this.prisma.$transaction(async (transaction) => {
      const next = await transaction.brandProfile.update({
        where: { id: profile.id },
        data: {
          logoKey: key,
          logoOriginalName: file.originalname,
          logoMimeType: file.mimetype,
          version: { increment: 1 },
        },
      });
      await transaction.brandProfileVersion.create({
        data: {
          brandProfileId: next.id,
          version: next.version,
          snapshot: this.snapshot(next),
        },
      });
      return next;
    });
    return { exists: true, profile: this.serialize(updated) };
  }

  async logo(userId: string): Promise<{ body: Buffer; mimeType: string; name: string }> {
    const profile = await this.prisma.brandProfile.findUnique({ where: { userId } });
    if (!profile?.logoKey) throw new NotFoundException('No brand logo has been uploaded');
    return {
      body: await this.storage.get(profile.logoKey),
      mimeType: profile.logoMimeType ?? 'image/png',
      name: profile.logoOriginalName ?? 'brand-logo',
    };
  }

  snapshot(profile: BrandProfile) {
    return {
      brandName: profile.brandName,
      businessType: profile.businessType,
      businessSubcategory: profile.businessSubcategory,
      website: profile.website,
      description: profile.description,
      slogan: profile.slogan,
      markets: profile.markets,
      languages: profile.languages,
      audience: profile.audience,
      positioning: profile.positioning,
      values: profile.values,
      tone: profile.tone,
      primaryColor: profile.primaryColor,
      secondaryColors: profile.secondaryColors,
      accentColors: profile.accentColors,
      primaryFont: profile.primaryFont,
      secondaryFont: profile.secondaryFont,
      photographyStyles: profile.photographyStyles,
      preferredEnvironments: profile.preferredEnvironments,
      forbiddenEnvironments: profile.forbiddenEnvironments,
      preferredModelAttributes: profile.preferredModelAttributes,
      defaultChannels: profile.defaultChannels,
      defaultAspectRatios: profile.defaultAspectRatios,
      defaultCampaignObjectives: profile.defaultCampaignObjectives,
      forbiddenVisualElements: profile.forbiddenVisualElements,
      requiredVisualElements: profile.requiredVisualElements,
      logoKey: profile.logoKey,
      version: profile.version,
    };
  }

  private serialize(profile: BrandProfile) {
    return {
      ...this.snapshot(profile),
      id: profile.id,
      logoUrl: profile.logoKey ? '/brand-profile/logo' : null,
      logoOriginalName: profile.logoOriginalName,
      onboardingComplete: profile.onboardingComplete,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  private defaults(name: string) {
    return {
      id: null,
      brandName: name,
      businessType: 'other',
      businessSubcategory: null,
      website: null,
      description: null,
      slogan: null,
      markets: [],
      languages: ['en'],
      audience: {},
      positioning: null,
      values: [],
      tone: [],
      primaryColor: '#111111',
      secondaryColors: [],
      accentColors: [],
      primaryFont: null,
      secondaryFont: null,
      photographyStyles: [],
      preferredEnvironments: [],
      forbiddenEnvironments: [],
      preferredModelAttributes: {},
      defaultChannels: [],
      defaultAspectRatios: [],
      defaultCampaignObjectives: [],
      forbiddenVisualElements: [],
      requiredVisualElements: [],
      logoKey: null,
      logoUrl: null,
      version: 0,
      onboardingComplete: false,
      createdAt: null,
      updatedAt: null,
    };
  }

  private clean(dto: UpdateBrandProfileDto): Record<string, unknown> {
    const list = (value?: string[]) => value?.map((item) => item.trim()).filter(Boolean);
    const text = (value?: string | null) =>
      value === undefined ? undefined : value?.trim() || null;
    return {
      ...(dto.brandName !== undefined ? { brandName: dto.brandName.trim() } : {}),
      ...(dto.businessType !== undefined ? { businessType: dto.businessType } : {}),
      ...(dto.businessSubcategory !== undefined
        ? { businessSubcategory: text(dto.businessSubcategory) }
        : {}),
      ...(dto.website !== undefined ? { website: text(dto.website) } : {}),
      ...(dto.description !== undefined ? { description: text(dto.description) } : {}),
      ...(dto.slogan !== undefined ? { slogan: text(dto.slogan) } : {}),
      ...(dto.markets !== undefined ? { markets: list(dto.markets) } : {}),
      ...(dto.languages !== undefined ? { languages: list(dto.languages) } : {}),
      ...(dto.audience !== undefined ? { audience: dto.audience } : {}),
      ...(dto.positioning !== undefined ? { positioning: text(dto.positioning) } : {}),
      ...(dto.values !== undefined ? { values: list(dto.values) } : {}),
      ...(dto.tone !== undefined ? { tone: list(dto.tone) } : {}),
      ...(dto.primaryColor !== undefined ? { primaryColor: dto.primaryColor.toUpperCase() } : {}),
      ...(dto.secondaryColors !== undefined
        ? { secondaryColors: dto.secondaryColors.map((color) => color.toUpperCase()) }
        : {}),
      ...(dto.accentColors !== undefined
        ? { accentColors: dto.accentColors.map((color) => color.toUpperCase()) }
        : {}),
      ...(dto.primaryFont !== undefined ? { primaryFont: text(dto.primaryFont) } : {}),
      ...(dto.secondaryFont !== undefined ? { secondaryFont: text(dto.secondaryFont) } : {}),
      ...(dto.photographyStyles !== undefined
        ? { photographyStyles: list(dto.photographyStyles) }
        : {}),
      ...(dto.preferredEnvironments !== undefined
        ? { preferredEnvironments: list(dto.preferredEnvironments) }
        : {}),
      ...(dto.forbiddenEnvironments !== undefined
        ? { forbiddenEnvironments: list(dto.forbiddenEnvironments) }
        : {}),
      ...(dto.preferredModelAttributes !== undefined
        ? { preferredModelAttributes: dto.preferredModelAttributes }
        : {}),
      ...(dto.defaultChannels !== undefined ? { defaultChannels: list(dto.defaultChannels) } : {}),
      ...(dto.defaultAspectRatios !== undefined
        ? { defaultAspectRatios: list(dto.defaultAspectRatios) }
        : {}),
      ...(dto.defaultCampaignObjectives !== undefined
        ? { defaultCampaignObjectives: list(dto.defaultCampaignObjectives) }
        : {}),
      ...(dto.forbiddenVisualElements !== undefined
        ? { forbiddenVisualElements: list(dto.forbiddenVisualElements) }
        : {}),
      ...(dto.requiredVisualElements !== undefined
        ? { requiredVisualElements: list(dto.requiredVisualElements) }
        : {}),
      ...(dto.onboardingComplete !== undefined
        ? { onboardingComplete: dto.onboardingComplete }
        : {}),
    };
  }
}
