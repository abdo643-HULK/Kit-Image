import * as path from 'path';
// import adapter from '@sveltejs/adapter-auto';
import preprocess from 'svelte-preprocess';
import adapter from './adapter/dist/index.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: preprocess(),

	kit: {
		adapter: adapter(),

		// hydrate the <div id="svelte"> element in src/app.html
		target: '#svelte',
		vite: () => ({
			resolve: {
				alias: {
					$dist: path.resolve('./src/lib/dist')
				}
			}
		})
	}
};

export default config;
