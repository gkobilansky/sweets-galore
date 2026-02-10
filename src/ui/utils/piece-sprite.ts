import type { Spritesheet } from 'pixi.js';
import { PixiAssets, PixiContainer, PixiGraphics, PixiSprite, PixiTexture } from '../../plugins/engine';
import { Manager } from '../../entities/manager';
import { getDisplaySize, shouldShowRadiusBorder, type TierConfig } from '../../shared/config/game-config';

interface PieceSpriteOptions {
  targetDiameter?: number;
}

type PieceSpriteWithFrames = PixiSprite & {
  pieceFrameTextures?: PixiTexture[];
  pieceFrameIndex?: number;
  pieceActiveFrameIndex?: number;
  pieceTargetDiameter?: number;
};

const tierTextureCache: Map<number, PixiTexture[]> = new Map();
const frameTextureCache: Map<string, PixiTexture> = new Map();
const fallbackTextureCache: Map<string, PixiTexture> = new Map();
let cachedSpritesheet: Spritesheet | null = null;

export function createPieceSprite(tier: TierConfig, options: PieceSpriteOptions = {}): PixiSprite {
  // Use displaySize for visual rendering (independent of physics radius)
  const targetDiameter = options.targetDiameter ?? getDisplaySize(tier.id);
  const textures = getTierTextures(tier);

  if (textures.length > 0) {
    const sprite = new PixiSprite(textures[0]);
    sprite.anchor.set(0.5);

    const spriteWithFrames = sprite as PieceSpriteWithFrames;
    spriteWithFrames.pieceFrameTextures = textures;
    spriteWithFrames.pieceTargetDiameter = targetDiameter;
    spriteWithFrames.pieceActiveFrameIndex = findActiveFrameIndex(tier.frames);

    setSpriteFrameIndex(spriteWithFrames, 0);

    // Debug: show physics radius border
    if (shouldShowRadiusBorder()) {
      return wrapWithRadiusBorder(sprite, tier);
    }

    return sprite;
  }

  return createFallbackSprite(tier, targetDiameter / 2);
}

function wrapWithRadiusBorder(sprite: PixiSprite, tier: TierConfig): PixiSprite {
  const container = new PixiContainer();

  // Draw circle showing physics radius
  const border = new PixiGraphics();
  border.circle(0, 0, tier.radius);
  border.stroke({ color: tier.color, alpha: 0.7, width: 2 });

  container.addChild(border);
  container.addChild(sprite);

  // Copy sprite properties to container for compatibility
  const spriteWithFrames = sprite as PieceSpriteWithFrames;
  const containerAsSprite = container as unknown as PieceSpriteWithFrames;
  containerAsSprite.pieceFrameTextures = spriteWithFrames.pieceFrameTextures;
  containerAsSprite.pieceTargetDiameter = spriteWithFrames.pieceTargetDiameter;
  containerAsSprite.pieceActiveFrameIndex = spriteWithFrames.pieceActiveFrameIndex;
  containerAsSprite.pieceFrameIndex = spriteWithFrames.pieceFrameIndex;

  // Store reference to the actual sprite for frame changes
  (container as any)._innerSprite = sprite;

  return container as unknown as PixiSprite;
}

function getSpritesheet(): Spritesheet | null {
  if (cachedSpritesheet) {
    return cachedSpritesheet;
  }

  const sheet = PixiAssets.get('pieces-atlas-data') as Spritesheet | undefined;
  if (sheet && typeof sheet === 'object' && sheet.textures) {
    cachedSpritesheet = sheet;
    return sheet;
  }

  return null;
}

function getTierTextures(tier: TierConfig): PixiTexture[] {
  const cached = tierTextureCache.get(tier.id);
  if (cached) {
    return cached;
  }

  const textures: PixiTexture[] = [];
  for (const frameName of tier.frames ?? []) {
    const texture = getFrameTexture(frameName);
    if (texture) {
      textures.push(texture);
    }
  }

  if (textures.length > 0) {
    tierTextureCache.set(tier.id, textures);
  }

  return textures;
}

function getFrameTexture(frameName: string): PixiTexture | undefined {
  const cached = frameTextureCache.get(frameName);
  if (cached) {
    return cached;
  }

  const spritesheet = getSpritesheet();
  if (!spritesheet) {
    return undefined;
  }

  const texture = spritesheet.textures?.[frameName];
  if (texture) {
    frameTextureCache.set(frameName, texture);
    return texture;
  }

  return undefined;
}

function getTextureBaseWidth(texture: PixiTexture): number {
  // Prefer original size when available to avoid scale skew from previous adjustments
  const origWidth = (texture as any).orig?.width;
  if (typeof origWidth === 'number' && origWidth > 0) {
    return origWidth;
  }
  return texture.width;
}

function createFallbackSprite(tier: TierConfig, radius: number): PixiSprite {
  const key = `${tier.id}:${radius.toFixed(2)}`;
  let texture = fallbackTextureCache.get(key);

  if (!texture) {
    const graphics = new PixiGraphics();
    graphics.circle(0, 0, radius);
    graphics.fill({ color: tier.color });

    const renderer = Manager.app?.renderer;
    if (!renderer) {
      throw new Error('Pixi renderer not initialized');
    }

    texture = renderer.generateTexture(graphics) as PixiTexture;
    fallbackTextureCache.set(key, texture);
  }

  const sprite = new PixiSprite(texture);
  sprite.anchor.set(0.5);
  return sprite;
}

function setSpriteFrameIndex(sprite: PieceSpriteWithFrames, frameIndex: number): void {
  // Handle wrapped container case (when radius border is shown)
  const innerSprite = (sprite as any)._innerSprite as PieceSpriteWithFrames | undefined;
  const targetSprite = innerSprite ?? sprite;

  const textures = targetSprite.pieceFrameTextures ?? sprite.pieceFrameTextures;
  if (!textures?.length) {
    return;
  }

  const clamped = Math.max(0, Math.min(frameIndex, textures.length - 1));
  if (targetSprite.pieceFrameIndex === clamped && targetSprite.texture === textures[clamped]) {
    return;
  }

  targetSprite.pieceFrameIndex = clamped;
  sprite.pieceFrameIndex = clamped;
  targetSprite.texture = textures[clamped];
  applyScaleForTexture(targetSprite, textures[clamped]);
}

function applyScaleForTexture(sprite: PieceSpriteWithFrames, texture: PixiTexture): void {
  const targetDiameter = sprite.pieceTargetDiameter;
  if (!targetDiameter || targetDiameter <= 0) {
    return;
  }

  const baseWidth = getTextureBaseWidth(texture);
  if (baseWidth > 0) {
    const scale = targetDiameter / baseWidth;
    sprite.scale.set(scale);
  }
}

function findActiveFrameIndex(frames?: string[]): number | undefined {
  if (!frames || frames.length === 0) {
    return undefined;
  }

  const explicitIndex = frames.findIndex((frameName) => frameName.endsWith('-1'));
  if (explicitIndex >= 0) {
    return explicitIndex;
  }

  return frames.length > 1 ? 1 : undefined;
}

export function setPieceSpriteMovementState(sprite: PixiSprite, isMoving: boolean): void {
  const spriteWithFrames = sprite as PieceSpriteWithFrames;
  const activeIndex = spriteWithFrames.pieceActiveFrameIndex;
  if (activeIndex === undefined) {
    return;
  }

  const targetIndex = isMoving ? activeIndex : 0;
  setSpriteFrameIndex(spriteWithFrames, targetIndex);
}
