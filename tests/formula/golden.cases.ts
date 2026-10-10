// Golden cases for the formula language (P8-01, SAD-60). Approved 2026-10-10.
// Source of truth: docs/formula-spec.md. Executed against the engine by tests/formula/golden.test.ts (P8-02).
//
// Encoding
//   fields: text -> "text"; number -> 12; boolean -> true/false; blank -> null;
//           date -> "date:YYYY-MM-DD"; datetime -> "datetime:YYYY-MM-DDTHH:mm[:ss]".
//   now / row times: "datetime:..." strings, local time (test zone Asia/Dhaka, UTC+6, no DST).
//   expect: "num:<decimal>" | "text:<string>" | "bool:true|false" | "date:YYYY-MM-DD" |
//           "datetime:YYYY-MM-DD HH:mm[:ss]" | "blank" | "err:#CODE"
//   text:  with an empty string after the colon is the empty text "".

export type FieldValue = string | number | boolean | null;

export interface GoldenRow {
  id: string;
  createdTime: string;
  modifiedTime: string;
}

export interface GoldenCase {
  id: string;
  group: string;
  formula: string;
  expect: string;
  fields?: Record<string, FieldValue>;
  now?: string;
  row?: Partial<GoldenRow>;
}

const DEFAULT_NOW = 'datetime:2026-10-10T10:00';
const DEFAULT_ROW: GoldenRow = {
  id: 'row_test01',
  createdTime: 'datetime:2026-10-09T09:00',
  modifiedTime: 'datetime:2026-10-10T08:15',
};

function g(
  id: string,
  group: string,
  formula: string,
  expect: string,
  fields?: Record<string, FieldValue>,
  now?: string,
  row?: Partial<GoldenRow>,
): GoldenCase {
  const c: GoldenCase = { id, group, formula, expect };
  if (fields) c.fields = fields;
  if (now) c.now = now;
  if (row) c.row = row;
  return c;
}

export const DEFAULT_CONTEXT = { now: DEFAULT_NOW, row: DEFAULT_ROW };

