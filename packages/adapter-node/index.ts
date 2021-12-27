import zlib from 'zlib';
import glob from 'tiny-glob';
import esbuild from 'esbuild';

import { promisify } from 'util';
import { pipeline } from 'stream';
import { join, resolve } from 'path';
import { fileURLToPath, URL } from 'url';
import { createReadStream, createWriteStream, existsSync, readFileSync, statSync, writeFileSync } from 'fs';

import { imageConfigDefault } from '../../config/defaults';

import type { Adapter, Config } from '@sveltejs/kit';
import type { BuildOptions } from 'esbuild';
import type { ImageConfig, ImageConfigComplete } from 'types';

interface Env {
	path?: string;
	host?: string;
	port?: string;
}

interface NodeAdapterConfig {
	entryPoint?: string;
	out?: string;
	precompress?: boolean;
	env?: Env;
	esbuild?: (conf: BuildOptions) => Promise<BuildOptions>;
}

interface NodeImageConfig extends Omit<Config, 'adapter'> {
	image?: ImageConfig;
	adapterConfig?: NodeAdapterConfig;
}

export default function withAdapter(config: NodeImageConfig) {
	const kit = (config.kit = config.kit || {});
	const viteConf = (typeof config.kit?.vite === 'function' ? config.kit.vite() : config.kit?.vite) || {};

	viteConf.server = viteConf.server || {};

	const imageConfig: ImageConfigComplete = {
		loader: config.image?.loader || 'node',
		path: config.image?.path || '/_kit/image',
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
				'^/_kit/.*': {
					target: 'http://localhost:3001',
				},
				...viteConf.server?.proxy,
			},
		},
		define: {
			__KIT_IMAGE_OPTS: imageConfig,
			...(viteConf.define || {}),
		},
	});

	kit.adapter = adapter({
		...(config.adapterConfig || {}),
		image: imageConfig,
	});

	console.debug(config);

	return config;
}

const pipe = promisify(pipeline);

function adapter({
	entryPoint = '.svelte-kit/node/index.js',
	out = 'build',
	precompress,
	env: { path: path_env = 'SOCKET_PATH', host: host_env = 'HOST', port: port_env = 'PORT' } = {},
	esbuild: esbuild_config,
	image,
}: NodeAdapterConfig & { image: ImageConfigComplete }): Adapter {
	return {
		name: '@sveltejs/adapter-node-kit-image',

		async adapt({ utils, config }) {
			utils.rimraf(out);

			utils.log.minor('Copying assets');
			const static_directory = join(out, 'assets');
			utils.copy_client_files(static_directory);
			utils.copy_static_files(static_directory);

			if (precompress) {
				utils.log.minor('Compressing assets');
				await compress(static_directory);
			}

			utils.log.minor('Building SvelteKit middleware');
			const files = fileURLToPath(new URL('./files', import.meta.url));
			utils.copy(files, '.svelte-kit/node');
			writeFileSync(
				'.svelte-kit/node/env.js',
				`export const path = process.env[${JSON.stringify(
					path_env
				)}] || false;\nexport const host = process.env[${JSON.stringify(
					host_env
				)}] || '0.0.0.0';\nexport const port = process.env[${JSON.stringify(port_env)}] || (!path && 3000);`
			);

			const defaultOptions: BuildOptions = {
				entryPoints: ['.svelte-kit/node/middlewares.js'],
				outfile: join(out, 'middlewares.js'),
				bundle: true,
				external: Object.keys(JSON.parse(readFileSync('package.json', 'utf8')).dependencies || {}),
				format: 'esm',
				platform: 'node',
				target: 'node14',
				inject: [join(files, 'shims.js')],
				define: {
					APP_DIR: `"/${config.kit.appDir}/"`,
				},
			};

			const build_options = esbuild_config ? await esbuild_config(defaultOptions) : defaultOptions;
			await esbuild.build(build_options);

			utils.log.minor('Building SvelteKit server');

			const default_options_ref_server: BuildOptions = {
				entryPoints: [entryPoint],
				outfile: join(out, 'index.js'),
				bundle: true,
				format: 'esm',
				platform: 'node',
				target: 'node14',
				define: {
					__KIT_IMAGE_OPTS: JSON.stringify(image),
				},
				// external exclude workaround, see https://github.com/evanw/esbuild/issues/514
				plugins: [
					{
						name: 'fix-middlewares-exclude',
						setup(build) {
							// Match an import of "middlewares.js" and mark it as external
							const internal_middlewares_path = resolve('.svelte-kit/node/middlewares.js');
							const build_middlewares_path = resolve(out, 'middlewares.js');
							build.onResolve({ filter: /\/middlewares\.js$/ }, ({ path, resolveDir }) => {
								const resolved = resolve(resolveDir, path);
								if (resolved === internal_middlewares_path || resolved === build_middlewares_path) {
									return {
										path: './middlewares.js',
										external: true,
									};
								}
							});
						},
					},
				],
			};

			const build_options_ref_server = esbuild_config
				? await esbuild_config(default_options_ref_server)
				: default_options_ref_server;
			await esbuild.build(build_options_ref_server);

			utils.log.minor('Prerendering static pages');
			await utils.prerender({
				dest: `${out}/prerendered`,
			});

			if (precompress && existsSync(`${out}/prerendered`)) {
				utils.log.minor('Compressing prerendered pages');
				await compress(`${out}/prerendered`);
			}
		},
	};
}

async function compress(directory: string) {
	const files = await glob('**/*.{html,js,json,css,svg,xml}', {
		cwd: directory,
		dot: true,
		absolute: true,
		filesOnly: true,
	});

	await Promise.all(files.map(file => Promise.all([compress_file(file, 'gz'), compress_file(file, 'br')])));
}

async function compress_file(file: string, format: 'gz' | 'br' = 'gz') {
	const compress =
		format === 'br'
			? zlib.createBrotliCompress({
					params: {
						[zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
						[zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
						[zlib.constants.BROTLI_PARAM_SIZE_HINT]: statSync(file).size,
					},
			  })
			: zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION });

	const source = createReadStream(file);
	const destination = createWriteStream(`${file}.${format}`);

	await pipe(source, compress, destination);
}
