/**
 * auregistre - the official client for the auregistre API.
 *
 * Zero dependencies, ESM, Node 18 or newer (it uses the global fetch). No key
 * and no account: the data is public and the API asks for nothing.
 *
 * The shape of this file is shared with the other clients of the fleet
 * (auregistre, titelia, quivad), because the three APIs answer by one
 * convention: absolute addresses, an envelope naming the source and the
 * service, refusals as RFC 9457 problem documents, and long collections cut by
 * limit/offset with a page block that says where the rest is.
 */

/** Where the API answers. */
export const BASE_URL = 'https://auregistre.fr';

/**
 * A refusal the API described, rather than a bare HTTP status.
 *
 * Every error of this API is an `application/problem+json` document
 * (RFC 9457): `type` is a documentation anchor that opens in a browser,
 * `title` and `detail` say what happened. A 429 also carries how long to
 * wait, which is why `retryAfterSeconds` is read out here rather than left in
 * the body: a caller that backs off needs one number, not a document.
 */
export class ApiError extends Error {
	constructor(problem, status) {
		const said = [problem.title, problem.detail].filter(Boolean).join(': ');
		super(said || `HTTP ${status}`);
		this.name = 'ApiError';
		this.type = problem.type ?? null;
		this.title = problem.title ?? null;
		this.status = problem.status ?? status;
		this.detail = problem.detail ?? null;
		this.instance = problem.instance ?? null;
		this.retryAfterSeconds = problem.retry_after_seconds ?? null;
	}
}

/** Options every call accepts. */
function ask(options = {}) {
	return {
		baseUrl: options.baseUrl ?? BASE_URL,
		fetch: options.fetch ?? globalThis.fetch,
		signal: options.signal
	};
}

function address(base, path, params = {}) {
	const url = new URL(path, base);
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
	}
	return url.toString();
}

/**
 * One call, and the only place an error is turned into an exception.
 *
 * A body is read as a problem document whenever the status refuses, whatever
 * the media type: the API always answers JSON, and a caller that gets HTML has
 * met something else - a proxy, a captive portal - which deserves to be said
 * rather than to surface as a parse error.
 */
async function call(url, options, accept = 'application/json') {
	const { fetch: doFetch, signal } = ask(options);
	const response = await doFetch(url, { headers: { accept }, signal });
	if (!response.ok) {
		let problem = {};
		try {
			problem = await response.json();
		} catch {
			problem = { title: `HTTP ${response.status}`, status: response.status };
		}
		throw new ApiError(problem, response.status);
	}
	return response;
}

async function json(url, options) {
	return (await call(url, options)).json();
}

async function text(url, options) {
	return (await call(url, options, 'text/plain')).text();
}

/**
 * Every row of a cut collection, page after page.
 *
 * The API hands back the address of the next page rather than describing it,
 * so this follows `page.next` instead of assembling anything: a client that
 * builds the address itself gets it slightly wrong once, and the bug then looks
 * like missing data rather than a broken loop.
 */
async function* walk(url, rowsKey, options) {
	let next = url;
	while (next) {
		const answer = await json(next, options);
		for (const row of answer[rowsKey] ?? []) yield row;
		next = answer.page?.next ?? null;
	}
}

/**
 * Every recorded change for one company, oldest first.
 *
 * The identifier is a SIREN: the nine digits the French business register
 * assigns to a legal entity. Spaces, dots and dashes are accepted and removed,
 * because that is how a SIREN is written everywhere, this site included.
 *
 * There is one entry per field that has CHANGED at least once. A field that has
 * never moved is not a timeline, it is a state, and it is left out.
 */
export async function timeline(siren, options) {
	const nine = String(siren).replace(/[\s.-]/g, '');
	return json(address(ask(options).baseUrl, `/api/company/${nine}/timeline`), options);
}

/** The machine-readable contract this client was written against. */
export async function openapi(options) {
	return json(address(ask(options).baseUrl, '/api/openapi.json'), options);
}
