//// 以下是模版的控制信息
#import "lib/book-setup.typ": (
  bz, exercise-debug, fonts, lxt, notes, nt, ntc, ntj, ntp, ntw, pxt, py, setup-book, sizes, snt, translation, tzg,
  upnote, xzt,
)
// 三段字号下限16、14、12，注释下限10.5
// 每篇文章只排一面，高度不够时可增加标准高度（297mm）的倍数
#show: setup-book.with(width: 210mm, height: 297mm * 2, size: 14pt)

// 打开后练习题透明答案改为深红色；正式出片时请注释掉
#exercise-debug()
//// 以下开始排正文

= 一年之计#super[\*]

// 题注
#notes[\* 本文选自《管子》。题目为后人所加。]

// 每篇一个#ntp(注释、翻译、拼音集成版式)

#ntp[
  #snt(notes: (
    [种植谷物],
    [栽种树木],
    [培养人才],
  ))[
    一年之计，莫如#ntc[树谷]；十年之计，莫如#ntc[树木]；终身之计，莫如#ntc[树人]。
  ][
    一年的计划，没有比种植谷物更合适的；十年的计划，没有比栽种树木更合适的；一生的计划，没有比培养人才更合适的。
  ][
    yī nián zhī jì mò rú shù gǔ shí nián zhī jì mò rú shù mù zhōng shēn zhī jì mò rú shù rén
  ]
  #snt(notes: ())[
    一树一获者，谷也；一树十获者，木也；一树百获者，人也。
  ][
    种植一次收获一次的，是谷物；种植一次收获十次的，是树木；种植一次收获百次的，是人才。
  ][
    yī shù yī huò zhě gǔ yě yī shù shí huò zhě mù yě yī shù bǎi huò zhě rén yě
  ]
]

// 竖向空白
#v(5em)
// 备注
#bz[这里是备注，可记录发现的问题。]




= 人一能之#super[\*]

// 题注
#notes[\* 本文选自《十三经注疏》。题目为后人所加。]

// 每篇一个#ntp(注释、翻译、拼音集成版式)

#ntp[
  #snt(notes: (
    [通“己”，自己],
    [即使，表让步],
  ))[
    人一能之，#ntc[已]百之；人十能之，已千之。果能此道矣，#ntc[虽]愚必明，虽柔必强。
  ][
    别人一次就能做到的，自己就用百倍的努力去做到；别人十次能做到的，自己就用千倍的努力去做到。如果真能践行这个道理，即使天资愚钝也必定变得聪明，即使性格柔弱也必定变得刚强。
  ][
    rén yī néng zhī yǐ bǎi zhī rén shí néng zhī yǐ qiān zhī guǒ néng cǐ dào yǐ suī yú bì míng suī róu bì qiáng
  ]

]

// 竖向空白
#v(5em)
// 备注
#bz[这里是备注，可记录发现的问题。]



= 人一能之#super[\*]

// 题注
#notes[\* 本文选自《十三经注疏》。题目为后人所加。]

// 每篇一个#ntp(注释、翻译、拼音集成版式)

#ntp[
  #snt(notes: (
    [通“己”，自己],
  ))[
    人一能之，#ntc[已]百之；人十能之，已千之。
  ][
    别人一次就能做到的，自己就用百倍的努力去做到；别人十次能做到的，自己就用千倍的努力去做到。
  ][
    rén yī néng zhī yǐ bǎi zhī rén shí néng zhī yǐ qiān zhī
  ]
  #snt(notes: (
    [即使，表让步],
  ))[
    果能此道矣，#ntc[虽]愚必明，虽柔必强。
  ][
    如果真能践行这个道理，即使天资愚钝也必定变得聪明，即使性格柔弱也必定变得刚强。
  ][
    guǒ néng cǐ dào yǐ suī yú bì míng suī róu bì qiáng
  ]
]

// 竖向空白
#v(5em)
// 备注
#bz[这里是备注，可记录发现的问题。]




