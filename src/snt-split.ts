/**
 * 拆分 / 合并相邻 #snt。
 * 拆分以古文切分为准，译文按标点对齐（失败则按汉字比例），拼音按汉字槽数切开。
 */

import { type EditOptions, type EditResult, fail, succeed } from "./snt-edit";
import {
  type NoteCall,
  type SntBlock,
  type SntCall,
  blockIndexAt,
  findSntAt,
  findSntCalls,
  indentAt,
  skipTrivia,
} from "./snt-parse";

const ALIGN_PUNCT = "。！？；，、：";

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

function countVisibleChar(
  text: string,
  from: number,
  to: number,
  calls: NoteCall[],
  ch: string,
): number {
  let n = 0;
  forEachVisible(text, from, to, calls, (_i, c) => {
    if (c === ch) {
      n += 1;
    }
    return true;
  });
  return n;
}

function lastAlignPunct(
  text: string,
  from: number,
  to: number,
  calls: NoteCall[],
): string | null {
  let last = "";
  forEachVisible(text, from, to, calls, (_i, ch) => {
    if (!isSpace(ch)) {
      last = ch;
    }
    return true;
  });
  return last && ALIGN_PUNCT.includes(last) ? last : null;
}

function afterNthVisibleChar(
  text: string,
  block: SntBlock,
  ch: string,
  n: number,
): number | null {
  if (n <= 0) {
    return null;
  }
  let seen = 0;
  let found: number | null = null;
  forEachVisible(text, block.innerStart, block.innerEnd, block.calls, (i, c) => {
    if (c === ch) {
      seen += 1;
      if (seen === n) {
        found = i + 1;
        return false;
      }
    }
    return true;
  });
  return found;
}

function afterHanCount(text: string, block: SntBlock, n: number): number {
  if (n <= 0) {
    return block.innerStart;
  }
  let seen = 0;
  let last = block.innerStart;
  let stopped = false;
  forEachVisible(text, block.innerStart, block.innerEnd, block.calls, (i, ch) => {
    last = i + 1;
    if (isHan(ch)) {
      seen += 1;
      if (seen >= n) {
        stopped = true;
        return false;
      }
    }
    return true;
  });
  return stopped ? last : block.innerEnd;
}

function callContainingStrict(calls: NoteCall[], offset: number): NoteCall | undefined {
  return calls.find((c) => c.start < offset && offset < c.end);
}

function snapOutOfMacros(offset: number, calls: NoteCall[]): number {
  const hit = callContainingStrict(calls, offset);
  if (!hit) {
    return offset;
  }
  return offset - hit.start <= hit.end - offset ? hit.start : hit.end;
}

function snapToNearbyPunct(text: string, block: SntBlock, offset: number): number {
  const snapped = snapOutOfMacros(offset, block.calls);
  const window = 4;
  let best: number | null = null;
  let bestDist = window + 1;
  forEachVisible(text, block.innerStart, block.innerEnd, block.calls, (i, ch) => {
    if (ALIGN_PUNCT.includes(ch)) {
      const after = i + 1;
      const dist = Math.abs(after - snapped);
      if (dist < bestDist) {
        bestDist = dist;
        best = after;
      }
    }
    return true;
  });
  return best != null ? snapOutOfMacros(best, block.calls) : snapped;
}

function inferAlignedOffset(
  text: string,
  src: SntBlock,
  srcAbs: number,
  dest: SntBlock,
): number {
  const punct = lastAlignPunct(text, src.innerStart, srcAbs, src.calls);
  if (punct) {
    const n = countVisibleChar(text, src.innerStart, srcAbs, src.calls, punct);
    const at = afterNthVisibleChar(text, dest, punct, n);
    if (at != null) {
      return snapOutOfMacros(at, dest.calls);
    }
  }
  const srcHan = countHan(text, src.innerStart, src.innerEnd, src.calls);
  const leftHan = countHan(text, src.innerStart, srcAbs, src.calls);
  if (srcHan <= 0) {
    return dest.innerStart;
  }
  const destHan = countHan(text, dest.innerStart, dest.innerEnd, dest.calls);
  const target = Math.round((leftHan / srcHan) * destHan);
  const at = afterHanCount(text, dest, target);
  return snapToNearbyPunct(text, dest, at);
}

