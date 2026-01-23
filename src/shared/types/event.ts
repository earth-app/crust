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
	date: number;
	end_date?: number;
	visibility: typeof com.earthapp.Visibility.prototype.name;
	attendee_count: number;
	is_attending: boolean;
	can_edit: boolean;
	created_at: string;
	updated_at?: string;
};

export type EventData = Omit<
	Event,
	'id' | 'host' | 'attendee_count' | 'is_attending' | 'created_at' | 'updated_at'
>;

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
