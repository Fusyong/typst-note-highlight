/**
 * 拆分 / 合并相邻 #snt。
 * 拆分要求正文与译文的光标数量相同，按从左到右一一对应；
 * 拼音按各段汉字槽数切开，notes 按轻锚点落在哪一段分配。
 */

import { type EditOptions, type EditResult, fail, succeed } from "./snt-edit";
import {
  type NoteCall,
  type SntBlock,
  type SntCall,
  findSntAt,
  findSntCalls,
  indentAt,
  skipTrivia,
} from "./snt-parse";

function isHan(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0x3400 && code <= 0x9fff) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0x20000 && code <= 0x2fa1f)
  );
}

function isSpace(ch: string | undefined): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function onlyWhitespace(s: string): boolean {
  return /^\s*$/.test(s);
}

function trimBlockInner(inner: string): string {
  return inner.replace(/^\s+/, "").replace(/\s+$/, "");
}

function blockNonEmpty(inner: string): boolean {
  return (
    inner
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "")
      .trim() !== ""
  );
}

function forEachVisible(
  text: string,
  from: number,
  to: number,
  calls: NoteCall[],
  visit: (index: number, ch: string) => boolean,
): void {
  const nested = calls
    .filter((c) => c.start >= from && c.end <= to)
    .sort((a, b) => a.start - b.start);
  let i = from;
  for (const call of nested) {
    while (i < call.start && i < to) {
      if (!visit(i, text[i])) {
        return;
      }
      i += 1;
    }
    for (let k = call.word.innerStart; k < call.word.innerEnd; k += 1) {
      if (!visit(k, text[k])) {
        return;
      }
    }
    i = call.end;
  }
  while (i < to) {
    if (!visit(i, text[i])) {
      return;
    }
    i += 1;
  }
}

function countHan(text: string, from: number, to: number, calls: NoteCall[]): number {
  let n = 0;
  forEachVisible(text, from, to, calls, (_i, ch) => {
    if (isHan(ch)) {
      n += 1;
    }
    return true;
  });
  return n;
}

function callContainingStrict(calls: NoteCall[], offset: number): NoteCall | undefined {
  return calls.find((c) => c.start < offset && offset < c.end);
}

function parseYinSlots(inner: string): string[] {
  const s = inner.replace(/[\n\t\r]+/g, " ").trim();
  if (!s) {
    return [];
  }
  return s.split(" ");
}

/** 按各段汉字数切拼音槽；最后一段拿走剩余槽，以免丢音节。 */
function splitYinByHanCounts(inner: string, hanCounts: number[]): string[] {
  const slots = parseYinSlots(inner);
  const parts: string[] = [];
  let at = 0;
  for (let i = 0; i < hanCounts.length; i += 1) {
    const isLast = i === hanCounts.length - 1;
    const n = isLast
      ? Math.max(slots.length - at, 0)
      : Math.min(Math.max(hanCounts[i], 0), Math.max(slots.length - at, 0));
    parts.push(slots.slice(at, at + n).join(" "));
    at += n;
  }
  return parts;
}

function notesKeyStart(text: string, snt: SntCall): number {
  if (!snt.notes || !snt.paren) {
    return -1;
  }
  let i = snt.notes.start;
  while (i > snt.paren.start && isSpace(text[i - 1])) {
    i -= 1;
  }
  if (text[i - 1] !== ":") {
    return -1;
  }
  i -= 1;
  while (i > snt.paren.start && isSpace(text[i - 1])) {
    i -= 1;
  }
  if (i >= 5 && text.slice(i - 5, i) === "notes") {
    return i - 5;
  }
  return -1;
}

function otherParenArgs(text: string, snt: SntCall): string {
  if (!snt.paren) {
    return "";
  }
  const innerStart = snt.paren.start + 1;
  const innerEnd = snt.paren.end - 1;
  if (!snt.notes) {
    return text.slice(innerStart, innerEnd).trim();
  }
  const key = notesKeyStart(text, snt);
  if (key < 0) {
    return text.slice(innerStart, innerEnd).trim();
  }
  let before = text.slice(innerStart, key).trim();
  let after = text.slice(snt.notes.end, innerEnd).trim();
  if (before.endsWith(",")) {
    before = before.slice(0, -1).trim();
  }
  if (after.startsWith(",")) {
    after = after.slice(1).trim();
  }
  if (!before) {
    return after;
  }
  if (!after) {
    return before;
  }
  return `${before}, ${after}`;
}

interface BlockStyle {
  multiline: boolean;
  contentIndent: string;
  closeIndent: string;
}

