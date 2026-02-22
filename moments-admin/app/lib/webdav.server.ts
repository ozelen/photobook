export async function uploadToWebDAV(
	baseUrl: string,
	username: string,
	password: string,
	path: string,
	content: ArrayBuffer | Blob,
	contentType: string,
): Promise<void> {
	const url = `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
	const auth = btoa(`${username}:${password}`);

	const res = await fetch(url, {
		method: "PUT",
		headers: {
			Authorization: `Basic ${auth}`,
			"Content-Type": contentType,
		},
		body: content,
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`WebDAV upload failed: ${res.status} ${text}`);
	}
}

export async function fetchFromWebDAV(
	baseUrl: string,
	username: string,
	password: string,
	path: string,
): Promise<Response> {
	const url = `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
	const auth = btoa(`${username}:${password}`);

	const res = await fetch(url, {
		method: "GET",
		headers: {
			Authorization: `Basic ${auth}`,
		},
	});

	if (!res.ok) {
		throw new Error(`WebDAV fetch failed: ${res.status}`);
	}

	return res;
}
