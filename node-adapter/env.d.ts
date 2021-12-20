interface ImportMeta {
	readonly version: string;
}

type ImageFormat = 'image/avif' | 'image/webp';

interface ImportMetaEnv {
	readonly KIT_IMAGE_SHARP_PATH: string;
	// readonly __KIT_IMAGE_OPTS: {
	// 	deviceSizes: number[];
	// 	imageSizes: number[];
	// 	loader: LoaderValue;
	// 	path: string;
	// 	domains?: string[];
	// 	disableStaticImages?: boolean;
	// 	minimumCacheTTL?: number;
	// 	formats?: ImageFormat[];
	// };
}
