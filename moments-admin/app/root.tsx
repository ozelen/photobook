import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	redirect,
	Scripts,
	ScrollRestoration,
	useRouteLoaderData,
	Link as RouterLink,
} from "react-router";

import {
	AppBar,
	Box,
	Button,
	CssBaseline,
	ThemeProvider,
	Toolbar,
	Typography,
	createTheme,
} from "@mui/material";

import type { Route } from "./+types/root";
import { getSessionUser } from "./lib/auth.server";
import "./app.css";

const theme = createTheme({
	palette: {
		mode: "dark",
	},
});

export async function loader({ request, context }: Route.LoaderArgs) {
	const url = new URL(request.url);
	if (url.pathname === "/login" || url.pathname === "/logout") {
		return { user: null };
	}
	const secret = (context.cloudflare.env as { SESSION_SECRET?: string }).SESSION_SECRET;
	const user = await getSessionUser(request, context.cloudflare.env.DB, secret);
	if (!user) return redirect("/login");
	return { user };
}

export const links: Route.LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{
		rel: "preconnect",
		href: "https://fonts.gstatic.com",
		crossOrigin: "anonymous",
	},
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
	},
];

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	const data = useRouteLoaderData("root") as { user: { firstName: string | null } | null } | undefined;
	const user = data?.user;

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			{user && (
				<AppBar
					position="static"
					color="transparent"
					elevation={0}
					sx={{
						borderBottom: 1,
						borderColor: "divider",
						bgcolor: "background.default",
					}}
				>
					<Toolbar
						sx={{
							maxWidth: "72rem",
							width: "100%",
							mx: "auto",
							px: { xs: 2, sm: 3, lg: 4 },
						}}
					>
						<Box sx={{ display: "flex", alignItems: "center", gap: 3, flexGrow: 1 }}>
							<Button
								component={RouterLink}
								to="/"
								color="inherit"
								sx={{ fontWeight: 600, fontSize: "1rem" }}
							>
								Moments Admin
							</Button>
							<Button component={RouterLink} to="/albums" color="inherit" size="small">
								Albums
							</Button>
							<Button component={RouterLink} to="/gallery" color="inherit" size="small">
								Gallery
							</Button>
							<Button component={RouterLink} to="/tags" color="inherit" size="small">
								Tags
							</Button>
						</Box>
						<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
							<Typography variant="body2" color="text.secondary">
								{user.firstName ?? user}
							</Typography>
							<Button
								component="a"
								href="/logout"
								color="inherit"
								size="small"
								variant="outlined"
							>
								Log out
							</Button>
						</Box>
					</Toolbar>
				</AppBar>
			)}
			<main>
				<Box
					sx={
						user
							? {
									maxWidth: "72rem",
									mx: "auto",
									px: { xs: 2, sm: 3, lg: 4 },
									py: 4,
							  }
							: undefined
					}
				>
					<Outlet />
				</Box>
			</main>
		</ThemeProvider>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = "Oops!";
	let details = "An unexpected error occurred.";
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? "404" : "Error";
		details =
			error.status === 404
				? "The requested page could not be found."
				: error.statusText || details;
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	return (
		<main className="pt-16 p-4 container mx-auto">
			<h1>{message}</h1>
			<p>{details}</p>
			{stack && (
				<pre className="w-full p-4 overflow-x-auto">
					<code>{stack}</code>
				</pre>
			)}
		</main>
	);
}
