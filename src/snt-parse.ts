/**
 * 源码级解析：#snt 调用、notes: 数组、正文/译文中的 #nt* 宏。
 * 不依赖 Typst 编译；注释与字符串内的宏名会被跳过。
 */

export interface Span {
  start: number;
  end: number;
}

export interface ContentSpan extends Span {
  innerStart: number;
  innerEnd: number;
}

export interface NoteCall {
  start: number;
  end: number;
  name: string;
  args: Span | null;
  word: ContentSpan;
  note: ContentSpan | null;
  light: boolean;
}

export interface NotesItem extends ContentSpan {
  empty: boolean;
}

export interface NotesArray extends Span {
  items: NotesItem[];
}

export interface SntBlock extends ContentSpan {
  calls: NoteCall[];
  light: NoteCall[];
}

export interface SntCall {
  start: number;
  end: number;
  paren: Span | null;
  notes: NotesArray | null;
  blocks: SntBlock[];
}

export const NOTE_NAMES = [
  "upnote",
  "ntw",
  "ntc",
  "ntj",
  "ncs",
  "ncx",
  "ncd",
  "nch",
  "ngs",
  "ngx",
  "ngd",
  "ngh",
  "nt",
] as const;

export function isIdentChar(c: string | undefined): boolean {
  return c != null && /[A-Za-z0-9_-]/.test(c);
}

function skipBlockComment(text: string, i: number): number {
  const n = text.length;
  if (text[i] !== "/" || text[i + 1] !== "*") {
    return i;
  }
  let depth = 1;
  i += 2;
  while (i < n && depth > 0) {
    if (text[i] === "/" && text[i + 1] === "*") {
      depth += 1;
      i += 2;
      continue;
    }
    if (text[i] === "*" && text[i + 1] === "/") {
      depth -= 1;
      i += 2;
      continue;
    }
    i += 1;
  }
  return i;
}

function skipLineComment(text: string, i: number): number {
  const n = text.length;
  i += 2;
  while (i < n && text[i] !== "\n") {
    i += 1;
  }
  return i;
}

function skipString(text: string, i: number): number {
  const n = text.length;
  const q = text[i];
  i += 1;
  while (i < n) {
    if (text[i] === "\\") {
      i += 2;
      continue;
    }
    if (text[i] === q) {
      return i + 1;
    }
    i += 1;
  }
  return i;
}

/** 跳过空白、行注释、块注释。 */
export function skipTrivia(text: string, i: number): number {
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i += 1;
      continue;
    }
    if (c === "/" && text[i + 1] === "/" && text[i - 1] !== ":") {
      i = skipLineComment(text, i);
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      i = skipBlockComment(text, i);
      continue;
    }
    break;
  }
  return i;
}

function openerOf(c: string | undefined): string | null {
  if (c === "(") {
    return ")";
  }
  if (c === "[") {
    return "]";
  }
  if (c === "{") {
    return "}";
  }
  return null;
}

/**
 * 从 openIndex（正指向 ( [ {）匹配到对应闭合符之后。
 * 失败返回 -1。
 */
export function matchBalanced(text: string, openIndex: number): number {
  const open = text[openIndex];
  const close = openerOf(open);
  if (!close) {
    return -1;
  }
  const n = text.length;
  let depth = 1;
  let i = openIndex + 1;
  while (i < n) {
    i = skipTrivia(text, i);
    if (i >= n) {
      return -1;
    }
    const c = text[i];
    if (c === '"') {
      i = skipString(text, i);
      continue;
    }
    if (openerOf(c)) {
      depth += 1;
      i += 1;
      continue;
    }
    if (c === close || c === ")" || c === "]" || c === "}") {
      if (c === close) {
        depth -= 1;
        i += 1;
        if (depth === 0) {
          return i;
        }
        continue;
      }
      depth -= 1;
      i += 1;
      if (depth === 0) {
        return i;
      }
      continue;
    }
    i += 1;
  }
  return -1;
}

function matchNameAt(text: string, i: number, names: readonly string[]): string | null {
  for (const name of names) {
    if (text.startsWith(name, i) && !isIdentChar(text[i + name.length])) {
      return name;
    }
  }
  return null;
}

