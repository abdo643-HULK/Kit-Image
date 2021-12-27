import { constants, promises } from 'fs';
import { getType as lookup, getExtension as extension } from 'mime';

import { fresh } from './fresh';
import { AVIF, GIF, JPEG, PNG, SVG, WEBP } from './constants';

import type { IncomingMessage, ServerResponse } from 'http';

export const inflightRequests = new Map<string, Promise<undefined>>();

type ContentType = 'image/avif' | 'image/webp' | 'image/png' | 'image/jpeg' | 'image/gif' | 'image/svg+xml';
/**
 * Inspects the first few bytes of a buffer to determine if
 * it matches the "magic number" of known file signatures.
 * https://en.wikipedia.org/wiki/List_of_file_signatures
 */
export function detectContentType(buffer: Buffer): ContentType | null {
	if ([0xff, 0xd8, 0xff].every((b, i) => buffer[i] === b)) {
		return JPEG;
	}

	if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => buffer[i] === b)) {
		return PNG;
	}

	if ([0x47, 0x49, 0x46, 0x38].every((b, i) => buffer[i] === b)) {
		return GIF;
	}

	if ([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50].every((b, i) => !b || buffer[i] === b)) {
		return WEBP;
	}

	if ([0x3c, 0x3f, 0x78, 0x6d, 0x6c].every((b, i) => buffer[i] === b)) {
		return SVG;
	}

	if ([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66].every((b, i) => !b || buffer[i] === b)) {
		return AVIF;
	}

	return null;
}

export function getExtension(contentType: string): string | null {
	return extension(contentType);
}

export function getContentType(extWithoutDot: string): string | null {
	return lookup(extWithoutDot);
}

export async function fileExists(fileName: string, type?: 'file' | 'directory'): Promise<boolean> {
	try {
		if (type === 'file') {
			const stats = await promises.stat(fileName);
			return stats.isFile();
		} else if (type === 'directory') {
			const stats = await promises.stat(fileName);
			return stats.isDirectory();
		} else {
			await promises.access(fileName, constants.F_OK);
		}

		return true;
	} catch (err) {
		if (isError(err) && (err.code === 'ENOENT' || err.code === 'ENAMETOOLONG')) {
			return false;
		}

		throw err;
	}
}

export default function isError(err: unknown): err is KitError {
	return typeof err === 'object' && err !== null && 'name' in err && 'message' in err;
}

export interface KitError extends Error {
	type?: string;
	page?: string;
	code?: string | number;
	cancelled?: boolean;
}

export function sendEtagResponse(req: IncomingMessage, res: ServerResponse, etag: string | undefined): boolean {
	if (etag) {
		/**
		 * The server generating a 304 response MUST generate any of the
		 * following header fields that would have been sent in a 200 (OK)
		 * response to the same request: Cache-Control, Content-Location, Date,
		 * ETag, Expires, and Vary. https://tools.ietf.org/html/rfc7232#section-4.1
		 */
		res.setHeader('ETag', etag);
	}

	if (fresh(req.headers, { etag })) {
		res.statusCode = 304;
		res.end();
		return true;
	}

	return false;
}
