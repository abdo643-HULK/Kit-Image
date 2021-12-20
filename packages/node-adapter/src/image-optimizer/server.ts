import { default as chalk } from 'chalk';
import imageSizeOf from 'image-size';

import { join } from 'path';
import { createHash } from 'crypto';
import { mediaType } from '@hapi/accept';
import { Readable, Writable } from 'stream';
import { parse } from 'url';

import { createReadStream, promises } from 'fs';

import isAnimated from '../is-animated';
import contentDisposition from '../content-disposition';

import { fileExists } from './file-exists';
import { sendEtagResponse } from './send-payload';
import { imageConfigDefault } from '../../../image/src/lib/defaults';
import { getContentType, getExtension } from './helper';
import {
	ANIMATABLE_TYPES,
	AVIF,
	CACHE_VERSION,
	detectContentType,
	inflightRequests,
	JPEG,
	PNG,
	VECTOR_TYPES,
	WEBP,
} from './helper';

import type { Socket } from 'net';
import type { Request } from 'polka';
import type { SharpOptions, Sharp } from 'sharp';
import type { ServerResponse, IncomingHttpHeaders } from 'http';

// import type Server from './base-server';
import type { ImageConfig, ImageExtension } from 'types';

interface MockRequest extends Readable {
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

let sharp: sharpFunction;

try {
	(async () => {
		sharp = await import(
			(import.meta.env.KIT_IMAGE_SHARP_PATH as string) || 'sharp'
		);
	})();
} catch (e) {
	// Sharp not present on the server, Squoosh fallback will be used
}

export async function imageOptimizer(
	// server: Server,
	req: Request,
	res: ServerResponse,
	imageConfig: ImageConfig,
	distDir: string
): Promise<void> {
	const imageData: ImageConfig = imageConfig || imageConfigDefault;
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

	if (!url) {
		res.statusCode = 400;
		res.end('"url" parameter is required');
		return;
	} else if (Array.isArray(url)) {
		res.statusCode = 400;
		res.end('"url" parameter cannot be an array');
		return;
	}

	let href: string;
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

	/**
	 * retrieve hash of the image for the cache
	 */
	const hash = getHash([CACHE_VERSION, href, width, quality, mimeType]);
	const imagesDir = join(distDir, 'cache', 'images');
	const hashDir = join(imagesDir, hash);
	const now = Date.now();

	// If there're concurrent requests hitting the same resource and it's still
	// being optimized, wait before accessing the cache.
	if (inflightRequests.has(hash)) {
		await inflightRequests.get(hash);
	}

	// first version of the request
	let dedupeResolver: (val?: PromiseLike<undefined>) => void;
	inflightRequests.set(
		hash,
		new Promise((resolve) => (dedupeResolver = resolve))
	);

	try {
		// check if the file exists in the cache dir
		if (await fileExists(hashDir, 'directory')) {
			const files = await promises.readdir(hashDir);
			for (const file of files) {
				const [maxAgeStr, expireAtSt, etag, extension] =
					file.split('.');
				const maxAge = Number(maxAgeStr);
				const expireAt = Number(expireAtSt);
				const contentType = getContentType(extension);
				const fsPath = join(hashDir, file);
				// if the saved file hasn't reached the maximum-ttl or maxage
				// respond with it and finish the request
				// by returning, else remove the image and continue
				if (now < expireAt) {
					const result = setResponseHeaders(
						req,
						res,
						url,
						etag,
						maxAge,
						contentType
					);
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
			// get the remote image and set the headers
			const upstreamRes = await fetch(href);

			if (!upstreamRes.ok) {
				res.statusCode = upstreamRes.status;
				res.end(
					'"url" parameter is valid but upstream response is invalid'
				);
				return;
			}

			res.statusCode = upstreamRes.status;
			upstreamBuffer = Buffer.from(await upstreamRes.arrayBuffer());
			upstreamType =
				detectContentType(upstreamBuffer) ||
				upstreamRes.headers.get('Content-Type');
			maxAge = getMaxAge(upstreamRes.headers.get('Cache-Control'));
		} else {
			try {
				const resBuffers: Buffer[] = [];
				const mockRes: any = new Writable();

				const isStreamFinished = new Promise(function (
					resolve,
					reject
				) {
					mockRes.on('finish', () => resolve(true));
					mockRes.on('end', () => resolve(true));
					mockRes.on('error', () => reject());
				});

				mockRes.write = (chunk: Buffer | string) => {
					resBuffers.push(
						Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
					);
				};
				mockRes._write = (chunk: Buffer | string) => {
					mockRes.write(chunk);
				};

				const mockHeaders: Record<string, string | string[]> = {};

				mockRes.writeHead = (_status: any, _headers: any) =>
					Object.assign(mockHeaders, _headers);
				mockRes.getHeader = (name: string) =>
					mockHeaders[name.toLowerCase()];
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

				const mockReq = new Readable() as MockRequest;

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
				upstreamType =
					detectContentType(upstreamBuffer) ||
					mockRes.getHeader('Content-Type');
				maxAge = getMaxAge(mockRes.getHeader('Cache-Control'));
			} catch (err) {
				res.statusCode = 500;
				res.end(
					'"url" parameter is valid but upstream response is invalid'
				);
				return;
			}
		}

		const expireAt = Math.max(maxAge, minimumCacheTTL) * 1000 + now;

		if (upstreamType) {
			const vector = VECTOR_TYPES.includes(upstreamType);
			const animate =
				ANIMATABLE_TYPES.includes(upstreamType) &&
				isAnimated(upstreamBuffer);
			if (vector || animate) {
				await writeToCacheDir(
					hashDir,
					upstreamType,
					maxAge,
					expireAt,
					upstreamBuffer
				);
				sendResponse(
					req,
					res,
					url,
					maxAge,
					upstreamType,
					upstreamBuffer
				);
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
		} else if (
			upstreamType?.startsWith('image/') &&
			getExtension(upstreamType)
		) {
			contentType = upstreamType;
		} else {
			contentType = JPEG;
		}

		try {
			let optimizedBuffer: Buffer | undefined;
			// Begin sharp transformation logic
			const transformer = sharp(upstreamBuffer);

			transformer.rotate();

			const { width: metaWidth } = await transformer.metadata();

			if (metaWidth && metaWidth > width) {
				transformer.resize(width);
			}

			if (contentType === AVIF) {
				if (transformer.avif) {
					const avifQuality = quality - 15;
					transformer.avif({
						quality: Math.max(avifQuality, 0),
						chromaSubsampling: '4:2:0', // same as webp
					});
				} else {
					console.warn(
						chalk.yellow.bold('Warning: ') +
							`Your installed version of the 'sharp' package does not support AVIF images. Run 'yarn add sharp@latest' to upgrade to the latest version.\n` +
							'Read more: https://nextjs.org/docs/messages/sharp-version-avif'
					);
					transformer.webp({ quality });
				}
			} else if (contentType === WEBP) {
				transformer.webp({ quality });
			} else if (contentType === PNG) {
				transformer.png({ quality });
			} else if (contentType === JPEG) {
				transformer.jpeg({ quality });
			}

			optimizedBuffer = await transformer.toBuffer();
			// End sharp transformation logic
			if (optimizedBuffer) {
				await writeToCacheDir(
					hashDir,
					contentType,
					maxAge,
					expireAt,
					optimizedBuffer
				);
				sendResponse(
					req,
					res,
					url,
					maxAge,
					contentType,
					optimizedBuffer
				);
			} else {
				throw new Error('Unable to optimize buffer');
			}
		} catch (error) {
			sendResponse(req, res, url, maxAge, upstreamType, upstreamBuffer);
		}

		return;
	} finally {
		// Make sure to remove the hash in the end.
		dedupeResolver!();
		inflightRequests.delete(hash);
	}
}

async function writeToCacheDir(
	dir: string,
	contentType: string,
	maxAge: number,
	expireAt: number,
	buffer: Buffer
) {
	await promises.mkdir(dir, { recursive: true });

	const extension = getExtension(contentType);
	const etag = getHash([buffer]);
	const filename = join(dir, `${maxAge}.${expireAt}.${etag}.${extension}`);

	await promises.writeFile(filename, buffer);
}

function getFileNameWithExtension(
	url: string,
	contentType: string | null
): string | void {
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
	isDev: boolean = false
) {
	res.setHeader('Vary', 'Accept');
	res.setHeader(
		'Cache-Control',
		`public, max-age=${isDev ? 0 : maxAge}, must-revalidate`
	);

	if (sendEtagResponse(req, res, etag)) {
		// already called res.end() so we're finished
		return { finished: true };
	}

	if (contentType) {
		res.setHeader('Content-Type', contentType);
	}

	const fileName = getFileNameWithExtension(url, contentType);
	if (fileName) {
		res.setHeader(
			'Content-Disposition',
			contentDisposition(fileName, { type: 'inline' })
		);
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
	isDev: boolean = false
) {
	const etag = getHash([buffer]);
	const result = setResponseHeaders(
		req,
		res,
		url,
		etag,
		maxAge,
		contentType,
		isDev
	);
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

const extensions = {
	avif: (transformer: Sharp, quality: number) => {
		if (transformer.avif) return transformer.avif({ quality });

		console.warn(
			chalk.yellow.bold('Warning: ') +
				`Your installed version of the 'sharp' package does not support AVIF images. Run 'yarn add sharp@latest' to upgrade to the latest version.\n` +
				'Read more: https://nextjs.org/docs/messages/sharp-version-avif'
		);
		transformer.webp({ quality });
	},
	webp: (transformer: Sharp, quality: number) =>
		transformer.webp({ quality }),
	jpeg: (transformer: Sharp, quality: number) =>
		transformer.jpeg({ quality }),
	png: (transformer: Sharp, quality: number) => transformer.png({ quality }),
};

export async function resizeImage(
	content: Buffer,
	dimension: 'width' | 'height',
	size: number,
	// Should match VALID_BLUR_EXT
	extension: ImageExtension,
	quality: number
): Promise<Buffer> {
	const transformer = sharp(content);

	extensions[extension](transformer, quality);

	if (dimension === 'width') {
		transformer.resize(size);
	} else {
		transformer.resize(null, size);
	}

	const buf = await transformer.toBuffer();

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
		const transformer = sharp(buffer);
		const { width, height } = await transformer.metadata();
		return { width, height };
	}

	const { width, height } = imageSizeOf(buffer);
	return { width, height };
}
