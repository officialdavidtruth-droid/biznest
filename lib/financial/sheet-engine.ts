/**
 * A small spreadsheet engine: A1 cell references, ranges, + - * / ^ %, comparisons, text joins and the
 * functions people use for accounts. Pure and dependency-free so it can run in the browser and in tests.
 */
export type Cells = Record<string, string>;
export type CellValue = number | string | boolean | { error: string };
export const isErr = (v: unknown): v is { error: string } => typeof v === "object" && v !== null && "error" in v;
const err = (e: string) => ({ error: e });

export const colName = (i: number) => { let s = ""; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
export const colIndex = (name: string) => name.split("").reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
export const cellId = (col: number, row: number) => `${colName(col)}${row + 1}`;
export function parseCellId(id: string) {
  const m = /^\$?([A-Z]{1,2})\$?([1-9][0-9]*)$/.exec(id);
  return m ? { col: colIndex(m[1]), row: Number(m[2]) - 1 } : null;
}

type Tok = { t: "num" | "str" | "id" | "op" | "lp" | "rp" | "comma" | "colon"; v: string };
function tokenize(src: string): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " ") { i++; continue; }
    if (/[0-9.]/.test(c)) { const m = /^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?|^[0-9]+\.?/.exec(src.slice(i)); if (!m) return null; out.push({ t: "num", v: m[0] }); i += m[0].length; continue; }
    if (c === '"') { let j = i + 1, s = ""; while (j < src.length && src[j] !== '"') s += src[j++]; if (j >= src.length) return null; out.push({ t: "str", v: s }); i = j + 1; continue; }
    if (/[A-Za-z$_]/.test(c)) { const m = /^[A-Za-z$_][A-Za-z0-9$_.]*/.exec(src.slice(i))!; out.push({ t: "id", v: m[0] }); i += m[0].length; continue; }
    const two = src.slice(i, i + 2);
    if (["<=", ">=", "<>"].includes(two)) { out.push({ t: "op", v: two }); i += 2; continue; }
    if ("+-*/^&=<>%".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    if (c === "(") { out.push({ t: "lp", v: c }); i++; continue; }
    if (c === ")") { out.push({ t: "rp", v: c }); i++; continue; }
    if (c === ",") { out.push({ t: "comma", v: c }); i++; continue; }
    if (c === ":") { out.push({ t: "colon", v: c }); i++; continue; }
    return null;
  }
  return out;
}

type Node =
  | { k: "num"; v: number } | { k: "str"; v: string } | { k: "bool"; v: boolean }
  | { k: "ref"; id: string } | { k: "range"; a: string; b: string }
  | { k: "un"; op: string; x: Node } | { k: "bin"; op: string; l: Node; r: Node } | { k: "pct"; x: Node }
  | { k: "fn"; name: string; args: Node[] };

