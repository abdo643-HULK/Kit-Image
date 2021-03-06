import chalk from 'chalk';
import imageSizeOf from 'image-size';
import Stream from 'stream';

import { join } from 'path';
import { createHash } from 'crypto';
import { mediaType } from '@hapi/accept';
import { parse } from 'url';

import { createReadStream, promises } from 'fs';
import { getOrientation, Orientation } from 'get-orientation';

import isAnimated from './is-animated';
import contentDisposition from './content-disposition';

import { fileExists } from './file-exists';
import { sendEtagResponse } from './send-payload';
import { imageConfigDefault } from '../../../../config/defaults';
import { getContentType, getExtension } from './helper';

// import { processBuffer, decodeBuffer, Operation } from '../squoosh/main';

import type { Socket } from 'net';
import type { Request } from 'polka';
import type { SharpOptions, Sharp } from 'sharp';
import type { ServerResponse, IncomingHttpHeaders } from 'http';

// import type Server from './base-server';
import type { ImageConfig, ImageExtension } from 'types';

type ContentType = 'image/avif' | 'image/webp' | 'image/png' | 'image/jpeg' | 'image/gif' | 'image/svg+xml';

const AVIF = 'image/avif';
const WEBP = 'image/webp';
const PNG = 'image/png';
const JPEG = 'image/jpeg';
const GIF = 'image/gif';
const SVG = 'image/svg+xml';
const CACHE_VERSION = 3;
const ANIMATABLE_TYPES = [WEBP, PNG, GIF];
const VECTOR_TYPES = [SVG];
const BLUR_IMG_SIZE = 8; // should match `next-image-loader`
const inflightRequests = new Map<string, Promise<undefined>>();

interface MockRequest extends Stream.Readable {
	headers: IncomingHttpHeaders;
	method?: string;
	url: string;
	connection: Socket;
}

type sharpFunction = {
	(
		input?:
			| Buffer
			| Uint8Array
			| Uint8ClampedArray
			| Int8Array
			| Uint16Array
			| Int16Array
			| Uint32Array
			| Int32Array
			| Float32Array
			| Float64Array
			| string,
		options?: SharpOptions
	): Sharp;
	(options?: SharpOptions): Sharp;
};

let sharp: sharpFunction | undefined;

try {
	(async () => {
		sharp = await import((import.meta.env.KIT_IMAGE_SHARP_PATH as string) || 'sharp');
	})();
} catch (e) { 
	// Sharp not present on the server, Squoosh fallback will be used
}

