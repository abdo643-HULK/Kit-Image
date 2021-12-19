import polka from 'polka';
// @ts-ignore
import { path, host, port } from './env.js';
import {
	assetsMiddleware,
	kitMiddleware,
	prerenderedMiddleware,
} from './middlewares.js';

// const server = polka().use(
// 	// https://github.com/lukeed/polka/issues/173
// 	// @ts-ignore - nothing we can do about so just ignore it
// 	assetsMiddleware,
// 	kitMiddleware,
// 	prerenderedMiddleware
// );
const server = polka();

server.get('/_kit-image', (req, res) => {
	console.log(req.query);
	res.end('This is not Svelte!');
});

server.all('*', assetsMiddleware, prerenderedMiddleware, kitMiddleware);

const listenOpts = { path, host, port };

server.listen(listenOpts, () => {
	console.log(`Listening on ${path ? path : host + ':' + port}`);
});

export { server };
