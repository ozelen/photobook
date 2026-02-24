import { createRequestHandler } from "react-router";
import { processCfImagesUpload } from "../app/lib/cf-images-queue.server";

declare module "react-router" {
	export interface AppLoadContext {
		cloudflare: {
			env: Env;
			ctx: ExecutionContext;
		};
	}
}

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

export default {
	fetch(request, env, ctx) {
		return requestHandler(request, {
			cloudflare: { env, ctx },
		});
	},
	async queue(batch, env, ctx) {
		for (const msg of batch.messages) {
			try {
				const body = msg.body as { itemId?: string; imageId?: string };
				await processCfImagesUpload(
					{ itemId: body.itemId ?? "", imageId: body.imageId ?? "" },
					env as Parameters<typeof processCfImagesUpload>[1],
				);
				msg.ack();
			} catch {
				msg.retry();
			}
		}
	},
} satisfies ExportedHandler<Env>;
