export default defineEventHandler(async (event) => {
	const sessionToken = getCookie(event, 'session_token');
	return { session_token: sessionToken || null };
});
