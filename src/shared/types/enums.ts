// #region visibility
export const VISIBILITY = ['PRIVATE', 'UNLISTED', 'PUBLIC'] as const;

export type Visibility = (typeof VISIBILITY)[number];

// #endregion

// #region account

export const ACCOUNT_TYPE = ['FREE', 'PRO', 'WRITER', 'ORGANIZER', 'ADMINISTRATOR'] as const;

export type AccountType = (typeof ACCOUNT_TYPE)[number];

export const PRIVACY = ['PRIVATE', 'CIRCLE', 'MUTUAL', 'PUBLIC'] as const;

export type Privacy = (typeof PRIVACY)[number];

export const COUNTRY = [
	'INTERNATIONAL',
	'UNITED_STATES',
	'AFGHANISTAN',
	'ALBANIA',
	'ALGERIA',
	'ANDORRA',
	'ANGOLA',
	'ANTIGUA_AND_BARBUDA',
	'ARGENTINA',
	'ARMENIA',
	'AUSTRALIA',
	'AUSTRIA',
	'AZERBAIJAN',
	'BAHAMAS',
	'BAHRAIN',
	'BANGLADESH',
	'BARBADOS',
	'BELARUS',
	'BELGIUM',
	'BELIZE',
	'BENIN',
	'BHUTAN',
	'BOLIVIA',
	'BOSNIA_AND_HERZEGOVINA',
	'BOTSWANA',
	'BRAZIL',
	'BRUNEI',
	'BULGARIA',
	'BURKINA_FASO',
	'BURUNDI',
	'CABO_VERDE',
	'CAMBODIA',
	'CAMEROON',
	'CANADA',
	'CENTRAL_AFRICAN_REPUBLIC',
	'CHAD',
	'CHILE',
	'CHINA',
	'COLOMBIA',
	'COMOROS',
	'CONGO',
	'COSTA_RICA',
	'CROATIA',
	'CUBA',
	'CYPRUS',
	'CZECH_REPUBLIC',
	'DEMOCRATIC_REPUBLIC_OF_THE_CONGO',
	'DENMARK',
	'DJIBOUTI',
	'DOMINICA',
	'DOMINICAN_REPUBLIC',
	'ECUADOR',
	'EGYPT',
	'EL_SALVADOR',
	'EQUATORIAL_GUINEA',
	'ERITREA',
	'ESTONIA',
	'ESWATINI',
	'ETHIOPIA',
	'FIJI',
	'FINLAND',
	'FRANCE',
	'GABON',
	'GAMBIA',
	'GEORGIA',
	'GERMANY',
	'GHANA',
	'GREECE',
	'GRENADA',
	'GUATEMALA',
	'GUINEA',
	'GUINEA_BISSAU',
	'GUYANA',
	'HAITI',
	'HONDURAS',
	'HUNGARY',
	'ICELAND',
	'INDIA',
	'INDONESIA',
	'IRAN',
	'IRAQ',
	'IRELAND',
	'ISRAEL',
	'ITALY',
	'IVORY_COAST',
	'JAMAICA',
	'JAPAN',
	'JORDAN',
	'KAZAKHSTAN',
	'KENYA',
	'KIRIBATI',
	'KUWAIT',
	'KYRGYZSTAN',
	'LAOS',
	'LATVIA',
	'LEBANON',
	'LESOTHO',
	'LIBERIA',
	'LIBYA',
	'LIECHTENSTEIN',
	'LITHUANIA',
	'LUXEMBOURG',
	'MADAGASCAR',
	'MALAWI',
	'MALAYSIA',
	'MALDIVES',
	'MALI',
	'MALTA',
	'MARSHALL_ISLANDS',
	'MAURITANIA',
	'MAURITIUS',
	'MEXICO',
	'MICRONESIA',
	'MOLDOVA',
	'MONACO',
	'MONGOLIA',
	'MONTENEGRO',
	'MOROCCO',
	'MOZAMBIQUE',
	'MYANMAR',
	'NAMIBIA',
	'NAURU',
	'NEPAL',
	'NETHERLANDS',
	'NEW_ZEALAND',
	'NICARAGUA',
	'NIGER',
	'NIGERIA',
	'NORTH_MACEDONIA',
	'NORWAY',
	'OMAN',
	'PAKISTAN',
	'PALAU',
	'PANAMA',
	'PAPUA_NEW_GUINEA',
	'PARAGUAY',
	'PERU',
	'PHILIPPINES',
	'POLAND',
	'PORTUGAL',
	'QATAR',
	'ROMANIA',
	'RUSSIA',
	'RWANDA',
	'SAINT_KITTS_AND_NEVIS',
	'SAINT_LUCIA',
	'SAINT_VINCENT_AND_THE_GRENADINES',
	'SAMOA',
	'SAN_MARINO',
	'SAO_TOME_AND_PRINCIPE',
	'SAUDI_ARABIA',
	'SENEGAL',
	'SERBIA',
	'SEYCHELLES',
	'SIERRA_LEONE',
	'SINGAPORE',
	'SLOVAKIA',
	'SLOVENIA',
	'SOLOMON_ISLANDS',
	'SOMALIA',
	'SOUTH_AFRICA',
	'SOUTH_KOREA',
	'SOUTH_SUDAN',
	'SPAIN',
	'SRI_LANKA',
	'SUDAN',
	'SURINAME',
	'SWEDEN',
	'SWITZERLAND',
	'SYRIA',
	'TAIWAN',
	'TAJIKISTAN',
	'TANZANIA',
	'THAILAND',
	'TIMOR_LESTE',
	'TOGO',
	'TONGA',
	'TRINIDAD_AND_TOBAGO',
	'TUNISIA',
	'TURKEY',
	'TURKMENISTAN',
	'TUVALU',
	'UGANDA',
	'UKRAINE',
	'UNITED_ARAB_EMIRATES',
	'UNITED_KINGDOM',
	'URUGUAY',
	'UZBEKISTAN',
	'VANUATU',
	'VATICAN_CITY',
	'VENEZUELA',
	'VIETNAM',
	'YEMEN',
	'ZAMBIA',
	'ZIMBABWE'
] as const;

export type Country = (typeof COUNTRY)[number];

// #endregion

// #region activity

