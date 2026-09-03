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
 *
 * `proceedings` holds the insolvency judgments beside it rather than inside
 * it: a timeline entry follows the VALUE of a field, a judgment is a dated
 * EVENT, and one field name must never mean two things.
 */
export async function timeline(siren, options) {
	const nine = String(siren).replace(/[\s.-]/g, '');
	return json(address(ask(options).baseUrl, `/api/company/${nine}/timeline`), options);
}

/**
 * The annual accounts one company filed, fiscal year by fiscal year.
 *
 * Revenue, gross margin, EBITDA, EBIT, net income and the thirteen ratios the
 * INPI computes from the filed statements, most recent first. Every entry says
 * its `perimeter`: `legal_entity` is the one company registered under this
 * SIREN, `group` the consolidated accounts of its group, and THE TWO NEVER ADD
 * UP. Quote the perimeter with the figure.
 *
 * A company that exists and has no published accounts is a 404 whose `type`
 * ends in `no-financial-statements`, which is not `company-not-found`: do not
 * delete the row, it may file next year.
 */
export async function financials(siren, options) {
	const nine = String(siren).replace(/[\s.-]/g, '');
	return json(address(ask(options).baseUrl, `/api/company/${nine}/financials`), options);
}

/**
 * How many companies one watch call takes.
 *
 * The API keeps the first twenty and drops the rest WITHOUT SAYING SO, because
 * refusing a whole watch over one company too many would be worse on its side
 * of the wire. On this side there is a caller to tell, so this client refuses
 * rather than watching fewer companies than it was handed.
 */
export const MAX_WATCHED = 20;

/**
 * What the gazette published about companies you already track, since a date.
 *
 * It takes identifiers you already hold and never a criterion, so it is not a
 * search: a caller who does not know a SIREN learns none from it.
 *
 * The window filters on the PUBLICATION date, not on the date of the act. The
 * two differ by sixteen days at the median, and a watch that filtered on the act
 * would never see a judgment ruled before its last visit and published after.
 *
 * Each company spends one unit of the rate limit, so twenty companies cost
 * twenty.
 */
export async function changes(siren, options = {}) {
	const many = (Array.isArray(siren) ? siren : String(siren).split(','))
		.map((one) => String(one).replace(/[\s.-]/g, ''))
		.filter(Boolean);
	if (many.length > MAX_WATCHED) {
		throw new RangeError(
			`${many.length} companies asked for, ${MAX_WATCHED} at most. The API would keep ${MAX_WATCHED} and drop the rest in silence: split the call instead.`
		);
	}
	const since = options.since instanceof Date ? options.since.toISOString().slice(0, 10) : options.since;
	return json(
		address(ask(options).baseUrl, '/api/changes', { siren: many.join(','), since }),
		options
	);
}

/**
 * Insolvency openings, a rolling twelve months against the twelve before.
 *
 * Called with no scope it counts France. Otherwise pass `{ department }` or
 * `{ trade }`, and the value must be one the website already publishes as a
 * page: an unknown one is a 404 rather than a query composed from what you sent.
 *
 * Closures are not counted - they are the opposite of a new failure - and the
 * current month is always excluded, because a month still running reads as a
 * collapse.
 */
export async function insolvencies(scope, options) {
	/*
	 * A caller who wants France with a fetch of their own writes
	 * `insolvencies({ fetch })`, which is an options object and not a scope.
	 * Reading it as an empty scope would drop their fetch in silence, so what
	 * decides here is whether a scope KEY is present, never the arity.
	 */
	const aimed =
		typeof scope === 'object' && scope !== null && ('department' in scope || 'trade' in scope);
	const settings = aimed ? options : (scope ?? options);
	const path = !aimed
		? '/api/insolvencies'
		: 'department' in scope
			? `/api/insolvencies/department/${encodeURIComponent(scope.department)}`
			: `/api/insolvencies/trade/${encodeURIComponent(scope.trade)}`;
	return json(address(ask(settings).baseUrl, path), settings);
}

/** The machine-readable contract this client was written against. */
export async function openapi(options) {
	return json(address(ask(options).baseUrl, '/api/openapi.json'), options);
}
