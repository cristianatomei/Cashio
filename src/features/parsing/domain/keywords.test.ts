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

  it('returns null when nothing matches', () => {
    expect(classifyText('Plata la Kaufland', DEFAULT_KEYWORD_RULES)).toBeNull();
  });
});
