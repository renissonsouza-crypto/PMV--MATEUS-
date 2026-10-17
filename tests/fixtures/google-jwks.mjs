// Loaded explicitly by the disposable browser-test API, never by application entrypoints.
import { readFileSync } from 'node:fs';

if (process.env.NODE_ENV !== 'test' || !process.env.QV_TEST_GOOGLE_JWKS) throw new Error('Google JWKS fixture requires an isolated test process.');
const jwks = JSON.parse(readFileSync(process.env.QV_TEST_GOOGLE_JWKS, 'utf8'));
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.href === 'https://www.googleapis.com/oauth2/v3/certs') return Promise.resolve(Response.json(jwks));
  if (['accounts.google.com', 'oauth2.googleapis.com', 'www.googleapis.com'].includes(url.hostname)) throw new Error('Unexpected live Google request in isolated authentication test.');
  return originalFetch(input, options);
};
