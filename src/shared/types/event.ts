import type { com } from '@earth-app/ocean';
import type { User } from './user';

export type EventType = 'IN_PERSON' | 'HYBRID' | 'ONLINE';

export type Event = {
	id: string;
	hostId: string;
	host: User;
	name: string;
	description: string;
	type: EventType;
	activities: string[];
	location: {
		latitude: number;
		longitude: number;
	};
	date: string;
	end_date?: string;
	visibility: typeof com.earthapp.Visibility.prototype.name;
	attendee_count: number;
	is_attending: boolean;
	created_at: string;
	updated_at?: string;
};

export type EventData = {
	name: string;
	description?: string;
	type: EventType;
	activities: string[];
	location?: {
		latitude: number;
		longitude: number;
	};
	date: number;
	end_date?: number;
	visibility: typeof com.earthapp.Visibility.prototype.name;
};

export type RawEventAutocompleteSuggestion = {
	place?: string;
	placeId?: string;
	text: {
		text: string;
		matches: {
			startOffset?: number;
			endOffset: number;
		}[];
	};
	structuredFormat?: {
		mainText: {
			text: string;
			matches: {
				startOffset?: number;
				endOffset: number;
			}[];
		};
		secondaryText: {
			text: string;
		};
	};
	types: string[];
	distanceMeters?: number;
};

export type EventAutocompleteSuggestion = {
	name: string;
	full_name: string;
	place_id?: string;
	address?: string;
	distance_meters?: number;
};
