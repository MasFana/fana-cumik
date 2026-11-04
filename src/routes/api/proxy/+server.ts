/**
 * Image Proxy Route
 *
 * Bypasses hotlink protection by fetching images server-side
 * with spoofed Referer headers. Critical for displaying manga
 * images from protected sources.
 *
 * Usage: /api/proxy?url=<encoded-image-url>&source=<source-id>
 */

import type { RequestHandler } from './$types';

// Standard User-Agent to avoid bot detection
const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Hosts this proxy may fetch from. Exists so the endpoint cannot be used as an
// open relay for arbitrary web content. Derived from live source adapters.
const ALLOWED_HOSTS = [
	'asurascans.com', // asura covers
	'komiku.org', // komiku thumbnails + chapter pages
	'komiku.to', // komiku thumbnails
	'mangadex.org', // mangadex uploads
	'mangadex.network', // mangadex at-home nodes
	'vortexscans.org', // vortex chapter pages
	'wp.com', // vortex covers via i0/i1/i2.wp.com
	'omegascans.org', // omega covers + chapter pages
	'compsci88.com', // weebcentral covers
	'lastation.us' // weebcentral chapter pages
];

/** Host is allowed if it equals an entry or is a subdomain of one. */
function isHostAllowed(host: string): boolean {
	return ALLOWED_HOSTS.some((h) => host === h || host.endsWith('.' + h));
}

export const GET: RequestHandler = async ({ url }) => {
	const targetUrl = url.searchParams.get('url');
	const sourceId = url.searchParams.get('source');

	if (!targetUrl) {
		return new Response('Missing URL parameter', { status: 400 });
	}

	try {
		// Decode the URL if it's encoded
		const decodedUrl = decodeURIComponent(targetUrl);

		// Reject unparseable URLs and hosts outside the allowlist before fetching
		let parsedUrl: URL;
		try {
			parsedUrl = new URL(decodedUrl);
		} catch {
			return new Response('Invalid URL', { status: 400 });
		}
		if (!isHostAllowed(parsedUrl.hostname)) {
			return new Response('Host not allowed', { status: 403 });
		}

		// Determine referer and user-agent based on source or target URL
		let referer = parsedUrl.origin;
		let userAgent = USER_AGENT;

		const isMangadex =
			sourceId === 'mangadex' ||
			decodedUrl.includes('mangadex.org') ||
			decodedUrl.includes('mangadex.network');
		const isKomiku =
			sourceId === 'komiku' ||
			decodedUrl.includes('komiku.org') ||
			decodedUrl.includes('komiku.to') ||
			decodedUrl.includes('komikid.org');
		const isAsura =
			sourceId === 'asura' ||
			decodedUrl.includes('asurascans.com') ||
			decodedUrl.includes('asuracomic.net');

		if (isMangadex) {
			userAgent = 'fana-cumik/1.0';
			referer = 'https://mangadex.org';
		} else if (isKomiku) {
			referer = 'https://komiku.org/';
		} else if (isAsura) {
			referer = 'https://asurascans.com';
		}

		// Fetch the image from the original source
		let imageResponse = await fetch(decodedUrl, {
			headers: {
				'User-Agent': userAgent,
				Referer: referer,
				Accept: 'image/webp,image/apng,image/*,*/*;q=0.8'
			}
		});

		// Fallback for MangaDex Network node failure (e.g. 404, 500, network error)
		if (!imageResponse.ok && isMangadex && decodedUrl.includes('.mangadex.network/')) {
			const fallbackUrl = decodedUrl.replace(
				/^https:\/\/[^/]+\.mangadex\.network\//,
				'https://uploads.mangadex.org/'
			);
			try {
				const fbResponse = await fetch(fallbackUrl, {
					headers: {
						'User-Agent': userAgent,
						Referer: referer,
						Accept: 'image/webp,image/apng,image/*,*/*;q=0.8'
					}
				});
				if (fbResponse.ok) {
					imageResponse = fbResponse;
				}
			} catch {
				// Keep original response on fallback error
			}
		}

		if (!imageResponse.ok) {
			return new Response(`Failed to fetch image: ${imageResponse.status}`, {
				status: imageResponse.status
			});
		}

		// Get content type, default to JPEG if not provided, but reject
		// anything the origin explicitly labels as non-image.
		const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
		if (!contentType.startsWith('image/')) {
			return new Response('Not an image', { status: 415 });
		}

		// Return the image with aggressive caching (1 year, immutable)
		return new Response(imageResponse.body, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=31536000, immutable',
				'Access-Control-Allow-Origin': '*'
			}
		});
	} catch (error) {
		console.error('Proxy error:', error);
		return new Response('Failed to proxy image', { status: 500 });
	}
};
