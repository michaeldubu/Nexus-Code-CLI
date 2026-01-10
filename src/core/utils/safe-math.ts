/**
 * Safe Math Evaluator
 * Replaces dangerous eval() with a safe expression parser
 *
 * Supports:
 * - Basic arithmetic: +, -, *, /, %, **
 * - Parentheses
 * - Math functions: sqrt, sin, cos, tan, abs, floor, ceil, round, log, exp
 * - Constants: PI, E
 */

export class SafeMathEvaluator {
  /**
   * Evaluate a mathematical expression safely
   */
  static evaluate(expression: string): number {
    // Remove whitespace
    const cleaned = expression.replace(/\s/g, '');

    // Validate characters (only allow numbers, operators, parentheses, and math functions)
    if (!/^[0-9+\-*/.()%,^a-zA-Z]*$/.test(cleaned)) {
      throw new Error('Invalid characters in expression');
    }

    // Replace constants
    let expr = cleaned
      .replace(/\bPI\b/g, String(Math.PI))
      .replace(/\bE\b/g, String(Math.E));

    // Replace power operator
    expr = expr.replace(/\*\*/g, '^');

    // Parse and evaluate
    return this.parseExpression(expr);
  }

  /**
   * Parse expression with proper operator precedence
   */
  private static parseExpression(expr: string): number {
    // Handle addition and subtraction (lowest precedence)
    for (let i = expr.length - 1; i >= 0; i--) {
      const char = expr[i];

      if (char === '+' || char === '-') {
        // Skip if it's a unary operator
        if (i === 0 || '+-*/^('.includes(expr[i - 1])) {
          continue;
        }

        const left = this.parseExpression(expr.slice(0, i));
        const right = this.parseExpression(expr.slice(i + 1));

        return char === '+' ? left + right : left - right;
      }
    }

    // Handle multiplication, division, and modulo
    for (let i = expr.length - 1; i >= 0; i--) {
      const char = expr[i];

      if (char === '*' || char === '/' || char === '%') {
        const left = this.parseExpression(expr.slice(0, i));
        const right = this.parseExpression(expr.slice(i + 1));

        if (char === '*') return left * right;
        if (char === '/') {
          if (right === 0) throw new Error('Division by zero');
          return left / right;
        }
        if (char === '%') return left % right;
      }
    }

    // Handle power operator
    for (let i = expr.length - 1; i >= 0; i--) {
      if (expr[i] === '^') {
        const left = this.parseExpression(expr.slice(0, i));
        const right = this.parseExpression(expr.slice(i + 1));
        return Math.pow(left, right);
      }
    }

    // Handle parentheses
    if (expr.startsWith('(') && expr.endsWith(')')) {
      return this.parseExpression(expr.slice(1, -1));
    }

    // Handle math functions
    const funcMatch = expr.match(/^([a-z]+)\((.+)\)$/);
    if (funcMatch) {
      const [, funcName, argExpr] = funcMatch;
      const arg = this.parseExpression(argExpr);

      switch (funcName.toLowerCase()) {
        case 'sqrt':
          return Math.sqrt(arg);
        case 'sin':
          return Math.sin(arg);
        case 'cos':
          return Math.cos(arg);
        case 'tan':
          return Math.tan(arg);
        case 'abs':
          return Math.abs(arg);
        case 'floor':
          return Math.floor(arg);
        case 'ceil':
          return Math.ceil(arg);
        case 'round':
          return Math.round(arg);
        case 'log':
          return Math.log(arg);
        case 'exp':
          return Math.exp(arg);
        default:
          throw new Error(`Unknown function: ${funcName}`);
      }
    }

    // Handle unary minus
    if (expr.startsWith('-')) {
      return -this.parseExpression(expr.slice(1));
    }

    // Handle unary plus
    if (expr.startsWith('+')) {
      return this.parseExpression(expr.slice(1));
    }

    // Parse number
    const num = parseFloat(expr);
    if (isNaN(num)) {
      throw new Error(`Invalid expression: ${expr}`);
    }

    return num;
  }
}

/**
 * Safe evaluate function (drop-in replacement for eval())
 */
export function safeEval(expression: string): number {
  return SafeMathEvaluator.evaluate(expression);
}
