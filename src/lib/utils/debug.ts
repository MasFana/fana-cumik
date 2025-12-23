/**
 * Debug Utilities
 *
 * Environment-aware logging that is silent in production.
 * Use these instead of console.log for debugging.
 */

// Safe check for dev environment
const isDev = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.DEV : process.env.NODE_ENV !== 'production';

export const debug = {
	log: (...args: unknown[]) => {
		if (isDev) console.log('[FanaCumik]', ...args);
	},

	warn: (...args: unknown[]) => {
		if (isDev) console.warn('[FanaCumik]', ...args);
	},

	error: (...args: unknown[]) => {
		if (isDev) console.error('[FanaCumik]', ...args);
	},

	info: (...args: unknown[]) => {
		if (isDev) console.info('[FanaCumik]', ...args);
	},

	table: (data: unknown) => {
		if (isDev) console.table(data);
	}
};

export default debug;
