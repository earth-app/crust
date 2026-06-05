const PROXY_ORIGIN = 'https://app.earth-app.com';

const PROXY_HTML = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
		<meta name="referrer" content="strict-origin-when-cross-origin" />
		<meta name="color-scheme" content="dark light" />
		<title>Video</title>
		<style>
			html,
			body {
				margin: 0;
				padding: 0;
				background: #000;
				height: 100%;
				overflow: hidden;
			}
			#player {
				position: absolute;
				inset: 0;
				width: 100%;
				height: 100%;
			}
			#player iframe {
				width: 100%;
				height: 100%;
				border: 0;
				display: block;
			}
			.error {
				position: absolute;
				inset: 0;
				display: flex;
				flex-direction: column;
				gap: 8px;
				align-items: center;
				justify-content: center;
				color: #ddd;
				font:
					14px/1.4 system-ui,
					-apple-system,
					sans-serif;
				padding: 16px;
				text-align: center;
			}
			.error a {
				color: #6cf;
				text-decoration: underline;
			}
		</style>
	</head>
	<body>
		<div id="player"></div>
		<noscript>
			<div class="error">
				JavaScript required to load this player.
				<a href="https://www.youtube.com/" rel="noopener noreferrer" target="_blank"
					>Open on YouTube</a
				>
			</div>
		</noscript>
		<script>
			(function () {
				var params = new URLSearchParams(window.location.search);
				var id = (params.get('v') || '').trim();
				if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
					document.body.innerHTML = '<div class="error">Invalid video id.</div>';
					return;
				}

				var autoplay = params.get('autoplay') === '1' ? 1 : 0;
				var startRaw = params.get('start');
				var startSec = startRaw && /^\\d{1,5}$/.test(startRaw) ? parseInt(startRaw, 10) : null;

				function watchOnYTLink() {
					return (
						'<a href="https://www.youtube.com/watch?v=' +
						encodeURIComponent(id) +
						'" rel="noopener noreferrer" target="_blank">Watch on YouTube</a>'
					);
				}

				function fail(msg) {
					document.body.innerHTML =
						'<div class="error">' + msg + '. ' + watchOnYTLink() + '.</div>';
				}

				// IFrame Player API global hook. defined before the script loads so we don't
				// race the api callback.
				window.onYouTubeIframeAPIReady = function () {
					try {
						var playerVars = {
							autoplay: autoplay,
							controls: 1,
							rel: 0,
							modestbranding: 1,
							playsinline: 1,
							origin: '${PROXY_ORIGIN}'
						};
						if (startSec !== null) playerVars.start = startSec;

						new window.YT.Player('player', {
							videoId: id,
							host: 'https://www.youtube.com',
							playerVars: playerVars,
							events: {
								onError: function (e) {
									var code = e && e.data;
									var msg = 'Could not load this video';
									if (code === 2) msg = 'Invalid video request';
									else if (code === 5) msg = 'HTML5 player error';
									else if (code === 100) msg = 'Video not found';
									else if (code === 101 || code === 150)
										msg = 'Embedding disabled by the uploader';
									else if (code === 153) msg = 'Player configuration error';
									fail(msg);
								}
							}
						});
					} catch (err) {
						fail('Player crashed');
					}
				};

				var apiScript = document.createElement('script');
				apiScript.src = 'https://www.youtube.com/iframe_api';
				apiScript.referrerPolicy = 'strict-origin-when-cross-origin';
				apiScript.onerror = function () {
					fail('Player script failed to load');
				};
				document.head.appendChild(apiScript);

				// belt-and-suspenders: if the api never reports ready in 8s, surface a fallback
				// rather than leaving a silent white screen
				setTimeout(function () {
					var hasIframe = !!document.querySelector('#player iframe');
					var apiReady = !!(window.YT && window.YT.Player);
					if (!hasIframe && !apiReady) fail('Player timed out');
				}, 8000);
			})();
		</script>
	</body>
</html>
`;

export default defineEventHandler((event) => {
	setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8');
	setResponseHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin');
	setResponseHeader(
		event,
		'Content-Security-Policy',
		'frame-ancestors *; ' +
			"script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com; " +
			'frame-src https://www.youtube.com https://www.youtube-nocookie.com; ' +
			"img-src 'self' https://i.ytimg.com data:; " +
			"style-src 'self' 'unsafe-inline'; " +
			"default-src 'self' https://www.youtube.com"
	);
	setResponseHeader(event, 'Permissions-Policy', 'autoplay=*, fullscreen=*, picture-in-picture=*');
	setResponseHeader(event, 'Cache-Control', 'public, max-age=300');
	return PROXY_HTML;
});
