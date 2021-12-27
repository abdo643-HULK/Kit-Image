declare const __KIT_IMAGE_OPTS: ImageConfigComplete;

import polka from 'polka';
import compression from 'compression';

// @ts-ignore
import { prerenderedMiddleware, assetsMiddleware, kitMiddleware } from '@sveltejs/adapter-node/files/middlewares';

// @ts-ignore
import { path, host, port } from './env.js';
import { imageOptimizer } from './optimizer';
// import { assetsMiddleware, kitMiddleware, prerenderedMiddleware } from './middlewares.js';

import type { Middleware } from 'polka';
import type { ImageConfigComplete } from 'types';

const server = polka();
server.use(compression({ threshold: 0 }) as unknown as Middleware);

const imgConfig = __KIT_IMAGE_OPTS;

server.get('/_kit/image', async (req, res) => {
	await imageOptimizer(req, res, imgConfig, assetsMiddleware);
});

server.all('*', assetsMiddleware, prerenderedMiddleware, kitMiddleware);

const listenOpts = { path, host, port };

server.listen(listenOpts, () => {
	console.log(`Listening on ${path ? path : host + ':' + port}`);
});

export { server };
