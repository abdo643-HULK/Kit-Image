import { getRawBody } from '@sveltejs/kit/node';

// TODO hardcoding the relative location makes this brittle
//@ts-ignore
import { init, render } from '../output/server/app.js';

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface HttpError {
	status: number;
	reason: string;
}

init();

export default async (req: VercelRequest, res: VercelResponse) => {
	const { pathname, searchParams } = new URL(req.url || '', 'http://localhost');

	let body;

	try {
		body = await getRawBody(req);
	} catch (err) {
		res.statusCode = (err as HttpError).status || 400;
		return res.end((err as HttpError).reason || 'Invalid request body');
	}

	const rendered = await render({
		method: req.method,
		headers: req.headers,
		path: pathname,
		query: searchParams,
		rawBody: body,
	});

	if (rendered) {
		const { status, headers, body } = rendered;
		return res.writeHead(status, headers).end(body);
	}

	return res.writeHead(404).end();
};
