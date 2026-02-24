/**
 * Extract EXIF metadata from image bytes for storage in items.meta.
 */
import exifr from "exifr";

export interface ExifMeta {
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
}

export async function extractExif(buffer: ArrayBuffer): Promise<ExifMeta | null> {
	try {
		const exif = await exifr.parse(buffer, {
			 pick: [
				"Make",
				"Model",
				"LensModel",
				"ISO",
				"FocalLength",
				"FNumber",
				"ExposureTime",
				"DateTimeOriginal",
				"ImageWidth",
				"ImageHeight",
				"latitude",
				"longitude",
			],
		});
		if (!exif || typeof exif !== "object") return null;

		const meta: ExifMeta = {};
		if (exif.Make) meta.cameraMake = String(exif.Make);
		if (exif.Model) meta.cameraModel = String(exif.Model);
		if (exif.LensModel) meta.lensModel = String(exif.LensModel);
		if (typeof exif.ISO === "number") meta.iso = exif.ISO;
		if (typeof exif.FocalLength === "number") meta.focalLength = exif.FocalLength;
		if (typeof exif.FNumber === "number") meta.fNumber = exif.FNumber;
		if (typeof exif.ExposureTime === "number") {
			meta.exposure = formatExposure(exif.ExposureTime);
		}
		if (exif.DateTimeOriginal) {
			meta.takenAt = new Date(exif.DateTimeOriginal).toISOString();
		}
		if (typeof exif.ImageWidth === "number") meta.width = exif.ImageWidth;
		if (typeof exif.ImageHeight === "number") meta.height = exif.ImageHeight;
		if (typeof exif.latitude === "number") meta.lat = exif.latitude;
		if (typeof exif.longitude === "number") meta.lng = exif.longitude;

		return Object.keys(meta).length > 0 ? meta : null;
	} catch {
		return null;
	}
}

function formatExposure(seconds: number): string {
	if (seconds >= 1) return `${seconds}s`;
	const frac = 1 / seconds;
	if (frac === Math.round(frac)) return `1/${frac}`;
	return `${seconds}s`;
}
