// lite-embed proxy. shows the YouTube thumbnail immediately (no nested iframe, no
// cross-origin script, no storage handshake -> no white-block failure mode), then
// loads the IFrame Player API ONLY on user tap. WKWebView's third-party storage
// partitioning has a user-gesture carve-out, so the same handshake that fails on
// cold load often succeeds post-tap. if it still fails (script blocked, onError,
// 5s timeout with no onReady), the proxy swaps to a visible "Watch on YouTube"
// button that opens the system browser via target=_blank.
//
// !! CLOUDFLARE TRAP !! Cloudflare's Managed Transforms / security profiles will
// overwrite Referrer-Policy, Content-Security-Policy, X-Frame-Options, and
// Cache-Control on every response. Custom Transform Rules on /yt.html stomp them
// back. Required rules:
//   Referrer-Policy = strict-origin-when-cross-origin
//   Content-Security-Policy = (the value below)
//   X-Frame-Options = (remove)
//   Cache-Control = no-store, no-transform   (optional - belt-and-suspenders against
//                                             stale broken responses living in webview cache)

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
				font:
					14px/1.4 system-ui,
					-apple-system,
					sans-serif;
			}
			#stage {
				position: absolute;
				inset: 0;
			}
			#thumb {
				position: absolute;
				inset: 0;
				background-size: cover;
				background-position: center;
				background-color: #111;
				display: flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
				-webkit-tap-highlight-color: transparent;
			}
			#thumb::before {
				content: '';
				position: absolute;
				inset: 0;
				background: linear-gradient(180deg, transparent 40%, rgba(0, 0, 0, 0.55) 100%);
			}
			#play {
				position: relative;
				z-index: 1;
				width: 68px;
				height: 48px;
				border: none;
				background: rgba(0, 0, 0, 0.6);
				border-radius: 12px;
				display: flex;
				align-items: center;
				justify-content: center;
				transition: background 180ms ease;
				cursor: pointer;
			}
			#thumb:hover #play,
			#thumb:active #play {
				background: rgb(229, 9, 20);
			}
			#play svg {
				width: 28px;
				height: 28px;
				fill: #fff;
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
			.fallback {
				position: absolute;
				inset: 0;
				display: flex;
				flex-direction: column;
				gap: 14px;
				align-items: center;
				justify-content: center;
				color: #ddd;
				padding: 24px;
				text-align: center;
			}
			.fallback a {
				display: inline-flex;
				align-items: center;
				gap: 8px;
				padding: 12px 22px;
				border-radius: 999px;
				background: rgb(229, 9, 20);
				color: #fff;
				text-decoration: none;
				font-weight: 600;
				font-size: 15px;
			}
			.hidden {
				display: none !important;
			}
		</style>
	</head>
	<body>
		<div id="stage">
			<div
				id="thumb"
				role="button"
				aria-label="Play video"
			>
				<button
					id="play"
					aria-label="Play"
				>
					<svg
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path d="M8 5v14l11-7z" />
					</svg>
				</button>
			</div>
			<div id="player"></div>
		</div>
		<noscript>
			<div class="fallback">
				JavaScript required to play this video.
				<a
					href="https://www.youtube.com/"
					rel="noopener noreferrer"
					target="_blank"
					>Open YouTube</a
				>
			</div>
		</noscript>
		<script>
			(function () {
				var params = new URLSearchParams(window.location.search);
				var id = (params.get('v') || '').trim();
				if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
					document.body.innerHTML = '<div class="fallback">Invalid video id.</div>';
					return;
				}

				var thumb = document.getElementById('thumb');
				thumb.style.backgroundImage =
					'url("https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/hqdefault.jpg")';

				function showFallback(msg) {
					document.body.innerHTML =
						'<div class="fallback">' +
						(msg ? msg + '<br />' : '') +
						'<a href="https://www.youtube.com/watch?v=' +
						encodeURIComponent(id) +
						'" rel="noopener noreferrer" target="_blank">' +
						'<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>' +
						'Watch on YouTube</a></div>';
				}

				var readyFired = false;
				var fallbackArmed = false;
				function armFallback(msg) {
					if (fallbackArmed) return;
					fallbackArmed = true;
					showFallback(msg);
				}

				function startEmbed() {
					thumb.classList.add('hidden');

					var startRaw = params.get('start');
					var startSec = startRaw && /^\\d{1,5}$/.test(startRaw) ? parseInt(startRaw, 10) : null;

					window.onYouTubeIframeAPIReady = function () {
						try {
							var playerVars = {
								autoplay: 1,
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
									onReady: function () {
										readyFired = true;
									},
									onError: function () {
										armFallback('Player error');
									}
								}
							});
						} catch (err) {
							armFallback('Player crashed');
						}
					};

					var apiScript = document.createElement('script');
					apiScript.src = 'https://www.youtube.com/iframe_api';
					apiScript.referrerPolicy = 'strict-origin-when-cross-origin';
					apiScript.onerror = function () {
						armFallback('Player script failed to load');
					};
					document.head.appendChild(apiScript);

					// belt-and-suspenders: if the api never says onReady in 5s, swap to the
					// visible "Watch on YouTube" button so the user is never stuck on a blank
					setTimeout(function () {
						if (!readyFired && !fallbackArmed) armFallback('Player timed out');
					}, 5000);
				}

				thumb.addEventListener('click', startEmbed, { once: true });
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
