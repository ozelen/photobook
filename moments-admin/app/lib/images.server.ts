const IMAGES_API = "https://api.cloudflare.com/client/v4/accounts";

export interface DirectUploadResult {
	uploadURL: string;
	imageId: string;
}

export async function createDirectUploadUrl(
	accountId: string,
	apiToken: string,
): Promise<DirectUploadResult> {
	const res = await fetch(
		`${IMAGES_API}/${accountId}/images/v2/direct_upload`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiToken}`,
			},
		},
	);
	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Cloudflare Images API error: ${res.status} ${err}`);
	}
	const json = (await res.json()) as {
		success: boolean;
		result?: { id: string; uploadURL: string };
		errors?: unknown[];
	};
	if (!json.success || !json.result) {
		throw new Error(
			`Cloudflare Images API error: ${JSON.stringify(json.errors ?? json)}`,
		);
	}
	return {
		uploadURL: json.result.uploadURL,
		imageId: json.result.id,
	};
}

export function getImageUrl(
	deliveryHash: string,
	imageId: string,
	variant: "thumb" | "grid" | "hero",
): string {
	return `https://imagedelivery.net/${deliveryHash}/${imageId}/${variant}`;
}
