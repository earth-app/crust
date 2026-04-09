import type { com } from '@earth-app/ocean';

export type Activity = {
	id: string;
	name: string;
	description: string;
	types: (typeof com.earthapp.activity.ActivityType.prototype.name)[];
	aliases: string[];
	created_at?: string;
	updated_at?: string;
	fields: Record<string, string>;
};

export type WikipediaSummary = {
	type: string;
	title: string;
	description: string;
	extract: string;
	originalimage?: {
		source: string;
		width: number;
		height: number;
	};
	titles: {
		canonical: string;
	};
	pageid: number;
	summarySnippet?: string;
};

export type YouTubeVideo = {
	id: string;
	title: string;
	uploaded_at: string;
};

export type PixabayImage = {
	user: string;
	type: 'photo' | 'illustration' | 'vector';
	pageURL: string;
	tags: string;
	webformatURL: string;
};

export type PixabayVideo = {
	user: string;
	type: 'film' | 'animation';
	pageURL: string;
	tags: string;
	videos: {
		large: PiaxbayVideoVariant;
		medium: PiaxbayVideoVariant;
		small: PiaxbayVideoVariant;
		tiny: PiaxbayVideoVariant;
	};
};

export type PiaxbayVideoVariant = {
	url: string;
	width: number;
	height: number;
	thumbnail: string;
};

export type InternetArchiveSearch = {
	response: {
		numFound: number;
		docs: {
			creator: string;
			date: string;
			title: string;
			description: string | string[];
			identifier: string;
			mediatype: 'audio' | 'image' | 'texts' | 'movies';
		}[];
	};
};

export type InternetArchiveMetadata = {
	files: {
		name: string;
		source: 'original' | 'derivative' | string;
		format: 'Metadata' | 'Item Tile' | 'Text PDF' | 'Abbyy GZ' | 'chOCR' | 'hOCR' | string;
		private?: 'true' | 'false';
	}[];
	files_count: number;
	metadata: {
		identifier: string;
		description: string | string[];
		subject: string | string[];
		creator: string;
		uploader: string;
		'access-restricted-item'?: boolean;
	};
};

export type InternetArchiveItem = {
	identifier: string;
	title: string;
	creator: string;
	uploader: string;
	date: string; // ISO string
	description: string;
	type: InternetArchiveSearch['response']['docs'][number]['mediatype'];
	files: {
		url: string;
		format:
			| 'pdf'
			| 'txt'
			| 'epub'
			// image formats
			| 'png'
			| 'jpg'
			| 'gif'
			| 'webp'
			| 'tiff'
			| 'bmp'
			// audio formats
			| 'mp3'
			| 'ogg'
			| 'flac'
			| 'm4a'
			| 'wav'
			| 'aac'
			// video formats
			| 'mp4'
			| 'avi'
			| 'm4v'
			| 'mkv'
			| 'mov'
			| 'flv'
			| 'webm'
			// generic types
			| 'audio'
			| 'image'
			| 'video'
			| string;
	}[];
};

export type UnsplashImage = {
	id: string;
	created_at: string;
	updated_at: string;
	width: number;
	height: number;
	color: string;
	description: string;
	alt_description: string;
	urls: {
		raw: string;
		full: string;
		regular: string;
		small: string;
		thumb: string;
	};
	links: {
		self: string;
		html: string;
	};
	user: {
		id: string;
		username: string;
		name: string;
	};
};
