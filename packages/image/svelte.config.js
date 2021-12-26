//@ts-check
import * as path from 'path';
import preprocess from 'svelte-preprocess';
import adapter from '@kit-image/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: preprocess(),
	image: {
		minimumCacheTTL: 8000,
	},
	kit: {
		target: '#svelte',
		vite: () => ({
			resolve: {
				alias: {
					$dist: path.resolve('./src/lib/dist'),
				},
			},
		}),
	},
};

/**
 *
 * @param {import('@sveltejs/kit').Config} config
 * @returns {import('@sveltejs/kit').Config}
 */
function withImage(config) {
	const viteConf = typeof config.kit.vite === 'function' ? config.kit.vite() : config.kit.vite;

	viteConf.server = viteConf.server || {};

	config.kit.vite = () => ({
		server: {
			...viteConf.server,
			port: viteConf.server.port || 3001,
			proxy: {
				'^/_kit/.*': {
					target: 'http://localhost:3000',
				},
				...viteConf.server.proxy,
			},
		},
		define: {
			__KIT_IMAGE_OPTS: config.image,
			...(viteConf.define || {}),
		},
	});

	config.kit.adapter = adapter({
		imageConfig: config.image,
	});

	return config;
}

export default withImage(config);