export const ACTIVITY_TYPE = [
	'HOBBY',
	'SPORT',
	'WORK',
	'STUDY',
	'TRAVEL',
	'SOCIAL',
	'RELAXATION',
	'HEALTH',
	'PROJECT',
	'PERSONAL_GOAL',
	'COMMUNITY_SERVICE',
	'CREATIVE',
	'FAMILY',
	'HOLIDAY',
	'ENTERTAINMENT',
	'LEARNING',
	'NATURE',
	'TECHNOLOGY',
	'ART',
	'SPIRITUALITY',
	'FINANCE',
	'HOME_IMPROVEMENT',
	'PETS',
	'FASHION',
	'OTHER'
] as const;

export type ActivityType = (typeof ACTIVITY_TYPE)[number];

// #endregion

// #region guards

/**
 * Narrow an unknown value to one of `values`, or fall back.
 *
 * Replaces ocean's `Enum.valueOf(string)`, which THREW on an unknown name. The backend can add an
 * enum member before the frontend ships, so a hard throw there takes a page down over a value it
 * simply has not heard of yet; falling back keeps the surface rendering.
 *
 * @param values the allowed set
 * @param value candidate, usually straight off the wire
 * @param fallback returned when the candidate is not a member
 */
function coerce<T extends string>(values: readonly T[], value: unknown, fallback: T): T {
	return typeof value === 'string' && (values as readonly string[]).includes(value)
		? (value as T)
		: fallback;
}

export const isVisibility = (v: unknown): v is Visibility =>
	typeof v === 'string' && (VISIBILITY as readonly string[]).includes(v);

export const toVisibility = (v: unknown, fallback: Visibility = 'PUBLIC'): Visibility =>
	coerce(VISIBILITY, v, fallback);

export const isAccountType = (v: unknown): v is AccountType =>
	typeof v === 'string' && (ACCOUNT_TYPE as readonly string[]).includes(v);

export const toAccountType = (v: unknown, fallback: AccountType = 'FREE'): AccountType =>
	coerce(ACCOUNT_TYPE, v, fallback);

export const isPrivacy = (v: unknown): v is Privacy =>
	typeof v === 'string' && (PRIVACY as readonly string[]).includes(v);

export const toPrivacy = (v: unknown, fallback: Privacy = 'PRIVATE'): Privacy =>
	coerce(PRIVACY, v, fallback);

export const isActivityType = (v: unknown): v is ActivityType =>
	typeof v === 'string' && (ACTIVITY_TYPE as readonly string[]).includes(v);

export const toActivityType = (v: unknown, fallback: ActivityType = 'OTHER'): ActivityType =>
	coerce(ACTIVITY_TYPE, v, fallback);

export const isCountry = (v: unknown): v is Country =>
	typeof v === 'string' && (COUNTRY as readonly string[]).includes(v);

export const toCountry = (v: unknown, fallback: Country = 'INTERNATIONAL'): Country =>
	coerce(COUNTRY, v, fallback);

// #endregion

// #region country data

/**
 * Full country table, not just the names -- the profile editor renders `countryName`, `code` and
 * `flagEmoji`, so a bare string list would not have been enough. Generated from ocean's runtime.
 *
 * `INTERNATIONAL` deliberately carries an empty `code`; the editor disables it on that basis.
 */
export type CountryInfo = {
	name: Country;
	countryName: string;
	code: string;
	locale: string;
	flagEmoji: string;
	phonePrefix: string;
};

