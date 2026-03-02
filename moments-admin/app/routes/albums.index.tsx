import { Form, Link } from "react-router";
import type { Route } from "./+types/albums.index";
import { getSessionUser } from "../lib/auth.server";
import { listAlbums } from "../lib/albums.server";
import { listAlbumItems } from "../lib/items.server";
import {
	Box,
	Button,
	Card,
	CardActions,
	CardContent,
	Chip,
	Stack,
	Typography,
} from "@mui/material";

export function meta() {
	return [{ title: "Albums — Moments Admin" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) {
		return {
			albums: [],
			previewsByAlbum: {} as Record<string, { id: string; imageId: string }[]>,
		};
	}

	const db = context.cloudflare.env.DB;
	const albums = await listAlbums(db, user.id);

	const previewsByAlbum: Record<string, { id: string; imageId: string }[]> = {};
	for (const album of albums) {
		const items = await listAlbumItems(db, album.id, user.id);
		previewsByAlbum[album.id] = items.slice(0, 6).map((i) => ({
			id: i.id,
			imageId: i.imageId,
		}));
	}

	return { albums, previewsByAlbum };
}

export default function AlbumsIndex({ loaderData }: Route.ComponentProps) {
	const { albums, previewsByAlbum } = loaderData;

	return (
		<Box>
			<Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
				<Typography variant="h4" component="h1">
					Albums
				</Typography>
				<Button
					component={Link}
					to="/albums/new"
					variant="contained"
					color="primary"
				>
					New album
				</Button>
			</Stack>
			{albums.length === 0 ? (
				<Card>
					<CardContent sx={{ textAlign: "center", py: 6 }}>
						<Typography color="text.secondary" gutterBottom>
							No albums yet.
						</Typography>
						<Button
							component={Link}
							to="/albums/new"
							variant="text"
							color="primary"
						>
							Create your first album
						</Button>
					</CardContent>
				</Card>
			) : (
				<Stack spacing={2}>
					{albums.map((album) => (
						<Card key={album.id} variant="outlined">
							<CardContent>
								<Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
									<Box>
										<Typography
											component={Link}
											to={`/albums/${album.id}`}
											variant="subtitle1"
											sx={{ textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
										>
											{album.name}
										</Typography>
										<Stack direction="row" spacing={1} mt={0.5} alignItems="center">
											<Typography variant="body2" color="text.secondary">
												/{album.slug}
											</Typography>
											<Chip size="small" label={album.kind} />
											{album.isPublic ? (
												<Chip size="small" color="success" label="Public" />
											) : null}
										</Stack>
									</Box>
									<CardActions sx={{ p: 0, gap: 1 }}>
										<Button
											component={Link}
											to={`/albums/${album.id}/edit`}
											size="small"
										>
											Edit
										</Button>
										<Form method="post" action={`/albums/${album.id}`}>
											<input type="hidden" name="_action" value="delete" />
											<Button
												type="submit"
												size="small"
												color="error"
												onClick={(e) => {
													if (!confirm("Delete this album?")) e.preventDefault();
												}}
											>
												Delete
											</Button>
										</Form>
									</CardActions>
								</Stack>
								{(previewsByAlbum?.[album.id]?.length ?? 0) > 0 && (
									<Stack direction="row" spacing={1} mt={2} sx={{ overflowX: "auto" }}>
										{previewsByAlbum[album.id].map((item) => (
											<Box
												key={item.id}
												component="img"
												src={`/api/items/${item.id}/image`}
												alt=""
												sx={{
													width: 64,
													height: 64,
													borderRadius: 1,
													objectFit: "cover",
													border: 1,
													borderColor: "divider",
												}}
												loading="lazy"
											/>
										))}
									</Stack>
								)}
							</CardContent>
						</Card>
					))}
				</Stack>
			)}
		</Box>
	);
}
