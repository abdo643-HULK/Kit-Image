// eslint-disable-file @typescript-eslint/no-var-requires
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
// import typescript from '@rollup/plugin-typescript';
import typescript from 'rollup-plugin-typescript2';
import alias from '@rollup/plugin-alias';

import { nodeResolve } from '@rollup/plugin-node-resolve';

export default [
	{
		input: 'index.ts',
		output: {
			dir: 'build',
			format: 'esm',
			sourcemap: true,
		},
		plugins: [
			commonjs(),
			typescript(),
			json(),
			alias({
				entries: [{ find: '$dist', replacement: './src/dist' }],
			}),
		],
		// external: [
		// 	// eslint-disable-next-line @typescript-eslint/no-var-requires
		// 	...require('module').builtinModules
		// ]
	},
	{
		input: 'src/index.ts',
		output: {
			file: 'build/files/index.js',
			format: 'esm',
			sourcemap: true,
		},
		plugins: [
			nodeResolve(),
			commonjs(),
			typescript(),
			json(),
			alias({
				entries: [
					{ find: '$dist', replacement: './src/dist' },
					{ find: 'types', replacement: '../types.d.ts' },
				],
			}),
		],
		external: [
			'mime',
			...require('module').builtinModules,
			'./env.js',
			'./middlewares.js',
			'../output/server/app.js',
		],
	},
	{
		input: 'src/middlewares.ts',
		output: {
			file: 'build/files/middlewares.js',
			format: 'esm',
			sourcemap: true,
		},
		plugins: [
			nodeResolve(),
			commonjs(),
			typescript(),
			json(),
			alias({
				entries: [
					{ find: '$dist', replacement: './src/dist' },
					{ find: 'types', replacement: '../types.d.ts' },
				],
			}),
		],
		external: [
			'../output/server/app.js',
			...require('module').builtinModules,
		],
	},
	{
		input: 'src/shims.ts',
		output: {
			file: 'build/files/shims.js',
			format: 'esm',
			sourcemap: true,
		},
		plugins: [typescript()],
		external: ['module'],
	},
];
