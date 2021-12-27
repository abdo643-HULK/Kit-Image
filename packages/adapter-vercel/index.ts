import esbuild from 'esbuild';

import { join } from 'path';
import { writeFileSync } from 'fs';
import { fileURLToPath, URL } from 'url';

import { imageConfigDefault } from '../../config/defaults';

import type { BuildOptions } from 'esbuild';
import type { Config } from '@sveltejs/kit';
import type { Adapter } from '@sveltejs/kit/types';
import type { ImageConfig, ImageConfigComplete } from 'types';

interface VercelAdapterConfig {
	esbuild?: (conf: BuildOptions) => Promise<BuildOptions>;
}

interface VercelImageConfig extends Omit<Config, 'adapter'> {
	image?: ImageConfig;
	adapterConfig: VercelAdapterConfig;
}

export default function withAdapter(config: VercelImageConfig) {
	const kit = (config.kit = config.kit || {});
	const viteConf = (typeof config.kit?.vite === 'function' ? config.kit.vite() : config.kit?.vite) || {};

	viteConf.server = viteConf.server || {};

	const imageConfig: ImageConfigComplete = {
		loader: config.image?.loader || 'vercel',
		path: config.image?.path || '/_vercel/image',
		domains: config.image?.domains || imageConfigDefault.domains,
		formats: config.image?.formats || imageConfigDefault.formats,
		imageSizes: config.image?.imageSizes ?? imageConfigDefault.imageSizes,
		deviceSizes: config.image?.deviceSizes ?? imageConfigDefault.deviceSizes,
		minimumCacheTTL: config.image?.minimumCacheTTL || imageConfigDefault.minimumCacheTTL,
	};

	kit.vite = () => ({
		...viteConf,
		server: {
			...viteConf.server,
			port: viteConf.server?.port,
			proxy: {
				...viteConf.server?.proxy,
				'^/_kit/.*': {
					target: 'http://localhost:3001',
				},
			},
		},
		define: {
			...(viteConf.define || {}),
			__KIT_IMAGE_OPTS: imageConfig,
		},
	});

	kit.adapter = adapter({
		image: { ...imageConfig },
		esbuild: config.adapterConfig.esbuild,
	});

	console.debug(config);

	return config;
}

function adapter(options: VercelAdapterConfig & { image: ImageConfigComplete }): Adapter {
	return {
		name: '@sveltejs/adapter-vercel-kit-image',

		async adapt({ utils }) {
			const dir = '.vercel_build_output';
			utils.rimraf(dir);

			const files = fileURLToPath(new URL('./files', import.meta.url));

			const dirs = {
				static: join(dir, 'static'),
				lambda: join(dir, 'functions/node/render'),
			};

			// TODO ideally we'd have something like utils.tmpdir('vercel')
			// rather than hardcoding '.svelte-kit/vercel/entry.js', and the
			// relative import from that file to output/server/app.js
			// would be controlled. at the moment we're exposing
			// implementation details that could change
			utils.log.minor('Generating serverless function...');
			utils.copy(join(files, 'entry.js'), '.svelte-kit/vercel/entry.js');

			const default_options: BuildOptions = {
				entryPoints: ['.svelte-kit/vercel/entry.js'],
				outfile: join(dirs.lambda, 'index.js'),
				bundle: true,
				inject: [join(files, 'shims.js')],
				platform: 'node',
			};

			const build_options = options && options.esbuild ? await options.esbuild(default_options) : default_options;

			await esbuild.build(build_options);

			writeFileSync(join(dirs.lambda, 'package.json'), JSON.stringify({ type: 'commonjs' }));

			utils.log.minor('Prerendering static pages...');
			await utils.prerender({
				dest: dirs.static,
			});

			utils.log.minor('Copying assets...');
			utils.copy_static_files(dirs.static);
			utils.copy_client_files(dirs.static);

			utils.log.minor('Writing routes...');
			utils.copy(join(files, 'routes.json'), join(dir, 'config/routes.json'));

			const imageConfig = options.image;
			if (imageConfig.loader !== 'vercel') return;

			utils.log.minor('Writing image config...');
			writeFileSync(
				join(dir, 'config/images.json'),
				`
				{
					"version": 1,
					"images": {
					  "sizes": ${JSON.stringify([...imageConfig.deviceSizes, ...imageConfig.imageSizes])},
					  "domains": ${JSON.stringify(imageConfig.domains)},
					  "formats": ${JSON.stringify(imageConfig.formats)},
					  "minimumCacheTTL": ${imageConfig.minimumCacheTTL}
					}
				}
				`
			);
		},
	};
}
