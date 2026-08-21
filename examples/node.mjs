// auregistre - What changed in a French company, and when.
// npm install auregistre, then: node examples/node.mjs

import { timeline, changes, insolvencies, ApiError } from 'auregistre';

const doctolib = await timeline('794 598 813');

// Doctolib. Its share capital has moved more than fifty times.
for (const thread of doctolib.timeline) {
	console.log(`${thread.label}: ${thread.changes} change(s)`);
	console.log(`  first known  ${thread.first_known.date}  ${thread.first_known.value}`);
	console.log(`  today        ${thread.current.date}  ${thread.current.value}`);
}

// Where it stands under insolvency law, or null. Served ready-made on purpose:
// taking the most severe entry of .proceedings would mark as liquidated a
// company a court put back on its feet.
console.log(doctolib.insolvency ?? 'no insolvency proceeding on record');

// A watch over companies you already track. It takes identifiers, never
// criteria, so it is not a search.
const watch = await changes(['794598813', '552032534'], { since: '2026-06-01' });
for (const company of watch.companies) {
	// complete: false means the list is a BEGINNING, not that nothing happened.
	console.log(company.legal_name, company.changes.length, company.complete);
}

// Insolvency openings: France, then one department, then one trade.
try {
	const france = await insolvencies();
	console.log(france.window.openings, 'openings', `(${france.change_percent}%)`);
	console.log(await insolvencies({ department: '75' }).then((d) => d.scope.name));
	console.log(await insolvencies({ trade: 'restauration' }).then((t) => t.window.openings));
} catch (error) {
	if (error instanceof ApiError) console.error(error.status, error.title, error.detail);
	else throw error;
}

// What the data does not say travels with it.
console.log(doctolib.notice);
