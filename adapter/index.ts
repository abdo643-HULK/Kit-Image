import esbuild from 'esbuild';

import { fileURLToPath } from 'url';
import { join, resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

import type { BuildOptions } from 'esbuild';

export default function ({
	entryPoint = '.svelte-kit/node/index.js',
	out = 'build',
	env: {
		path: path_env = 'SOCKET_PATH',
		host: host_env = 'HOST',
		port: port_env = 'PORT',
	} = {},
	esbuild: esbuild_config,
} = {}) {
	return {
		name: '@sveltejs/adapter-node-kit-image',

		async adapt({ utils, config }) {
			utils.rimraf(out);

			utils.log.minor('Copying assets');
			const static_directory = join(out, 'assets');
			utils.copy_client_files(static_directory);
			utils.copy_static_files(static_directory);

			utils.log.minor('Building SvelteKit middleware');
			const files = fileURLToPath(new URL('./files', import.meta.url));
			utils.copy(files, '.svelte-kit/node');
			writeFileSync(
				'.svelte-kit/node/env.js',
				`export const path = process.env[${JSON.stringify(
					path_env
				)}] || false;\nexport const host = process.env[${JSON.stringify(
					host_env
				)}] || '0.0.0.0';\nexport const port = process.env[${JSON.stringify(
					port_env
				)}] || (!path && 3000);`
			);

			const defaultOptions: BuildOptions = {
				entryPoints: ['.svelte-kit/node/middlewares.js'],
				outfile: join(out, 'middlewares.js'),
				bundle: true,
				external: Object.keys(
					JSON.parse(readFileSync('package.json', 'utf8'))
						.dependencies || {}
				),
				format: 'esm',
				platform: 'node',
				target: 'node14',
				inject: [join(files, 'shims.js')],
				define: {
					APP_DIR: `"/${config.kit.appDir}/"`,
				},
			};
			const build_options = esbuild_config
				? await esbuild_config(defaultOptions)
				: defaultOptions;
			await esbuild.build(build_options);

			utils.log.minor('Building SvelteKit server');

			const default_options_ref_server: BuildOptions = {
				entryPoints: [entryPoint],
				outfile: join(out, 'index.js'),
				bundle: true,
				format: 'esm',
				platform: 'node',
				target: 'node14',
				// external exclude workaround, see https://github.com/evanw/esbuild/issues/514
				plugins: [
					{
						name: 'fix-middlewares-exclude',
						setup(build) {
							// Match an import of "middlewares.js" and mark it as external
							const internal_middlewares_path = resolve(
								'.svelte-kit/node/middlewares.js'
							);
							const build_middlewares_path = resolve(
								out,
								'middlewares.js'
							);
							build.onResolve(
								{ filter: /\/middlewares\.js$/ },
								({ path, resolveDir }) => {
									const resolved = resolve(resolveDir, path);
									if (
										resolved ===
											internal_middlewares_path ||
										resolved === build_middlewares_path
									) {
										return {
											path: './middlewares.js',
											external: true,
										};
									}
								}
							);
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
		},
	};
}
