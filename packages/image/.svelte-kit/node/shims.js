import { createRequire } from 'module';
export { Headers, Request, Response, fetch } from '@sveltejs/kit/install-fetch';

Object.defineProperty(globalThis, "require", {
  enumerable: true,
  value: createRequire(import.meta.url)
});
//# sourceMappingURL=shims.js.map
