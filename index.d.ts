/**
 * auregistre - what changed in a French company, and when.
 *
 * The types describe what the API SERVES. A field may be added under this
 * shape; none is removed or renamed, which is the promise that replaces a
 * version number.
 */

/** Where the API answers. */
export declare const BASE_URL: 'https://auregistre.fr';

/** Options every call accepts. */
export interface Options {
	/** Another origin, for a staging environment. Defaults to `BASE_URL`. */
	baseUrl?: string;
	/** A fetch of your own: a proxy, a retry policy, a test double. */
	fetch?: typeof globalThis.fetch;
	signal?: AbortSignal;
}

/** A refusal the API described, in the shape of RFC 9457. */
export declare class ApiError extends Error {
	name: 'ApiError';
	/** A documentation anchor that opens in a browser. */
	type: string | null;
	title: string | null;
	status: number;
	detail: string | null;
	/** The path that was requested. */
	instance: string | null;
	/** Present on a 429: how long to wait before asking again. */
	retryAfterSeconds: number | null;
}

/** One value, on the day the gazette published it. */
export interface Step {
	/** Publication date of the announcement that carried this value. */
	date: string;
	/** The value exactly as the register published it, in French. */
	value: string;
	/** The same value as a number, on monetary fields only. */
	amount?: { value: number; currency: string };
	/** The announcement that published it. Every step is verifiable. */
	source?: string;
}

/** One field that has changed at least once. */
export interface Thread {
	field: 'share_capital' | 'legal_name' | 'legal_form' | 'registered_office' | 'stated_activity';
	/** Human-readable field name, in English. */
	label: string;
	/** How many times the value changed. `history` holds one more entry. */
	changes: number;
	first_known: Step;
	current: Step;
	history: Step[];
}

/** Where the data comes from, and when it was read. */
export interface Attribution {
	name: string;
	url: string;
	licence: string;
	/** When WE read the source, in ISO 8601. Not the publication date. */
	retrieved: string;
}

export interface Timeline {
	siren: string;
	/** The name as the gazette last published it, or null. */
	legal_name: string | null;
	/** One entry per field that has changed at least once. */
	timeline: Thread[];
	coverage: {
		/** How many announcements actually describe this company. */
		announcements_read: number;
		/** False when the gazette stopped answering mid-read. */
		complete: boolean;
		earliest_possible_year: number;
	};
	attribution: Attribution[];
	/** Which service produced this response, as opposed to the data. */
	served_by: { name: string; url: string };
	terms: string;
	documentation: string;
	/** What the data does and does not say. */
	notice: string;
}

/**
 * Every recorded change for one company.
 *
 * The identifier is a SIREN. Spaces, dots and dashes are accepted and removed.
 */
export declare function timeline(siren: string | number, options?: Options): Promise<Timeline>;

/** The machine-readable contract this client was written against. */
export declare function openapi(options?: Options): Promise<Record<string, unknown>>;