export const COUNTRIES: readonly CountryInfo[] = [
	{
		name: 'INTERNATIONAL',
		countryName: 'International',
		code: '',
		locale: 'en-INT',
		flagEmoji: '🌐',
		phonePrefix: '+0'
	},
	{
		name: 'UNITED_STATES',
		countryName: 'United States',
		code: 'US',
		locale: 'en-US',
		flagEmoji: '🇺🇸',
		phonePrefix: '+1'
	},
	{
		name: 'AFGHANISTAN',
		countryName: 'Afghanistan',
		code: 'AF',
		locale: 'fa-AF',
		flagEmoji: '🇦🇫',
		phonePrefix: '+93'
	},
	{
		name: 'ALBANIA',
		countryName: 'Albania',
		code: 'AL',
		locale: 'sq-AL',
		flagEmoji: '🇦🇱',
		phonePrefix: '+355'
	},
	{
		name: 'ALGERIA',
		countryName: 'Algeria',
		code: 'DZ',
		locale: 'ar-DZ',
		flagEmoji: '🇩🇿',
		phonePrefix: '+213'
	},
	{
		name: 'ANDORRA',
		countryName: 'Andorra',
		code: 'AD',
		locale: 'ca-AD',
		flagEmoji: '🇦🇩',
		phonePrefix: '+376'
	},
	{
		name: 'ANGOLA',
		countryName: 'Angola',
		code: 'AO',
		locale: 'pt-AO',
		flagEmoji: '🇦🇴',
		phonePrefix: '+244'
	},
	{
		name: 'ANTIGUA_AND_BARBUDA',
		countryName: 'Antigua and Barbuda',
		code: 'AG',
		locale: 'en-AG',
		flagEmoji: '🇦🇬',
		phonePrefix: '+1'
	},
	{
		name: 'ARGENTINA',
		countryName: 'Argentina',
		code: 'AR',
		locale: 'es-AR',
		flagEmoji: '🇦🇷',
		phonePrefix: '+54'
	},
	{
		name: 'ARMENIA',
		countryName: 'Armenia',
		code: 'AM',
		locale: 'hy-AM',
		flagEmoji: '🇦🇲',
		phonePrefix: '+374'
	},
	{
		name: 'AUSTRALIA',
		countryName: 'Australia',
		code: 'AU',
		locale: 'en-AU',
		flagEmoji: '🇦🇺',
		phonePrefix: '+61'
	},
	{
		name: 'AUSTRIA',
		countryName: 'Austria',
		code: 'AT',
		locale: 'de-AT',
		flagEmoji: '🇦🇹',
		phonePrefix: '+43'
	},
	{
		name: 'AZERBAIJAN',
		countryName: 'Azerbaijan',
		code: 'AZ',
		locale: 'az-AZ',
		flagEmoji: '🇦🇿',
		phonePrefix: '+994'
	},
	{
		name: 'BAHAMAS',
		countryName: 'Bahamas',
		code: 'BS',
		locale: 'en-BS',
		flagEmoji: '🇧🇸',
		phonePrefix: '+1'
	},
	{
		name: 'BAHRAIN',
		countryName: 'Bahrain',
		code: 'BH',
		locale: 'ar-BH',
		flagEmoji: '🇧🇭',
		phonePrefix: '+973'
	},
	{
		name: 'BANGLADESH',
		countryName: 'Bangladesh',
		code: 'BD',
		locale: 'bn-BD',
		flagEmoji: '🇧🇩',
		phonePrefix: '+880'
	},
	{
		name: 'BARBADOS',
		countryName: 'Barbados',
		code: 'BB',
		locale: 'en-BB',
		flagEmoji: '🇧🇧',
		phonePrefix: '+1'
	},
	{
		name: 'BELARUS',
		countryName: 'Belarus',
		code: 'BY',
		locale: 'be-BY',
		flagEmoji: '🇧🇾',
		phonePrefix: '+375'
	},
	{
		name: 'BELGIUM',
		countryName: 'Belgium',
		code: 'BE',
		locale: 'nl-BE',
		flagEmoji: '🇧🇪',
		phonePrefix: '+32'
	},
	{
		name: 'BELIZE',
		countryName: 'Belize',
		code: 'BZ',
		locale: 'en-BZ',
		flagEmoji: '🇧🇿',
		phonePrefix: '+501'
	},
	{
		name: 'BENIN',
		countryName: 'Benin',
		code: 'BJ',
		locale: 'fr-BJ',
		flagEmoji: '🇧🇯',
		phonePrefix: '+229'
	},
	{
		name: 'BHUTAN',
		countryName: 'Bhutan',
		code: 'BT',
		locale: 'dz-BT',
		flagEmoji: '🇧🇹',
		phonePrefix: '+975'
	},
	{
		name: 'BOLIVIA',
		countryName: 'Bolivia',
		code: 'BO',
		locale: 'es-BO',
		flagEmoji: '🇧🇴',
		phonePrefix: '+591'
	},
	{
		name: 'BOSNIA_AND_HERZEGOVINA',
		countryName: 'Bosnia and Herzegovina',
		code: 'BA',
		locale: 'bs-BA',
		flagEmoji: '🇧🇦',
		phonePrefix: '+387'
	},
	{
		name: 'BOTSWANA',
		countryName: 'Botswana',
		code: 'BW',
		locale: 'en-BW',
		flagEmoji: '🇧🇼',
		phonePrefix: '+267'
	},
	{
		name: 'BRAZIL',
		countryName: 'Brazil',
		code: 'BR',
		locale: 'pt-BR',
		flagEmoji: '🇧🇷',
		phonePrefix: '+55'
	},
	{
		name: 'BRUNEI',
		countryName: 'Brunei',
		code: 'BN',
		locale: 'ms-BN',
		flagEmoji: '🇧🇳',
		phonePrefix: '+673'
	},
	{
		name: 'BULGARIA',
		countryName: 'Bulgaria',
		code: 'BG',
		locale: 'bg-BG',
		flagEmoji: '🇧🇬',
		phonePrefix: '+359'
	},
	{
		name: 'BURKINA_FASO',
		countryName: 'Burkina Faso',
		code: 'BF',
		locale: 'fr-BF',
		flagEmoji: '🇧🇫',
		phonePrefix: '+226'
	},
	{
		name: 'BURUNDI',
		countryName: 'Burundi',
		code: 'BI',
		locale: 'rn-BI',
		flagEmoji: '🇧🇮',
		phonePrefix: '+257'
	},
	{
		name: 'CABO_VERDE',
		countryName: 'Cabo Verde',
		code: 'CV',
		locale: 'pt-CV',
		flagEmoji: '🇨🇻',
		phonePrefix: '+238'
	},
	{
		name: 'CAMBODIA',
		countryName: 'Cambodia',
		code: 'KH',
		locale: 'km-KH',
		flagEmoji: '🇰🇭',
		phonePrefix: '+855'
	},
	{
		name: 'CAMEROON',
		countryName: 'Cameroon',
		code: 'CM',
		locale: 'fr-CM',
		flagEmoji: '🇨🇲',
		phonePrefix: '+237'
	},
	{
		name: 'CANADA',
		countryName: 'Canada',
		code: 'CA',
		locale: 'en-CA',
		flagEmoji: '🇨🇦',
		phonePrefix: '+1'
	},
	{
		name: 'CENTRAL_AFRICAN_REPUBLIC',
		countryName: 'Central African Republic',
		code: 'CF',
		locale: 'fr-CF',
		flagEmoji: '🇨🇫',
		phonePrefix: '+236'
	},
	{
		name: 'CHAD',
		countryName: 'Chad',
		code: 'TD',
		locale: 'fr-TD',
		flagEmoji: '🇹🇩',
		phonePrefix: '+235'
	},
	{
		name: 'CHILE',
		countryName: 'Chile',
		code: 'CL',
		locale: 'es-CL',
		flagEmoji: '🇨🇱',
		phonePrefix: '+56'
	},
	{
		name: 'CHINA',
		countryName: 'China',
		code: 'CN',
		locale: 'zh-CN',
		flagEmoji: '🇨🇳',
		phonePrefix: '+86'
	},
	{
		name: 'COLOMBIA',
		countryName: 'Colombia',
		code: 'CO',
		locale: 'es-CO',
		flagEmoji: '🇨🇴',
		phonePrefix: '+57'
	},
	{
		name: 'COMOROS',
		countryName: 'Comoros',
		code: 'KM',
		locale: 'ar-KM',
		flagEmoji: '🇰🇲',
		phonePrefix: '+269'
	},
	{
		name: 'CONGO',
		countryName: 'Congo',
		code: 'CG',
		locale: 'fr-CG',
		flagEmoji: '🇨🇬',
		phonePrefix: '+242'
	},
	{
		name: 'COSTA_RICA',
		countryName: 'Costa Rica',
		code: 'CR',
		locale: 'es-CR',
		flagEmoji: '🇨🇷',
		phonePrefix: '+506'
	},
	{
		name: 'CROATIA',
		countryName: 'Croatia',
		code: 'HR',
		locale: 'hr-HR',
		flagEmoji: '🇭🇷',
		phonePrefix: '+385'
	},
	{
		name: 'CUBA',
		countryName: 'Cuba',
		code: 'CU',
		locale: 'es-CU',
		flagEmoji: '🇨🇺',
		phonePrefix: '+53'
	},
	{
		name: 'CYPRUS',
		countryName: 'Cyprus',
		code: 'CY',
		locale: 'el-CY',
		flagEmoji: '🇨🇾',
		phonePrefix: '+357'
	},
	{
		name: 'CZECH_REPUBLIC',
		countryName: 'Czech Republic',
		code: 'CZ',
		locale: 'cs-CZ',
		flagEmoji: '🇨🇿',
		phonePrefix: '+420'
	},
	{
		name: 'DEMOCRATIC_REPUBLIC_OF_THE_CONGO',
		countryName: 'Democratic Republic of the Congo',
		code: 'CD',
		locale: 'fr-CD',
		flagEmoji: '🇨🇩',
		phonePrefix: '+243'
	},
	{
		name: 'DENMARK',
		countryName: 'Denmark',
		code: 'DK',
		locale: 'da-DK',
		flagEmoji: '🇩🇰',
		phonePrefix: '+45'
	},
	{
		name: 'DJIBOUTI',
		countryName: 'Djibouti',
		code: 'DJ',
		locale: 'fr-DJ',
		flagEmoji: '🇩🇯',
		phonePrefix: '+253'
	},
	{
		name: 'DOMINICA',
		countryName: 'Dominica',
		code: 'DM',
		locale: 'en-DM',
		flagEmoji: '🇩🇲',
		phonePrefix: '+1'
	},
	{
		name: 'DOMINICAN_REPUBLIC',
		countryName: 'Dominican Republic',
		code: 'DO',
		locale: 'es-DO',
		flagEmoji: '🇩🇴',
		phonePrefix: '+1'
	},
	{
		name: 'ECUADOR',
		countryName: 'Ecuador',
		code: 'EC',
		locale: 'es-EC',
		flagEmoji: '🇪🇨',
		phonePrefix: '+593'
	},
	{
		name: 'EGYPT',
		countryName: 'Egypt',
		code: 'EG',
		locale: 'ar-EG',
		flagEmoji: '🇪🇬',
		phonePrefix: '+20'
	},
	{
		name: 'EL_SALVADOR',
		countryName: 'El Salvador',
		code: 'SV',
		locale: 'es-SV',
		flagEmoji: '🇸🇻',
		phonePrefix: '+503'
	},
	{
		name: 'EQUATORIAL_GUINEA',
		countryName: 'Equatorial Guinea',
		code: 'GQ',
		locale: 'es-GQ',
		flagEmoji: '🇬🇶',
		phonePrefix: '+240'
	},
	{
		name: 'ERITREA',
		countryName: 'Eritrea',
		code: 'ER',
		locale: 'ti-ER',
		flagEmoji: '🇪🇷',
		phonePrefix: '+291'
	},
	{
		name: 'ESTONIA',
		countryName: 'Estonia',
		code: 'EE',
		locale: 'et-EE',
		flagEmoji: '🇪🇪',
		phonePrefix: '+372'
	},
	{
		name: 'ESWATINI',
		countryName: 'Eswatini',
		code: 'SZ',
		locale: 'en-SZ',
		flagEmoji: '🇸🇿',
		phonePrefix: '+268'
	},
	{
		name: 'ETHIOPIA',
		countryName: 'Ethiopia',
		code: 'ET',
		locale: 'am-ET',
		flagEmoji: '🇪🇹',
		phonePrefix: '+251'
	},
	{
		name: 'FIJI',
		countryName: 'Fiji',
		code: 'FJ',
		locale: 'en-FJ',
		flagEmoji: '🇫🇯',
		phonePrefix: '+679'
	},
	{
		name: 'FINLAND',
		countryName: 'Finland',
		code: 'FI',
		locale: 'fi-FI',
		flagEmoji: '🇫🇮',
		phonePrefix: '+358'
	},
	{
		name: 'FRANCE',
		countryName: 'France',
		code: 'FR',
		locale: 'fr-FR',
		flagEmoji: '🇫🇷',
		phonePrefix: '+33'
	},
	{
		name: 'GABON',
		countryName: 'Gabon',
		code: 'GA',
		locale: 'fr-GA',
		flagEmoji: '🇬🇦',
		phonePrefix: '+241'
	},
	{
		name: 'GAMBIA',
		countryName: 'Gambia',
		code: 'GM',
		locale: 'en-GM',
		flagEmoji: '🇬🇲',
		phonePrefix: '+220'
	},
	{
		name: 'GEORGIA',
		countryName: 'Georgia',
		code: 'GE',
		locale: 'ka-GE',
		flagEmoji: '🇬🇪',
		phonePrefix: '+995'
	},
	{
		name: 'GERMANY',
		countryName: 'Germany',
		code: 'DE',
		locale: 'de-DE',
		flagEmoji: '🇩🇪',
		phonePrefix: '+49'
	},
	{
		name: 'GHANA',
		countryName: 'Ghana',
		code: 'GH',
		locale: 'en-GH',
		flagEmoji: '🇬🇭',
		phonePrefix: '+233'
	},
	{
		name: 'GREECE',
		countryName: 'Greece',
		code: 'GR',
		locale: 'el-GR',
		flagEmoji: '🇬🇷',
		phonePrefix: '+30'
	},
	{
		name: 'GRENADA',
		countryName: 'Grenada',
		code: 'GD',
		locale: 'en-GD',
		flagEmoji: '🇬🇩',
		phonePrefix: '+1'
	},
	{
		name: 'GUATEMALA',
		countryName: 'Guatemala',
		code: 'GT',
		locale: 'es-GT',
		flagEmoji: '🇬🇹',
		phonePrefix: '+502'
	},
	{
		name: 'GUINEA',
		countryName: 'Guinea',
		code: 'GN',
		locale: 'fr-GN',
		flagEmoji: '🇬🇳',
		phonePrefix: '+224'
	},
	{
		name: 'GUINEA_BISSAU',
		countryName: 'Guinea-Bissau',
		code: 'GW',
		locale: 'pt-GW',
		flagEmoji: '🇬🇼',
		phonePrefix: '+245'
	},
	{
		name: 'GUYANA',
		countryName: 'Guyana',
		code: 'GY',
		locale: 'en-GY',
		flagEmoji: '🇬🇾',
		phonePrefix: '+592'
	},
	{
		name: 'HAITI',
		countryName: 'Haiti',
		code: 'HT',
		locale: 'ht-HT',
		flagEmoji: '🇭🇹',
		phonePrefix: '+509'
	},
	{
		name: 'HONDURAS',
		countryName: 'Honduras',
		code: 'HN',
		locale: 'es-HN',
		flagEmoji: '🇭🇳',
		phonePrefix: '+504'
	},
	{
		name: 'HUNGARY',
		countryName: 'Hungary',
		code: 'HU',
		locale: 'hu-HU',
		flagEmoji: '🇭🇺',
		phonePrefix: '+36'
	},
	{
		name: 'ICELAND',
		countryName: 'Iceland',
		code: 'IS',
		locale: 'is-IS',
		flagEmoji: '🇮🇸',
		phonePrefix: '+354'
	},
	{
		name: 'INDIA',
		countryName: 'India',
		code: 'IN',
		locale: 'hi-IN',
		flagEmoji: '🇮🇳',
		phonePrefix: '+91'
	},
	{
		name: 'INDONESIA',
		countryName: 'Indonesia',
		code: 'ID',
		locale: 'id-ID',
		flagEmoji: '🇮🇩',
		phonePrefix: '+62'
	},
	{
		name: 'IRAN',
		countryName: 'Iran',
		code: 'IR',
		locale: 'fa-IR',
		flagEmoji: '🇮🇷',
		phonePrefix: '+98'
	},
	{
		name: 'IRAQ',
		countryName: 'Iraq',
		code: 'IQ',
		locale: 'ar-IQ',
		flagEmoji: '🇮🇶',
		phonePrefix: '+964'
	},
	{
		name: 'IRELAND',
		countryName: 'Ireland',
		code: 'IE',
		locale: 'en-IE',
		flagEmoji: '🇮🇪',
		phonePrefix: '+353'
	},
	{
		name: 'ISRAEL',
		countryName: 'Israel',
		code: 'IL',
		locale: 'he-IL',
		flagEmoji: '🇮🇱',
		phonePrefix: '+972'
	},
	{
		name: 'ITALY',
		countryName: 'Italy',
		code: 'IT',
		locale: 'it-IT',
		flagEmoji: '🇮🇹',
		phonePrefix: '+39'
	},
	{
		name: 'IVORY_COAST',
		countryName: 'Ivory Coast',
		code: 'CI',
		locale: 'fr-CI',
		flagEmoji: '🇨🇮',
		phonePrefix: '+225'
	},
	{
		name: 'JAMAICA',
		countryName: 'Jamaica',
		code: 'JM',
		locale: 'en-JM',
		flagEmoji: '🇯🇲',
		phonePrefix: '+1'
	},
	{
		name: 'JAPAN',
		countryName: 'Japan',
		code: 'JP',
		locale: 'ja-JP',
		flagEmoji: '🇯🇵',
		phonePrefix: '+81'
	},
	{
		name: 'JORDAN',
		countryName: 'Jordan',
		code: 'JO',
		locale: 'ar-JO',
		flagEmoji: '🇯🇴',
		phonePrefix: '+962'
	},
	{
		name: 'KAZAKHSTAN',
		countryName: 'Kazakhstan',
		code: 'KZ',
		locale: 'kk-KZ',
		flagEmoji: '🇰🇿',
		phonePrefix: '+7'
	},
	{
		name: 'KENYA',
		countryName: 'Kenya',
		code: 'KE',
		locale: 'sw-KE',
		flagEmoji: '🇰🇪',
		phonePrefix: '+254'
	},
	{
		name: 'KIRIBATI',
		countryName: 'Kiribati',
		code: 'KI',
		locale: 'en-KI',
		flagEmoji: '🇰🇮',
		phonePrefix: '+686'
	},
	{
		name: 'KUWAIT',
		countryName: 'Kuwait',
		code: 'KW',
		locale: 'ar-KW',
		flagEmoji: '🇰🇼',
		phonePrefix: '+965'
	},
	{
		name: 'KYRGYZSTAN',
		countryName: 'Kyrgyzstan',
		code: 'KG',
		locale: 'ky-KG',
		flagEmoji: '🇰🇬',
		phonePrefix: '+996'
	},
	{
		name: 'LAOS',
		countryName: 'Laos',
		code: 'LA',
		locale: 'lo-LA',
		flagEmoji: '🇱🇦',
		phonePrefix: '+856'
	},
	{
		name: 'LATVIA',
		countryName: 'Latvia',
		code: 'LV',
		locale: 'lv-LV',
		flagEmoji: '🇱🇻',
		phonePrefix: '+371'
	},
	{
		name: 'LEBANON',
		countryName: 'Lebanon',
		code: 'LB',
		locale: 'ar-LB',
		flagEmoji: '🇱🇧',
		phonePrefix: '+961'
	},
	{
		name: 'LESOTHO',
		countryName: 'Lesotho',
		code: 'LS',
		locale: 'st-LS',
		flagEmoji: '🇱🇸',
		phonePrefix: '+266'
	},
	{
		name: 'LIBERIA',
		countryName: 'Liberia',
		code: 'LR',
		locale: 'en-LR',
		flagEmoji: '🇱🇷',
		phonePrefix: '+231'
	},
	{
		name: 'LIBYA',
		countryName: 'Libya',
		code: 'LY',
		locale: 'ar-LY',
		flagEmoji: '🇱🇾',
		phonePrefix: '+218'
	},
	{
		name: 'LIECHTENSTEIN',
		countryName: 'Liechtenstein',
		code: 'LI',
		locale: 'de-LI',
		flagEmoji: '🇱🇮',
		phonePrefix: '+423'
	},
	{
		name: 'LITHUANIA',
		countryName: 'Lithuania',
		code: 'LT',
		locale: 'lt-LT',
		flagEmoji: '🇱🇹',
		phonePrefix: '+370'
	},
	{
		name: 'LUXEMBOURG',
		countryName: 'Luxembourg',
		code: 'LU',
		locale: 'lb-LU',
		flagEmoji: '🇱🇺',
		phonePrefix: '+352'
	},
	{
		name: 'MADAGASCAR',
		countryName: 'Madagascar',
		code: 'MG',
		locale: 'mg-MG',
		flagEmoji: '🇲🇬',
		phonePrefix: '+261'
	},
	{
		name: 'MALAWI',
		countryName: 'Malawi',
		code: 'MW',
		locale: 'en-MW',
		flagEmoji: '🇲🇼',
		phonePrefix: '+265'
	},
	{
		name: 'MALAYSIA',
		countryName: 'Malaysia',
		code: 'MY',
		locale: 'ms-MY',
		flagEmoji: '🇲🇾',
		phonePrefix: '+60'
	},
	{
		name: 'MALDIVES',
		countryName: 'Maldives',
		code: 'MV',
		locale: 'dv-MV',
		flagEmoji: '🇲🇻',
		phonePrefix: '+960'
	},
	{
		name: 'MALI',
		countryName: 'Mali',
		code: 'ML',
		locale: 'fr-ML',
		flagEmoji: '🇲🇱',
		phonePrefix: '+223'
	},
	{
		name: 'MALTA',
		countryName: 'Malta',
		code: 'MT',
		locale: 'mt-MT',
		flagEmoji: '🇲🇹',
		phonePrefix: '+356'
	},
	{
		name: 'MARSHALL_ISLANDS',
		countryName: 'Marshall Islands',
		code: 'MH',
		locale: 'mh-MH',
		flagEmoji: '🇲🇭',
		phonePrefix: '+692'
	},
	{
		name: 'MAURITANIA',
		countryName: 'Mauritania',
		code: 'MR',
		locale: 'ar-MR',
		flagEmoji: '🇲🇷',
		phonePrefix: '+222'
	},
	{
		name: 'MAURITIUS',
		countryName: 'Mauritius',
		code: 'MU',
		locale: 'en-MU',
		flagEmoji: '🇲🇺',
		phonePrefix: '+230'
	},
	{
		name: 'MEXICO',
		countryName: 'Mexico',
		code: 'MX',
		locale: 'es-MX',
		flagEmoji: '🇲🇽',
		phonePrefix: '+52'
	},
	{
		name: 'MICRONESIA',
		countryName: 'Micronesia',
		code: 'FM',
		locale: 'en-FM',
		flagEmoji: '🇫🇲',
		phonePrefix: '+691'
	},
	{
		name: 'MOLDOVA',
		countryName: 'Moldova',
		code: 'MD',
		locale: 'ro-MD',
		flagEmoji: '🇲🇩',
		phonePrefix: '+373'
	},
	{
		name: 'MONACO',
		countryName: 'Monaco',
		code: 'MC',
		locale: 'fr-MC',
		flagEmoji: '🇲🇨',
		phonePrefix: '+377'
	},
	{
		name: 'MONGOLIA',
		countryName: 'Mongolia',
		code: 'MN',
		locale: 'mn-MN',
		flagEmoji: '🇲🇳',
		phonePrefix: '+976'
	},
	{
		name: 'MONTENEGRO',
		countryName: 'Montenegro',
		code: 'ME',
		locale: 'sr-ME',
		flagEmoji: '🇲🇪',
		phonePrefix: '+382'
	},
	{
		name: 'MOROCCO',
		countryName: 'Morocco',
		code: 'MA',
		locale: 'ar-MA',
		flagEmoji: '🇲🇦',
		phonePrefix: '+212'
	},
	{
		name: 'MOZAMBIQUE',
		countryName: 'Mozambique',
		code: 'MZ',
		locale: 'pt-MZ',
		flagEmoji: '🇲🇿',
		phonePrefix: '+258'
	},
	{
		name: 'MYANMAR',
		countryName: 'Myanmar',
		code: 'MM',
		locale: 'my-MM',
		flagEmoji: '🇲🇲',
		phonePrefix: '+95'
	},
	{
		name: 'NAMIBIA',
		countryName: 'Namibia',
		code: 'NA',
		locale: 'en-NA',
		flagEmoji: '🇳🇦',
		phonePrefix: '+264'
	},
	{
		name: 'NAURU',
		countryName: 'Nauru',
		code: 'NR',
		locale: 'na-NR',
		flagEmoji: '🇳🇷',
		phonePrefix: '+674'
	},
	{
		name: 'NEPAL',
		countryName: 'Nepal',
		code: 'NP',
		locale: 'ne-NP',
		flagEmoji: '🇳🇵',
		phonePrefix: '+977'
	},
	{
		name: 'NETHERLANDS',
		countryName: 'Netherlands',
		code: 'NL',
		locale: 'nl-NL',
		flagEmoji: '🇳🇱',
		phonePrefix: '+31'
	},
	{
		name: 'NEW_ZEALAND',
		countryName: 'New Zealand',
		code: 'NZ',
		locale: 'en-NZ',
		flagEmoji: '🇳🇿',
		phonePrefix: '+64'
	},
	{
		name: 'NICARAGUA',
		countryName: 'Nicaragua',
		code: 'NI',
		locale: 'es-NI',
		flagEmoji: '🇳🇮',
		phonePrefix: '+505'
	},
	{
		name: 'NIGER',
		countryName: 'Niger',
		code: 'NE',
		locale: 'fr-NE',
		flagEmoji: '🇳🇪',
		phonePrefix: '+227'
	},
	{
		name: 'NIGERIA',
		countryName: 'Nigeria',
		code: 'NG',
		locale: 'en-NG',
		flagEmoji: '🇳🇬',
		phonePrefix: '+234'
	},
	{
		name: 'NORTH_MACEDONIA',
		countryName: 'North Macedonia',
		code: 'MK',
		locale: 'mk-MK',
		flagEmoji: '🇲🇰',
		phonePrefix: '+389'
	},
	{
		name: 'NORWAY',
		countryName: 'Norway',
		code: 'NO',
		locale: 'no-NO',
		flagEmoji: '🇳🇴',
		phonePrefix: '+47'
	},
	{
		name: 'OMAN',
		countryName: 'Oman',
		code: 'OM',
		locale: 'ar-OM',
		flagEmoji: '🇴🇲',
		phonePrefix: '+968'
	},
	{
		name: 'PAKISTAN',
		countryName: 'Pakistan',
		code: 'PK',
		locale: 'ur-PK',
		flagEmoji: '🇵🇰',
		phonePrefix: '+92'
	},
	{
		name: 'PALAU',
		countryName: 'Palau',
		code: 'PW',
		locale: 'pau-PW',
		flagEmoji: '🇵🇼',
		phonePrefix: '+680'
	},
	{
		name: 'PANAMA',
		countryName: 'Panama',
		code: 'PA',
		locale: 'es-PA',
		flagEmoji: '🇵🇦',
		phonePrefix: '+507'
	},
	{
		name: 'PAPUA_NEW_GUINEA',
		countryName: 'Papua New Guinea',
		code: 'PG',
		locale: 'en-PG',
		flagEmoji: '🇵🇬',
		phonePrefix: '+675'
	},
	{
		name: 'PARAGUAY',
		countryName: 'Paraguay',
		code: 'PY',
		locale: 'es-PY',
		flagEmoji: '🇵🇾',
		phonePrefix: '+595'
	},
	{
		name: 'PERU',
		countryName: 'Peru',
		code: 'PE',
		locale: 'es-PE',
		flagEmoji: '🇵🇪',
		phonePrefix: '+51'
	},
	{
		name: 'PHILIPPINES',
		countryName: 'Philippines',
		code: 'PH',
		locale: 'fil-PH',
		flagEmoji: '🇵🇭',
		phonePrefix: '+63'
	},
	{
		name: 'POLAND',
		countryName: 'Poland',
		code: 'PL',
		locale: 'pl-PL',
		flagEmoji: '🇵🇱',
		phonePrefix: '+48'
	},
	{
		name: 'PORTUGAL',
		countryName: 'Portugal',
		code: 'PT',
		locale: 'pt-PT',
		flagEmoji: '🇵🇹',
		phonePrefix: '+351'
	},
	{
		name: 'QATAR',
		countryName: 'Qatar',
		code: 'QA',
		locale: 'ar-QA',
		flagEmoji: '🇶🇦',
		phonePrefix: '+974'
	},
	{
		name: 'ROMANIA',
		countryName: 'Romania',
		code: 'RO',
		locale: 'ro-RO',
		flagEmoji: '🇷🇴',
		phonePrefix: '+40'
	},
	{
		name: 'RUSSIA',
		countryName: 'Russia',
		code: 'RU',
		locale: 'ru-RU',
		flagEmoji: '🇷🇺',
		phonePrefix: '+7'
	},
	{
		name: 'RWANDA',
		countryName: 'Rwanda',
		code: 'RW',
		locale: 'rw-RW',
		flagEmoji: '🇷🇼',
		phonePrefix: '+250'
	},
	{
		name: 'SAINT_KITTS_AND_NEVIS',
		countryName: 'Saint Kitts and Nevis',
		code: 'KN',
		locale: 'en-KN',
		flagEmoji: '🇰🇳',
		phonePrefix: '+1'
	},
	{
		name: 'SAINT_LUCIA',
		countryName: 'Saint Lucia',
		code: 'LC',
		locale: 'en-LC',
		flagEmoji: '🇱🇨',
		phonePrefix: '+1'
	},
	{
		name: 'SAINT_VINCENT_AND_THE_GRENADINES',
		countryName: 'Saint Vincent and the Grenadines',
		code: 'VC',
		locale: 'en-VC',
		flagEmoji: '🇻🇨',
		phonePrefix: '+1'
	},
	{
		name: 'SAMOA',
		countryName: 'Samoa',
		code: 'WS',
		locale: 'sm-WS',
		flagEmoji: '🇼🇸',
		phonePrefix: '+685'
	},
	{
		name: 'SAN_MARINO',
		countryName: 'San Marino',
		code: 'SM',
		locale: 'it-SM',
		flagEmoji: '🇸🇲',
		phonePrefix: '+378'
	},
	{
		name: 'SAO_TOME_AND_PRINCIPE',
		countryName: 'Sao Tome and Principe',
		code: 'ST',
		locale: 'pt-ST',
		flagEmoji: '🇸🇹',
		phonePrefix: '+239'
	},
	{
		name: 'SAUDI_ARABIA',
		countryName: 'Saudi Arabia',
		code: 'SA',
		locale: 'ar-SA',
		flagEmoji: '🇸🇦',
		phonePrefix: '+966'
	},
	{
		name: 'SENEGAL',
		countryName: 'Senegal',
		code: 'SN',
		locale: 'fr-SN',
		flagEmoji: '🇸🇳',
		phonePrefix: '+221'
	},
	{
		name: 'SERBIA',
		countryName: 'Serbia',
		code: 'RS',
		locale: 'sr-RS',
		flagEmoji: '🇷🇸',
		phonePrefix: '+381'
	},
	{
		name: 'SEYCHELLES',
		countryName: 'Seychelles',
		code: 'SC',
		locale: 'en-SC',
		flagEmoji: '🇸🇨',
		phonePrefix: '+248'
	},
	{
		name: 'SIERRA_LEONE',
		countryName: 'Sierra Leone',
		code: 'SL',
		locale: 'en-SL',
		flagEmoji: '🇸🇱',
		phonePrefix: '+232'
	},
	{
		name: 'SINGAPORE',
		countryName: 'Singapore',
		code: 'SG',
		locale: 'en-SG',
		flagEmoji: '🇸🇬',
		phonePrefix: '+65'
	},
	{
		name: 'SLOVAKIA',
		countryName: 'Slovakia',
		code: 'SK',
		locale: 'sk-SK',
		flagEmoji: '🇸🇰',
		phonePrefix: '+421'
	},
	{
		name: 'SLOVENIA',
		countryName: 'Slovenia',
		code: 'SI',
		locale: 'sl-SI',
		flagEmoji: '🇸🇮',
		phonePrefix: '+386'
	},
	{
		name: 'SOLOMON_ISLANDS',
		countryName: 'Solomon Islands',
		code: 'SB',
		locale: 'en-SB',
		flagEmoji: '🇸🇧',
		phonePrefix: '+677'
	},
	{
		name: 'SOMALIA',
		countryName: 'Somalia',
		code: 'SO',
		locale: 'so-SO',
		flagEmoji: '🇸🇴',
		phonePrefix: '+252'
	},
	{
		name: 'SOUTH_AFRICA',
		countryName: 'South Africa',
		code: 'ZA',
		locale: 'af-ZA',
		flagEmoji: '🇿🇦',
		phonePrefix: '+27'
	},
	{
		name: 'SOUTH_KOREA',
		countryName: 'South Korea',
		code: 'KR',
		locale: 'ko-KR',
		flagEmoji: '🇰🇷',
		phonePrefix: '+82'
	},
	{
		name: 'SOUTH_SUDAN',
		countryName: 'South Sudan',
		code: 'SS',
		locale: 'en-SS',
		flagEmoji: '🇸🇸',
		phonePrefix: '+211'
	},
	{
		name: 'SPAIN',
		countryName: 'Spain',
		code: 'ES',
		locale: 'es-ES',
		flagEmoji: '🇪🇸',
		phonePrefix: '+34'
	},
	{
		name: 'SRI_LANKA',
		countryName: 'Sri Lanka',
		code: 'LK',
		locale: 'si-LK',
		flagEmoji: '🇱🇰',
		phonePrefix: '+94'
	},
	{
		name: 'SUDAN',
		countryName: 'Sudan',
		code: 'SD',
		locale: 'ar-SD',
		flagEmoji: '🇸🇩',
		phonePrefix: '+249'
	},
	{
		name: 'SURINAME',
		countryName: 'Suriname',
		code: 'SR',
		locale: 'nl-SR',
		flagEmoji: '🇸🇷',
		phonePrefix: '+597'
	},
	{
		name: 'SWEDEN',
		countryName: 'Sweden',
		code: 'SE',
		locale: 'sv-SE',
		flagEmoji: '🇸🇪',
		phonePrefix: '+46'
	},
	{
		name: 'SWITZERLAND',
		countryName: 'Switzerland',
		code: 'CH',
		locale: 'de-CH',
		flagEmoji: '🇨🇭',
		phonePrefix: '+41'
	},
	{
		name: 'SYRIA',
		countryName: 'Syria',
		code: 'SY',
		locale: 'ar-SY',
		flagEmoji: '🇸🇾',
		phonePrefix: '+963'
	},
	{
		name: 'TAIWAN',
		countryName: 'Taiwan',
		code: 'TW',
		locale: 'zh-TW',
		flagEmoji: '🇹🇼',
		phonePrefix: '+886'
	},
	{
		name: 'TAJIKISTAN',
		countryName: 'Tajikistan',
		code: 'TJ',
		locale: 'tg-TJ',
		flagEmoji: '🇹🇯',
		phonePrefix: '+992'
	},
	{
		name: 'TANZANIA',
		countryName: 'Tanzania',
		code: 'TZ',
		locale: 'sw-TZ',
		flagEmoji: '🇹🇿',
		phonePrefix: '+255'
	},
	{
		name: 'THAILAND',
		countryName: 'Thailand',
		code: 'TH',
		locale: 'th-TH',
		flagEmoji: '🇹🇭',
		phonePrefix: '+66'
	},
	{
		name: 'TIMOR_LESTE',
		countryName: 'Timor-Leste',
		code: 'TL',
		locale: 'pt-TL',
		flagEmoji: '🇹🇱',
		phonePrefix: '+670'
	},
	{
		name: 'TOGO',
		countryName: 'Togo',
		code: 'TG',
		locale: 'fr-TG',
		flagEmoji: '🇹🇬',
		phonePrefix: '+228'
	},
	{
		name: 'TONGA',
		countryName: 'Tonga',
		code: 'TO',
		locale: 'to-TO',
		flagEmoji: '🇹🇴',
		phonePrefix: '+676'
	},
	{
		name: 'TRINIDAD_AND_TOBAGO',
		countryName: 'Trinidad and Tobago',
		code: 'TT',
		locale: 'en-TT',
		flagEmoji: '🇹🇹',
		phonePrefix: '+1'
	},
	{
		name: 'TUNISIA',
		countryName: 'Tunisia',
		code: 'TN',
		locale: 'ar-TN',
		flagEmoji: '🇹🇳',
		phonePrefix: '+216'
	},
	{
		name: 'TURKEY',
		countryName: 'Turkey',
		code: 'TR',
		locale: 'tr-TR',
		flagEmoji: '🇹🇷',
		phonePrefix: '+90'
	},
	{
		name: 'TURKMENISTAN',
		countryName: 'Turkmenistan',
		code: 'TM',
		locale: 'tk-TM',
		flagEmoji: '🇹🇲',
		phonePrefix: '+993'
	},
	{
		name: 'TUVALU',
		countryName: 'Tuvalu',
		code: 'TV',
		locale: 'tvl-TV',
		flagEmoji: '🇹🇻',
		phonePrefix: '+688'
	},
	{
		name: 'UGANDA',
		countryName: 'Uganda',
		code: 'UG',
		locale: 'en-UG',
		flagEmoji: '🇺🇬',
		phonePrefix: '+256'
	},
	{
		name: 'UKRAINE',
		countryName: 'Ukraine',
		code: 'UA',
		locale: 'uk-UA',
		flagEmoji: '🇺🇦',
		phonePrefix: '+380'
	},
	{
		name: 'UNITED_ARAB_EMIRATES',
		countryName: 'United Arab Emirates',
		code: 'AE',
		locale: 'ar-AE',
		flagEmoji: '🇦🇪',
		phonePrefix: '+971'
	},
	{
		name: 'UNITED_KINGDOM',
		countryName: 'United Kingdom',
		code: 'GB',
		locale: 'en-GB',
		flagEmoji: '🇬🇧',
		phonePrefix: '+44'
	},
	{
		name: 'URUGUAY',
		countryName: 'Uruguay',
		code: 'UY',
		locale: 'es-UY',
		flagEmoji: '🇺🇾',
		phonePrefix: '+598'
	},
	{
		name: 'UZBEKISTAN',
		countryName: 'Uzbekistan',
		code: 'UZ',
		locale: 'uz-UZ',
		flagEmoji: '🇺🇿',
		phonePrefix: '+998'
	},
	{
		name: 'VANUATU',
		countryName: 'Vanuatu',
		code: 'VU',
		locale: 'bi-VU',
		flagEmoji: '🇻🇺',
		phonePrefix: '+678'
	},
	{
		name: 'VATICAN_CITY',
		countryName: 'Vatican City',
		code: 'VA',
		locale: 'it-VA',
		flagEmoji: '🇻🇦',
		phonePrefix: '+379'
	},
	{
		name: 'VENEZUELA',
		countryName: 'Venezuela',
		code: 'VE',
		locale: 'es-VE',
		flagEmoji: '🇻🇪',
		phonePrefix: '+58'
	},
	{
		name: 'VIETNAM',
		countryName: 'Vietnam',
		code: 'VN',
		locale: 'vi-VN',
		flagEmoji: '🇻🇳',
		phonePrefix: '+84'
	},
	{
		name: 'YEMEN',
		countryName: 'Yemen',
		code: 'YE',
		locale: 'ar-YE',
		flagEmoji: '🇾🇪',
		phonePrefix: '+967'
	},
	{
		name: 'ZAMBIA',
		countryName: 'Zambia',
		code: 'ZM',
		locale: 'en-ZM',
		flagEmoji: '🇿🇲',
		phonePrefix: '+260'
	},
	{
		name: 'ZIMBABWE',
		countryName: 'Zimbabwe',
		code: 'ZW',
		locale: 'en-ZW',
		flagEmoji: '🇿🇼',
		phonePrefix: '+263'
	}
];

// #endregion
