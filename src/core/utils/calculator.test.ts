import { applyKeypadKey, evaluateExpression } from './calculator';
import { minorToKeypadInput } from './money';

describe('applyKeypadKey', () => {
  const press = (keys: string[]) => keys.reduce(applyKeypadKey, '');

  it('builds numbers and operators', () => {
    expect(press(['1', '2', '+', '3'])).toBe('12+3');
  });

  it('replaces a repeated operator and ignores a leading one', () => {
    expect(press(['+', '5', '+', '×'])).toBe('5×');
  });

  it('allows one decimal separator with at most two decimals', () => {
    expect(press(['1', ',', '5', ',', '2', '5'])).toBe('1,52');
    expect(press(['1', ',', '2', '5', '9'])).toBe('1,25');
  });

  it('starts a decimal with a zero and supports backspace', () => {
    expect(press(['5', '+', ','])).toBe('5+0,');
    expect(press(['1', '2', '⌫'])).toBe('1');
  });
});

describe('evaluateExpression', () => {
  it.each([
    ['12', 1200],
    ['12,5', 1250],
    ['12+3×2', 1800],
    ['10÷4', 250],
    ['1,5+2.25', 375],
    ['0.1+0.2', 30],
    ['100-30-20', 5000],
    ['5+', 500],
    ['5+-3', 200],
  ])('evaluates %s', (expression, expected) => {
    expect(evaluateExpression(expression)).toBe(expected);
  });

  it.each([[''], ['+'], ['1÷0'], ['abc']])('rejects %s', (expression) => {
    expect(evaluateExpression(expression)).toBeNull();
  });
});

it('allows changing a saved whole-number amount with the keypad', () => {
  const edited = applyKeypadKey(minorToKeypadInput(1200), '3');
  expect(edited).toBe('123');
  expect(evaluateExpression(edited)).toBe(12300);
});
