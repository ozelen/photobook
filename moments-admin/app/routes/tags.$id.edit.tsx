import { useMemo, useRef, useState } from "react";
import { Form, Link, redirect } from "react-router";
import type { Route } from "./+types/tags.$id.edit";
import { getSessionUser } from "../lib/auth.server";
import { deleteTagWithStrategy, getTag, listItemsForTag, listTags, updateTag } from "../lib/tags.server";
import { slugify } from "../lib/slugify";
import {
	Box,
	Button,
	Card,
	CardActionArea,
	CardMedia,
	FormControl,
	FormControlLabel,
	FormLabel,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Grid,
	Radio,
	RadioGroup,
	Stack,
	TextField,
	Typography,
	MenuItem,
} from "@mui/material";

export function meta({ loaderData }: Route.MetaArgs) {
	const tag = loaderData?.tag;
	return [
		{ title: tag ? `Edit ${tag.name} — Moments Admin` : "Edit Tag — Moments Admin" },
	];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) return redirect("/login");

	const tag = await getTag(context.cloudflare.env.DB, params.id);
	if (!tag) throw new Response("Not found", { status: 404 });
	const allTags = await listTags(context.cloudflare.env.DB);
	const items = await listItemsForTag(context.cloudflare.env.DB, user.id, params.id, 48);
	return { tag, allTags, items };
}

export async function action({ params, request, context }: Route.ActionArgs) {
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) return redirect("/login");

	const formData = await request.formData();
	const intent = String(formData.get("intent") ?? "save");

	if (intent === "delete") {
		const strategyRaw = String(formData.get("deleteStrategy") ?? "untag");
		const strategy = strategyRaw === "merge" ? "merge" : "untag";
		const mergeTargetTagId = String(formData.get("mergeTargetTagId") ?? "").trim() || null;

		try {
			await deleteTagWithStrategy(context.cloudflare.env.DB, params.id, {
				strategy,
				mergeTargetTagId,
			});
		} catch (error) {
			return { error: (error as Error).message || "Failed to delete tag" };
		}

		return redirect("/tags");
	}

	const name = String(formData.get("name") ?? "").trim();
	const slug = String(formData.get("slug") ?? "").trim();
	const heroTitle = String(formData.get("heroTitle") ?? "").trim() || null;
	const heroSubtitle = String(formData.get("heroSubtitle") ?? "").trim() || null;
	const heroItemId = String(formData.get("heroItemId") ?? "").trim() || null;

	if (!name) {
		return { error: "Name is required" };
	}

	const tag = await updateTag(context.cloudflare.env.DB, params.id, {
		name,
		slug: slug || slugify(name),
		heroTitle,
		heroSubtitle,
		heroItemId,
	});
	if (tag) return redirect("/tags");
	return { error: "Failed to update" };
}

