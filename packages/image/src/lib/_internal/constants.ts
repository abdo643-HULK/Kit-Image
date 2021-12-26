import { imageConfigDefault } from '../../../../../config/defaults';
import { akamaiLoader, cloudinaryLoader, customLoader, defaultLoader, imgixLoader } from './loaders';

import type { DefaultImageLoaderProps, ImageConfig, LoaderValue } from 'types';

export const EMPTY_DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export const VALID_LAYOUT_VALUES = ['fill', 'fixed', 'intrinsic', 'responsive', undefined] as const;

export const TAG = 'IMAGE COMPONENT:';

export const VALID_LOADERS = ['default', 'imgix', 'cloudinary', 'akamai', 'custom'] as const;

declare const __KIT_IMAGE_OPTS: ImageConfig;

export const {
	deviceSizes: configDeviceSizes,
	imageSizes: configImageSizes,
	loader: configLoader,
	path: configPath,
	domains: configDomains,
} = { ...imageConfigDefault, ...(__KIT_IMAGE_OPTS || {}) };

// sort smallest to largest
export const allSizes = [...configDeviceSizes, ...configImageSizes];
configDeviceSizes.sort((a: number, b: number) => a - b);
allSizes.sort((a, b) => a - b);

type LoaderFuntion = (props: DefaultImageLoaderProps) => string;

export const loaders = new Map<LoaderValue, LoaderFuntion>([
	['default', defaultLoader],
	['imgix', imgixLoader],
	['cloudinary', cloudinaryLoader],
	['akamai', akamaiLoader],
	['custom', customLoader],
]);
