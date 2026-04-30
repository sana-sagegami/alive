const OURA_API = 'https://api.ouraring.com/v2/usercollection/heartrate';
const ALLOWED_ORIGIN = 'https://alive.bysana.me';

interface Env {
	OURA_TOKEN: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const corsHeaders = {
			'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
			'Access-Control-Allow-Methods': 'GET',
			'Content-Type': 'application/json',
		};

		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		const now = new Date();
		const from = new Date(now.getTime() - 30 * 60 * 1000);

		const url = new URL(OURA_API);
		url.searchParams.set('start_datetime', from.toISOString());
		url.searchParams.set('end_datetime', now.toISOString());

		const res = await fetch(url.toString(), {
			headers: { Authorization: `Bearer ${env.OURA_TOKEN}` },
		});
		if (!res.ok) {
			return new Response(JSON.stringify({ error: 'upstream failed' }), {
				status: 502,
				headers: corsHeaders,
			});
		}

		const data = await res.json<{ data: { bpm: number; timestamp: string }[] }>();

		// 最新1件だけ返す
		const latest = data.data.at(-1) ?? null;

		return new Response(JSON.stringify({ heartrate: latest }), {
			headers: { ...corsHeaders, 'Cache-Control': 'no-store' },
		});
	},
};
