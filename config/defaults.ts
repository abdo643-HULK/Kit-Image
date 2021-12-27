import type { ImageConfig, ImageConfigComplete } from '../types';

const deviceSizes = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];
const imageSizes = [16, 32, 48, 64, 96, 128, 256, 384];
const domains: string[] = [];
const formats: ImageFormat[] = ['image/webp'];
const minimumCacheTTL = 60;

export const imageConfigDefault: Omit<ImageConfigComplete, 'loader' | 'path'> = {
	deviceSizes: deviceSizes,
	imageSizes: imageSizes,
	domains: domains,
	minimumCacheTTL: minimumCacheTTL,
	formats: formats,
};
