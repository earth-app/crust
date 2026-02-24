export const useTitleSuffix = () => {
	const appConfig = useAppConfig();
	const suffix = useState<string>('titleSuffix', () => '');

	const setTitleSuffix = (s: string | null | undefined) => {
		const safeSuffix = s || '';
		suffix.value = safeSuffix;
		useHead({
			titleTemplate: (title) => {
				const clean = safeSuffix.trim();
				return title ? `${title} | ${clean}` : clean;
			},
			meta: [
				{
					name: 'og:title',
					content: () => {
						return suffix.value ? `${suffix.value} | ${appConfig.name}` : appConfig.name;
					}
				}
			]
		});
	};

	return { setTitleSuffix, suffix };
};