export async function imageOptimizer(
	// server: Server,
	req: Request,
	res: ServerResponse,
	basePath: string,
	// nextConfig: NextConfig,
	distDir: string,
	isDev = false
): Promise<void> {
	// const imageData: ImageConfig = nextConfig.images || imageConfigDefault;
	const imageData: ImageConfig = imageConfigDefault;
	const {
		deviceSizes = [],
		imageSizes = [],
		domains = [],
		loader,
		minimumCacheTTL = 60,
		formats = ['image/webp'],
	} = imageData;

	if (loader !== 'default') {
		res.statusCode = 404;
		res.end('Not found');
		// await server.render404(req, res, parsedUrl);
		return;
	}

	const { headers, query } = req;
	const { url, w, q } = query;
	const mimeType = getSupportedMimeType(formats, headers.accept);
	let href: string;

	if (!url) {
		res.statusCode = 400;
		res.end('"url" parameter is required');
		return;
	} else if (Array.isArray(url)) {
		res.statusCode = 400;
		res.end('"url" parameter cannot be an array');
		return;
	}

	let isAbsolute: boolean;

	if (url.startsWith('/')) {
		href = url;
		isAbsolute = false;
	} else {
		let hrefParsed: URL;

		try {
			hrefParsed = new URL(url);
			href = hrefParsed.toString();
			isAbsolute = true;
		} catch (_error) {
			res.statusCode = 400;
			res.end('"url" parameter is invalid');
			return;
		}

		if (!['http:', 'https:'].includes(hrefParsed.protocol)) {
			res.statusCode = 400;
			res.end('"url" parameter is invalid');
			return;
		}

		if (!domains.includes(hrefParsed.hostname)) {
			res.statusCode = 400;
			res.end('"url" parameter is not allowed');
			return;
		}
	}

	if (!w) {
		res.statusCode = 400;
		res.end('"w" parameter (width) is required');
		return;
	} else if (Array.isArray(w)) {
		res.statusCode = 400;
		res.end('"w" parameter (width) cannot be an array');
		return;
	}

	if (!q) {
		res.statusCode = 400;
		res.end('"q" parameter (quality) is required');
		return;
	} else if (Array.isArray(q)) {
		res.statusCode = 400;
		res.end('"q" parameter (quality) cannot be an array');
		return;
	}

	const width = parseInt(w, 10);

	if (!width || isNaN(width)) {
		res.statusCode = 400;
		res.end('"w" parameter (width) must be a number greater than 0');
		return;
	}

	const sizes = [...deviceSizes, ...imageSizes];

	if (isDev) {
		sizes.push(BLUR_IMG_SIZE);
	}

	if (!sizes.includes(width)) {
		res.statusCode = 400;
		res.end(`"w" parameter (width) of ${width} is not allowed`);
		return;
	}

	const quality = parseInt(q);

	if (isNaN(quality) || quality < 1 || quality > 100) {
		res.statusCode = 400;
		res.end('"q" parameter (quality) must be a number between 1 and 100');
		return;
	}

	const hash = getHash([CACHE_VERSION, href, width, quality, mimeType]);
	const imagesDir = join(distDir, 'cache', 'images');
	const hashDir = join(imagesDir, hash);
	const now = Date.now();

	// If there're concurrent requests hitting the same resource and it's still
	// being optimized, wait before accessing the cache.
	if (inflightRequests.has(hash)) {
		await inflightRequests.get(hash);
	}

	let dedupeResolver: (val?: PromiseLike<undefined>) => void;
	inflightRequests.set(hash, new Promise(resolve => (dedupeResolver = resolve)));

	try {
		if (await fileExists(hashDir, 'directory')) {
			const files = await promises.readdir(hashDir);
			for (const file of files) {
				const [maxAgeStr, expireAtSt, etag, extension] = file.split('.');
				const maxAge = Number(maxAgeStr);
				const expireAt = Number(expireAtSt);
				const contentType = getContentType(extension);
				const fsPath = join(hashDir, file);
				if (now < expireAt) {
					const result = setResponseHeaders(req, res, url, etag, maxAge, contentType, isStatic, isDev);
					if (!result.finished) {
						createReadStream(fsPath).pipe(res);
					}
					return;
				} else {
					await promises.unlink(fsPath);
				}
			}
		}

		let upstreamBuffer: Buffer;
		let upstreamType: string | null;
		let maxAge: number;

		if (isAbsolute) {
			const upstreamRes = await fetch(href);

			if (!upstreamRes.ok) {
				res.statusCode = upstreamRes.status;
				res.end('"url" parameter is valid but upstream response is invalid');
				return;
			}

			res.statusCode = upstreamRes.status;
			upstreamBuffer = Buffer.from(await upstreamRes.arrayBuffer());
			upstreamType = detectContentType(upstreamBuffer) || upstreamRes.headers.get('Content-Type');
			maxAge = getMaxAge(upstreamRes.headers.get('Cache-Control'));
		} else {
			try {
				const resBuffers: Buffer[] = [];
				const mockRes: any = new Stream.Writable();

				const isStreamFinished = new Promise(function (resolve, reject) {
					mockRes.on('finish', () => resolve(true));
					mockRes.on('end', () => resolve(true));
					mockRes.on('error', () => reject());
				});

				mockRes.write = (chunk: Buffer | string) => {
					resBuffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
				};
				mockRes._write = (chunk: Buffer | string) => {
					mockRes.write(chunk);
				};

				const mockHeaders: Record<string, string | string[]> = {};

				mockRes.writeHead = (_status: any, _headers: any) => Object.assign(mockHeaders, _headers);
				mockRes.getHeader = (name: string) => mockHeaders[name.toLowerCase()];
				mockRes.getHeaders = () => mockHeaders;
				mockRes.getHeaderNames = () => Object.keys(mockHeaders);
				mockRes.setHeader = (name: string, value: string | string[]) =>
					(mockHeaders[name.toLowerCase()] = value);
				mockRes.removeHeader = (name: string) => {
					delete mockHeaders[name.toLowerCase()];
				};
				mockRes._implicitHeader = () => {};
				mockRes.connection = res.socket;
				mockRes.finished = false;
				mockRes.statusCode = 200;

				const mockReq = new Stream.Readable() as MockRequest;

				mockReq._read = () => {
					mockReq.emit('end');
					mockReq.emit('close');
					return Buffer.from('');
				};

				mockReq.headers = req.headers;
				mockReq.method = req.method;
				mockReq.url = href;
				mockReq.connection = req.socket;

				// await server.getRequestHandler()(
				// 	mockReq,
				// 	mockRes,
				// 	parse(href, true)
				// );
				await isStreamFinished;
				res.statusCode = mockRes.statusCode;

				upstreamBuffer = Buffer.concat(resBuffers);
				upstreamType = detectContentType(upstreamBuffer) || mockRes.getHeader('Content-Type');
				maxAge = getMaxAge(mockRes.getHeader('Cache-Control'));
			} catch (err) {
				res.statusCode = 500;
				res.end('"url" parameter is valid but upstream response is invalid');
				return;
			}
		}

		const expireAt = Math.max(maxAge, minimumCacheTTL) * 1000 + now;

		if (upstreamType) {
			const vector = VECTOR_TYPES.includes(upstreamType);
			const animate = ANIMATABLE_TYPES.includes(upstreamType) && isAnimated(upstreamBuffer);
			if (vector || animate) {
				await writeToCacheDir(hashDir, upstreamType, maxAge, expireAt, upstreamBuffer);
				sendResponse(req, res, url, maxAge, upstreamType, upstreamBuffer, isStatic, isDev);
				return;
			}

			if (!upstreamType.startsWith('image/')) {
				res.statusCode = 400;
				res.end("The requested resource isn't a valid image.");
				return;
			}
		}

		let contentType: string;

		if (mimeType) {
			contentType = mimeType;
		} else if (upstreamType?.startsWith('image/') && getExtension(upstreamType)) {
			contentType = upstreamType;
		} else {
			contentType = JPEG;
		}

		try {
			let optimizedBuffer: Buffer | undefined;

			// Show sharp warning in production once
			console.warn(
				'Warning: ' +
					`For production Image Optimization with Next.js, the optional 'sharp' package is strongly recommended. Run 'yarn add sharp', and Next.js will use it automatically for Image Optimization.\n` +
					'Read more: https://nextjs.org/docs/messages/sharp-missing-in-production'
			);

			// Begin Squoosh transformation logic
			const orientation = await getOrientation(upstreamBuffer);
			const operations: Operation[] = [];
			if (orientation === Orientation.RIGHT_TOP) {
				operations.push({ type: 'rotate', numRotations: 1 });
			} else if (orientation === Orientation.BOTTOM_RIGHT) {
				operations.push({ type: 'rotate', numRotations: 2 });
			} else if (orientation === Orientation.LEFT_BOTTOM) {
				operations.push({ type: 'rotate', numRotations: 3 });
			} else {
				// TODO: support more orientations
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				// const _: never = orientation
			}

			operations.push({ type: 'resize', width });
			if (contentType === AVIF) {
				optimizedBuffer = await processBuffer(upstreamBuffer, operations, 'avif', quality);
			} else if (contentType === WEBP) {
				optimizedBuffer = await processBuffer(upstreamBuffer, operations, 'webp', quality);
			} else if (contentType === PNG) {
				optimizedBuffer = await processBuffer(upstreamBuffer, operations, 'png', quality);
			} else if (contentType === JPEG) {
				optimizedBuffer = await processBuffer(upstreamBuffer, operations, 'jpeg', quality);
			}
			// End Squoosh transformation logic

			if (optimizedBuffer) {
				await writeToCacheDir(hashDir, contentType, maxAge, expireAt, optimizedBuffer);
				sendResponse(req, res, url, maxAge, contentType, optimizedBuffer, isDev);
			} else {
				throw new Error('Unable to optimize buffer');
			}
		} catch (error) {
			sendResponse(req, res, url, maxAge, upstreamType, upstreamBuffer, isDev);
		}

		return;
	} finally {
		// Make sure to remove the hash in the end.
		dedupeResolver!();
		inflightRequests.delete(hash);
	}
}

