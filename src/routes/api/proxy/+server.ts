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

export const GET: RequestHandler = async ({ url }) => {
	const targetUrl = url.searchParams.get('url');
	const sourceId = url.searchParams.get('source');

	if (!targetUrl) {
		return new Response('Missing URL parameter', { status: 400 });
	}

	try {
		// Decode the URL if it's encoded
		const decodedUrl = decodeURIComponent(targetUrl);

		// Determine referer based on source or target URL
		let referer = new URL(decodedUrl).origin;
		if (sourceId) {
			// Map source IDs to their base URLs for proper referer
			const sourceReferers: Record<string, string> = {
				mangalife: 'https://manga4life.com',
				asura: 'https://asuracomic.net',
				mangabat: 'https://mangabat.com'
				// Add more as needed
			};
			referer = sourceReferers[sourceId] || referer;
		}

		// Fetch the image from the original source
		const imageResponse = await fetch(decodedUrl, {
			headers: {
				'User-Agent': USER_AGENT,
				Referer: referer,
				Accept: 'image/webp,image/apng,image/*,*/*;q=0.8'
			}
		});

		if (!imageResponse.ok) {
			return new Response(`Failed to fetch image: ${imageResponse.status}`, {
				status: imageResponse.status
			});
		}

		// Get content type, default to JPEG if not provided
		const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

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
