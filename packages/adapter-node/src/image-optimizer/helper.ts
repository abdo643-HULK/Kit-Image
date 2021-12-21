import { getType as lookup, getExtension as extension } from 'mime';

export const AVIF = 'image/avif';
export const WEBP = 'image/webp';
export const PNG = 'image/png';
export const JPEG = 'image/jpeg';
export const GIF = 'image/gif';
export const SVG = 'image/svg+xml';
export const CACHE_VERSION = 3;
export const ANIMATABLE_TYPES = [WEBP, PNG, GIF];
export const VECTOR_TYPES = [SVG];
export const BLUR_IMG_SIZE = 8; // should match `next-image-loader`
export const inflightRequests = new Map<string, Promise<undefined>>();

type ContentType =
	| 'image/avif'
	| 'image/webp'
	| 'image/png'
	| 'image/jpeg'
	| 'image/gif'
	| 'image/svg+xml';
/**
 * Inspects the first few bytes of a buffer to determine if
 * it matches the "magic number" of known file signatures.
 * https://en.wikipedia.org/wiki/List_of_file_signatures
 */
export function detectContentType(buffer: Buffer): ContentType | null {
	if ([0xff, 0xd8, 0xff].every((b, i) => buffer[i] === b)) {
		return JPEG;
	}

	if (
		[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
			(b, i) => buffer[i] === b
		)
	) {
		return PNG;
	}

	if ([0x47, 0x49, 0x46, 0x38].every((b, i) => buffer[i] === b)) {
		return GIF;
	}

	if (
		[0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50].every(
			(b, i) => !b || buffer[i] === b
		)
	) {
		return WEBP;
	}

	if ([0x3c, 0x3f, 0x78, 0x6d, 0x6c].every((b, i) => buffer[i] === b)) {
		return SVG;
	}

	if (
		[0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66].every(
			(b, i) => !b || buffer[i] === b
		)
	) {
		return AVIF;
	}

	return null;
}

export function getExtension(contentType: string): string | null {
	// if (contentType === 'image/avif') {
	// 	// TODO: update "mime" package
	// 	return 'avif';
	// }

	return extension(contentType);
}

export function getContentType(extWithoutDot: string): string | null {
	// if (extWithoutDot === 'avif') {
	// 	// TODO: update "mime" package
	// 	return 'image/avif';
	// }

	return lookup(extWithoutDot);
}
