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

/**
 * Where a company stands under insolvency law, as a judgment installed it.
 *
 * Absent on the judgments whose wording we refuse to classify: a procedure we
 * cannot read must not manufacture a status, in either direction.
 */
export type InsolvencyStatus =
	| 'safeguard'
	| 'receivership'
	| 'recovery_plan'
	| 'liquidation'
	| 'closed_for_insufficient_assets'
	| 'closed_debts_paid'
	| 'judgment_set_aside';

/** One insolvency judgment, as the court clerk published it. */
export interface Proceeding {
	/** The date of the JUDGMENT, not of its publication. */
	date: string;
	/** The day the gazette printed it. This is what starts legal deadlines. */
	published_on?: string;
	/** The ruling in French, the words the clerk used. */
	title: string;
	status?: InsolvencyStatus;
	/** Who the court appointed. Roles stay in French: they are the ruling's own words. */
	appointee?: {
		role: string;
		firm: string;
		person: string | null;
		court: string | null;
	};
	/** The last day to file a claim, on an OPENING judgment only. */
	claims_deadline?: string;
	source?: string;
}

/** Where the company stands TODAY, served ready-made. */
export interface Insolvency {
	status: InsolvencyStatus;
	/** The date of the judgment that installed it. */
	since: string;
	source?: string;
}

/** Where the data comes from, and when it was read. */
export interface Attribution {
	name: string;
	url: string;
	licence: string;
	/** When WE read the source, in ISO 8601. Not the publication date. */
	retrieved: string;
}

/** The four fields every answer of this API carries. */
export interface Envelope {
	attribution: Attribution[];
	/** Which service produced this response, as opposed to the data. */
	served_by: { name: string; url: string };
	terms: string;
	documentation: string;
	/** What the data does and does not say. */
	notice: string;
}

export interface Timeline extends Envelope {
	siren: string;
	/** The name as the gazette last published it, or null. */
	legal_name: string | null;
	/** One entry per field that has changed at least once. */
	timeline: Thread[];
	/**
	 * The insolvency judgments, most recent first.
	 *
	 * Beside `timeline` rather than inside it: a timeline entry follows the
	 * VALUE of a field, a judgment is a dated EVENT, and one field name must
	 * never mean two things.
	 */
	proceedings: Proceeding[];
	/**
	 * Where the company stands today, or null.
	 *
	 * Do NOT recompute it from `proceedings` by taking the worst one. A closure
	 * cancels a liquidation, a set-aside cancels the judgment it sets aside, and
	 * two judgments can share a date: taking the most severe would mark as
	 * liquidated a company a court put back on its feet.
	 */
	insolvency: Insolvency | null;
	coverage: {
		/** How many announcements actually describe this company. */
		announcements_read: number;
		/** False when the gazette stopped answering mid-read. */
		complete: boolean;
		earliest_possible_year: number;
	};
}

/** What the gazette published about one company since the requested date. */
export interface Change {
	/** The date of the act: the judgment, the meeting, the registration. */
	date: string;
	/** The day the gazette printed it. This is the field the window filters on. */
	published_on: string;
	/** The wording of the announcement, in French. */
	title: string;
	source?: string;
}

/** One watched company, and what happened to it. */
export interface WatchedCompany {
	siren: string;
	legal_name: string | null;
	changes: Change[];
	/**
	 * False means this list is a BEGINNING: either the gazette fell silent, or
	 * the company published more announcements in the window than one page
	 * holds. An empty list with `complete: true` means nothing happened, which
	 * is a different fact.
	 */
	complete: boolean;
}

export interface Changes extends Envelope {
	/** The date actually applied, which is not always the one you sent. */
	since: string;
	companies: WatchedCompany[];
}

/** The three natures of insolvency the barometer counts separately. */
export type InsolvencyNature = 'liquidation' | 'receivership' | 'safeguard';

export interface InsolvencyWindow {
	/** First month counted, `YYYY-MM`. */
	from: string;
	/** Last month counted. The current month is always excluded. */
	to: string;
	openings: number;
}

