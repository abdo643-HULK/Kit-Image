import * as path from 'path';
import preprocess from 'svelte-preprocess';
import adapter from '@kit-image/adapter-node';
// import adapter from '@sveltejs/adapter-cloudflare-workers';
const imageConfig = {
	minimumCacheTTL: 8000,
};

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: preprocess(),
	kit: {
		adapter: adapter({
			imageConfig,
		}),
		target: '#svelte',
		vite: () => ({
			resolve: {
				alias: {
					$dist: path.resolve('./src/lib/dist'),
				},
			},
			define: {
				__KIT_IMAGE_OPTS: imageConfig,
			},
			server: {
				port: 3001,
				proxy: {
					'^/_kit/.*': {
						target: 'http://localhost:3000',
						rewrite: (path) => {
							console.log(path);
							return path;
						},
					},
				},
			},
		}),
	},
};

export default config;
