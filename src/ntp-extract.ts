/**
 * 从 #ntp 收集古文正文：去掉 #nt* / #py 等宏，按「#snt 前空行」分段。
 */

import {
  NOTE_NAMES,
  type NtpCall,
  findNtpCalls,
  findSntCalls,
  parseNoteCall,
  skipComment,
} from "./snt-parse";

const STRIP_NAMES: readonly string[] = [...NOTE_NAMES, "py"];

function stripMarkup(text: string, from: number, to: number): string {
  let out = "";
  let i = from;
  while (i < to) {
    const afterComment = skipComment(text, i);
    if (afterComment > i) {
      i = afterComment;
      continue;
    }
    if (text[i] === "#") {
      const call = parseNoteCall(text, i, STRIP_NAMES);
      if (call && call.end <= to) {
        out += stripMarkup(text, call.word.innerStart, call.word.innerEnd);
        i = call.end;
        continue;
      }
    }
    out += text[i];
    i += 1;
  }
  return out;
}

/** 句内折行与缩进是源码排版，不是正文空格。 */
function flattenSentence(raw: string): string {
  return raw.replace(/[ \t]*\r?\n[ \t]*/g, "").trim();
}

/** #snt 前的空隙里是否有空行（分段标记）。 */
export function hasParagraphBreak(text: string, from: number, to: number): boolean {
  return /\n[ \t]*\r?\n/.test(text.slice(from, to));
}

export interface ExtractRange {
  start: number;
  end: number;
  eol?: string;
}

function ntpContains(ntp: { start: number; end: number }, offset: number): boolean {
  return ntp.start <= offset && offset < ntp.end;
}

function ntpIntersects(
  ntp: { start: number; end: number },
  start: number,
  end: number,
): boolean {
  return ntp.start < end && ntp.end > start;
}

function selectNtps(ntps: NtpCall[], start: number, end: number): NtpCall[] {
  if (start === end) {
    const hits = ntps.filter((n) => ntpContains(n, start));
    if (hits.length === 0) {
      return [];
    }
    hits.sort((a, b) => a.end - a.start - (b.end - b.start));
    return [hits[0]];
  }
  return ntps.filter((n) => ntpIntersects(n, start, end));
}

/**
 * 收集指定范围内的 #ntp 古文。
 * 无选区（start === end）：只取光标所在的 #ntp（若套叠则取最内层）。
 * 有选区：取与选区相交的全部 #ntp。
 * 同一段内的句子直接拼接；#snt 前空行另起一段；多个 #ntp 之间空两行。
 */
export function extractNtpPlainText(text: string, range: ExtractRange): string {
  const eol = range.eol ?? "\n";
  const ntps = selectNtps(findNtpCalls(text), range.start, range.end);
  if (ntps.length === 0) {
    return "";
  }
  const snts = findSntCalls(text);
  const articles: string[] = [];

  for (const ntp of ntps) {
    const { innerStart, innerEnd } = ntp.body;
    const mine = snts.filter((s) => s.start >= innerStart && s.end <= innerEnd);
    const paragraphs: string[][] = [];
    let current: string[] = [];
    let prevEnd = innerStart;

    for (const snt of mine) {
      if (current.length > 0 && hasParagraphBreak(text, prevEnd, snt.start)) {
        paragraphs.push(current);
        current = [];
      }
      const wen = snt.blocks[0];
      if (wen) {
        const sentence = flattenSentence(stripMarkup(text, wen.innerStart, wen.innerEnd));
        if (sentence) {
          current.push(sentence);
        }
      }
      prevEnd = snt.end;
    }
    if (current.length > 0) {
      paragraphs.push(current);
    }
    const article = paragraphs.map((p) => p.join("")).join(eol + eol);
    if (article) {
      articles.push(article);
    }
  }

  return articles.join(eol + eol + eol);
}
