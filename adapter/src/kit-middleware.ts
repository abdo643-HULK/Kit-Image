import { getRawBody } from '@sveltejs/kit/node';

import type { Middleware } from 'polka';
import type { App, RawBody } from '@sveltejs/kit';

export function create_kit_middleware({
	render,
}: Omit<App, 'init'>): Middleware {
	return async (req, res) => {
		let parsed;
		try {
			parsed = new URL(req.url || '', 'http://localhost');
		} catch (e) {
			res.statusCode = 400;
			return res.end('Invalid URL');
		}

		let body: RawBody;

		try {
			body = await getRawBody(req);
		} catch (err) {
			res.statusCode = err.status || 400;
			return res.end(err.reason || 'Invalid request body');
		}

		const rendered = await render({
			method: req.method,
			//@ts-ignore
			headers: req.headers, // TODO: what about repeated headers, i.e. string[]
			path: parsed.pathname,
			query: parsed.searchParams,
			rawBody: body,
		});

		if (rendered) {
			res.writeHead(rendered.status, rendered.headers);
			if (rendered.body) {
				res.write(rendered.body);
			}
			res.end();
		} else {
			res.statusCode = 404;
			res.end('Not found');
		}
	};
}
