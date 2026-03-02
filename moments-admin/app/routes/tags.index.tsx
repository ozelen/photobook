import { Link } from "react-router";
import type { Route } from "./+types/tags.index";
import { getSessionUser } from "../lib/auth.server";
import { listItemsForTag, listTags } from "../lib/tags.server";
import { Box, Button, Card, CardContent, Stack, Typography, Chip } from "@mui/material";

export function meta() {
	return [{ title: "Tags — Moments Admin" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) return { tags: [], previewsByTag: {} as Record<string, { id: string; imageId: string }[]> };

	const db = context.cloudflare.env.DB;
	const tags = await listTags(db);
	const previewsByTag: Record<string, { id: string; imageId: string }[]> = {};
	for (const tag of tags) {
		const items = await listItemsForTag(db, user.id, tag.id, 6);
		previewsByTag[tag.id] = items.map((i) => ({ id: i.id, imageId: i.imageId }));
	}

	return { tags, previewsByTag };
}

export default function TagsIndex({ loaderData }: Route.ComponentProps) {
	const { tags, previewsByTag } = loaderData;

	return (
		<Box>
			<Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
				<Typography variant="h4" component="h1">
					Tags
				</Typography>
			</Stack>
			<Typography variant="body2" color="text.secondary" mb={3}>
				Tags appear as gallery filters and hero CTAs. Edit a tag to set its hero title, subtitle,
				and image.
			</Typography>
			{tags.length === 0 ? (
				<Card>
					<CardContent sx={{ textAlign: "center", py: 6 }}>
						<Typography color="text.secondary">
							No tags yet. Tags are created when you add them to albums or photos.
						</Typography>
					</CardContent>
				</Card>
			) : (
				<Stack spacing={2}>
					{tags.map((tag) => (
						<Card key={tag.id} variant="outlined">
							<CardContent>
								<Stack
									direction="row"
									justifyContent="space-between"
									alignItems="flex-start"
									spacing={2}
								>
									<Box>
										<Stack direction="row" spacing={1} alignItems="center">
											<Typography variant="subtitle1">{tag.name}</Typography>
											<Typography variant="body2" color="text.secondary">
												/{tag.slug}
											</Typography>
										</Stack>
										<Stack direction="row" spacing={1} mt={0.5} flexWrap="wrap">
											{tag.kind && (
												<Chip size="small" label={tag.kind} variant="outlined" />
											)}
											{tag.heroTitle && (
												<Chip
													size="small"
													color="primary"
													variant="outlined"
													label="Has hero"
												/>
											)}
										</Stack>
										{(tag.heroTitle || tag.heroSubtitle) && (
											<Typography variant="body2" color="text.secondary" mt={0.5}>
												Hero: {tag.heroTitle || tag.heroSubtitle || "—"}
											</Typography>
										)}
									</Box>
									<Button
										component={Link}
										to={`/tags/${tag.id}/edit`}
										size="small"
										variant="text"
									>
										Edit
									</Button>
								</Stack>
								{(previewsByTag?.[tag.id]?.length ?? 0) > 0 && (
									<Stack direction="row" spacing={1} mt={2} sx={{ overflowX: "auto" }}>
										{previewsByTag[tag.id].map((item) => (
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
