import fs from 'fs';
import sirv from 'sirv';

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import type { Middleware } from 'polka';

//@ts-ignore
import { init, render } from '../output/server/app.js';
import { create_kit_middleware } from './kit-middleware';

// App is a dynamic file built from the application layer.
const __dirname = dirname(fileURLToPath(import.meta.url));
const noop_handler: Middleware = (_req, _res, next) => next();

const paths = {
	assets: join(__dirname, '/assets'),
	prerendered: join(__dirname, '/prerendered'),
};

declare var APP_DIR: string;

export const prerenderedMiddleware = fs.existsSync(paths.prerendered)
	? sirv(paths.prerendered, {
			etag: true,
			maxAge: 0,
			gzip: true,
			brotli: true,
	  })
	: noop_handler;

export const assetsMiddleware = fs.existsSync(paths.assets)
	? sirv(paths.assets, {
			setHeaders: (res, pathname) => {
				if (pathname.startsWith(APP_DIR)) {
					res.setHeader(
						'cache-control',
						'public, max-age=31536000, immutable'
					);
				}
			},
			gzip: true,
			brotli: true,
	  })
	: noop_handler;

export const kitMiddleware = (function () {
	init();
	return create_kit_middleware({ render });
})();
