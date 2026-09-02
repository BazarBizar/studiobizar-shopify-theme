/**
 * Minimal coloured logger. No dependencies.
 * Colour is disabled automatically when NO_COLOR is set or stdout is not a TTY,
 * so piping output to a file stays readable.
 */

const useColour =
  !process.env.NO_COLOR &&
  process.env.TERM !== 'dumb' &&
  (process.stdout.isTTY || process.env.FORCE_COLOR === '1');

const wrap = (open, close) => (text) =>
  useColour ? `\u001b[${open}m${text}\u001b[${close}m` : String(text);

export const c = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  magenta: wrap(35, 39),
  cyan: wrap(36, 39),
  grey: wrap(90, 39),
};

/** Fixed-width status badges so the log lines up in a column. */
const badge = {
  CREATE: c.green('CREATE '),
  SKIP: c.grey('SKIP   '),
  PATCH: c.cyan('PATCH  '),
  FAIL: c.red('FAIL   '),
  PLAN: c.magenta('PLAN   '),
  WAIT: c.yellow('WAIT   '),
};

export const log = {
  /** Section heading. */
  step(title) {
    console.log(`\n${c.bold(c.blue('▸ ' + title))}`);
  },
  /** Sub-heading inside a section. */
  group(title) {
    console.log(`  ${c.bold(title)}`);
  },
  info(msg) {
    console.log(`  ${msg}`);
  },
  dim(msg) {
    console.log(`  ${c.grey(msg)}`);
  },
  warn(msg) {
    console.log(`  ${c.yellow('!')} ${c.yellow(msg)}`);
  },
  error(msg) {
    console.error(`  ${c.red('✖')} ${msg}`);
  },
  /** `status` must be a key of `badge`. */
  result(status, label, detail = '') {
    const tail = detail ? ` ${c.grey(detail)}` : '';
    console.log(`  ${badge[status] ?? status} ${label}${tail}`);
  },
  blank() {
    console.log('');
  },
};

/**
 * Render a small ASCII table. `rows` is an array of arrays of strings.
 * Widths are measured on the *uncoloured* string so ANSI codes don't skew them.
 */
const visibleLength = (s) => String(s).replace(/\u001b\[\d+m/g, '').length;

export function table(headers, rows) {
  const all = [headers, ...rows];
  const widths = headers.map((_, i) =>
    Math.max(...all.map((r) => visibleLength(r[i] ?? '')))
  );
  const line = (cells, colour = (x) => x) =>
    '  ' +
    cells
      .map((cell, i) => colour(String(cell ?? '') + ' '.repeat(widths[i] - visibleLength(cell ?? ''))))
      .join('  ');

  console.log(line(headers, c.bold));
  console.log('  ' + widths.map((w) => c.grey('─'.repeat(w))).join('  '));
  for (const row of rows) console.log(line(row));
}
