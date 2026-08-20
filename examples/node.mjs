// auregistre - What changed in a French company, and when.
// npm install auregistre, then: node examples/node.mjs

import { timeline, ApiError } from 'auregistre';

// Doctolib. Its share capital has moved more than fifty times.
try {
	const company = await timeline('794 598 813');
	console.log(company.legal_name);
	for (const thread of company.timeline) {
		console.log(`${thread.label}: ${thread.changes} change(s)`);
		console.log(`  first known  ${thread.first_known.date}  ${thread.first_known.value}`);
		console.log(`  today        ${thread.current.date}  ${thread.current.value}`);
	}
	// What the data does not say travels with it.
	console.log(company.notice);
} catch (error) {
	if (error instanceof ApiError) console.error(error.status, error.title, error.detail);
	else throw error;
}
