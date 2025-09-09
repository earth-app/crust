import * as z from 'zod';

export const usernameSchema = z
	.string()
	.min(3, 'Must be at least 3 characters')
	.max(30, 'Must be at most 30 characters')
	.regex(
		/^[a-zA-Z0-9_.-]+$/,
		'Only alphanumeric characters, underscores, dashes, and periods are allowed'
	);

export const passwordSchema = z
	.string()
	.min(5, 'Must be at least 5 characters')
	.max(100, 'Must be at most 100 characters')
	.regex(/^[a-zA-Z0-9!@#$%^&*()_+={}\[\]:;"'<>,.?\/\\|-]+$/, 'Invalid characters in password');
