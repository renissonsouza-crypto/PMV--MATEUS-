import { fileURLToPath } from 'node:url';
// loadEnvFile preserves variables already supplied by the host or secret manager.
try { process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url))); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