async function writeToCacheDir(dir: string, contentType: string, maxAge: number, expireAt: number, buffer: Buffer) {
	await promises.mkdir(dir, { recursive: true });

	const extension = getExtension(contentType);
	const etag = getHash([buffer]);
	const filename = join(dir, `${maxAge}.${expireAt}.${etag}.${extension}`);

	await promises.writeFile(filename, buffer);
}

function getFileNameWithExtension(url: string, contentType: string | null): string | void {
	const [urlWithoutQueryParams] = url.split('?');
	const fileNameWithExtension = urlWithoutQueryParams.split('/').pop();

	if (!contentType || !fileNameWithExtension) {
		return;
	}

	const [fileName] = fileNameWithExtension.split('.');
	const extension = getExtension(contentType);

	return `${fileName}.${extension}`;
}

function setResponseHeaders(
	req: Request,
	res: ServerResponse,
	url: string,
	etag: string,
	maxAge: number,
	contentType: string | null,
	isDev: boolean
) {
	res.setHeader('Vary', 'Accept');
	res.setHeader('Cache-Control', `public, max-age=${isDev ? 0 : maxAge}, must-revalidate`);

	if (sendEtagResponse(req, res, etag)) {
		// already called res.end() so we're finished
		return { finished: true };
	}

	if (contentType) {
		res.setHeader('Content-Type', contentType);
	}

	const fileName = getFileNameWithExtension(url, contentType);
	if (fileName) {
		res.setHeader('Content-Disposition', contentDisposition(fileName, { type: 'inline' }));
	}

	res.setHeader('Content-Security-Policy', `script-src 'none'; sandbox;`);

	return { finished: false };
}

