// Feature-local copy keeps this redesign independent of the shared locale files.
const en = {
  free: 'Free to spend per day',
  balance: 'Current balance',
  reserved: 'Reserved until payday',
  available: 'Left after known payments',
  explanation:
    'Today up to, but not including, payday. Known recurring expenses and loan instalments only; no future income added. Variable bills use their saved amount. Overdue payments and unlinked duplicates need review in Recurring.',
  payday: 'Next payday (YYYY-MM-DD)',
  setPayday: 'Set next payday',
  changePayday: 'Change next payday',
  save: 'Save payday',
  cancel: 'Cancel',
  invalidDate: 'Enter a real date after today, within the next 366 days.',
  setup: 'When is your next payday?',
  setupHint:
    'We will not guess from your income. Set an exact date to calculate a daily amount; update it after each payday.',
  until: 'Payday',
  days: 'Spending days',
  incomplete:
    'Daily amount unavailable: check missing exchange rates or invalid amounts. The balance may be partial.',
  error: 'Could not calculate safely. Check your data and try reopening Home.',
  saveError: 'Could not save your payday. Please try again.',
  deficit: 'Known payments exceed your balance. No daily spending is available.',
  loading: 'Loading Home',
  classified: 'Nothing waiting to be classified',
  classifiedHint: 'Review captured payments in your inbox.',
  noPayments: 'No known payments in this period',
  noPaymentsHint:
    'Add recurring expenses or import a loan schedule. No payday set? The list covers the next 30 days.',
  noBudgets: 'No budgets yet',
  noBudgetsHint: 'Create a budget to track category spending.',
  noAccounts: 'Add your first account',
  noAccountsHint: 'A balance is needed before we can calculate free-to-spend.',
  noRecent: 'No transactions this month',
  noRecentHint: 'Add a transaction to start tracking spending.',
  reviewLinks: 'Review loan / recurring duplicates',
  linkHint:
    'Select a loan, then the recurring expense for the SAME debt. Only link when you are certain: Home will reserve the loan schedule instead of that rule. Reminders and forecasts elsewhere are unchanged.',
  linkRule: 'Use schedule instead of this recurring expense',
  unlink: 'No matching recurring expense (remove link)',
  unlinked: 'No linked recurring expense',
  linkError:
    'Could not save this association. Check that the expense has the same currency and is not linked to another loan.',
};

const ro: typeof en = {
  free: 'Liber de cheltuit pe zi',
  balance: 'Sold curent',
  reserved: 'Rezervat până la salariu',
  available: 'Rămas după plățile cunoscute',
  explanation:
    'De azi până la salariu, exclusiv ziua salariului. Doar cheltuieli recurente și rate cunoscute; fără venituri viitoare. Facturile variabile folosesc suma salvată. Verifică restanțele și duplicatele neasociate în Recurente.',
  payday: 'Următorul salariu (AAAA-LL-ZZ)',
  setPayday: 'Setează următorul salariu',
  changePayday: 'Schimbă data salariului',
  save: 'Salvează data',
  cancel: 'Anulează',
  invalidDate: 'Introdu o dată reală după azi, în următoarele 366 de zile.',
  setup: 'Când este următorul salariu?',
  setupHint:
    'Nu presupunem data din venituri. Setează data exactă pentru suma zilnică; actualizeaz-o după fiecare salariu.',
  until: 'Salariu',
  days: 'Zile de cheltuieli',
  incomplete:
    'Suma zilnică nu este disponibilă: verifică lipsa cursurilor sau sumele invalide. Soldul poate fi parțial.',
  error: 'Calculul sigur nu este disponibil. Verifică datele și redeschide Acasă.',
  saveError: 'Data nu a putut fi salvată. Încearcă din nou.',
  deficit: 'Plățile cunoscute depășesc soldul. Nu există sumă zilnică disponibilă.',
  loading: 'Se încarcă Acasă',
  classified: 'Nimic de clasificat',
  classifiedHint: 'Verifică plățile capturate în inbox.',
  noPayments: 'Nicio plată cunoscută în această perioadă',
  noPaymentsHint:
    'Adaugă recurente sau importă un scadențar. Fără data salariului, lista acoperă următoarele 30 de zile.',
  noBudgets: 'Niciun buget încă',
  noBudgetsHint: 'Creează un buget pentru cheltuielile pe categorii.',
  noAccounts: 'Adaugă primul cont',
  noAccountsHint: 'Este necesar un sold pentru a calcula suma disponibilă.',
  noRecent: 'Nicio tranzacție luna aceasta',
  noRecentHint: 'Adaugă o tranzacție pentru a urmări cheltuielile.',
  reviewLinks: 'Verifică duplicatele rate / recurente',
  linkHint:
    'Alege creditul, apoi cheltuiala recurentă pentru ACEEAȘI datorie. Asociază doar dacă ești sigur: Acasă va rezerva scadențarul în locul regulii. Reminderele și estimările din alte ecrane nu se schimbă.',
  linkRule: 'Folosește scadențarul în locul acestei recurente',
  unlink: 'Fără recurentă corespunzătoare (elimină asocierea)',
  unlinked: 'Fără recurentă asociată',
  linkError:
    'Asocierea nu a putut fi salvată. Verifică aceeași monedă și că recurenta nu este asociată altui credit.',
};

export function homeCopy(language: string) {
  return language.startsWith('en') ? en : ro;
}

export type HomeCopy = typeof en;
