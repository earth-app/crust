export type ContentType =
	| 'prompt'
	| 'prompt_response'
	| 'article'
	| 'event'
	| 'event_image'
	| 'user';

export type ReportReason =
	| 'hate_speech'
	| 'harassment'
	| 'sexual'
	| 'violence'
	| 'spam'
	| 'misinformation'
	| 'self_harm'
	| 'illegal'
	| 'other';

export type ReportStatus = 'pending' | 'dismissed' | 'actioned' | 'auto_removed' | 'expired';

export type ReportSource = 'user' | 'ai';

export type Report = {
	id: string;
	content_type: ContentType;
	content_id: string;
	parent_id?: string;
	content_owner_id?: string;
	reason: ReportReason;
	description?: string;
	reporter_id?: string;
	reporter_ip_hash?: string;
	source: ReportSource;
	ai?: {
		model: string;
		confidence: number;
		labels: string[];
	};
	status: ReportStatus;
	report_count: number;
	created_at: number;
	updated_at: number;
	reviewed_by?: string;
	reviewed_at?: number;
	action_notes?: string;
};

// hydrated admin list item: report plus server-resolved preview + usernames
export type ReportListItem = Report & {
	content_preview: string;
	reporter_username: string | null;
	author_username: string | null;
};

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
	{ value: 'hate_speech', label: 'Hate speech / slurs' },
	{ value: 'harassment', label: 'Harassment or bullying' },
	{ value: 'sexual', label: 'Sexual or pornographic' },
	{ value: 'violence', label: 'Violence or threats' },
	{ value: 'spam', label: 'Spam or scam' },
	{ value: 'misinformation', label: 'Misinformation' },
	{ value: 'self_harm', label: 'Self-harm' },
	{ value: 'illegal', label: 'Illegal or dangerous' },
	{ value: 'other', label: 'Other' }
];

export function reportReasonLabel(reason: ReportReason): string {
	return REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
}