/** 从 `#` 解析一枚 #nt* 调用（不含 #py）。 */
export function parseNoteCall(text: string, hashIndex: number): NoteCall | null {
  if (text[hashIndex] !== "#") {
    return null;
  }
  let i = hashIndex + 1;
  const name = matchNameAt(text, i, NOTE_NAMES);
  if (!name) {
    return null;
  }
  i += name.length;
  i = skipTrivia(text, i);
  let args: Span | null = null;
  if (text[i] === "(") {
    const end = matchBalanced(text, i);
    if (end < 0) {
      return null;
    }
    args = { start: i, end };
    i = skipTrivia(text, end);
  }
  if (text[i] !== "[") {
    return null;
  }
  const wordEnd = matchBalanced(text, i);
  if (wordEnd < 0) {
    return null;
  }
  const word: ContentSpan = {
    start: i,
    end: wordEnd,
    innerStart: i + 1,
    innerEnd: wordEnd - 1,
  };
  i = wordEnd;
  const afterWord = i;
  i = skipTrivia(text, i);
  let note: ContentSpan | null = null;
  if (text[i] === "[") {
    const noteEnd = matchBalanced(text, i);
    if (noteEnd < 0) {
      return null;
    }
    note = {
      start: i,
      end: noteEnd,
      innerStart: i + 1,
      innerEnd: noteEnd - 1,
    };
    i = noteEnd;
  } else {
    i = afterWord;
  }
  return {
    start: hashIndex,
    end: i,
    name,
    args,
    word,
    note,
    light: note == null,
  };
}

export function findNoteCalls(text: string, from: number, to: number): NoteCall[] {
  const out: NoteCall[] = [];
  let i = from;
  const limit = to;
  while (i < limit) {
    const j = skipTrivia(text, i);
    if (j > i) {
      i = j;
      continue;
    }
    if (text[i] === '"') {
      i = skipString(text, i);
      continue;
    }
    if (text[i] === "#") {
      const call = parseNoteCall(text, i);
      if (call && call.end <= limit) {
        out.push(call);
        i = call.end;
        continue;
      }
    }
    i += 1;
  }
  return out;
}

function parseNotesArray(text: string, openParen: number): NotesArray | null {
  const close = matchBalanced(text, openParen);
  if (close < 0) {
    return null;
  }
  const items: NotesItem[] = [];
  const limit = close - 1;
  let i = openParen + 1;
  while (i < limit) {
    i = skipTrivia(text, i);
    if (i >= limit) {
      break;
    }
    if (text[i] === ",") {
      i += 1;
      continue;
    }
    if (text[i] === "[") {
      const end = matchBalanced(text, i);
      if (end < 0 || end - 1 > limit) {
        break;
      }
      const innerStart = i + 1;
      const innerEnd = end - 1;
      items.push({
        start: i,
        end,
        innerStart,
        innerEnd,
        empty: text.slice(innerStart, innerEnd).trim() === "",
      });
      i = end;
      continue;
    }
    i += 1;
  }
  return { start: openParen, end: close, items };
}

function findNotesArg(text: string, parenStart: number, parenEnd: number): NotesArray | null {
  let i = parenStart + 1;
  let depth = 1;
  while (i < parenEnd) {
    const j = skipTrivia(text, i);
    if (j > i) {
      i = j;
      continue;
    }
    if (text[i] === '"') {
      i = skipString(text, i);
      continue;
    }
    const c = text[i];
    if (c === "(" || c === "[" || c === "{") {
      depth += 1;
      i += 1;
      continue;
    }
    if (c === ")" || c === "]" || c === "}") {
      depth -= 1;
      i += 1;
      continue;
    }
    if (
      depth === 1 &&
      text.startsWith("notes", i) &&
      !isIdentChar(text[i - 1]) &&
      !isIdentChar(text[i + 5])
    ) {
      let k = skipTrivia(text, i + 5);
      if (text[k] === ":") {
        k = skipTrivia(text, k + 1);
        if (text[k] === "(") {
          return parseNotesArray(text, k);
        }
      }
    }
    i += 1;
  }
  return null;
}

