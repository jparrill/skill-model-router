/**
 * Skill Model Router — Pi Extension
 *
 * Automatically switches to a configured model when specific skills are invoked,
 * then restores the original model when the turn ends.
 *
 * Config: ~/.pi/agent/skill-models.json (auto-created on first run)
 * {
 *   "worklog-add": "local-provider",
 *   "code-review": "cloud-provider/model-id"
 * }
 *
 * Values can be:
 *   - "provider"            — uses the first model from that provider
 *   - "provider/model-id"   — uses a specific model
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Model, Api } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

interface SkillModelsConfig {
	[skillName: string]: string;
}

const PLACEHOLDER: SkillModelsConfig = {
	"example-skill": "local-provider",
	"example-review": "cloud-provider/model-id",
};

function getConfigPath(): string {
	return join(getAgentDir(), "skill-models.json");
}

function seedConfig(): void {
	writeFileSync(
		getConfigPath(),
		JSON.stringify(PLACEHOLDER, null, 2) + "\n",
	);
}

function loadConfig(): SkillModelsConfig {
	const path = getConfigPath();
	if (!existsSync(path)) return {};
	try {
		const config = JSON.parse(readFileSync(path, "utf-8"));
		const keys = Object.keys(config).filter(
			(k) => !k.startsWith("example-"),
		);
		if (keys.length === 0) return {};
		return Object.fromEntries(
			Object.entries(config).filter(
				([k]) => !k.startsWith("example-"),
			),
		);
	} catch {
		return {};
	}
}

function resolveModel(
	spec: string,
	ctx: ExtensionContext,
): Model<Api> | undefined {
	if (spec.includes("/")) {
		const [provider, modelId] = spec.split("/", 2);
		return ctx.modelRegistry.find(provider, modelId);
	}
	const models = ctx.modelRegistry
		.getAll()
		.filter((m: Model<Api>) => m.provider === spec);
	return models[0];
}

export default function skillModelRouter(pi: ExtensionAPI) {
	let config: SkillModelsConfig = {};
	let originalModel: Model<Api> | undefined;
	let switched = false;

	pi.on("session_start", async (_event, ctx) => {
		if (!existsSync(getConfigPath())) {
			seedConfig();
			ctx.ui.notify(
				"skill-router: created ~/.pi/agent/skill-models.json — edit it to configure routing",
				"info",
			);
			return;
		}

		config = loadConfig();
		const count = Object.keys(config).length;
		if (count > 0) {
			ctx.ui.setStatus(
				"skill-router",
				ctx.ui.theme.fg("dim", `router:${count} skills`),
			);
		}
	});

	pi.on("input", async (event, ctx) => {
		const text = event.text.trim();
		if (!text.startsWith("/skill:")) return;

		const skillName = text.replace("/skill:", "").split(/\s/)[0];
		const spec = config[skillName];
		if (!spec) return;

		const target = resolveModel(spec, ctx);
		if (!target) {
			ctx.ui.notify(
				`skill-router: model "${spec}" not found`,
				"warning",
			);
			return;
		}

		if (
			ctx.model?.id === target.id &&
			ctx.model?.provider === target.provider
		)
			return;

		originalModel = ctx.model;
		const success = await pi.setModel(target);
		if (success) {
			switched = true;
			ctx.ui.setStatus(
				"skill-router",
				ctx.ui.theme.fg(
					"accent",
					`→ ${target.provider}/${target.id}`,
				),
			);
		}
	});

	pi.on("turn_end", async (_event, ctx) => {
		if (!switched || !originalModel) return;

		await pi.setModel(originalModel);
		switched = false;
		ctx.ui.setStatus(
			"skill-router",
			ctx.ui.theme.fg(
				"dim",
				`router:${Object.keys(config).length} skills`,
			),
		);
	});
}
