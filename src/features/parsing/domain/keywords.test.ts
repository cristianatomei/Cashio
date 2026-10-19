import { DEFAULT_KEYWORD_RULES, classifyText } from './keywords';

describe('classifyText', () => {
  it('matches whole words, ignoring case and diacritics', () => {
    expect(classifyText('Rată credit 1.234 RON', DEFAULT_KEYWORD_RULES)?.pattern).toBe('rata');
    expect(classifyText('Incasare SALARIU octombrie', DEFAULT_KEYWORD_RULES)?.type).toBe('income');
  });

  it('does not match inside other words', () => {
    expect(classifyText('Plata la Karate Club', DEFAULT_KEYWORD_RULES)).toBeNull();
    expect(classifyText('Corate 10 RON', DEFAULT_KEYWORD_RULES)).toBeNull();
  });

  it('matches multi-word patterns', () => {
    expect(classifyText('Plata asigurare auto Allianz', DEFAULT_KEYWORD_RULES)?.category?.ro).toBe(
      'Asigurare auto',
    );
  });

  it.each([
    ['Plata la Bolt Food', 'Comandă mâncare'],
    ['Plata la Uber Eats', 'Comandă mâncare'],
    ['Plata la Bolt', 'Taxi'],
    ['Plata la Uber', 'Taxi'],
    ['Plata la Glovo', 'Comandă mâncare'],
    ['Plata la Volt', 'Comandă mâncare'],
    ['Plata la Kaufland', 'Alimente'],
    ['Plata la Carrefour', 'Alimente'],
    ['Plata la Mega Image', 'Alimente'],
  ])('classifies %s', (text, category) => {
    expect(classifyText(text, DEFAULT_KEYWORD_RULES)?.category?.ro).toBe(category);
  });

  it('returns null when nothing matches', () => {
    expect(classifyText('Plata la Xulescu Market', DEFAULT_KEYWORD_RULES)).toBeNull();
  });
});