export interface Insolvencies extends Envelope {
	/** What was counted, and the page that shows the same figures to a human. */
	scope: {
		kind: 'country' | 'department' | 'trade';
		code: string | null;
		name: string;
		page_url: string;
	};
	/** The rolling twelve months. */
	window: InsolvencyWindow;
	/** The twelve months before, to compare against. */
	reference: InsolvencyWindow | null;
	change_percent: number | null;
	monthly: { month: string; openings: number }[];
	/**
	 * The three natures do NOT add up to the total: a judgment naming two
	 * procedures answers two filters, which overshoots by well under one percent.
	 */
	by_nature: { nature: InsolvencyNature; openings: number | null }[];
	/** Present on the national scope only. */
	by_department?: { code: string; name: string; openings: number }[];
}

/** Which slice of the country to count. Omit it for France as a whole. */
export type InsolvencyScope = { department: string } | { trade: string };

/**
 * Every recorded change for one company, plus its insolvency judgments.
 *
 * The identifier is a SIREN. Spaces, dots and dashes are accepted and removed.
 */
export declare function timeline(siren: string | number, options?: Options): Promise<Timeline>;

/** A monetary amount with its currency beside it, never announced once at the top. */
export interface Amount {
	value: number;
	currency: 'EUR';
}

/**
 * Which accounts a statement describes.
 *
 * `legal_entity` is the one company registered under this SIREN; `group` is
 * the consolidated accounts of its group. THE TWO NEVER ADD UP: a holding
 * files a revenue of zero beside a group revenue in the billions.
 */
export type Perimeter = 'legal_entity' | 'group';

/** The thirteen ratios the INPI computes. The unit is in the field name; null means it was not computed. */
export interface FinancialRatios {
	ebitda_margin_percent: number | null;
	financial_autonomy_percent: number | null;
	debt_ratio_percent: number | null;
	current_ratio: number | null;
	cash_flow_to_revenue_percent: number | null;
	debt_repayment_capacity_years: number | null;
	interest_coverage: number | null;
	working_capital_to_revenue_percent: number | null;
	working_capital_days: number | null;
	inventory_turnover_days: number | null;
	customer_credit_days: number | null;
	supplier_credit_days: number | null;
}

/** One fiscal year, as filed. */
export interface FinancialStatement {
	/** `YYYY-MM-DD`, the closing date of the fiscal year. */
	fiscal_year_end: string;
	fiscal_year: string;
	perimeter: Perimeter;
	/** Null when not published, or when the dataset carried a zero beside a non-zero net income. */
	revenue: Amount | null;
	/** Against the previous fiscal year OF THE SAME PERIMETER, to one decimal. The only computed figure. */
	revenue_change_percent: number | null;
	gross_margin: Amount | null;
	ebitda: Amount | null;
	ebit: Amount | null;
	net_income: Amount | null;
	ratios: FinancialRatios;
}

export interface Financials extends Envelope {
	siren: string;
	/** Most recent first, both perimeters mixed: `perimeter` tells them apart on every entry. */
	statements: FinancialStatement[];
	coverage: {
		statements: number;
		perimeters: Perimeter[];
		/** Always true: a confidential filing is absent, never served as zeros. */
		confidential_filings_excluded: true;
	};
}

/**
 * The annual accounts one company filed, fiscal year by fiscal year.
 *
 * Revenue, gross margin, EBITDA, EBIT, net income and the thirteen INPI ratios,
 * most recent first. Quote the `perimeter` with the figure: company-only and
 * consolidated accounts never add up. A company with no published accounts is
 * a 404 whose `type` ends in `no-financial-statements`, which is not
 * `company-not-found`.
 */
export declare function financials(siren: string | number, options?: Options): Promise<Financials>;

/**
 * What the gazette published about companies you already track.
 *
 * It takes identifiers you hold, never criteria, so it is not a search. Up to
 * twenty companies per call, and each one spends one unit of the rate limit.
 *
 * @throws RangeError when more than twenty are passed. The API would silently
 * keep twenty of them; a watch that drops companies without saying so is worse
 * than one that refuses.
 */
export declare function changes(
	siren: string | number | readonly (string | number)[],
	options?: Options & {
		/** Publication date to look back to. Defaults to thirty days ago. */
		since?: string | Date;
	}
): Promise<Changes>;

/**
 * Insolvency openings, over a rolling twelve months against the twelve before.
 *
 * Called with no scope it counts France. A department code or a trade slug must
 * be one the website already publishes as a page: an unknown one is a 404
 * rather than a query composed from what you sent.
 */
export declare function insolvencies(
	scope?: InsolvencyScope | Options,
	options?: Options
): Promise<Insolvencies>;

/** The machine-readable contract this client was written against. */
export declare function openapi(options?: Options): Promise<Record<string, unknown>>;