function parse(toks: Tok[]): Node | null {
  let p = 0;
  const peek = () => toks[p];
  const isOp = (...ops: string[]) => peek()?.t === "op" && ops.includes(peek().v);
  const level = (next: () => Node | null, ops: string[]) => () => {
    let l = next(); if (!l) return null;
    while (isOp(...ops)) { const op = toks[p++].v; const r = next(); if (!r) return null; l = { k: "bin", op, l, r }; }
    return l;
  };
  const primary = (): Node | null => {
    const t = toks[p];
    if (!t) return null;
    if (t.t === "num") { p++; return { k: "num", v: Number(t.v) }; }
    if (t.t === "str") { p++; return { k: "str", v: t.v }; }
    if (t.t === "lp") { p++; const e = expr(); if (!e || toks[p]?.t !== "rp") return null; p++; return e; }
    if (t.t === "id") {
      p++;
      if (toks[p]?.t === "lp") {
        p++; const args: Node[] = [];
        if (toks[p]?.t === "rp") { p++; return { k: "fn", name: t.v.toUpperCase(), args }; }
        for (;;) { const a = expr(); if (!a) return null; args.push(a); if (toks[p]?.t === "comma") { p++; continue; } if (toks[p]?.t === "rp") { p++; break; } return null; }
        return { k: "fn", name: t.v.toUpperCase(), args };
      }
      const up = t.v.toUpperCase();
      if (up === "TRUE" || up === "FALSE") return { k: "bool", v: up === "TRUE" };
      if (!parseCellId(up)) return { k: "fn", name: `#NAME:${t.v}`, args: [] };
      if (toks[p]?.t === "colon" && toks[p + 1]?.t === "id" && parseCellId(toks[p + 1].v.toUpperCase())) { const b = toks[p + 1].v.toUpperCase().replace(/\$/g, ""); p += 2; return { k: "range", a: up.replace(/\$/g, ""), b }; }
      return { k: "ref", id: up.replace(/\$/g, "") };
    }
    return null;
  };
  const postfix = (): Node | null => { let x = primary(); if (!x) return null; while (isOp("%")) { p++; x = { k: "pct", x }; } return x; };
  const unary = (): Node | null => { if (isOp("-", "+")) { const op = toks[p++].v; const x = unary(); return x ? { k: "un", op, x } : null; } return postfix(); };
  const power = level(unary, ["^"]);
  const mul = level(power, ["*", "/"]);
  const add = level(mul, ["+", "-"]);
  const cat = level(add, ["&"]);
  const cmp = level(cat, ["=", "<>", "<", ">", "<=", ">="]);
  function expr(): Node | null { return cmp(); }
  const n = expr();
  return n && p === toks.length ? n : null;
}

/** Plain-text number parsing for typed cells: "1,200.50", "-3", "12%". */
export function parseTyped(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const pct = s.endsWith("%");
  const body = (pct ? s.slice(0, -1) : s).replace(/^(-?)(\d{1,3}(?:,\d{3})+)(\.\d+)?$/, (_, sign, ints, dec) => `${sign}${ints.replace(/,/g, "")}${dec ?? ""}`);
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(body)) return null;
  const n = Number(body);
  return Number.isFinite(n) ? (pct ? n / 100 : n) : null;
}

