import * as path from 'path';
import preprocess from 'svelte-preprocess';
import adapter from '@kit-image/adapter-node';
// import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: preprocess(),

	kit: {
		adapter: adapter({
			imageConfig: {
				minimumCacheTTL: 8000
			}
		}),

		// hydrate the <div id="svelte"> element in src/app.html
		target: '#svelte',
		vite: () => ({
			resolve: {
				alias: {
					$dist: path.resolve('./src/lib/dist')
				}
			},
			server: {
				port: 3001,
				proxy: {
					'^/_kit/image.*': 'http://localhost:3000/_kit/image'
				}
			}
		})
	}
};

export default config;
