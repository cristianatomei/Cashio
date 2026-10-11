export const KEYPAD_OPERATORS = ['÷', '×', '-', '+'] as const;

type Operator = (typeof KEYPAD_OPERATORS)[number];

function isOperator(char: string): char is Operator {
  return (KEYPAD_OPERATORS as readonly string[]).includes(char);
}

function tokenize(expression: string): (number | Operator)[] | null {
  const tokens: (number | Operator)[] = [];
  let current = '';

  const flush = (): boolean => {
    if (current === '') return true;
    const value = Number(current.replace(',', '.'));
    if (Number.isNaN(value)) return false;
    tokens.push(value);
    current = '';
    return true;
  };

  for (const char of expression.replace(/\s/g, '')) {
    if (isOperator(char)) {
      if (!flush()) return null;
      // A trailing or repeated operator replaces the previous one.
      if (typeof tokens[tokens.length - 1] === 'string') tokens.pop();
      if (tokens.length === 0) return null;
      tokens.push(char);
    } else if (/[\d.,]/.test(char)) {
      current += char;
    } else {
      return null;
    }
  }
  if (!flush()) return null;
  if (typeof tokens[tokens.length - 1] === 'string') tokens.pop();
  return tokens.length > 0 ? tokens : null;
}

function applyPass(
  tokens: (number | Operator)[],
  operators: readonly Operator[],
): (number | Operator)[] | null {
  const output: (number | Operator)[] = [tokens[0]];
  for (let i = 1; i < tokens.length; i += 2) {
    const operator = tokens[i] as Operator;
    const right = tokens[i + 1] as number;
    if (operators.includes(operator)) {
      const left = output.pop() as number;
      if (operator === '÷' && right === 0) return null;
      output.push(operator === '×' ? left * right : left / right);
    } else {
      output.push(operator, right);
    }
  }
  return output;
}

/** Applies one keypad press ("7", ",", "+", "⌫") to the expression text. */
export function applyKeypadKey(expression: string, key: string): string {
  if (key === '⌫') return expression.slice(0, -1);

  if (isOperator(key)) {
    if (expression === '') return expression;
    const last = expression[expression.length - 1];
    return isOperator(last) ? expression.slice(0, -1) + key : expression + key;
  }

  const currentNumber = expression.split(/[÷×+-]/).pop() ?? '';
  if (key === ',') {
    if (/[.,]/.test(currentNumber)) return expression;
    return currentNumber === '' ? `${expression}0,` : `${expression},`;
  }

  const decimals = currentNumber.split(/[.,]/)[1];
  if (decimals !== undefined && decimals.length >= 2) return expression;
  return expression + key;
}

/** Evaluates a keypad expression such as "12,5+3×2" and returns the result in minor units. */
export function evaluateExpression(expression: string): number | null {
  const tokens = tokenize(expression);
  if (!tokens) return null;

  const afterMultiplicative = applyPass(tokens, ['×', '÷']);
  if (!afterMultiplicative) return null;

  let total = afterMultiplicative[0] as number;
  for (let i = 1; i < afterMultiplicative.length; i += 2) {
    const right = afterMultiplicative[i + 1] as number;
    total += afterMultiplicative[i] === '+' ? right : -right;
  }
  return Number.isFinite(total) ? Math.round(total * 100) : null;
}
