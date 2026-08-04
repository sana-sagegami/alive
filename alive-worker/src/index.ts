const OURA_API = 'https://api.ouraring.com/v2/usercollection/heartrate';
const OURA_AUTHORIZE_URL = 'https://cloud.ouraring.com/oauth/authorize';
const OURA_TOKEN_URL = 'https://api.ouraring.com/oauth/token';
const OURA_SCOPE = 'heartrate';
const ALLOWED_ORIGINS = ['https://alive.bysana.me', 'https://alive.sana37.workers.dev', 'http://localhost:5173'];

interface Env {
	OURA_CLIENT_ID: string;
	OURA_CLIENT_SECRET: string;
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

interface OuraTokenResponse {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	token_type: string;
	scope: string;
}

async function requestOuraToken(env: Env, params: Record<string, string>): Promise<OuraTokenResponse> {
	const body = new URLSearchParams({
		client_id: env.OURA_CLIENT_ID,
		client_secret: env.OURA_CLIENT_SECRET,
		...params,
	});

	const res = await fetch(OURA_TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body,
	});

	if (!res.ok) {
		throw new Error(`oura token endpoint ${res.status}: ${await res.text()}`);
	}

	return res.json();
}

async function storeTokens(env: Env, tokens: OuraTokenResponse): Promise<void> {
	const expiresAt = Date.now() + tokens.expires_in * 1000;
	await Promise.all([
		env.HEARTRATE_KV.put('oura_access_token', tokens.access_token),
		env.HEARTRATE_KV.put('oura_access_token_expires_at', String(expiresAt)),
		env.HEARTRATE_KV.put('oura_refresh_token', tokens.refresh_token),
	]);
}

// アクセストークンを返す。期限切れ/未取得ならrefresh_tokenで更新する。未認可ならnull。
async function getValidAccessToken(env: Env): Promise<string | null> {
	const [accessToken, expiresAtRaw, refreshToken] = await Promise.all([
		env.HEARTRATE_KV.get('oura_access_token'),
		env.HEARTRATE_KV.get('oura_access_token_expires_at'),
		env.HEARTRATE_KV.get('oura_refresh_token'),
	]);

	const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : 0;
	if (accessToken && Date.now() < expiresAt - 60_000) {
		return accessToken;
	}

	if (!refreshToken) return null;

	// Ouraはリフレッシュのたびにrefresh_tokenをローテーションするため、毎回保存し直す
	const tokens = await requestOuraToken(env, {
		grant_type: 'refresh_token',
		refresh_token: refreshToken,
	});
	await storeTokens(env, tokens);
	return tokens.access_token;
}

async function fetchLatestFromOura(env: Env): Promise<FetchResult> {
	let accessToken: string | null;
	try {
		accessToken = await getValidAccessToken(env);
	} catch (e) {
		return { heartrate: null, error_reason: `token refresh error: ${e}` };
	}

	if (!accessToken) {
		return { heartrate: null, error_reason: 'not authorized: visit /authorize to connect Oura account' };
	}

	const now = new Date();
	const from = new Date(now.getTime() - 12 * 60 * 60 * 1000);

	const url = new URL(OURA_API);
	url.searchParams.set('start_datetime', from.toISOString());
	url.searchParams.set('end_datetime', now.toISOString());

	let res: Response;
	try {
		res = await fetch(url.toString(), {
			headers: { Authorization: `Bearer ${accessToken}` },
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
	// cronで5分ごとに実行 → 必要ならトークンを更新し、KVに最新データを保存
	async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
		const result = await fetchLatestFromOura(env);
		await env.HEARTRATE_KV.put('latest', JSON.stringify(result));
	},

	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const requestOrigin = request.headers.get('Origin');
		const corsHeaders: Record<string, string> = {
			'Access-Control-Allow-Methods': 'GET',
			'Content-Type': 'application/json',
			Vary: 'Origin',
		};
		if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
			corsHeaders['Access-Control-Allow-Origin'] = requestOrigin;
		}

		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// 初回認可の起点。ブラウザで直接開いてOura側の同意画面へ遷移する。
		if (url.pathname === '/authorize') {
			const state = crypto.randomUUID();
			await env.HEARTRATE_KV.put('oura_oauth_state', state, { expirationTtl: 300 });

			const authorizeUrl = new URL(OURA_AUTHORIZE_URL);
			authorizeUrl.searchParams.set('response_type', 'code');
			authorizeUrl.searchParams.set('client_id', env.OURA_CLIENT_ID);
			authorizeUrl.searchParams.set('redirect_uri', `${url.origin}/callback`);
			authorizeUrl.searchParams.set('scope', OURA_SCOPE);
			authorizeUrl.searchParams.set('state', state);

			return Response.redirect(authorizeUrl.toString(), 302);
		}

		// authorization codeフローのリダイレクト先。codeをトークンに交換してKVへ保存する。
		if (url.pathname === '/callback') {
			const code = url.searchParams.get('code');
			const state = url.searchParams.get('state');
			const expectedState = await env.HEARTRATE_KV.get('oura_oauth_state');

			if (!code || !state || !expectedState || state !== expectedState) {
				return new Response('invalid state or missing code', { status: 400 });
			}
			await env.HEARTRATE_KV.delete('oura_oauth_state');

			try {
				const tokens = await requestOuraToken(env, {
					grant_type: 'authorization_code',
					code,
					redirect_uri: `${url.origin}/callback`,
				});
				await storeTokens(env, tokens);
			} catch (e) {
				return new Response(`token exchange failed: ${e}`, { status: 500 });
			}

			return new Response('Oura connected. You can close this tab.', {
				headers: { 'Content-Type': 'text/plain' },
			});
		}

		if (url.pathname === '/debug') {
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
