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

interface FetchResult {
	heartrate: HeartrateEntry | null;
	error_reason: string | null;
}

async function fetchLatestFromOura(env: Env): Promise<FetchResult> {
	const now = new Date();
	const from = new Date(now.getTime() - 12 * 60 * 60 * 1000);

	const url = new URL(OURA_API);
	url.searchParams.set('start_datetime', from.toISOString());
	url.searchParams.set('end_datetime', now.toISOString());

	let res: Response;
	try {
		res = await fetch(url.toString(), {
			headers: { Authorization: `Bearer ${env.OURA_TOKEN}` },
		});
	} catch (e) {
		return { heartrate: null, error_reason: `network error: ${e}` };
	}

	if (!res.ok) {
		return { heartrate: null, error_reason: `oura api ${res.status}: ${await res.text()}` };
	}

	const data = await res.json<{ data: HeartrateEntry[] }>();
	const latest = data.data.at(-1) ?? null;
	const error_reason = latest === null ? 'no data in last 12h' : null;
	return { heartrate: latest, error_reason };
}

export default {
	// cronで5分ごとに実行 → KVに最新データを保存
	async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
		const result = await fetchLatestFromOura(env);
		await env.HEARTRATE_KV.put('latest', JSON.stringify(result));
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

		if (new URL(request.url).pathname === '/debug') {
			const result = await fetchLatestFromOura(env);
			return new Response(JSON.stringify(result), { headers: corsHeaders });
		}

		let cached = await env.HEARTRATE_KV.get('latest');
		if (!cached) {
			const result = await fetchLatestFromOura(env);
			const json = JSON.stringify(result);
			await env.HEARTRATE_KV.put('latest', json, { expirationTtl: 300 });
			cached = json;
		}
		const body = cached;

		return new Response(body, {
			headers: { ...corsHeaders, 'Cache-Control': 'no-store' },
		});
	},
};
