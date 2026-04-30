const OURA_API = 'https://api.ouraring.com/v2/usercollection/heartrate';
const ALLOWED_ORIGIN = 'https://alive.bysana.me';

interface Env {
	OURA_TOKEN: string;
	HEARTRATE_KV: KVNamespace;
}

interface HeartrateEntry {
	bpm: number;
	timestamp: string;
}

async function fetchLatestFromOura(env: Env): Promise<HeartrateEntry | null> {
	const now = new Date();
	const from = new Date(now.getTime() - 12 * 60 * 60 * 1000);

	const url = new URL(OURA_API);
	url.searchParams.set('start_datetime', from.toISOString());
	url.searchParams.set('end_datetime', now.toISOString());

	const res = await fetch(url.toString(), {
		headers: { Authorization: `Bearer ${env.OURA_TOKEN}` },
	});
	if (!res.ok) return null;

	const data = await res.json<{ data: HeartrateEntry[] }>();
	return data.data.at(-1) ?? null;
}

export default {
	// cronで5分ごとに実行 → KVに最新データを保存
	async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
		const latest = await fetchLatestFromOura(env);
		await env.HEARTRATE_KV.put('latest', JSON.stringify({ heartrate: latest }));
	},

	// フロントエンドからのリクエスト → KVから読んで返す
	async fetch(request: Request, env: Env): Promise<Response> {
		const corsHeaders = {
			'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
			'Access-Control-Allow-Methods': 'GET',
			'Content-Type': 'application/json',
		};

		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		const cached = await env.HEARTRATE_KV.get('latest');
		const body = cached ?? JSON.stringify({ heartrate: null });

		return new Response(body, {
			headers: { ...corsHeaders, 'Cache-Control': 'no-store' },
		});
	},
};
