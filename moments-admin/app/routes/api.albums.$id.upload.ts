import { ulid } from "ulid";
import type { Route } from "./+types/api.albums.$id.upload";
import { getSessionUser } from "../lib/auth.server";
import { getAlbum } from "../lib/albums.server";
import { addItemToAlbum } from "../lib/items.server";
import { uploadToWebDAV } from "../lib/webdav.server";
import { enqueueCfImagesUpload } from "../lib/enqueue-cf-images.server";
import { extractExif } from "../lib/exif.server";

const JPEG_EXTENSIONS = [".jpg", ".jpeg"];
function isJpeg(filename: string): boolean {
	const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
	return JPEG_EXTENSIONS.includes(ext);
}

export async function loader() {
	return new Response(JSON.stringify({ error: "Method not allowed" }), {
		status: 405,
		headers: { "Content-Type": "application/json" },
	});
}

export async function action({ params, request, context }: Route.ActionArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const album = await getAlbum(context.cloudflare.env.DB, params.id, user.id);
	if (!album) {
		return Response.json({ error: "Album not found" }, { status: 404 });
	}

	const cloudflareEnv = context.cloudflare.env as {
		WEBDAV_BASE_URL?: string;
		WEBDAV_USERNAME?: string;
		WEBDAV_PASSWORD?: string;
	};
	const { WEBDAV_BASE_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD } = cloudflareEnv;
	if (!WEBDAV_BASE_URL || !WEBDAV_USERNAME || !WEBDAV_PASSWORD) {
		return Response.json(
			{ error: "WebDAV not configured" },
			{ status: 500 },
		);
	}

	const formData = await request.formData();
	const file = formData.get("file");
	if (!file || !(file instanceof File)) {
		return Response.json({ error: "No file provided" }, { status: 400 });
	}

	if (!isJpeg(file.name)) {
		return Response.json(
			{ error: "Only JPEG images (.jpg, .jpeg) are allowed" },
			{ status: 400 },
		);
	}

	const storagePath = `${params.id}/${ulid()}.jpg`;
	const bytes = await file.arrayBuffer();

	const exif = await extractExif(bytes);
	const meta = exif ? { exif } : undefined;

	try {
		await uploadToWebDAV(
			WEBDAV_BASE_URL,
			WEBDAV_USERNAME,
			WEBDAV_PASSWORD,
			storagePath,
			bytes,
			file.type || "image/jpeg",
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Upload failed";
		return Response.json({ error: message }, { status: 500 });
	}

	const result = await addItemToAlbum(
		context.cloudflare.env.DB,
		params.id,
		user.id,
		storagePath,
		{ meta },
	);
	if (!result) {
		return Response.json({ error: "Failed to save photo" }, { status: 500 });
	}

	context.cloudflare.ctx.waitUntil(
		enqueueCfImagesUpload(
			cloudflareEnv as Parameters<typeof enqueueCfImagesUpload>[0],
			result.id,
			storagePath,
		),
	);

	return Response.json({ id: result.id });
}
