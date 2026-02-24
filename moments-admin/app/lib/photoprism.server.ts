const PHOTOPRISM_PREFIX = "photoprism:";

export function isPhotoPrismRef(imageId: string): boolean {
	return imageId.startsWith(PHOTOPRISM_PREFIX);
}

export function toPhotoPrismRef(hash: string): string {
	return `${PHOTOPRISM_PREFIX}${hash}`;
}

export function fromPhotoPrismRef(imageId: string): string | null {
	if (!imageId.startsWith(PHOTOPRISM_PREFIX)) return null;
	return imageId.slice(PHOTOPRISM_PREFIX.length);
}

export interface PhotoPrismAlbum {
	uid: string;
	title: string;
	description: string;
	photo_count: number;
	created_at: string;
	updated_at: string;
}

export interface PhotoPrismPhoto {
	uid: string;
	hash: string;
	title: string;
	taken_at: string;
	width: number;
	height: number;
	exif?: {
		cameraMake?: string;
		cameraModel?: string;
		lensModel?: string;
		iso?: number;
		focalLength?: number;
		fNumber?: number;
		exposure?: string;
		takenAt?: string;
		width?: number;
		height?: number;
		lat?: number;
		lng?: number;
	};
}

async function getSession(
	baseUrl: string,
	username: string,
	password: string,
): Promise<string> {
	const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/session`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, password }),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`PhotoPrism login failed: ${res.status} ${text}`);
	}
	const json = (await res.json()) as { id?: string };
	if (!json.id) throw new Error("PhotoPrism session missing id");
	return json.id;
}

async function apiGet(
	baseUrl: string,
	sessionId: string,
	path: string,
): Promise<{ data: unknown; previewToken: string; xCount: number }> {
	const url = `${baseUrl.replace(/\/$/, "")}${path}`;
	const res = await fetch(url, {
		headers: {
			Accept: "application/json",
			"X-Session-ID": sessionId,
		},
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`PhotoPrism API error: ${res.status} ${text}`);
	}
	const previewToken = res.headers.get("X-Preview-Token") || "public";
	const xCount = parseInt(res.headers.get("X-Count") ?? "0", 10);
	const data = (await res.json()) as unknown;
	return { data, previewToken, xCount };
}

export async function fetchPhotoPrismAlbums(
	baseUrl: string,
	username: string,
	password: string,
	offset = 0,
	count = 100,
): Promise<{ albums: PhotoPrismAlbum[]; total: number }> {
	const sessionId = await getSession(baseUrl, username, password);
	const { data } = await apiGet(
		baseUrl,
		sessionId,
		`/api/v1/albums?count=${count}&offset=${offset}&type=album&order=favorites`,
	);
	const raw = Array.isArray(data) ? data : (data as { albums?: unknown[] }).albums ?? [];
	const arr = Array.isArray(raw) ? raw : [];
	const albums = (arr as Record<string, unknown>[]).map((a) => ({
		uid: (a.UID ?? a.uid) as string,
		title: ((a.Title ?? a.title) as string) || "",
		description: ((a.Description ?? a.description) as string) || "",
		photo_count: ((a.PhotoCount ?? a.photo_count) as number) ?? 0,
		created_at: ((a.CreatedAt ?? a.created_at) as string) || "",
		updated_at: ((a.UpdatedAt ?? a.updated_at) as string) || "",
	}));
	return { albums, total: albums.length };
}

export async function fetchPhotoPrismPhotos(
	baseUrl: string,
	username: string,
	password: string,
	options: { albumUid?: string; offset?: number; count?: number } = {},
): Promise<{ photos: PhotoPrismPhoto[]; previewToken: string; hasMore: boolean }> {
	const { albumUid, offset = 0, count = 120 } = options;
	const sessionId = await getSession(baseUrl, username, password);
	let path = `/api/v1/photos?count=${count}&offset=${offset}&merged=true&order=oldest`;
	if (albumUid) path += `&s=${albumUid}`;
	const { data, previewToken, xCount } = await apiGet(baseUrl, sessionId, path);
	const arr = Array.isArray(data) ? data : [];
	const hasMore = arr.length >= count;
	const photos = (arr as Record<string, unknown>[]).map((p) => {
		const files = (p.Files as Record<string, unknown>[] | undefined) ?? [];
		const primary = files.find((f) => f.Primary) ?? files[0];
		const hash = (primary?.Hash ?? p.Hash ?? "") as string;
		const exif: PhotoPrismPhoto["exif"] = {};
		if (p.CameraMake) exif.cameraMake = String(p.CameraMake);
		if (p.CameraModel) exif.cameraModel = String(p.CameraModel);
		if (p.LensModel) exif.lensModel = String(p.LensModel);
		if (typeof p.Iso === "number") exif.iso = p.Iso;
		if (typeof p.FocalLength === "number") exif.focalLength = p.FocalLength;
		if (typeof p.FNumber === "number") exif.fNumber = p.FNumber;
		if (p.Exposure) exif.exposure = String(p.Exposure);
		if (p.TakenAt) exif.takenAt = String(p.TakenAt);
		if (typeof p.Width === "number") exif.width = p.Width;
		if (typeof p.Height === "number") exif.height = p.Height;
		if (typeof p.Lat === "number") exif.lat = p.Lat;
		if (typeof p.Lng === "number") exif.lng = p.Lng;
		return {
			uid: p.UID as string,
			hash,
			title: (p.Title as string) || (p.Name as string) || "",
			taken_at: (p.TakenAt as string) || "",
			width: (p.Width as number) ?? 0,
			height: (p.Height as number) ?? 0,
			exif: Object.keys(exif).length > 0 ? exif : undefined,
		};
	});
	return { photos, previewToken, hasMore };
}

export async function fetchAllPhotoPrismPhotos(
	baseUrl: string,
	username: string,
	password: string,
	albumUid?: string,
): Promise<PhotoPrismPhoto[]> {
	const all: PhotoPrismPhoto[] = [];
	let offset = 0;
	const count = 120;
	let previewToken = "public";
	while (true) {
		const { photos, hasMore } = await fetchPhotoPrismPhotos(baseUrl, username, password, {
			albumUid,
			offset,
			count,
		});
		all.push(...photos);
		if (!hasMore || photos.length < count) break;
		offset += count;
	}
	return all;
}

export function getPhotoPrismThumbnailUrl(
	baseUrl: string,
	hash: string,
	previewToken: string,
	size = "fit_720",
): string {
	return `${baseUrl.replace(/\/$/, "")}/api/v1/t/${hash}/${previewToken}/${size}`;
}