export function evaluateSheet(cells: Cells): Record<string, CellValue> {
  const cache = new Map<string, CellValue>();
  const visiting = new Set<string>();
  const asts = new Map<string, Node | null>();

  const cellValue = (id: string): CellValue => {
    if (cache.has(id)) return cache.get(id)!;
    const raw = cells[id] ?? "";
    let v: CellValue;
    if (raw.startsWith("=")) {
      if (visiting.has(id)) return err("#CIRC!");
      visiting.add(id);
      let ast = asts.get(id);
      if (ast === undefined) { const toks = tokenize(raw.slice(1)); ast = toks ? parse(toks) : null; asts.set(id, ast); }
      v = ast ? evalNode(ast) : err("#ERR!");
      visiting.delete(id);
    } else {
      const n = parseTyped(raw);
      v = raw === "" ? "" : n !== null ? n : raw;
    }
    cache.set(id, v);
    return v;
  };

  const toNum = (v: CellValue): number | { error: string } => {
    if (isErr(v)) return v;
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (v === "") return 0;
    const n = parseTyped(v);
    return n === null ? err("#VALUE!") : n;
  };
  const flatten = (n: Node): CellValue[] => {
    if (n.k === "range") {
      const a = parseCellId(n.a)!, b = parseCellId(n.b)!;
      const out: CellValue[] = [];
      for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++) for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++) out.push(cellValue(cellId(c, r)));
      return out;
    }
    return [evalNode(n)];
  };
  /** Numbers found in the arguments. Text and blanks inside ranges are skipped, like a spreadsheet. */
  const numbers = (args: Node[]): number[] | { error: string } => {
    const out: number[] = [];
    for (const a of args) for (const v of flatten(a)) {
      if (isErr(v)) return v;
      if (typeof v === "number") out.push(v);
      else if (typeof v === "boolean") { if (a.k !== "range") out.push(v ? 1 : 0); }
      else if (a.k !== "range" && v !== "") { const n = parseTyped(v); if (n === null) return err("#VALUE!"); out.push(n); }
    }
    return out;
  };
  const crit = (c: CellValue) => {
    if (typeof c === "number") return (v: CellValue) => v === c;
    const m = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(String(c))!;
    const op = m[1] || "=", rhsRaw = m[2], rhs = parseTyped(rhsRaw);
    return (v: CellValue) => {
      const l = typeof v === "number" ? v : parseTyped(String(v));
      if (rhs !== null && l !== null) return op === "=" ? l === rhs : op === "<>" ? l !== rhs : op === "<" ? l < rhs : op === ">" ? l > rhs : op === "<=" ? l <= rhs : l >= rhs;
      const a = String(v).toLowerCase(), b = rhsRaw.toLowerCase();
      return op === "=" ? a === b : op === "<>" ? a !== b : false;
    };
  };

  function evalNode(n: Node): CellValue {
    switch (n.k) {
      case "num": return n.v;
      case "str": return n.v;
      case "bool": return n.v;
      case "ref": return cellValue(n.id);
      case "range": return err("#VALUE!");
      case "pct": { const x = toNum(evalNode(n.x)); return isErr(x) ? x : x / 100; }
      case "un": { const x = toNum(evalNode(n.x)); return isErr(x) ? x : n.op === "-" ? -x : x; }
      case "bin": {
        const lv = evalNode(n.l), rv = evalNode(n.r);
        if (isErr(lv)) return lv; if (isErr(rv)) return rv;
        if (n.op === "&") return `${lv}${rv}`;
        if (["=", "<>", "<", ">", "<=", ">="].includes(n.op)) {
          const bothNum = typeof lv !== "string" && typeof rv !== "string";
          const l = bothNum ? Number(lv) : String(lv).toLowerCase(), r = bothNum ? Number(rv) : String(rv).toLowerCase();
          return n.op === "=" ? l === r : n.op === "<>" ? l !== r : n.op === "<" ? l < r : n.op === ">" ? l > r : n.op === "<=" ? l <= r : l >= r;
        }
        const l = toNum(lv), r = toNum(rv);
        if (isErr(l)) return l; if (isErr(r)) return r;
        switch (n.op) {
          case "+": return l + r; case "-": return l - r; case "*": return l * r;
          case "/": return r === 0 ? err("#DIV/0!") : l / r;
          case "^": { const v = Math.pow(l, r); return Number.isFinite(v) ? v : err("#NUM!"); }
        }
        return err("#ERR!");
      }
      case "fn": return callFn(n);
    }
  }

  function callFn(n: Extract<Node, { k: "fn" }>): CellValue {
    const { name, args } = n;
    if (name.startsWith("#NAME:")) return err("#NAME?");
    const one = (i: number) => { const v = args[i] ? evalNode(args[i]) : 0; return toNum(v); };
    switch (name) {
      case "SUM": { const x = numbers(args); return isErr(x) ? x : x.reduce((s, v) => s + v, 0); }
      case "AVERAGE": { const x = numbers(args); if (isErr(x)) return x; return x.length ? x.reduce((s, v) => s + v, 0) / x.length : err("#DIV/0!"); }
      case "MIN": { const x = numbers(args); return isErr(x) ? x : x.length ? Math.min(...x) : 0; }
      case "MAX": { const x = numbers(args); return isErr(x) ? x : x.length ? Math.max(...x) : 0; }
      case "COUNT": { let c = 0; for (const a of args) for (const v of flatten(a)) if (typeof v === "number") c++; return c; }
      case "COUNTA": { let c = 0; for (const a of args) for (const v of flatten(a)) if (v !== "") c++; return c; }
      case "ABS": { const x = one(0); return isErr(x) ? x : Math.abs(x); }
      case "SQRT": { const x = one(0); return isErr(x) ? x : x < 0 ? err("#NUM!") : Math.sqrt(x); }
      case "ROUND": case "ROUNDUP": case "ROUNDDOWN": {
        const x = one(0), d = args[1] ? one(1) : 0;
        if (isErr(x)) return x; if (isErr(d)) return d;
        const f = Math.pow(10, Math.trunc(d));
        const fn = name === "ROUND" ? (v: number) => Math.sign(v) * Math.round(Math.abs(v) * f + Number.EPSILON) / f : name === "ROUNDUP" ? (v: number) => Math.sign(v) * Math.ceil(Math.abs(v) * f - 1e-9) / f : (v: number) => Math.sign(v) * Math.floor(Math.abs(v) * f + 1e-9) / f;
        return fn(x);
      }
      case "POWER": { const a = one(0), b = one(1); if (isErr(a)) return a; if (isErr(b)) return b; const v = Math.pow(a, b); return Number.isFinite(v) ? v : err("#NUM!"); }
      case "MOD": { const a = one(0), b = one(1); if (isErr(a)) return a; if (isErr(b)) return b; return b === 0 ? err("#DIV/0!") : a - b * Math.floor(a / b); }
      case "IF": {
        const c = args[0] ? evalNode(args[0]) : false;
        if (isErr(c)) return c;
        const truthy = typeof c === "string" ? c !== "" : Boolean(c);
        return truthy ? (args[1] ? evalNode(args[1]) : true) : (args[2] ? evalNode(args[2]) : false);
      }
      case "IFERROR": { const v = args[0] ? evalNode(args[0]) : ""; return isErr(v) ? (args[1] ? evalNode(args[1]) : "") : v; }
      case "AND": case "OR": {
        const vals = args.flatMap(flatten);
        for (const v of vals) if (isErr(v)) return v;
        const bs = vals.map((v) => (typeof v === "string" ? v !== "" : Boolean(v)));
        return name === "AND" ? bs.every(Boolean) : bs.some(Boolean);
      }
      case "NOT": { const v = args[0] ? evalNode(args[0]) : false; return isErr(v) ? v : !(typeof v === "string" ? v !== "" : Boolean(v)); }
      case "SUMIF": {
        if (args.length < 2 || args[0].k !== "range") return err("#VALUE!");
        const test = crit(evalNode(args[1]));
        const range = flatten(args[0]);
        const sumRange = args[2] ? flatten(args[2]) : range;
        let s = 0;
        range.forEach((v, i) => { if (test(v)) { const t = sumRange[i]; if (isErr(t)) return; if (typeof t === "number") s += t; } });
        return s;
      }
      case "COUNTIF": {
        if (args.length < 2 || args[0].k !== "range") return err("#VALUE!");
        const test = crit(evalNode(args[1]));
        return flatten(args[0]).filter((v) => !isErr(v) && test(v)).length;
      }
      case "PMT": {
        const rate = one(0), nper = one(1), pv = one(2);
        if (isErr(rate)) return rate; if (isErr(nper)) return nper; if (isErr(pv)) return pv;
        if (nper === 0) return err("#NUM!");
        return rate === 0 ? -pv / nper : -(pv * rate) / (1 - Math.pow(1 + rate, -nper));
      }
      case "NPV": {
        const rate = one(0); if (isErr(rate)) return rate;
        const flows = numbers(args.slice(1)); if (isErr(flows)) return flows;
        return flows.reduce((s, v, i) => s + v / Math.pow(1 + rate, i + 1), 0);
      }
      default: return err("#NAME?");
    }
  }

  const out: Record<string, CellValue> = {};
  for (const id of Object.keys(cells)) out[id] = cellValue(id);
  return out;
}

/** What a cell shows: numbers get thousands separators, errors show their code. */
export function displayValue(v: CellValue | undefined): string {
  if (v === undefined || v === "") return "";
  if (isErr(v)) return v.error;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return v;
}
