import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, BASE_URL, timeline, changes, insolvencies, MAX_WATCHED } from '../index.js';

/*
 * The client is a thin layer, so what is worth testing is the thin layer: the
 * address it builds, and what it does with a refusal. Both are checked against
 * a fake fetch rather than against the live API - a test suite that calls a
 * foreign web server is a build dependency on somebody else's uptime.
 */

/** A fetch that records what it was asked for and answers what it is told. */
function fakeFetch(answer, status = 200) {
	const calls = [];
	const doFetch = async (url) => {
		calls.push(url);
		return new Response(JSON.stringify(answer), {
			status,
			headers: { 'content-type': 'application/json' }
		});
	};
	return { doFetch, calls };
}

test('the base address is the production one', () => {
	assert.equal(BASE_URL, 'https://auregistre.fr');
});

test('a SIREN is accepted the way it is written everywhere', async () => {
	const { doFetch, calls } = fakeFetch({ siren: '794598813' });
	await timeline('794 598 813', { fetch: doFetch });
	// Spaces, dots and dashes are removed rather than refused: that is the form
	// the register itself prints, and refusing what we display would be a trap.
	assert.deepEqual(calls, ['https://auregistre.fr/api/company/794598813/timeline']);
	await timeline('794.598-813', { fetch: doFetch });
	assert.equal(calls[1], 'https://auregistre.fr/api/company/794598813/timeline');
});

test('another origin can be aimed at, for a staging environment', async () => {
	const { doFetch, calls } = fakeFetch({ siren: '794598813' });
	await timeline('794598813', { fetch: doFetch, baseUrl: 'https://develop.auregistre.fr' });
	assert.equal(calls[0], 'https://develop.auregistre.fr/api/company/794598813/timeline');
});

test('a watch takes a list, a string, or one identifier', async () => {
	const { doFetch, calls } = fakeFetch({ companies: [] });
	await changes(['794 598 813', '552032534'], { fetch: doFetch });
	await changes('794598813,552032534', { fetch: doFetch });
	await changes(794598813, { fetch: doFetch });
	assert.equal(calls[0], 'https://auregistre.fr/api/changes?siren=794598813%2C552032534');
	assert.equal(calls[1], calls[0]);
	assert.equal(calls[2], 'https://auregistre.fr/api/changes?siren=794598813');
});

test('a window can be a Date, and is sent as the API writes it', async () => {
	const { doFetch, calls } = fakeFetch({ companies: [] });
	await changes('794598813', { since: new Date('2026-06-01T00:00:00Z'), fetch: doFetch });
	assert.match(calls[0], /since=2026-06-01$/);
});

test('more than twenty companies is refused here rather than trimmed there', async () => {
	// The API keeps twenty and drops the rest without a word. A watch that
	// silently stops watching is the one failure this client can prevent.
	const { doFetch, calls } = fakeFetch({ companies: [] });
	const many = Array.from({ length: MAX_WATCHED + 1 }, (_, i) => String(100000000 + i));
	await assert.rejects(
		() => changes(many, { fetch: doFetch }),
		(error) => error instanceof RangeError && /21 companies asked for, 20 at most/.test(error.message)
	);
	// Refused before the wire: no request was made.
	assert.deepEqual(calls, []);
});

test('the barometer scopes the three addresses the site publishes', async () => {
	const { doFetch, calls } = fakeFetch({ scope: { kind: 'country' } });
	await insolvencies(undefined, { fetch: doFetch });
	await insolvencies({ department: '2A' }, { fetch: doFetch });
	await insolvencies({ trade: 'restauration' }, { fetch: doFetch });
	assert.deepEqual(calls, [
		'https://auregistre.fr/api/insolvencies',
		'https://auregistre.fr/api/insolvencies/department/2A',
		'https://auregistre.fr/api/insolvencies/trade/restauration'
	]);
});

test('options passed where a scope would go are still options', async () => {
	// insolvencies({ fetch }) means France with a fetch of your own. Reading it
	// as an empty scope would drop the fetch and call the network for real.
	const { doFetch, calls } = fakeFetch({ scope: { kind: 'country' } });
	await insolvencies({ fetch: doFetch, baseUrl: 'https://develop.auregistre.fr' });
	assert.deepEqual(calls, ['https://develop.auregistre.fr/api/insolvencies']);
});

test('a refusal becomes an ApiError carrying the problem document', async () => {
	const problem = {
		type: 'https://auregistre.fr/api#not-found',
		title: 'Unknown',
		status: 404,
		detail: 'Nothing answers here.'
	};
	const { doFetch } = fakeFetch(problem, 404);
	await assert.rejects(
		() => timeline('794598813', { fetch: doFetch }),
		(error) => {
			assert.ok(error instanceof ApiError);
			assert.equal(error.status, 404);
			assert.equal(error.title, 'Unknown');
			assert.equal(error.detail, 'Nothing answers here.');
			assert.equal(error.type, problem.type);
			// The message is what a log line shows, so it says both halves.
			assert.match(error.message, /Unknown: Nothing answers here\./);
			return true;
		}
	);
});

test('a refusal that is not a problem document still says the status', async () => {
	// A proxy, a captive portal, anything that is not the API: the caller gets a
	// status rather than a parse error from deep inside the client.
	const doFetch = async () => new Response('<html>gateway</html>', { status: 502 });
	await assert.rejects(
		() => timeline('794598813', { fetch: doFetch }),
		(error) => error instanceof ApiError && error.status === 502
	);
});
