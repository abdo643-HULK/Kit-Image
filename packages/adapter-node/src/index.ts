declare var __KIT_IMAGE_OPTS: ImageConfig;

import polka from 'polka';
import compression from 'compression';

// @ts-ignore
import { path, host, port } from './env.js';
import { imageOptimizer } from './image-optimizer';
import { imageConfigDefault } from '../../../config/defaults';
import {
	assetsMiddleware,
	kitMiddleware,
	prerenderedMiddleware,
} from './middlewares.js';

import type { Middleware } from 'polka';
import type { ImageConfig } from 'types';

// const server = polka().use(
// 	compression({ threshold: 0 })
// 	assetsMiddleware,
// 	kitMiddleware,
// 	prerenderedMiddleware
// );

const server = polka();
server.use(compression({ threshold: 0 }) as unknown as Middleware);

const imgConfig = { ...imageConfigDefault, ...(__KIT_IMAGE_OPTS || {}) };

server.get('/_kit/image', async (req, res, next) => {
	console.log(imgConfig);
	await imageOptimizer(req, res, imgConfig, assetsMiddleware, '');
});

server.all('*', assetsMiddleware, prerenderedMiddleware, kitMiddleware);

const listenOpts = { path, host, port };

server.listen(listenOpts, () => {
	console.log(`Listening on ${path ? path : host + ':' + port}`);
});

export { server };
