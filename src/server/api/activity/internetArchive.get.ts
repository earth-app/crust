import {
	constructIASearch,
	detectFileFormat,
	fetchWithRetry,
	isFilePubliclyAccessible
} from '~/server/utils';
import {
	InternetArchiveItem,
	InternetArchiveMetadata,
	InternetArchiveSearch
} from '~/shared/types/activity';

type ValidMetadataResult = {
	doc: InternetArchiveSearch['response']['docs'][number];
	metadata: InternetArchiveMetadata['metadata'];
	files: NonNullable<InternetArchiveMetadata['files']>;
	open: boolean;
};

type MetadataResult =
	| ValidMetadataResult
	| { doc: InternetArchiveSearch['response']['docs'][number]; metadata: null };

async function fetchMetadataWithConcurrency(
	docs: InternetArchiveSearch['response']['docs'],
	concurrencyLimit: number
): Promise<MetadataResult[]> {
	const results: MetadataResult[] = [];
	const executing = new Set<Promise<void>>();

	for (const doc of docs) {
		const task = fetchMetadataForDoc(doc).then((result) => {
			results.push(result);
			executing.delete(task);
		});

		executing.add(task);

		if (executing.size >= concurrencyLimit) {
			await Promise.race(executing);
		}
	}

	await Promise.all(executing);
	return results;
}

async function fetchMetadataForDoc(
	doc: InternetArchiveSearch['response']['docs'][number]
): Promise<MetadataResult> {
	try {
		const metadataUrl = `https://archive.org/metadata/${doc.identifier}`;
		const metadataResponse = await fetchWithRetry<InternetArchiveMetadata>(metadataUrl, {
			headers: {
				'User-Agent': 'The Earth App/Web (https://earth-app.com)'
			}
		});

		if (!metadataResponse?.files || !Array.isArray(metadataResponse.files)) {
			return { doc, metadata: null };
		}

		// filter out private files and metadata files
		const files = metadataResponse.files.filter(
			(file) =>
				isFilePubliclyAccessible(file.private) &&
				file.format !== 'Metadata' &&
				file.format !== 'Item Tile'
		);

		if (files.length === 0) {
			return { doc, metadata: null };
		}

		const isAccessRestricted = metadataResponse.metadata?.['access-restricted-item'] === true;

		return {
			doc,
			metadata: metadataResponse.metadata,
			files,
			open: !isAccessRestricted
		};
	} catch (error) {
		console.error(`Failed to fetch metadata for ${doc.identifier}:`, error);
		return { doc, metadata: null };
	}
}

export default defineEventHandler(async (event) => {
	const { query, page, languages } = getQuery(event);

	if (typeof query !== 'string' || query.trim() === '') {
		throw createError({
			statusCode: 400,
			message: 'Query must be a non-empty string'
		});
	}

	const queries = query
		.split(',')
		.map((q) => q.trim())
		.filter((q) => q.length > 0);
	if (queries.length === 0) {
		throw createError({
			statusCode: 400,
			message: 'Query must contain at least one non-empty term'
		});
	}

	if (typeof page !== 'undefined' && (isNaN(Number(page)) || Number(page) < 1)) {
		throw createError({
			statusCode: 400,
			message: 'Invalid page number'
		});
	}

	const page0 = page ? Number(page) : 1;

	if (languages && Array.isArray(languages) && languages.some((l) => typeof l !== 'string')) {
		throw createError({
			statusCode: 400,
			message: 'Languages must be an array of strings'
		});
	}

	const languages0 = languages
		? Array.isArray(languages)
			? languages
			: [languages]
		: ['en', 'eng', 'English'];

	// First, perform search with retry logic
	const searchUrl = constructIASearch(query, languages0, page0);
	let searchResponse: InternetArchiveSearch;
	try {
		searchResponse = await fetchWithRetry<InternetArchiveSearch>(searchUrl, {
			headers: {
				'User-Agent': 'The Earth App/Web (https://earth-app.com)'
			}
		});
	} catch (error) {
		console.warn('Internet Archive search unavailable; returning empty result set.', error);
		return {
			items: [],
			page: page0,
			hasMore: false,
			total: 0
		};
	}

	if (!searchResponse.response?.docs || searchResponse.response.docs.length === 0) {
		return {
			items: [],
			page: page0,
			hasMore: false,
			total: 0
		};
	}

	// Then, get metadata for each result with concurrency limit
	const resultsWithMetadata = await fetchMetadataWithConcurrency(
		searchResponse.response.docs,
		5 // Limit to 5 concurrent requests
	);

	// Filter out invalid results (null metadata or no accessible files)
	const validResults = resultsWithMetadata.filter(
		(result): result is ValidMetadataResult =>
			result.metadata !== null && result.files && result.files.length > 0 && result.open
	);

	// Map to final response format
	const items = validResults.map((result) => {
		const mDesc = result.metadata.description || result.doc.description;
		const description = Array.isArray(mDesc) ? mDesc.join('\n') : mDesc || '';

		return {
			identifier: result.metadata.identifier,
			title: result.doc.title || 'Untitled',
			description,
			type: result.doc.mediatype,
			creator: result.doc.creator || 'Unknown',
			uploader: result.metadata.uploader || 'Unknown',
			date: result.doc.date || 'Unknown',
			files: result.files.map((file) => ({
				url: `https://archive.org/download/${result.doc.identifier}/${file.name}`,
				format: detectFileFormat(file.name, file.format)
			}))
		} satisfies InternetArchiveItem;
	});

	return {
		items,
		page: page0,
		hasMore: page0 * 20 < searchResponse.response.numFound,
		total: searchResponse.response.numFound
	};
});
