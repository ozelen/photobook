/**
 * Cloudflare Images API - upload from URL.
 * Used by the queue consumer to copy selected originals from NAS to CF Images.
 */

export interface CfImagesEnv {
	CF_IMAGES_ACCOUNT_ID?: string;
	CF_IMAGES_API_TOKEN?: string;
	CF_IMAGES_DELIVERY_HASH?: string;
}

export function isCfImagesConfigured(env: CfImagesEnv): boolean {
	return !!(
		env.CF_IMAGES_ACCOUNT_ID &&
		env.CF_IMAGES_API_TOKEN &&
		env.CF_IMAGES_DELIVERY_HASH
	);
}

export function isCfImageRef(imageId: string): boolean {
	return imageId.startsWith("cf:");
}

export function toCfImageRef(cfImageId: string): string {
	return `cf:${cfImageId}`;
}

export function fromCfImageRef(imageId: string): string | null {
	if (!imageId.startsWith("cf:")) return null;
	return imageId.slice(3);
}

/**
 * Upload an image to Cloudflare Images by URL.
 * CF Images fetches from the URL; supports Basic Auth in URL.
 */
export async function uploadFromUrl(
	accountId: string,
	apiToken: string,
	imageUrl: string,
): Promise<string> {
	const res = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiToken}`,
			},
			body: (() => {
				const fd = new FormData();
				fd.set("url", imageUrl);
				return fd;
			})(),
		},
	);
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`CF Images upload failed: ${res.status} ${text}`);
	}
	const json = (await res.json()) as { result?: { id?: string }; success?: boolean };
	if (!json.success || !json.result?.id) {
		throw new Error("CF Images upload: no id in response");
	}
	return json.result.id;
}