function sendResponse(
	req: Request,
	res: ServerResponse,
	url: string,
	maxAge: number,
	contentType: string | null,
	buffer: Buffer,
	isDev: boolean
) {
	const etag = getHash([buffer]);
	const result = setResponseHeaders(req, res, url, etag, maxAge, contentType, isDev);
	if (!result.finished) {
		res.end(buffer);
	}
}

function getSupportedMimeType(options: string[], accept = ''): string {
	const mimeType = mediaType(accept, options);
	return accept.includes(mimeType) ? mimeType : '';
}

function getHash(items: (string | number | Buffer)[]) {
	const hash = createHash('sha256');
	for (let item of items) {
		if (typeof item === 'number') hash.update(String(item));
		else {
			hash.update(item);
		}
	}
	// See https://en.wikipedia.org/wiki/Base64#Filenames
	return hash.digest('base64').replace(/\//g, '-');
}

function parseCacheControl(str: string | null): Map<string, string> {
	const map = new Map<string, string>();
	if (!str) {
		return map;
	}
	for (let directive of str.split(',')) {
		let [key, value] = directive.trim().split('=');
		key = key.toLowerCase();
		if (value) {
			value = value.toLowerCase();
		}
		map.set(key, value);
	}
	return map;
}

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

export function getMaxAge(str: string | null): number {
	const map = parseCacheControl(str);
	if (map) {
		let age = map.get('s-maxage') || map.get('max-age') || '';
		if (age.startsWith('"') && age.endsWith('"')) {
			age = age.slice(1, -1);
		}
		const n = parseInt(age, 10);
		if (!isNaN(n)) {
			return n;
		}
	}
	return 0;
}

export async function resizeImage(
	content: Buffer,
	dimension: 'width' | 'height',
	size: number,
	// Should match VALID_BLUR_EXT
	extension: ImageExtension,
	quality: number
): Promise<Buffer | undefined> {
	const resizeOperationOpts: Operation =
		dimension === 'width' ? { type: 'resize', width: size } : { type: 'resize', height: size };
	const buf = await processBuffer(content, [resizeOperationOpts], extension, quality);
	return buf;
}

export async function getImageSize(
	buffer: Buffer,
	// Should match VALID_BLUR_EXT
	extension: 'avif' | 'webp' | 'png' | 'jpeg'
): Promise<{
	width?: number;
	height?: number;
}> {
	// TODO: upgrade "image-size" package to support AVIF
	// See https://github.com/image-size/image-size/issues/348
	if (extension === 'avif') {
		const { width, height } = await decodeBuffer(buffer);
		return { width, height };
	}

	const { width, height } = imageSizeOf(buffer);
	return { width, height };
}
