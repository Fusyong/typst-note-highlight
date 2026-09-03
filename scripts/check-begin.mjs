const begin =
  /(#)((?:ntw|ntc|ntj|upnote|ncs|ncx|ncd|nch|ngs|ngx|ngd|ngh|nt|py)\b)(?:\((?:[^()]|\([^()]*\))*\))?\[/g;
const sntBegin = /(#)(snt)\b/g;

const samples = [
  "#ntw[建和元年][147 年。建和是汉桓帝年号]",
  '#ntc(ln: 1, a: "r")[#py[诏][zhào]][帝王的文书命令]',
  "#ntw(o: -3em)[中表][母亲兄弟姊妹的儿女叫内表]",
  "#ntj[人以其语#py[语][yù]之][有人把孔融的话告诉他]",
  "#nt[撞]",
  "#ntj[有耕者]",
  '#ntc(a: "r", o: 0.2em)[乃通][才予通报引见]',
  "#py[琰][yǎn]",
];

const sntSamples = [
  "#snt[古文][译文]",
  "#snt(notes: ([注1], [注2]))[",
  "#snt(c: \"c\")[",
];

let failed = 0;
for (const s of samples) {
  begin.lastIndex = 0;
  const m = begin.exec(s);
  if (!m) {
    failed += 1;
    console.log("FAIL", s);
  } else {
    console.log("OK  ", m[2], s.slice(0, 48));
  }
}

for (const s of sntSamples) {
  sntBegin.lastIndex = 0;
  const m = sntBegin.exec(s);
  if (!m) {
    failed += 1;
    console.log("FAIL snt", s);
  } else {
    console.log("OK  ", m[2], s.slice(0, 48));
  }
}

process.exit(failed ? 1 : 0);
