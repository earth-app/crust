const allowedOrigins = [
	'https://app.earth-app.com',
	'https://earth-app.com',
	'https://api.earth-app.com',
	'https://cloud.earth-app.com',
	'capacitor://localhost', // ios
	'http://localhost', // android
	'http://localhost:3000',
	'http://127.0.0.1:3000',
	'http://localhost:3001',
	'http://127.0.0.1:3001'
];

export default defineEventHandler((event) => {
	if (!event.path.startsWith('/api/')) {
		return;
	}

	const origin = getRequestHeader(event, 'origin');

	if (origin && allowedOrigins.includes(origin)) {
		setResponseHeader(event, 'Access-Control-Allow-Origin', origin);
	} else {
		setResponseHeader(event, 'Access-Control-Allow-Origin', 'https://app.earth-app.com');
	}

	setResponseHeader(
		event,
		'Access-Control-Allow-Methods',
		'GET, POST, PUT, PATCH, DELETE, OPTIONS'
	);
	setResponseHeader(
		event,
		'Access-Control-Allow-Headers',
		'Authorization, Content-Type, X-Requested-With, Accept'
	);
	setResponseHeader(event, 'Access-Control-Allow-Credentials', 'true');

	setResponseHeader(event, 'Vary', 'Accept-Encoding, Origin');

	if (event.method === 'OPTIONS') {
		setResponseStatus(event, 200);
		return '';
	}
});
