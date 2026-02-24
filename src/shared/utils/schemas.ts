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
	.min(8, 'Must be at least 8 characters')
	.max(100, 'Must be at most 100 characters')
	.regex(/^[a-zA-Z0-9!@#$%^&*()_+={}\[\]:;"'<>,.?\/\\|-]+$/, 'Invalid characters in password');

export const emailSchema = z
	.email('Invalid email address')
	.min(5, 'Must be at least 5 characters')
	.max(100, 'Must be at most 100 characters')
	.or(z.literal(''));

export const fullNameSchema = z
	.string()
	.min(1, 'Name cannot be empty')
	.max(100, 'Must be at most 100 characters')
	.regex(/^[a-zA-Z'-]+(\s+[a-zA-Z'-]+)*$/, 'Must be a valid full name (e.g., "John" or "John Doe")')
	.optional();

// Article Form

export const articleSchema = z.object({
	title: z
		.string()
		.min(5, 'Title must be at least 5 characters')
		.max(150, 'Title must be at most 150 characters'),
	description: z
		.string()
		.min(5, 'Description must be at least 5 characters')
		.max(512, 'Description must be at most 512 characters'),
	content: z
		.string()
		.min(20, 'Content must be at least 20 characters')
		.max(25000, 'Content must be at most 25000 characters'),
	color_hex: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/, 'Color must be a valid hex code')
});