function detectBlockStyle(text: string, block: SntBlock, indent: string): BlockStyle {
  const openInner = text.slice(block.start + 1, Math.min(block.innerEnd, block.start + 8));
  const multiline = openInner.includes("\n");
  if (!multiline) {
    return { multiline: false, contentIndent: "", closeIndent: "" };
  }
  const first = skipTrivia(text, block.innerStart);
  const contentIndent = first < block.innerEnd ? indentAt(text, first) : `${indent}  `;
  return { multiline: true, contentIndent, closeIndent: indent };
}

interface NotesEmitStyle {
  multiline: boolean;
  itemIndent: string;
}

function detectNotesStyle(text: string, snt: SntCall, indent: string): NotesEmitStyle {
  if (!snt.notes || snt.notes.items.length === 0) {
    return { multiline: true, itemIndent: `${indent}  ` };
  }
  const multiline = text.slice(snt.notes.start, snt.notes.end).includes("\n");
  return {
    multiline,
    itemIndent: indentAt(text, snt.notes.items[0].start),
  };
}

function wrapBlock(inner: string, style: BlockStyle, eol: string): string {
  if (!style.multiline) {
    return `[${trimBlockInner(inner)}]`;
  }
  const trimmed = trimBlockInner(inner);
  if (!trimmed) {
    return `[${eol}${style.closeIndent}]`;
  }
  return `[${eol}${style.contentIndent}${trimmed}${eol}${style.closeIndent}]`;
}

function emitNotesArg(
  inners: string[],
  style: NotesEmitStyle,
  closeIndent: string,
  eol: string,
): string {
  if (!style.multiline) {
    return `notes: (${inners.map((s) => `[${s}]`).join(", ")})`;
  }
  const lines = inners.map((s) => `${style.itemIndent}[${s}],`);
  return `notes: (${eol}${lines.join(eol)}${eol}${closeIndent})`;
}

function emitSnt(
  indent: string,
  eol: string,
  otherArgs: string,
  notesInners: string[] | null,
  notesStyle: NotesEmitStyle,
  blockSources: string[],
): string {
  let head = "#snt";
  const notesArg =
    notesInners && notesInners.length > 0
      ? emitNotesArg(notesInners, notesStyle, indent, eol)
      : null;
  if (notesArg && otherArgs) {
    head += `(${otherArgs}, ${notesArg})`;
  } else if (notesArg) {
    head += `(${notesArg})`;
  } else if (otherArgs) {
    head += `(${otherArgs})`;
  }
  return head + blockSources.join("");
}

function notesInnersOf(text: string, snt: SntCall): string[] | null {
  const lightCount = snt.blocks[0]?.light.length ?? 0;
  if (snt.notes) {
    const items = snt.notes.items.map((it) => text.slice(it.innerStart, it.innerEnd));
    if (lightCount > items.length) {
      return items.concat(Array.from({ length: lightCount - items.length }, () => ""));
    }
    return items;
  }
  if (lightCount > 0) {
    return Array.from({ length: lightCount }, () => "");
  }
  return null;
}

function splitNotesAt(
  text: string,
  snt: SntCall,
  wenSplits: number[],
): (string[] | null)[] {
  const wen = snt.blocks[0];
  const lights = wen?.light ?? [];
  const n = wenSplits.length + 1;
  const all = notesInnersOf(text, snt);
  if (!all || !wen) {
    return Array.from({ length: n }, () => null);
  }
  const bounds = [wen.innerStart, ...wenSplits, wen.innerEnd];
  const counts: number[] = [];
  let li = 0;
  for (let seg = 0; seg < n; seg += 1) {
    const end = bounds[seg + 1];
    let count = 0;
    while (li < lights.length && lights[li].end <= end) {
      count += 1;
      li += 1;
    }
    counts.push(count);
  }
  const groups: string[][] = [];
  let at = 0;
  for (let seg = 0; seg < n; seg += 1) {
    const take = seg === n - 1 ? all.length - at : counts[seg];
    groups.push(all.slice(at, at + take));
    at += take;
  }
  return groups.map((g) => (g.length ? g : null));
}

function sliceAt(text: string, block: SntBlock, splits: number[]): string[] {
  const bounds = [block.innerStart, ...splits, block.innerEnd];
  const parts: string[] = [];
  for (let i = 0; i < bounds.length - 1; i += 1) {
    parts.push(text.slice(bounds[i], bounds[i + 1]));
  }
  return parts;
}

function hanCountsBetween(text: string, block: SntBlock, splits: number[]): number[] {
  const bounds = [block.innerStart, ...splits, block.innerEnd];
  const counts: number[] = [];
  for (let i = 0; i < bounds.length - 1; i += 1) {
    counts.push(countHan(text, bounds[i], bounds[i + 1], block.calls));
  }
  return counts;
}