export default function TagEdit({ loaderData, actionData }: Route.ComponentProps) {
	const { tag, allTags, items } = loaderData;
	const slugRef = useRef<HTMLInputElement | null>(null);
	const [heroItemId, setHeroItemId] = useState<string>(tag.heroItemId ?? "");
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deleteStrategy, setDeleteStrategy] = useState<"untag" | "merge">("untag");
	const [mergeTargetTagId, setMergeTargetTagId] = useState<string>("");

	const mergeTargets = useMemo(
		() => allTags.filter((t: typeof tag) => t.id !== tag.id),
		[allTags, tag.id],
	);

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
				Edit tag
			</Typography>
			<Grid container spacing={3}>
				<Grid item xs={12} md={5} lg={4}>
					<Form method="post">
						<Stack spacing={2}>
							<TextField
								id="name"
								name="name"
								label="Name"
								defaultValue={tag.name}
								required
								fullWidth
								onInput={handleNameInput}
							/>
							<TextField
								id="slug"
								name="slug"
								label="Slug"
								helperText="Auto-generated from name, edit to override."
								defaultValue={tag.slug}
								fullWidth
								onFocus={handleSlugFocus}
								inputRef={slugRef}
							/>
							<TextField
								id="heroTitle"
								name="heroTitle"
								label="Hero title"
								defaultValue={tag.heroTitle ?? ""}
								placeholder="Capturing Moments That Last Forever"
								fullWidth
							/>
							<TextField
								id="heroSubtitle"
								name="heroSubtitle"
								label="Hero subtitle"
								multiline
								minRows={2}
								defaultValue={tag.heroSubtitle ?? ""}
								placeholder="Award-winning photography specializing in..."
								fullWidth
							/>
							<Box>
								<Typography variant="subtitle2" gutterBottom>
									Hero image
								</Typography>
								<Stack direction="row" spacing={1} alignItems="center">
									<Button
										type="button"
										variant="outlined"
										size="small"
										onClick={() => {
											// no-op; selection happens via clicking photos below
										}}
									>
										Pick from photos below
									</Button>
									{heroItemId && (
										<Typography variant="body2" color="text.secondary">
											Selected: {heroItemId}
										</Typography>
									)}
								</Stack>
								<Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
									Click a photo in the grid to set it as this tag&apos;s hero image. Leave
									empty to use the latest tagged photo.
								</Typography>
								<input type="hidden" name="heroItemId" value={heroItemId} />
							</Box>
							{actionData?.error && (
								<Typography variant="body2" color="error">
									{actionData.error}
								</Typography>
							)}
							<Stack direction="row" spacing={2}>
								<Button type="submit" name="intent" value="save" variant="contained">
									Save
								</Button>
								<Button component={Link} to="/tags" variant="text" color="inherit">
									Cancel
								</Button>
								<Button
									type="button"
									variant="outlined"
									color="error"
									onClick={() => setDeleteDialogOpen(true)}
								>
									Delete
								</Button>
							</Stack>
						</Stack>
					</Form>
					<Form method="post" id="delete-tag-form">
						<input type="hidden" name="intent" value="delete" />
						<input type="hidden" name="deleteStrategy" value={deleteStrategy} />
						<input type="hidden" name="mergeTargetTagId" value={mergeTargetTagId} />
					</Form>
				</Grid>
				<Grid item xs={12} md={7} lg={8}>
					<Typography variant="subtitle1" gutterBottom>
						Photos with this tag
					</Typography>
					{items.length === 0 ? (
						<Typography variant="body2" color="text.secondary">
							No photos use this tag yet.
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
										border: heroItemId === item.id ? 2 : 1,
										borderColor: heroItemId === item.id ? "primary.main" : "divider",
										transition: "transform 200ms ease, border-color 200ms ease",
										"&:hover": {
											transform: "scale(1.03)",
										},
									}}
								>
									<CardActionArea onClick={() => setHeroItemId(item.id)}>
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
			<Dialog
				open={deleteDialogOpen}
				onClose={() => setDeleteDialogOpen(false)}
				aria-labelledby="delete-tag-dialog-title"
			>
				<DialogTitle id="delete-tag-dialog-title">Delete tag</DialogTitle>
				<DialogContent>
					<FormControl component="fieldset" variant="standard" fullWidth>
						<FormLabel component="legend" sx={{ mb: 1 }}>
							What should happen to photos using this tag?
						</FormLabel>
						<RadioGroup
							aria-label="Delete strategy"
							name="deleteStrategyDialog"
							value={deleteStrategy}
							onChange={(e) => setDeleteStrategy(e.target.value as "untag" | "merge")}
						>
							<FormControlLabel
								value="untag"
								control={<Radio />}
								label="Remove tag and leave photos untagged"
							/>
							<Box sx={{ mt: 1 }}>
								<FormControlLabel
									value="merge"
									control={<Radio />}
									label="Merge into another tag"
								/>
								<TextField
									select
									id="mergeTargetTagIdDialog"
									label="Target tag"
									value={mergeTargetTagId}
									onChange={(e) => setMergeTargetTagId(e.target.value)}
									fullWidth
									size="small"
									sx={{ mt: 1 }}
									disabled={deleteStrategy !== "merge"}
								>
									<MenuItem value="">
										<em>Select target tag</em>
									</MenuItem>
									{mergeTargets.map((t) => (
										<MenuItem key={t.id} value={t.id}>
											{t.name}
										</MenuItem>
									))}
								</TextField>
								<Typography variant="caption" color="text.secondary">
									All photos currently tagged with <strong>{tag.name}</strong> will be retagged
									with the selected tag.
								</Typography>
							</Box>
						</RadioGroup>
					</FormControl>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
					<Button
						type="submit"
						form="delete-tag-form"
						color="error"
						variant="contained"
						onClick={() => setDeleteDialogOpen(false)}
					>
						Delete
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
}
