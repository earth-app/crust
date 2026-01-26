import type { com } from '@earth-app/ocean';
import type { Activity } from './activity';
import type { User } from './user';

export type EventType = 'IN_PERSON' | 'HYBRID' | 'ONLINE';

export type EventActivity =
	| {
			type: 'activity_type';
			value: typeof com.earthapp.activity.ActivityType.prototype.name;
	  }
	| ({
			type: 'activity';
	  } & Activity);

export type Event = {
	id: string;
	hostId: string;
	host: User;
	name: string;
	description: string;
	type: EventType;
	activities: EventActivity[];
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
	fields?: Record<string, any>;
};

export type EventData = Omit<
	Event,
	| 'id'
	| 'host'
	| 'hostId'
	| 'attendee_count'
	| 'is_attending'
	| 'created_at'
	| 'updated_at'
	| 'can_edit'
	| 'activities'
> & { activities: (string | typeof com.earthapp.activity.ActivityType.prototype.name)[] };

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
	types: string[];
};
