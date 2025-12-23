/**
 * History Page - Server Load
 */

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// History is loaded client-side from localStorage
	return {};
};