function parseYinSlots(inner: string): string[] {
  const s = inner.replace(/[\n\t\r]+/g, " ").trim();
  if (!s) {
    return [];
  }
  return s.split(" ");
}

function snapToSlotBoundary(inner: string, localOffset: number): number {
  const n = inner.length;
  let i = Math.max(0, Math.min(localOffset, n));
  if (i < n && isSpace(inner[i])) {
    return i;
  }
  if (i === 0 || isSpace(inner[i - 1])) {
    return i;
  }
  while (i < n && !isSpace(inner[i])) {
    i += 1;
  }
  return i;
}

function yinStyle(inner: string): { leftPad: string; rightPad: string } {
  const start = inner.match(/^\s*/);
  const end = inner.match(/\s*$/);
  return { leftPad: start ? start[0] : "", rightPad: end ? end[0] : "" };
}

function splitYinByHan(inner: string, leftHan: number): { left: string; right: string } {
  const style = yinStyle(inner);
  const slots = parseYinSlots(inner);
  if (slots.length === 0) {
    return { left: "", right: "" };
  }
  const n = Math.min(Math.max(leftHan, 0), slots.length);
  const leftSlots = slots.slice(0, n);
  const rightSlots = slots.slice(n);
  return {
    left: leftSlots.length ? `${style.leftPad}${leftSlots.join(" ")}` : "",
    right: rightSlots.length ? `${rightSlots.join(" ")}${style.rightPad}` : "",
  };
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

function splitNotes(
  text: string,
  snt: SntCall,
  wenSplit: number,
): { left: string[] | null; right: string[] | null } {
  const lights = snt.blocks[0]?.light ?? [];
  const all = notesInnersOf(text, snt);
  if (!all) {
    return { left: null, right: null };
  }
  let leftCount = 0;
  for (const call of lights) {
    if (call.end <= wenSplit) {
      leftCount += 1;
    } else {
      break;
    }
  }
  const left = all.slice(0, leftCount);
  const right = all.slice(leftCount);
  return {
    left: left.length ? left : null,
    right: right.length ? right : null,
  };
}

function sliceBlock(
  text: string,
  block: SntBlock | undefined,
  absSplit: number,
): { left: string; right: string } {
  if (!block) {
    return { left: "", right: "" };
  }
  const inner = text.slice(block.innerStart, block.innerEnd);
  const local = Math.max(0, Math.min(absSplit - block.innerStart, inner.length));
  return { left: inner.slice(0, local), right: inner.slice(local) };
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

function resolveWenSplit(
  text: string,
  snt: SntCall,
  offset: number,
): { error: string } | { wenSplit: number } {
  const wen = snt.blocks[0];
  if (!wen) {
    return { error: "这个 #snt 没有古文块" };
  }

  const inNotes =
    snt.notes != null && offset >= snt.notes.start && offset < snt.notes.end;
  if (inNotes && snt.notes) {
    const lights = wen.light;
    if (lights.length === 0) {
      return { error: "没有轻锚点，请把光标放在古文中拆分" };
    }
    let leftNotes = 0;
    for (const item of snt.notes.items) {
      if (offset <= item.start) {
        break;
      }
      leftNotes += 1;
      if (offset < item.end) {
        break;
      }
    }
    if (leftNotes <= 0) {
      return { wenSplit: snapOutOfMacros(lights[0].start, wen.calls) };
    }
    const idx = Math.min(leftNotes, lights.length) - 1;
    return { wenSplit: snapOutOfMacros(lights[idx].end, wen.calls) };
  }

  const bi = blockIndexAt(snt, offset);
  if (bi < 0) {
    return { error: "请把光标放在古文、译文、拼音或 notes 中再拆分" };
  }
  if (offset <= snt.blocks[bi].innerStart || offset >= snt.blocks[bi].innerEnd) {
    return { error: "请把光标放在块内容里再拆分" };
  }

  if (bi === 0) {
    return { wenSplit: offset };
  }
  if (bi === 1) {
    return { wenSplit: inferAlignedOffset(text, snt.blocks[1], offset, wen) };
  }

  const yin = snt.blocks[2];
  const inner = text.slice(yin.innerStart, yin.innerEnd);
  const snapped = snapToSlotBoundary(inner, offset - yin.innerStart);
  const leftSlots = parseYinSlots(inner.slice(0, snapped));
  return {
    wenSplit: snapOutOfMacros(afterHanCount(text, wen, leftSlots.length), wen.calls),
  };
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

/** 在光标处把当前 #snt 拆成两句。 */
export function splitSnt(
  text: string,
  start: number,
  end: number,
  options: EditOptions = {},
): EditResult {
  const eol = options.eol ?? "\n";
  const offset = start;
  if (start !== end) {
    const a = findSntAt(text, start);
    const b = findSntAt(text, Math.max(start, end - 1));
    if (a && b && a.start !== b.start) {
      return fail("选区跨越了两个 #snt，请缩小范围或改用合并");
    }
  }

  const snt = findSntAt(text, offset);
  if (!snt) {
    return fail("光标不在 #snt 中");
  }

  const resolved = resolveWenSplit(text, snt, offset);
  if ("error" in resolved) {
    return fail(resolved.error);
  }
  const wenSplit = resolved.wenSplit;
  const wen = snt.blocks[0];
  const hit = callContainingStrict(wen.calls, wenSplit);
  if (hit) {
    return fail("请勿在注释宏中间拆分");
  }
  if (wenSplit <= wen.innerStart || wenSplit >= wen.innerEnd) {
    return fail("拆分后一侧古文会为空，请换一个位置");
  }

  const wenParts = sliceBlock(text, wen, wenSplit);
  if (!blockNonEmpty(wenParts.left) || !blockNonEmpty(wenParts.right)) {
    return fail("拆分后一侧古文会为空，请换一个位置");
  }

  const indent = indentAt(text, snt.start);
  const notesStyle = detectNotesStyle(text, snt, indent);
  const styles = stylesFrom(text, snt, indent);
  const notesParts = splitNotes(text, snt, wenSplit);

  const yi = snt.blocks[1];
  const yiSplit = yi ? inferAlignedOffset(text, wen, wenSplit, yi) : wenSplit;
  const yiParts = sliceBlock(text, yi, yiSplit);

  const leftHan = countHan(text, wen.innerStart, wenSplit, wen.calls);
  const yin = snt.blocks[2];
  let yinLeft = "";
  let yinRight = "";
  if (yin) {
    const yinInner = text.slice(yin.innerStart, yin.innerEnd);
    const yinParts = splitYinByHan(yinInner, leftHan);
    yinLeft = yinParts.left;
    yinRight = yinParts.right;
  }

  const leftInners = [wenParts.left];
  const rightInners = [wenParts.right];
  if (snt.blocks.length >= 2) {
    leftInners.push(yiParts.left);
    rightInners.push(yiParts.right);
  }
  if (snt.blocks.length >= 3) {
    leftInners.push(yinLeft);
    rightInners.push(yinRight);
  }

  const leftSrc = emitHalf(
    text,
    snt,
    indent,
    eol,
    notesParts.left,
    notesStyle,
    leftInners,
    styles,
  );
  const rightSrc = emitHalf(
    text,
    snt,
    indent,
    eol,
    notesParts.right,
    notesStyle,
    rightInners,
    styles,
  );
  const joined = `${leftSrc}${eol}${indent}${rightSrc}`;
  const cursor = leftSrc.length + eol.length + indent.length;

  return succeed(text, [
    {
      start: snt.start,
      end: snt.end,
      text: joined,
      cursorOffset: cursor,
    },
  ]);
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
