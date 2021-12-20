import { lookup, extension } from 'mime';

export function getExtension(contentType: string): string | undefined {
	// if (contentType === 'image/avif') {
	// 	// TODO: update "mime" package
	// 	return 'avif';
	// }

	return extension(contentType);
}

export function getContentType(extWithoutDot: string): string {
	// if (extWithoutDot === 'avif') {
	// 	// TODO: update "mime" package
	// 	return 'image/avif';
	// }

	return lookup(extWithoutDot);
}
