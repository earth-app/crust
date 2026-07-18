import { ensureAdministrator } from '~/server/utils';
import type { MarketingKind, MarketingScene } from '~/shared/types/marketing';

export default defineEventHandler(async (event) => {
	await ensureAdministrator(event);
	const { kind } = getQuery(event) as { kind?: MarketingKind };

	const storage = useStorage('cache');
	const keys = await storage.getKeys('marketing:scene:');
	const scenes = (await Promise.all(keys.map((k) => storage.getItem<MarketingScene>(k)))).filter(
		(s): s is MarketingScene => !!s
	);

	const filtered = kind ? scenes.filter((s) => s.kind === kind) : scenes;
	return filtered.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
});
