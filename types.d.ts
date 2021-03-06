import type { VALID_LAYOUT_VALUES, VALID_LOADERS } from './packages/image/src/lib/_internal/constants';

export type LayoutValue = typeof VALID_LAYOUT_VALUES[number];
export type LoaderValue = typeof VALID_LOADERS[number];

export type PlaceholderValue = 'blur' | 'empty';

export type DefaultImageLoaderProps = ImageLoaderProps & { root: string };

export type ImageLoaderProps = {
	src: string;
	width: number;
	quality?: number;
};

export type OnLoadingComplete = (result: { naturalWidth: number; naturalHeight: number }) => void;

export type ObjectFitStyle = 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';

export type ObjectPositionStyle = CSSStyleDeclaration['objectPosition'];
export type DecodingAttribute = HTMLImageElement['decoding'];
export type LoadingAttribute = 'eager' | 'lazy';

export type ImageLoader = (resolverProps: ImageLoaderProps) => string;

export type GenImgAttrsData = {
	src: string;
	unoptimized: boolean;
	layout: LayoutValue;
	loader: ImageLoader;
	width?: number;
	quality?: number;
	sizes?: string;
};

export type GenImgAttrsResult = {
	src: string;
	srcset: string | undefined;
	sizes: string | undefined;
};

export type Img = {
	src: string;
	priority: boolean;
	placeholder: string;
};

type ImageFormat = 'image/avif' | 'image/webp';

export type ImageConfigComplete = {
	imageSizes: number[];
	deviceSizes: number[];
	domains: string[];
	minimumCacheTTL: number;
	formats: ImageFormat[];
	loader: LoaderValue;
	path: string;
};

export type ImageConfig = Partial<ImageConfigComplete>;

export type ImageExtension = 'avif' | 'webp' | 'png' | 'jpeg';