function inBlockInner(block: SntBlock | undefined, offset: number): boolean {
  return block != null && offset > block.innerStart && offset < block.innerEnd;
}

function stylesFrom(text: string, snt: SntCall, indent: string): BlockStyle[] {
  return snt.blocks.map((b) => detectBlockStyle(text, b, indent));
}

function blockSource(
  inner: string,
  index: number,
  styles: BlockStyle[],
  indent: string,
  eol: string,
): string {
  const style = styles[index] ?? styles[0] ?? {
    multiline: true,
    contentIndent: `${indent}  `,
    closeIndent: indent,
  };
  return wrapBlock(inner, style, eol);
}

/** 按正文、译文中数量相同的光标把当前 #snt 拆成多句。 */
export function splitSnt(
  text: string,
  cursors: number[],
  options: EditOptions = {},
): EditResult {
  const eol = options.eol ?? "\n";
  const offsets = [...new Set(cursors)].sort((a, b) => a - b);
  if (offsets.length === 0) {
    return fail("请在正文和译文中插入相同数量的光标");
  }

  const located = offsets.map((offset) => ({ offset, snt: findSntAt(text, offset) }));
  if (located.some((item) => !item.snt)) {
    return fail("光标不在 #snt 中");
  }
  const snt = located[0].snt;
  if (!snt || located.some((item) => item.snt?.start !== snt.start)) {
    return fail("请把光标放在同一个 #snt 中");
  }

  const wen = snt.blocks[0];
  if (!wen) {
    return fail("这个 #snt 没有正文");
  }
  const yi = snt.blocks[1];
  const yiNeeded = yi != null && blockNonEmpty(text.slice(yi.innerStart, yi.innerEnd));

  const wenOffsets: number[] = [];
  const yiOffsets: number[] = [];
  for (const { offset } of located) {
    if (inBlockInner(wen, offset)) {
      wenOffsets.push(offset);
    } else if (inBlockInner(yi, offset)) {
      yiOffsets.push(offset);
    } else {
      return fail(yi ? "请只在正文和译文中放置光标" : "请把光标放在正文里");
    }
  }

  if (yiNeeded) {
    if (wenOffsets.length === 0 || wenOffsets.length !== yiOffsets.length) {
      return fail(
        `请在正文和译文中插入相同数量的光标（正文 ${wenOffsets.length} 处，译文 ${yiOffsets.length} 处）`,
      );
    }
  } else if (yiOffsets.length > 0) {
    return fail("译文是空的，请只在正文中放置光标");
  } else if (wenOffsets.length === 0) {
    return fail("请在正文中放置光标");
  }

  if (wenOffsets.some((offset) => callContainingStrict(wen.calls, offset))) {
    return fail("请勿在注释宏中间拆分");
  }
  if (yi && yiOffsets.some((offset) => callContainingStrict(yi.calls, offset))) {
    return fail("请勿在注释宏中间拆分");
  }

  const n = wenOffsets.length + 1;
  const wenParts = sliceAt(text, wen, wenOffsets);
  if (wenParts.some((part) => !blockNonEmpty(part))) {
    return fail("拆分后一侧正文会为空，请换一个位置");
  }

  let yiParts: string[] = [];
  if (yi) {
    yiParts = yiNeeded ? sliceAt(text, yi, yiOffsets) : Array.from({ length: n }, () => "");
    if (yiNeeded && yiParts.some((part) => !blockNonEmpty(part))) {
      return fail("拆分后一侧译文会为空，请换一个位置");
    }
  }

  const yin = snt.blocks[2];
  const yinParts = yin
    ? splitYinByHanCounts(
        text.slice(yin.innerStart, yin.innerEnd),
        hanCountsBetween(text, wen, wenOffsets),
      )
    : [];
  const notesParts = splitNotesAt(text, snt, wenOffsets);

  const indent = indentAt(text, snt.start);
  const notesStyle = detectNotesStyle(text, snt, indent);
  const styles = stylesFrom(text, snt, indent);
  const sources: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const inners = [wenParts[i]];
    if (snt.blocks.length >= 2) {
      inners.push(yiParts[i] ?? "");
    }
    if (snt.blocks.length >= 3) {
      inners.push(yinParts[i] ?? "");
    }
    sources.push(emitHalf(text, snt, indent, eol, notesParts[i], notesStyle, inners, styles));
  }

  const joined = sources.map((src, i) => (i === 0 ? src : `${indent}${src}`)).join(eol);
  const cursor = sources.length > 1 ? sources[0].length + eol.length + indent.length : 0;

  return succeed(text, [
    {
      start: snt.start,
      end: snt.end,
      text: joined,
      cursorOffset: cursor,
    },
  ]);
}

