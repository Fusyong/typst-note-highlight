import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { findNtpCalls } = require("../out/snt-parse.js");
const { extractNtpPlainText, hasParagraphBreak } = require("../out/ntp-extract.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let failed = 0;
let passed = 0;

function assert(name, cond, detail) {
  if (cond) {
    passed += 1;
    console.log(`OK   ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}`);
    if (detail) console.error("     ", detail);
  }
}

const fixture = `#ntp[
  #snt(notes: ([a],))[
    #ntw[宋人]#ntj[有耕者]，田中有#ntc[株]。
  ][译][pin]
  #snt[
    兔#ntc[走]#ntc[触]株，折#nt[颈]而死。
  ][译][pin]

  #snt[
    兔不可复得。
  ][译][pin]
]
`;

assert("无空行的两句同一段", !hasParagraphBreak("]\n  #snt[", 0, 8));
assert("空行即分段", hasParagraphBreak("]\n\n  #snt[", 0, 10));

function all(text, eol) {
  return extractNtpPlainText(text, { start: 0, end: text.length, eol });
}

const extracted = all(fixture);
assert(
  "去宏并按空行分段",
  extracted === "宋人有耕者，田中有株。兔走触株，折颈而死。\n\n兔不可复得。",
  JSON.stringify(extracted),
);

const nested = `#ntp[
  #snt[
    太后#ntc(ln: 1)[#py[诏][zhào]]问。
  ][译][pin]
]
`;
assert(
  "嵌套 #py 只留底字",
  all(nested) === "太后诏问。",
  JSON.stringify(all(nested)),
);

const commented = `#ntp[
  /*
  假正文应忽略
  */
  #snt[
    // 行注释
    真#nt[文]。
  ][译][pin]
]
`;
assert(
  "注释不进入正文",
  all(commented) === "真文。",
  JSON.stringify(all(commented)),
);

const twoNtp = `#ntp[
  #snt[甲。][译][pin]
]
#ntp[
  #snt[乙。][译][pin]
]
`;
assert(
  "多个 #ntp 全选时空两行",
  all(twoNtp) === "甲。\n\n\n乙。",
  JSON.stringify(all(twoNtp)),
);

const ntps2 = findNtpCalls(twoNtp);
assert("twoNtp 解析到 2 个", ntps2.length === 2, ntps2.length);
const inJia = twoNtp.indexOf("甲");
const inYi = twoNtp.indexOf("乙");
assert(
  "光标在第一段只收甲",
  extractNtpPlainText(twoNtp, { start: inJia, end: inJia }) === "甲。",
  JSON.stringify(extractNtpPlainText(twoNtp, { start: inJia, end: inJia })),
);
assert(
  "光标在第二段只收乙",
  extractNtpPlainText(twoNtp, { start: inYi, end: inYi }) === "乙。",
  JSON.stringify(extractNtpPlainText(twoNtp, { start: inYi, end: inYi })),
);
const between = ntps2[0].end;
assert(
  "光标在两段之间为空",
  extractNtpPlainText(twoNtp, { start: between, end: between }) === "",
);
assert(
  "选区只碰到第一段只收甲",
  extractNtpPlainText(twoNtp, { start: inJia, end: inJia + 1 }) === "甲。",
);
assert(
  "选区横跨两段都收",
  extractNtpPlainText(twoNtp, { start: inJia, end: inYi + 1 }) === "甲。\n\n\n乙。",
  JSON.stringify(extractNtpPlainText(twoNtp, { start: inJia, end: inYi + 1 })),
);

assert("没有 #ntp 则空串", all("#snt[甲][译]") === "");

const mid = fs.readFileSync(path.join(root, "tests", "样张-中段.typ"), "utf8");
const midText = all(mid);
assert("样张-中段 解析到 #ntp", findNtpCalls(mid).length === 1, findNtpCalls(mid).length);
assert(
  "样张-中段 正文去宏为一段",
  midText ===
    "宋人有耕者，田中有株。兔走触株，折颈而死。因释其耒而守株，冀复得兔。兔不可复得，而身为宋国笑。",
  JSON.stringify(midText),
);

const high = fs.readFileSync(path.join(root, "tests", "样张-高段.typ"), "utf8");
const highText = all(high);
const highNtps = findNtpCalls(high);
assert("样张-高段 两个 #ntp", highNtps.length === 2, highNtps.length);
const cursorKong = high.indexOf("孔文举");
const onlyKong = extractNtpPlainText(high, { start: cursorKong, end: cursorKong });
assert(
  "光标在小时了了不收黄琬",
  onlyKong.includes("孔文举") && !onlyKong.includes("琬字子琰"),
  onlyKong.slice(0, 40),
);

const wan = "琬字子琰。少失父。早而辩慧。祖父琼，初为魏郡太守。建和元年正月日食，京师不见而琼以状闻。太后诏问所食多少，琼思其对而未知所况。琬年七岁，在傍，曰：“何不言日食之余，如月之初？”琼大惊，即以其言应诏，而深奇爱之。";
assert("黄琬段与篇首注释一致", highText.startsWith(wan), JSON.stringify(highText.slice(0, 80)));

const paras = highText
  .split(/\n{2,}/)
  .map((p) => p.trim())
  .filter(Boolean);
assert(
  "小时了了 按空行分成三段",
  paras.some((p) => p.startsWith("孔文举年十岁")) &&
    paras.some((p) => p.startsWith("文举至门")) &&
    paras.some((p) => p.startsWith("太中大夫陈韪后至")),
  paras.filter((p) => p.includes("孔文举") || p.includes("文举至门") || p.includes("陈韪")).join(" | "),
);

const kong = paras.find((p) => p.startsWith("孔文举年十岁"));
assert(
  "孔文举段含第二句且无空行拼接",
  kong != null && kong.includes("时李元礼有盛名") && !kong.includes("\n"),
  kong,
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