function parseContentBlocks(text: string, start: number): { blocks: ContentSpan[]; end: number } {
  const blocks: ContentSpan[] = [];
  let i = start;
  while (true) {
    const j = skipTrivia(text, i);
    if (text[j] !== "[") {
      break;
    }
    const end = matchBalanced(text, j);
    if (end < 0) {
      break;
    }
    blocks.push({
      start: j,
      end,
      innerStart: j + 1,
      innerEnd: end - 1,
    });
    i = end;
  }
  return { blocks, end: i };
}

export function parseSntCall(text: string, hashIndex: number): SntCall | null {
  if (!text.startsWith("#snt", hashIndex)) {
    return null;
  }
  if (isIdentChar(text[hashIndex + 4])) {
    return null;
  }
  let i = skipTrivia(text, hashIndex + 4);
  let paren: Span | null = null;
  let notes: NotesArray | null = null;
  if (text[i] === "(") {
    const end = matchBalanced(text, i);
    if (end < 0) {
      return null;
    }
    paren = { start: i, end };
    notes = findNotesArg(text, i, end);
    i = end;
  }
  const parsed = parseContentBlocks(text, i);
  if (parsed.blocks.length === 0) {
    return null;
  }
  const blocks: SntBlock[] = parsed.blocks.map((block) => {
    const calls = findNoteCalls(text, block.innerStart, block.innerEnd);
    return {
      ...block,
      calls,
      light: calls.filter((c) => c.light),
    };
  });
  return {
    start: hashIndex,
    end: parsed.end,
    paren,
    notes,
    blocks,
  };
}

export function findSntCalls(text: string): SntCall[] {
  const out: SntCall[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const j = skipTrivia(text, i);
    if (j > i) {
      i = j;
      continue;
    }
    if (text[i] === '"') {
      i = skipString(text, i);
      continue;
    }
    if (text[i] === "#" && text.startsWith("#snt", i) && !isIdentChar(text[i + 4])) {
      const call = parseSntCall(text, i);
      if (call) {
        out.push(call);
        i = call.end;
        continue;
      }
    }
    i += 1;
  }
  return out;
}

export function findSntAt(
  text: string,
  offset: number,
  sntCalls: SntCall[] | null = null,
): SntCall | undefined {
  const calls = sntCalls ?? findSntCalls(text);
  let best: SntCall | undefined;
  for (const snt of calls) {
    if (snt.start <= offset && offset < snt.end) {
      if (!best || snt.end - snt.start < best.end - best.start) {
        best = snt;
      }
    }
  }
  return best;
}

export function blockIndexAt(snt: SntCall, offset: number): number {
  for (let i = 0; i < snt.blocks.length; i += 1) {
    const b = snt.blocks[i];
    if (b.start <= offset && offset < b.end) {
      return i;
    }
  }
  return -1;
}

export function noteCallContaining(calls: NoteCall[], offset: number): NoteCall | undefined {
  let best: NoteCall | undefined;
  for (const call of calls) {
    if (call.start <= offset && offset < call.end) {
      if (!best || call.end - call.start < best.end - best.start) {
        best = call;
      }
    }
  }
  return best;
}

export function noteCallsIntersecting(calls: NoteCall[], start: number, end: number): NoteCall[] {
  if (end < start) {
    const t = start;
    start = end;
    end = t;
  }
  return calls.filter((c) => c.start < end && c.end > start);
}

export function notesItemContaining(notes: NotesArray | null, offset: number): number {
  if (!notes) {
    return -1;
  }
  for (let i = 0; i < notes.items.length; i += 1) {
    const it = notes.items[i];
    if (it.start <= offset && offset < it.end) {
      return i;
    }
  }
  return -1;
}

export function indentAt(text: string, offset: number): string {
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  let i = lineStart;
  while (i < offset && (text[i] === " " || text[i] === "\t")) {
    i += 1;
  }
  return text.slice(lineStart, i);
}

export function lineStartAt(text: string, offset: number): number {
  return text.lastIndexOf("\n", offset - 1) + 1;
}
