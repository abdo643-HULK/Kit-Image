// eslint-disable-file @typescript-eslint/no-var-requires
import esbuild from 'rollup-plugin-esbuild';
import copy from 'rollup-plugin-copy';

/**
 * @type {import("rollup").RollupOptions[]}
 */
const config = [
	{
		input: 'index.ts',
		output: {
			dir: 'build',
			format: 'esm',
			sourcemap: true,
		},
		plugins: [
			esbuild({
				target: 'node14',
			}),
			copy({
				targets: [{ src: 'src/routes.json', dest: 'build/files' }],
			}),
		],
		external: [...require('module').builtinModules],
	},
	{
		input: 'src/entry.ts',
		output: {
			file: 'build/files/entry.js',
			format: 'esm',
			sourcemap: true,
		},
		plugins: [
			esbuild({
				target: 'node14',
			}),
		],
		external: ['../output/server/app.js', ...require('module').builtinModules],
	},
	{
		input: 'src/shims.ts',
		output: {
			file: 'build/files/shims.js',
			format: 'esm',
			sourcemap: true,
		},
		plugins: [
			esbuild({
				target: 'node14',
			}),
		],
		external: ['module'],
	},
];

export default config;
