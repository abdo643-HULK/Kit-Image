import polka from 'polka';
import compression from 'compression';

// @ts-ignore
import { path, host, port } from './env.js';
import { imageOptimizer } from './image-optimizer';
import { assetsMiddleware, kitMiddleware, prerenderedMiddleware } from './middlewares.js';

import type { Middleware } from 'polka';

// const server = polka().use(
// 	compression({ threshold: 0 })
// 	assetsMiddleware,
// 	kitMiddleware,
// 	prerenderedMiddleware
// );

const server = polka();
server.use(compression({ threshold: 0 }) as unknown as Middleware);

server.get('/_kit/image', async (req, res, next) => {
	console.log('image request');
	await imageOptimizer(req, res, undefined, assetsMiddleware, '');
});

server.all('*', assetsMiddleware, prerenderedMiddleware, kitMiddleware);

const listenOpts = { path, host, port };

server.listen(listenOpts, () => {
	console.log(`Listening on ${path ? path : host + ':' + port}`);
});

export { server };