function emitHalf(
  text: string,
  snt: SntCall,
  indent: string,
  eol: string,
  notes: string[] | null,
  notesStyle: NotesEmitStyle,
  blockInners: string[],
  styles: BlockStyle[],
): string {
  const otherArgs = otherParenArgs(text, snt);
  const sources = blockInners.map((inner, i) =>
    blockSource(inner, i, styles, indent, eol),
  );
  return emitSnt(indent, eol, otherArgs, notes, notesStyle, sources);
}

function pickMergePair(
  text: string,
  start: number,
  end: number,
  calls: SntCall[],
): { error: string } | { a: SntCall; b: SntCall } {
  if (calls.length < 2) {
    return { error: "没有可合并的相邻 #snt" };
  }

  const empty = start === end;
  const leftOff = start;
  const rightOff = empty ? start : Math.max(start, end - 1);
  const left = findSntAt(text, leftOff, calls);
  const right = findSntAt(text, rightOff, calls);

  if (left && right && left.start !== right.start) {
    const i = calls.indexOf(left);
    const j = calls.indexOf(right);
    if (Math.abs(j - i) !== 1) {
      return { error: "只能合并相邻的两个 #snt" };
    }
    const a = i < j ? left : right;
    const b = i < j ? right : left;
    return { a, b };
  }

  const snt = left ?? right;
  if (!snt) {
    return { error: "光标不在 #snt 中" };
  }
  const i = calls.indexOf(snt);
  if (i < 0) {
    return { error: "光标不在 #snt 中" };
  }
  if (i + 1 < calls.length) {
    return { a: snt, b: calls[i + 1] };
  }
  if (i > 0) {
    return { a: calls[i - 1], b: snt };
  }
  return { error: "没有可合并的相邻 #snt" };
}

function joinKind(index: number): "wen" | "yi" | "yin" {
  if (index >= 2) {
    return "yin";
  }
  return index === 0 ? "wen" : "yi";
}

function joinInners(a: string, b: string, kind: "wen" | "yi" | "yin"): string {
  const ta = trimBlockInner(a);
  const tb = trimBlockInner(b);
  if (!ta) {
    return tb;
  }
  if (!tb) {
    return ta;
  }
  return kind === "yin" ? `${ta} ${tb}` : `${ta}${tb}`;
}

/** 合并光标所在 #snt 与下一句；在末句则与上一句合并。选区跨两句则合并这两句。 */
export function mergeSnt(
  text: string,
  start: number,
  end: number,
  options: EditOptions = {},
): EditResult {
  const eol = options.eol ?? "\n";
  const calls = findSntCalls(text);
  const pair = pickMergePair(text, start, end, calls);
  if ("error" in pair) {
    return fail(pair.error);
  }
  const { a, b } = pair;
  const between = text.slice(a.end, b.start);
  if (!onlyWhitespace(between)) {
    return fail("两个 #snt 之间还有其他内容，无法合并");
  }

  const indent = indentAt(text, a.start);
  const notesStyle = detectNotesStyle(text, a.notes ? a : b, indent);
  const styles = stylesFrom(text, a.blocks.length ? a : b, indent);
  const otherArgs = otherParenArgs(text, a) || otherParenArgs(text, b);

  const notes = (() => {
    const left = notesInnersOf(text, a);
    const right = notesInnersOf(text, b);
    if (!left && !right) {
      return null;
    }
    const merged = [...(left ?? []), ...(right ?? [])];
    return merged.length ? merged : null;
  })();

  const nBlocks = Math.max(a.blocks.length, b.blocks.length);
  const blockSources: string[] = [];
  for (let i = 0; i < nBlocks; i += 1) {
    const innerA = a.blocks[i]
      ? text.slice(a.blocks[i].innerStart, a.blocks[i].innerEnd)
      : "";
    const innerB = b.blocks[i]
      ? text.slice(b.blocks[i].innerStart, b.blocks[i].innerEnd)
      : "";
    blockSources.push(blockSource(joinInners(innerA, innerB, joinKind(i)), i, styles, indent, eol));
  }

  const merged = emitSnt(indent, eol, otherArgs, notes, notesStyle, blockSources);
  const leftWen = a.blocks[0]
    ? trimBlockInner(text.slice(a.blocks[0].innerStart, a.blocks[0].innerEnd))
    : "";
  const firstBlock = blockSources[0] ?? "";
  const atBlock = merged.indexOf(firstBlock);
  const atWen = leftWen ? firstBlock.indexOf(leftWen) : 0;
  const cursor =
    atBlock >= 0 && atWen >= 0 ? atBlock + atWen + leftWen.length : merged.length;

  return succeed(text, [
    {
      start: a.start,
      end: b.end,
      text: merged,
      cursorOffset: cursor,
    },
  ]);
}
