import { SITE_NAME } from './useConstants';

export const useTitleSuffix = () => {
	const suffix = useState<string>('titleSuffix', () => '');

	const setTitleSuffix = (s: string) => {
		suffix.value = s;
		useHead({
			titleTemplate: (title) => {
				const clean = s.trim();
				return title ? `${title} | ${clean}` : clean;
			},
			meta: [
				{
					name: 'og:title',
					content: () => {
						return suffix.value ? `${suffix.value} | ${SITE_NAME}` : SITE_NAME;
					}
				}
			]
		});
	};

	return { setTitleSuffix, suffix };
};
