import vue from '@vitejs/plugin-vue';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
	plugins: [
		vue(),
		dts({
			insertTypesEntry: true,
			rollupTypes: false,
			outDir: 'lib',
			copyDtsFiles: true,
			aliasesExclude: [/^#/, /@nuxt\//],
			compilerOptions: {
				declaration: true,
				declarationMap: true
			},
			tsconfigPath: path.resolve(__dirname, 'tsconfig.lib.json'),
			include: [
				'src/lib.ts',
				'src/components/EarthCircle.vue',
				'src/composables/useActivity.ts',
				'src/composables/useArticle.ts',
				'src/composables/useConstants.ts',
				'src/composables/useLogin.ts',
				'src/composables/usePrompt.ts',
				'src/composables/useUser.ts',
				'src/shared/**/*.ts'
			],
			exclude: [
				'src/composables/useSiteTour.ts',
				'src/composables/useTurnstile.ts',
				'src/composables/useTitleSuffix.ts',
				'.nuxt/**'
			],
			afterBuild: () => {
				// Remove .nuxt directory from lib output as it contains absolute paths
				const nuxtDir = path.resolve(__dirname, 'lib/.nuxt');
				if (fs.existsSync(nuxtDir)) {
					fs.rmSync(nuxtDir, { recursive: true, force: true });
				}
			}
		})
	],
	build: {
		lib: {
			entry: path.resolve(__dirname, 'src/lib.ts'),
			name: 'crust',
			fileName: () => `crust.mjs`,
			formats: ['es']
		},
		rollupOptions: {
			external: [
				'vue',
				'vue-router',
				'#app',
				'#app/nuxt',
				'#app/composables/asyncData',
				'#app/composables/cookie',
				'#app/composables/error',
				'#app/composables/fetch',
				'#app/composables/head',
				'#app/composables/router',
				'#app/composables/state',
				'#imports',
				/@nuxt\//,
				/^#/
			],
			output: {
				inlineDynamicImports: true
			}
		},
		outDir: 'lib',
		emptyOutDir: true,
		sourcemap: true
	}
});
