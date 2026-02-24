/**
 * Build source URLs for CF Images upload (url= parameter).
 * CF Images fetches from these URLs; Basic Auth is supported in the URL.
 */
import {
	isPhotoPrismRef,
	fromPhotoPrismRef,
	getPhotoPrismThumbnailUrl,
	fetchPhotoPrismPhotos,
} from "./photoprism.server";

export interface SourceUrlEnv {
	PHOTOPRISM_BASE_URL?: string;
	WEBDAV_BASE_URL?: string;
	WEBDAV_USERNAME?: string;
	WEBDAV_PASSWORD?: string;
}

function authUrl(base: string, username: string, password: string): string {
	const u = encodeURIComponent(username);
	const p = encodeURIComponent(password);
	const url = new URL(base);
	url.username = u;
	url.password = p;
	return url.toString();
}

/**
 * Get a fetchable URL for the image (fit_1920 for PhotoPrism, full for WebDAV).
 * Used when uploading to CF Images.
 */
export async function getSourceUrlForCfUpload(
	imageId: string,
	env: SourceUrlEnv,
): Promise<string | null> {
	const { PHOTOPRISM_BASE_URL, WEBDAV_BASE_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD } = env;
	if (!WEBDAV_USERNAME || !WEBDAV_PASSWORD) return null;

	if (isPhotoPrismRef(imageId)) {
		const hash = fromPhotoPrismRef(imageId);
		if (!hash || !PHOTOPRISM_BASE_URL) return null;
		const { previewToken } = await fetchPhotoPrismPhotos(
			PHOTOPRISM_BASE_URL,
			WEBDAV_USERNAME,
			WEBDAV_PASSWORD,
			{ count: 1 },
		);
		const path = getPhotoPrismThumbnailUrl(
			PHOTOPRISM_BASE_URL,
			hash,
			previewToken,
			"fit_1920",
		);
		return authUrl(path, WEBDAV_USERNAME, WEBDAV_PASSWORD);
	}

	if (!WEBDAV_BASE_URL) return null;
	const fullUrl = `${WEBDAV_BASE_URL.replace(/\/$/, "")}/${imageId}`;
	return authUrl(fullUrl, WEBDAV_USERNAME, WEBDAV_PASSWORD);
}
