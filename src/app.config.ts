export default defineAppConfig({
	name: 'The Earth App',
	description: 'Explore with real people',
	themeColor: '#174f96',
	mobile: {
		getTheAppUrl: 'https://earth-app.com/get-the-app'
	},
	ui: {
		/* the single highest-leverage knob in the repo: every text-muted / bg-elevated /
		   border-default / neutral-* and every role utility resolves through here.
		   `neutral` deliberately does NOT go in nuxt.config's ui.theme.colors -- @nuxt/ui appends
		   it unconditionally, and listing it there emits --color-neutral: var(--ui-neutral),
		   which the colors plugin never generates, silently emptying bg-neutral/text-neutral.
		   every non-tailwind name here (brand, azure, danger, warning, ink) must be declared in
		   `@theme static` in main.css or tailwind tree-shakes it and the colour resolves EMPTY */
		colors: {
			primary: 'brand',
			// secondary carries the navbar chrome, info carries informational marks; they share the
			// azure hue and separate by shade, which is how the system varies L within one H
			secondary: 'azure',
			info: 'azure',
			tertiary: 'purple',
			success: 'brand',
			warning: 'warning',
			error: 'danger',
			neutral: 'ink'
		}
	}
});
