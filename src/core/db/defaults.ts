export type Language = 'ro' | 'en';

type Localized = { ro: string; en: string };

type DefaultCategory = { name: Localized; icon: string };

type DefaultGroup = {
  name: Localized;
  kind: 'expense' | 'income';
  color: string;
  icon: string;
  categories: readonly DefaultCategory[];
};

type DefaultAccount = {
  name: Localized;
  type: 'bank' | 'cash';
  color: string;
  icon: string;
  archived?: boolean;
};

// Icons are MaterialCommunityIcons names.
export const DEFAULT_GROUPS: readonly DefaultGroup[] = [
  {
    name: { ro: 'Nevoi', en: 'Needs' },
    kind: 'expense',
    color: '#4C9AFF',
    icon: 'shield-home-outline',
    categories: [
      { name: { ro: 'Alimente', en: 'Groceries' }, icon: 'cart-outline' },
      { name: { ro: 'Facturi', en: 'Bills' }, icon: 'receipt' },
      { name: { ro: 'Utilități', en: 'Utilities' }, icon: 'flash-outline' },
      { name: { ro: 'Chirie', en: 'Rent' }, icon: 'home-city-outline' },
      { name: { ro: 'Întreținere casă', en: 'Home upkeep' }, icon: 'home-outline' },
      { name: { ro: 'Sănătate', en: 'Health' }, icon: 'medical-bag' },
      { name: { ro: 'Dentist', en: 'Dentist' }, icon: 'tooth-outline' },
      { name: { ro: 'Copii', en: 'Kids' }, icon: 'baby-carriage' },
      { name: { ro: 'Animale', en: 'Pets' }, icon: 'paw' },
      { name: { ro: 'Impozite și taxe', en: 'Taxes' }, icon: 'file-document-outline' },
    ],
  },
  {
    name: { ro: 'Transport', en: 'Transport' },
    kind: 'expense',
    color: '#FF9F43',
    icon: 'car-outline',
    categories: [
      { name: { ro: 'Combustibil', en: 'Fuel' }, icon: 'gas-station-outline' },
      { name: { ro: 'Transport public', en: 'Public transport' }, icon: 'bus' },
      { name: { ro: 'Taxi', en: 'Ride hailing' }, icon: 'taxi' },
      { name: { ro: 'Întreținere auto', en: 'Car maintenance' }, icon: 'car-wrench' },
      { name: { ro: 'Asigurare auto', en: 'Car insurance' }, icon: 'shield-check-outline' },
      { name: { ro: 'Rovinietă și taxe', en: 'Road tax' }, icon: 'road-variant' },
    ],
  },
  {
    name: { ro: 'Distracție', en: 'Fun' },
    kind: 'expense',
    color: '#0F766E',
    icon: 'party-popper',
    categories: [
      { name: { ro: 'Mâncare în oraș', en: 'Eating out' }, icon: 'silverware-fork-knife' },
      { name: { ro: 'Comandă mâncare', en: 'Food delivery' }, icon: 'hamburger' },
      { name: { ro: 'Cafenele', en: 'Cafes' }, icon: 'coffee-outline' },
      { name: { ro: 'Abonamente', en: 'Subscriptions' }, icon: 'television-play' },
      { name: { ro: 'Vacanță', en: 'Vacation' }, icon: 'airplane' },
    ],
  },
  {
    name: { ro: 'Vicii', en: 'Vices' },
    kind: 'expense',
    color: '#FF5C8A',
    icon: 'smoking',
    categories: [
      { name: { ro: 'Țigări', en: 'Cigarettes' }, icon: 'smoking' },
      { name: { ro: 'Alcool', en: 'Alcohol' }, icon: 'glass-mug-variant' },
      { name: { ro: 'Jocuri de noroc', en: 'Gambling' }, icon: 'dice-multiple-outline' },
    ],
  },
  {
    name: { ro: 'Cumpărături', en: 'Shopping' },
    kind: 'expense',
    color: '#36C2CE',
    icon: 'shopping-outline',
    categories: [
      { name: { ro: 'Haine', en: 'Clothing' }, icon: 'tshirt-crew-outline' },
      { name: { ro: 'Electronice', en: 'Electronics' }, icon: 'laptop' },
      { name: { ro: 'Casă și grădină', en: 'Home & garden' }, icon: 'sofa-outline' },
    ],
  },
  {
    name: { ro: 'Credite și economii', en: 'Debt & savings' },
    kind: 'expense',
    color: '#94A3B8',
    icon: 'bank-outline',
    categories: [
      { name: { ro: 'Rate', en: 'Loan installments' }, icon: 'bank-outline' },
      { name: { ro: 'Datorii', en: 'Debts' }, icon: 'cash-minus' },
      { name: { ro: 'Asigurare credit', en: 'Loan insurance' }, icon: 'shield-check-outline' },
      { name: { ro: 'Dobânzi și comisioane', en: 'Interest & fees' }, icon: 'receipt' },
      { name: { ro: 'Economii', en: 'Savings' }, icon: 'piggy-bank-outline' },
      { name: { ro: 'Investiții', en: 'Investments' }, icon: 'chart-line' },
    ],
  },
  {
    name: { ro: 'Altele', en: 'Other' },
    kind: 'expense',
    color: '#A78BFA',
    icon: 'dots-horizontal-circle-outline',
    categories: [{ name: { ro: 'Diverse', en: 'Miscellaneous' }, icon: 'dots-horizontal' }],
  },
  {
    name: { ro: 'Venituri', en: 'Income' },
    kind: 'income',
    color: '#2DD4BF',
    icon: 'cash-plus',
    categories: [
      { name: { ro: 'Salariu', en: 'Salary' }, icon: 'briefcase-outline' },
      { name: { ro: 'Bonusuri', en: 'Bonuses' }, icon: 'gift-outline' },
      { name: { ro: 'Alte venituri', en: 'Other income' }, icon: 'cash-plus' },
    ],
  },
];

export const DEFAULT_ACCOUNTS: readonly DefaultAccount[] = [
  { name: { ro: 'ING', en: 'ING' }, type: 'bank', color: '#FF6200', icon: 'bank' },
  { name: { ro: 'Revolut', en: 'Revolut' }, type: 'bank', color: '#0666EB', icon: 'credit-card-outline' },
  { name: { ro: 'Salt Bank', en: 'Salt Bank' }, type: 'bank', color: '#F25C54', icon: 'bank-outline', archived: true },
  { name: { ro: 'Numerar', en: 'Cash' }, type: 'cash', color: '#2DD4BF', icon: 'wallet-outline' },
];

export const DEFAULT_CURRENCY = 'RON';
