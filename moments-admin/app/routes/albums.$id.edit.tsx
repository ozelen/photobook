import { useRef } from "react";
import { Form, redirect } from "react-router";
import type { Route } from "./+types/albums.$id.edit";
import { getSessionUser } from "../lib/auth.server";
import { getAlbum, updateAlbum, isValidKind } from "../lib/albums.server";
import { getTagsForEntity, setTagsForEntity } from "../lib/tags.server";
import { slugify } from "../lib/slugify";
import { listAlbumItems } from "../lib/items.server";
import {
	Box,
	Button,
	Card,
	CardActionArea,
	CardMedia,
	Grid,
	Stack,
	TextField,
	Typography,
	FormControlLabel,
	Checkbox,
	MenuItem,
} from "@mui/material";

export function meta({ loaderData }: Route.MetaArgs) {
	const album = loaderData?.album;
	return [
		{ title: album ? `Edit ${album.name} — Moments Admin` : "Edit Album — Moments Admin" },
	];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) return redirect("/login");

	const album = await getAlbum(context.cloudflare.env.DB, params.id, user.id);
	if (!album) throw new Response("Not found", { status: 404 });
	const tags = await getTagsForEntity(context.cloudflare.env.DB, "album", params.id);
	const items = await listAlbumItems(context.cloudflare.env.DB, params.id, user.id);
	return { album, tags, items };
}

export async function action({ params, request, context }: Route.ActionArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) return redirect("/login");

	const formData = await request.formData();
	const name = String(formData.get("name") ?? "").trim();
	const slug = String(formData.get("slug") ?? "").trim();
	const kind = String(formData.get("kind") ?? "portfolio");
	const description = String(formData.get("description") ?? "").trim();
	const isPublic = formData.get("isPublic") === "on";
	const tagsRaw = String(formData.get("tags") ?? "").trim();
	const tagNames = tagsRaw
		? tagsRaw.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean)
		: [];

	if (!name) {
		return { error: "Name is required" };
	}
	if (!isValidKind(kind)) {
		return { error: "Invalid album kind" };
	}

	const album = await updateAlbum(context.cloudflare.env.DB, params.id, user.id, {
		name,
		slug: slug || undefined,
		kind: kind as "portfolio" | "client_delivery",
		description: description || undefined,
		isPublic,
	});

	if (album) {
		await setTagsForEntity(context.cloudflare.env.DB, "album", params.id, tagNames);
		return redirect(`/albums/${album.id}`);
	}
	return { error: "Failed to update" };
}

export default function AlbumEdit({ loaderData, actionData }: Route.ComponentProps) {
	const { album, tags, items } = loaderData;
	const slugRef = useRef<HTMLInputElement | null>(null);

	function handleNameInput(e: React.FormEvent<HTMLInputElement>) {
		const name = (e.target as HTMLInputElement).value;
		if (slugRef.current && !slugRef.current.dataset.manual) {
			slugRef.current.value = slugify(name);
		}
	}

	function handleSlugFocus() {
		slugRef.current?.setAttribute("data-manual", "true");
	}

	return (
		<Box>
			<Typography variant="h4" component="h1" gutterBottom>
				Edit album
			</Typography>
			<Grid container spacing={3}>
				<Grid item xs={12} md={5} lg={4}>
					<Form method="post">
						<Stack spacing={2}>
							<TextField
								id="name"
								name="name"
								label="Name"
								defaultValue={album.name}
								required
								fullWidth
								onInput={handleNameInput}
							/>
							<TextField
								id="slug"
								name="slug"
								label="Slug"
								helperText="Auto-generated from name, edit to override."
								defaultValue={album.slug}
								fullWidth
								onFocus={handleSlugFocus}
								inputRef={slugRef}
							/>
							<TextField
								select
								id="kind"
								name="kind"
								label="Kind"
								defaultValue={album.kind}
								fullWidth
							>
								<MenuItem value="portfolio">Portfolio</MenuItem>
								<MenuItem value="client_delivery">Client delivery</MenuItem>
							</TextField>
							<TextField
								id="description"
								name="description"
								label="Description"
								multiline
								minRows={3}
								defaultValue={album.description ?? ""}
								fullWidth
							/>
							<TextField
								id="tags"
								name="tags"
								label="Tags"
								placeholder="portrait, wedding, outdoors"
								defaultValue={tags.map((t) => t.name).join(", ")}
								helperText="Comma-separated. Tags are normalized and shared across albums and photos."
								fullWidth
							/>
							<FormControlLabel
								control={
									<Checkbox
										id="isPublic"
										name="isPublic"
										defaultChecked={album.isPublic === 1}
									/>
								}
								label="Public (visible on portfolio)"
							/>
							{actionData?.error && (
								<Typography variant="body2" color="error">
									{actionData.error}
								</Typography>
							)}
							<Stack direction="row" spacing={2}>
								<Button type="submit" variant="contained" color="primary">
									Save
								</Button>
								<Button
									component="a"
									href={`/albums/${album.id}`}
									variant="text"
									color="inherit"
								>
									Cancel
								</Button>
							</Stack>
						</Stack>
					</Form>
				</Grid>
				<Grid item xs={12} md={7} lg={8}>
					<Typography variant="subtitle1" gutterBottom>
						Photos in this album
					</Typography>
					{items.length === 0 ? (
						<Typography variant="body2" color="text.secondary">
							No photos yet. Add photos on the album page.
						</Typography>
					) : (
						<Box
							sx={{
								display: "grid",
								gridTemplateColumns: {
									xs: "repeat(2, minmax(0, 1fr))",
									sm: "repeat(3, minmax(0, 1fr))",
									md: "repeat(4, minmax(0, 1fr))",
								},
								gap: 2,
							}}
						>
							{items.map((item: { id: string }) => (
								<Card
									key={item.id}
									sx={{
										borderRadius: 1.5,
										overflow: "hidden",
										bgcolor: "background.paper",
										transition: "transform 200ms ease",
										"&:hover": {
											transform: "scale(1.03)",
										},
									}}
								>
									<CardActionArea>
										<CardMedia
											component="img"
											image={`/api/items/${item.id}/image`}
											alt=""
											sx={{
												width: "100%",
												aspectRatio: "1 / 1",
												objectFit: "cover",
											}}
											loading="lazy"
										/>
									</CardActionArea>
								</Card>
							))}
						</Box>
					)}
				</Grid>
			</Grid>
		</Box>
	);
}