export const GOLDEN_CASES: GoldenCase[] = [
  // ---- core: operators, blanks, errors, parsing ----
  g('core-1', 'core', '1+2*3', 'num:7'),
  g('core-2', 'core', '(1+2)*3', 'num:9'),
  g('core-3', 'core', '2^3^2', 'num:64'),
  g('core-4', 'core', '-2^2', 'num:-4'),
  g('core-5', 'core', '10/4', 'num:2.5'),
  g('core-6', 'core', '1/0', 'err:#DIV/0!'),
  g('core-7', 'core', '"a"&"b"&1', 'text:ab1'),
  g('core-8', 'core', '1=1', 'bool:true'),
  g('core-9', 'core', '"a"="A"', 'bool:false'),
  g('core-10', 'core', '{Price}+1', 'num:1', { Price: null }),
  g('core-11', 'core', '"x"&{Name}', 'text:x', { Name: null }),
  g('core-12', 'core', '{Name}=""', 'bool:true', { Name: null }),
  g('core-13', 'core', '{Price}=0', 'bool:true', { Price: null }),
  g('core-14', 'core', '"3"+1', 'err:#VALUE!'),
  g('core-15', 'core', 'VALUE("3")+1', 'num:4'),
  g('core-16', 'core', '{Nope}+1', 'err:#NAME?'),
  g('core-17', 'core', 'FOO(1)', 'err:#NAME?'),
  g('core-18', 'core', '1+', 'err:#PARSE!'),
  g('core-19', 'core', '1/0+{Price}', 'err:#DIV/0!', { Price: 5 }),
  g('core-20', 'core', '1<"a"', 'err:#VALUE!'),
  g('core-21', 'core', '0.1+0.2&""', 'text:0.3'),
  g('core-22', 'core', '10^400', 'err:#OVERFLOW!'),
  g('core-23', 'core', '{Price}*2', 'num:20', { Price: 10 }),
  g('core-24', 'core', 'NOT({Done})', 'bool:true', { Done: null }),
  g('core-25', 'core', '{Due}>DATE("2026-10-01")', 'bool:true', { Due: 'date:2026-10-10' }),
  g('core-26', 'core', '1<2<3', 'err:#PARSE!'),

  // ---- ABS ----
  g('ABS-1', 'ABS', 'ABS(-3)', 'num:3'),
  g('ABS-2', 'ABS', 'ABS(2.5)', 'num:2.5'),
  g('ABS-3', 'ABS', 'ABS({Price})', 'num:7', { Price: -7 }),
  g('ABS-4', 'ABS', 'ABS({Price})', 'num:0', { Price: null }),

  // ---- ROUND ----
  g('ROUND-1', 'ROUND', 'ROUND(2.5)', 'num:3'),
  g('ROUND-2', 'ROUND', 'ROUND(-2.5)', 'num:-3'),
  g('ROUND-3', 'ROUND', 'ROUND(1.2345,2)', 'num:1.23'),
  g('ROUND-4', 'ROUND', 'ROUND(1234,-2)', 'num:1200'),
  g('ROUND-5', 'ROUND', 'ROUND(1,16)', 'err:#NUM!'),

  // ---- ROUNDUP ----
  g('ROUNDUP-1', 'ROUNDUP', 'ROUNDUP(2.1)', 'num:3'),
  g('ROUNDUP-2', 'ROUNDUP', 'ROUNDUP(-2.1)', 'num:-3'),
  g('ROUNDUP-3', 'ROUNDUP', 'ROUNDUP(1.231,2)', 'num:1.24'),

  // ---- ROUNDDOWN ----
  g('ROUNDDOWN-1', 'ROUNDDOWN', 'ROUNDDOWN(2.9)', 'num:2'),
  g('ROUNDDOWN-2', 'ROUNDDOWN', 'ROUNDDOWN(-2.9)', 'num:-2'),
  g('ROUNDDOWN-3', 'ROUNDDOWN', 'ROUNDDOWN(1.239,2)', 'num:1.23'),

  // ---- CEILING ----
  g('CEILING-1', 'CEILING', 'CEILING(2.1)', 'num:3'),
  g('CEILING-2', 'CEILING', 'CEILING(-2.1)', 'num:-2'),
  g('CEILING-3', 'CEILING', 'CEILING(4)', 'num:4'),

  // ---- FLOOR ----
  g('FLOOR-1', 'FLOOR', 'FLOOR(2.9)', 'num:2'),
  g('FLOOR-2', 'FLOOR', 'FLOOR(-2.1)', 'num:-3'),
  g('FLOOR-3', 'FLOOR', 'FLOOR(-4)', 'num:-4'),

  // ---- INT ----
  g('INT-1', 'INT', 'INT(2.9)', 'num:2'),
  g('INT-2', 'INT', 'INT(-2.1)', 'num:-3'),
  g('INT-3', 'INT', 'INT(7)', 'num:7'),

  // ---- MOD ----
  g('MOD-1', 'MOD', 'MOD(10,3)', 'num:1'),
  g('MOD-2', 'MOD', 'MOD(-10,3)', 'num:2'),
  g('MOD-3', 'MOD', 'MOD(10,-3)', 'num:-2'),
  g('MOD-4', 'MOD', 'MOD(5,0)', 'err:#DIV/0!'),

  // ---- POWER ----
  g('POWER-1', 'POWER', 'POWER(2,10)', 'num:1024'),
  g('POWER-2', 'POWER', 'POWER(-8,0.5)', 'err:#NUM!'),
  g('POWER-3', 'POWER', 'POWER(0,-1)', 'err:#DIV/0!'),

  // ---- SQRT ----
  g('SQRT-1', 'SQRT', 'SQRT(9)', 'num:3'),
  g('SQRT-2', 'SQRT', 'SQRT(0.25)', 'num:0.5'),
  g('SQRT-3', 'SQRT', 'SQRT(-1)', 'err:#NUM!'),

  // ---- MIN ----
  g('MIN-1', 'MIN', 'MIN(3,1,2)', 'num:1'),
  g('MIN-2', 'MIN', 'MIN(4,{Price})', 'num:4', { Price: null }),
  g('MIN-3', 'MIN', 'MIN({Price})', 'blank', { Price: null }),

  // ---- MAX ----
  g('MAX-1', 'MAX', 'MAX(3,1,2)', 'num:3'),
  g('MAX-2', 'MAX', 'MAX(-1,-5)', 'num:-1'),
  g('MAX-3', 'MAX', 'MAX({Price})', 'blank', { Price: null }),

  // ---- SUM ----
  g('SUM-1', 'SUM', 'SUM(1,2,3)', 'num:6'),
  g('SUM-2', 'SUM', 'SUM()', 'num:0'),
  g('SUM-3', 'SUM', 'SUM(1,{Price})', 'num:1', { Price: null }),
  g('SUM-4', 'SUM', 'SUM("a")', 'err:#VALUE!'),

  // ---- AVERAGE ----
  g('AVERAGE-1', 'AVERAGE', 'AVERAGE(1,2,3,4)', 'num:2.5'),
  g('AVERAGE-2', 'AVERAGE', 'AVERAGE(2,{Price})', 'num:2', { Price: null }),
  g('AVERAGE-3', 'AVERAGE', 'AVERAGE({Price})', 'err:#DIV/0!', { Price: null }),

  // ---- COUNT ----
  g('COUNT-1', 'COUNT', 'COUNT(1,"a",TRUE,{Price})', 'num:1', { Price: null }),
  g('COUNT-2', 'COUNT', 'COUNT(1,2)', 'num:2'),
  g('COUNT-3', 'COUNT', 'COUNT("x")', 'num:0'),

  // ---- CONCATENATE ----
  g('CONCATENATE-1', 'CONCATENATE', 'CONCATENATE("a","b")', 'text:ab'),
  g('CONCATENATE-2', 'CONCATENATE', 'CONCATENATE("a",1,TRUE)', 'text:a1TRUE'),
  g('CONCATENATE-3', 'CONCATENATE', 'CONCATENATE("x",{Name})', 'text:x', { Name: null }),

  // ---- LEN ----
  g('LEN-1', 'LEN', 'LEN("abc")', 'num:3'),
  g('LEN-2', 'LEN', 'LEN("é")', 'num:1'),
  g('LEN-3', 'LEN', 'LEN({Name})', 'num:0', { Name: null }),

  // ---- LOWER ----
  g('LOWER-1', 'LOWER', 'LOWER("AbC")', 'text:abc'),
  g('LOWER-2', 'LOWER', 'LOWER("ÀB")', 'text:àb'),
  g('LOWER-3', 'LOWER', 'LOWER({Name})', 'text:', { Name: null }),

  // ---- UPPER ----
  g('UPPER-1', 'UPPER', 'UPPER("aé")', 'text:AÉ'),
  g('UPPER-2', 'UPPER', 'UPPER("abc1")', 'text:ABC1'),
  g('UPPER-3', 'UPPER', 'UPPER("")', 'text:'),

  // ---- TRIM ----
  g('TRIM-1', 'TRIM', 'TRIM("  a   b  ")', 'text:a b'),
  g('TRIM-2', 'TRIM', 'TRIM("a")', 'text:a'),
  g('TRIM-3', 'TRIM', 'TRIM("   ")', 'text:'),

  // ---- LEFT ----
  g('LEFT-1', 'LEFT', 'LEFT("hello",2)', 'text:he'),
  g('LEFT-2', 'LEFT', 'LEFT("hi")', 'text:h'),
  g('LEFT-3', 'LEFT', 'LEFT("hi",9)', 'text:hi'),
  g('LEFT-4', 'LEFT', 'LEFT("hi",-1)', 'err:#NUM!'),

  // ---- RIGHT ----
  g('RIGHT-1', 'RIGHT', 'RIGHT("hello",3)', 'text:llo'),
  g('RIGHT-2', 'RIGHT', 'RIGHT("hi")', 'text:i'),
  g('RIGHT-3', 'RIGHT', 'RIGHT("hi",0)', 'text:'),

  // ---- MID ----
  g('MID-1', 'MID', 'MID("hello",2,3)', 'text:ell'),
  g('MID-2', 'MID', 'MID("hello",4,10)', 'text:lo'),
  g('MID-3', 'MID', 'MID("hello",0,2)', 'err:#NUM!'),
  g('MID-4', 'MID', 'MID("hello",9,2)', 'text:'),

  // ---- FIND ----
  g('FIND-1', 'FIND', 'FIND("b","abc")', 'num:2'),
  g('FIND-2', 'FIND', 'FIND("B","abc")', 'num:0'),
  g('FIND-3', 'FIND', 'FIND("b","abcb",3)', 'num:4'),
  g('FIND-4', 'FIND', 'FIND("a","abc",0)', 'err:#NUM!'),

  // ---- SEARCH ----
  g('SEARCH-1', 'SEARCH', 'SEARCH("B","abc")', 'num:2'),
  g('SEARCH-2', 'SEARCH', 'SEARCH("z","abc")', 'num:0'),
  g('SEARCH-3', 'SEARCH', 'SEARCH("C","abc",3)', 'num:3'),

  // ---- SUBSTITUTE ----
  g('SUBSTITUTE-1', 'SUBSTITUTE', 'SUBSTITUTE("aaa","a","b")', 'text:bbb'),
  g('SUBSTITUTE-2', 'SUBSTITUTE', 'SUBSTITUTE("abc","","x")', 'text:abc'),
  g('SUBSTITUTE-3', 'SUBSTITUTE', 'SUBSTITUTE("a-b-c","-","")', 'text:abc'),

  // ---- REPLACE ----
  g('REPLACE-1', 'REPLACE', 'REPLACE("hello",2,3,"X")', 'text:hXo'),
  g('REPLACE-2', 'REPLACE', 'REPLACE("abc",2,0,"-")', 'text:a-bc'),
  g('REPLACE-3', 'REPLACE', 'REPLACE("abc",9,0,"!")', 'text:abc!'),

  // ---- REPT ----
  g('REPT-1', 'REPT', 'REPT("ab",3)', 'text:ababab'),
  g('REPT-2', 'REPT', 'REPT("x",0)', 'text:'),
  g('REPT-3', 'REPT', 'REPT("x",-1)', 'err:#NUM!'),

  // ---- VALUE ----
  g('VALUE-1', 'VALUE', 'VALUE("3.5")', 'num:3.5'),
  g('VALUE-2', 'VALUE', 'VALUE(" -2 ")', 'num:-2'),
  g('VALUE-3', 'VALUE', 'VALUE("abc")', 'err:#VALUE!'),
  g('VALUE-4', 'VALUE', 'VALUE(4)', 'num:4'),

  // ---- IF ----
  g('IF-1', 'IF', 'IF(TRUE,"y","n")', 'text:y'),
  g('IF-2', 'IF', 'IF({Done},1,2)', 'num:2', { Done: false }),
  g('IF-3', 'IF', 'IF(1,"a")', 'text:a'),
  g('IF-4', 'IF', 'IF(FALSE,"a")', 'blank'),
  g('IF-5', 'IF', 'IF("x",1,2)', 'err:#VALUE!'),

  // ---- AND ----
  g('AND-1', 'AND', 'AND(TRUE,1)', 'bool:true'),
  g('AND-2', 'AND', 'AND(TRUE,FALSE)', 'bool:false'),
  g('AND-3', 'AND', 'AND(1,{Done})', 'bool:false', { Done: null }),

  // ---- OR ----
  g('OR-1', 'OR', 'OR(FALSE,0)', 'bool:false'),
  g('OR-2', 'OR', 'OR(FALSE,"x")', 'err:#VALUE!'),
  g('OR-3', 'OR', 'OR(0,{Done})', 'bool:false', { Done: null }),

  // ---- NOT ----
  g('NOT-1', 'NOT', 'NOT(TRUE)', 'bool:false'),
  g('NOT-2', 'NOT', 'NOT(0)', 'bool:true'),
  g('NOT-3', 'NOT', 'NOT({Done})', 'bool:true', { Done: null }),

  // ---- XOR ----
  g('XOR-1', 'XOR', 'XOR(TRUE,FALSE)', 'bool:true'),
  g('XOR-2', 'XOR', 'XOR(TRUE,TRUE)', 'bool:false'),
  g('XOR-3', 'XOR', 'XOR(1,0)', 'bool:true'),

  // ---- SWITCH ----
  g('SWITCH-1', 'SWITCH', 'SWITCH(2,1,"a",2,"b","c")', 'text:b'),
  g('SWITCH-2', 'SWITCH', 'SWITCH(3,1,"a",2,"b","c")', 'text:c'),
  g('SWITCH-3', 'SWITCH', 'SWITCH(3,1,"a")', 'blank'),

  // ---- BLANK ----
  g('BLANK-1', 'BLANK', 'BLANK()', 'blank'),
  g('BLANK-2', 'BLANK', 'IF(BLANK(),1,2)', 'num:2'),
  g('BLANK-3', 'BLANK', 'BLANK()&"x"', 'text:x'),

  // ---- DATE ----
  g('DATE-1', 'DATE', 'DATE("2026-10-10")', 'date:2026-10-10'),
  g('DATE-2', 'DATE', 'DATE("2024-02-29")', 'date:2024-02-29'),
  g('DATE-3', 'DATE', 'DATE("2026-02-30")', 'err:#VALUE!'),
  g('DATE-4', 'DATE', 'DATE("10/10/2026")', 'err:#VALUE!'),

  // ---- TODAY (clock injected through `now`) ----
  g('TODAY-1', 'TODAY', 'TODAY()', 'date:2026-10-10'),
  g('TODAY-2', 'TODAY', 'TODAY()', 'date:2026-10-10', undefined, 'datetime:2026-10-10T23:59'),
  g('TODAY-3', 'TODAY', 'TODAY()', 'date:2026-12-31', undefined, 'datetime:2026-12-31T00:00'),

  // ---- NOW ----
  g('NOW-1', 'NOW', 'NOW()', 'datetime:2026-10-10 10:00'),
  g('NOW-2', 'NOW', 'YEAR(NOW())', 'num:2026'),
  g('NOW-3', 'NOW', 'HOUR(NOW())', 'num:10'),

  // ---- DATEADD ----
  g('DATEADD-1', 'DATEADD', 'DATEADD(DATE("2026-01-31"),1,"months")', 'date:2026-02-28'),
  g('DATEADD-2', 'DATEADD', 'DATEADD(DATE("2026-10-10"),-3,"days")', 'date:2026-10-07'),
  g('DATEADD-3', 'DATEADD', 'DATEADD(DATE("2026-10-10"),2,"hours")', 'datetime:2026-10-10 02:00'),
  g('DATEADD-4', 'DATEADD', 'DATEADD(DATE("2026-10-10"),1,"fortnights")', 'err:#VALUE!'),
  g('DATEADD-5', 'DATEADD', 'DATEADD(DATE("2026-10-10"),2,"weeks")', 'date:2026-10-24'),

  // ---- DATETIME_DIFF ----
  g('DATETIME_DIFF-1', 'DATETIME_DIFF', 'DATETIME_DIFF(DATE("2026-10-10"),DATE("2026-10-01"),"days")', 'num:9'),
  g('DATETIME_DIFF-2', 'DATETIME_DIFF', 'DATETIME_DIFF(DATE("2026-03-01"),DATE("2026-01-31"),"months")', 'num:1'),
  g('DATETIME_DIFF-3', 'DATETIME_DIFF', 'DATETIME_DIFF(DATE("2026-10-10"),DATE("2026-10-09"),"hours")', 'num:24'),
  g('DATETIME_DIFF-4', 'DATETIME_DIFF', 'DATETIME_DIFF(DATE("2026-10-01"),DATE("2026-10-10"),"days")', 'num:-9'),
  g('DATETIME_DIFF-5', 'DATETIME_DIFF', 'DATETIME_DIFF(DATE("2030-10-10"),DATE("2026-10-10"),"years")', 'num:4'),

  // ---- IS_BEFORE ----
  g('IS_BEFORE-1', 'IS_BEFORE', 'IS_BEFORE(DATE("2026-10-09"),DATE("2026-10-10"))', 'bool:true'),
  g('IS_BEFORE-2', 'IS_BEFORE', 'IS_BEFORE(DATE("2026-10-10"),DATE("2026-10-10"))', 'bool:false'),
  g('IS_BEFORE-3', 'IS_BEFORE', 'IS_BEFORE(DATE("2026-10-10"),"x")', 'err:#VALUE!'),

  // ---- IS_AFTER ----
  g('IS_AFTER-1', 'IS_AFTER', 'IS_AFTER(DATE("2026-10-11"),DATE("2026-10-10"))', 'bool:true'),
  g('IS_AFTER-2', 'IS_AFTER', 'IS_AFTER(DATE("2026-10-10"),DATE("2026-10-10"))', 'bool:false'),
  g('IS_AFTER-3', 'IS_AFTER', 'IS_AFTER({Due},DATE("2026-10-01"))', 'bool:true', { Due: 'date:2026-10-10' }),

  // ---- YEAR ----
  g('YEAR-1', 'YEAR', 'YEAR(DATE("2026-10-10"))', 'num:2026'),
  g('YEAR-2', 'YEAR', 'YEAR(DATE("1999-01-01"))', 'num:1999'),
  g('YEAR-3', 'YEAR', 'YEAR("x")', 'err:#VALUE!'),

  // ---- MONTH ----
  g('MONTH-1', 'MONTH', 'MONTH(DATE("2026-10-10"))', 'num:10'),
  g('MONTH-2', 'MONTH', 'MONTH(DATE("2026-01-05"))', 'num:1'),
  g('MONTH-3', 'MONTH', 'MONTH(DATE("2026-12-31"))', 'num:12'),

  // ---- DAY ----
  g('DAY-1', 'DAY', 'DAY(DATE("2026-10-10"))', 'num:10'),
  g('DAY-2', 'DAY', 'DAY(DATE("2024-02-29"))', 'num:29'),
  g('DAY-3', 'DAY', 'DAY(DATE("2026-01-01"))', 'num:1'),

  // ---- WEEKDAY (ISO: 1 = Monday) ----
  g('WEEKDAY-1', 'WEEKDAY', 'WEEKDAY(DATE("2026-10-10"))', 'num:6'),
  g('WEEKDAY-2', 'WEEKDAY', 'WEEKDAY(DATE("2026-10-12"))', 'num:1'),
  g('WEEKDAY-3', 'WEEKDAY', 'WEEKDAY(DATE("2026-10-11"))', 'num:7'),

  // ---- HOUR ----
  g('HOUR-1', 'HOUR', 'HOUR({Created})', 'num:14', { Created: 'datetime:2026-10-10T14:30' }),
  g('HOUR-2', 'HOUR', 'HOUR(DATE("2026-10-10"))', 'num:0'),
  g('HOUR-3', 'HOUR', 'HOUR("x")', 'err:#VALUE!'),

  // ---- MINUTE ----
  g('MINUTE-1', 'MINUTE', 'MINUTE({Created})', 'num:30', { Created: 'datetime:2026-10-10T14:30' }),
  g('MINUTE-2', 'MINUTE', 'MINUTE(DATE("2026-10-10"))', 'num:0'),
  g('MINUTE-3', 'MINUTE', 'MINUTE(NOW())', 'num:45', undefined, 'datetime:2026-10-10T10:45'),

  // ---- SECOND ----
  g('SECOND-1', 'SECOND', 'SECOND({Created})', 'num:0', { Created: 'datetime:2026-10-10T14:30' }),
  g('SECOND-2', 'SECOND', 'SECOND(DATE("2026-10-10"))', 'num:0'),
  g('SECOND-3', 'SECOND', 'SECOND(NOW())', 'num:7', undefined, 'datetime:2026-10-10T10:00:07'),

  // ---- DATETIME_FORMAT ----
  g('DATETIME_FORMAT-1', 'DATETIME_FORMAT', 'DATETIME_FORMAT(DATE("2026-10-10"),"YYYY-MM-DD")', 'text:2026-10-10'),
  g('DATETIME_FORMAT-2', 'DATETIME_FORMAT', 'DATETIME_FORMAT({Created},"DD/MM/YYYY HH:mm")', 'text:10/10/2026 14:30', { Created: 'datetime:2026-10-10T14:30' }),
  g('DATETIME_FORMAT-3', 'DATETIME_FORMAT', 'DATETIME_FORMAT(DATE("2026-10-10"),"HH:mm")', 'text:00:00'),

  // ---- RECORD_ID ----
  g('RECORD_ID-1', 'RECORD_ID', 'RECORD_ID()', 'text:row_test01'),
  g('RECORD_ID-2', 'RECORD_ID', 'LEN(RECORD_ID())', 'num:10'),
  g('RECORD_ID-3', 'RECORD_ID', 'RECORD_ID()', 'text:row_abc', undefined, undefined, { id: 'row_abc' }),

  // ---- CREATED_TIME ----
  g('CREATED_TIME-1', 'CREATED_TIME', 'CREATED_TIME()', 'datetime:2026-10-09 09:00'),
  g('CREATED_TIME-2', 'CREATED_TIME', 'DAY(CREATED_TIME())', 'num:9'),
  g('CREATED_TIME-3', 'CREATED_TIME', 'HOUR(CREATED_TIME())', 'num:9'),

  // ---- LAST_MODIFIED_TIME ----
  g('LAST_MODIFIED_TIME-1', 'LAST_MODIFIED_TIME', 'LAST_MODIFIED_TIME()', 'datetime:2026-10-10 08:15'),
  g('LAST_MODIFIED_TIME-2', 'LAST_MODIFIED_TIME', 'MINUTE(LAST_MODIFIED_TIME())', 'num:15'),
  g('LAST_MODIFIED_TIME-3', 'LAST_MODIFIED_TIME', 'IS_AFTER(LAST_MODIFIED_TIME(),CREATED_TIME())', 'bool:true'),
];

/** Number of golden cases per function group. */
export function countByGroup(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of GOLDEN_CASES) counts[c.group] = (counts[c.group] ?? 0) + 1;
  return counts;
}
