const PROXY_HTML = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
		<meta name="referrer" content="origin" />
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
			.frame {
				position: absolute;
				inset: 0;
			}
			.frame iframe {
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
		<div id="frame" class="frame"></div>
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

				var autoplay = params.get('autoplay') === '1' ? '1' : '0';
				var start = params.get('start');
				var startParam =
					start && /^\\d{1,5}$/.test(start)
						? '&start=' + encodeURIComponent(start)
						: '';

				var src =
					'https://www.youtube-nocookie.com/embed/' +
					encodeURIComponent(id) +
					'?autoplay=' +
					autoplay +
					'&playsinline=1&modestbranding=1&rel=0&controls=1' +
					startParam;

				var iframe = document.createElement('iframe');
				iframe.src = src;
				iframe.title = 'YouTube video';
				iframe.allow =
					'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
				iframe.allowFullscreen = true;
				iframe.setAttribute('referrerpolicy', 'origin');
				iframe.setAttribute('loading', 'eager');
				iframe.setAttribute('frameborder', '0');

				iframe.addEventListener('error', function () {
					document.body.innerHTML =
						'<div class="error">Couldn\\u2019t load this video. <a href="https://www.youtube.com/watch?v=' +
						encodeURIComponent(id) +
						'" rel="noopener noreferrer" target="_blank">Watch on YouTube</a>.</div>';
				});

				document.getElementById('frame').appendChild(iframe);
			})();
		</script>
	</body>
</html>
`;

export default defineEventHandler((event) => {
	setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8');
	setResponseHeader(event, 'Content-Security-Policy', 'frame-ancestors *');
	setResponseHeader(event, 'X-Frame-Options', 'ALLOWALL');
	setResponseHeader(event, 'Cache-Control', 'public, max-age=300');
	return PROXY_HTML;
});
