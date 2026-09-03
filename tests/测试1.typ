#import "lib/book-setup.typ": (
  bz, exercise-debug, fonts, notes, nt, ntc, ntj, ntp, ntw, px, py, setup-book, sizes, snt, translation, upnote, xt,
)

/// 三段字号下限16、14、12，注释下限10.5
/// 如果出现译文混乱的情况，可尝试微调宽度
#show: setup-book.with(width: 210mm, height: 500mm, size: 14pt)

// 打开后练习题透明答案改为深红色；正式出片请注释掉
#exercise-debug()

= 南辕北辙

#ntp[
  #snt[
    魏王欲攻邯郸，#bz[审校：此处「邯郸」是否需加注？]季梁闻之，#nt[中道而反][中途返回]，#nt[衣焦不申][衣服皱缩而不展平]，#nt[头尘不浴][头上沾满尘土而不洗濯]，往见王曰：
  ][
    魏王打算攻打邯郸，季梁听说后，立刻中途返回，衣服皱缩也不展平，头上沾满尘土也不洗濯，急忙去见魏王说：
  ][
    wèi wáng yù gōng hán dān jì liáng wén zhī zhōng dào ér fǎn yī jiāo bù shēn tóu chén bú yù wǎng jiàn wáng yuē
  ]
  #snt[
    “今者臣来，见人于#nt[大行][大道]，方#nt[北面][面向北方]而持其驾，告臣曰：‘我欲#nt[之楚][前往楚国]。’
  ][
    “刚才我来的时候，在大道上遇见一个人，正面向北方驾着车，告诉我说：‘我要去楚国。’
  ][
    jīn zhě chén lái jiàn rén yú dà háng fāng běi miàn ér chí qí jià gào chén yuē wǒ yù zhī chǔ
  ]
  #snt[
    臣曰：‘君之楚，将#nt[奚为][为何]北面？’
  ][
    我说：‘您要去楚国，为何却往北走？’
  ][
    chén yuē jūn zhī chǔ jiāng xī wéi běi miàn
  ]
  #snt[
    曰：‘吾马良。’
  ][
    他说：‘我的马很好。’
  ][
    yuē wú mǎ liáng
  ]
  #snt[
    臣曰：‘马虽良，此非楚之路也。’
  ][
    我说：‘马虽然好，但这不是去楚国的路啊。’
  ][
    chén yuē mǎ suī liáng cǐ fēi chǔ zhī lù yě
  ]
  #snt[
    曰：‘吾#nt[用][路费、资财]多。’
  ][
    他又说：‘我的路费很充足。’
  ][
    yuē wú yòng duō
  ]
  #snt[
    臣曰：‘用虽多，此非楚之路也。’
  ][
    我说：‘路费虽然充足，但这不是去楚国的路啊。’
  ][
    chén yuē yòng suī duō cǐ fēi chǔ zhī lù yě
  ]
  #snt[
    曰：‘吾#nt[御者][驾车的人]善。’
  ][
    他又说：‘我的车夫技术高超。’
  ][
    yuē wú yù zhě shàn
  ]
  #snt[
    此数者愈善，而离楚愈远耳。”
  ][
    其实这几样条件越好，反而离楚国越远了。
  ][
    cǐ shù zhě yù shàn ér lí chǔ yù yuǎn ěr
  ]
]


#pagebreak()
= 选择题 `#xt` 样例

+ 给加点字选择正确的解释。
  #xt[
    兔*走*触株
    - 慢慢地走
    + 奔跑
    - 蹦跳
  ]
  #xt[
    兔走*触*株
    - 遇见
    + 撞上
    - 触摸
  ]
+ #xt(cols: 1)[
    加点字意思不同一项是
    + *走*马观花
    - 飞沙*走*石
    - *走*街串巷
    - 奔*走*相告
  ]
+ #xt(cols: 2)[
    *既*通，前坐
    - 既然
    - 立即
    + 已，已经
    - 立刻
  ]
+ #xt(cols: 1)[
    下列加点「走」与例句意思相同的有
    + *走*马观花
    - 飞沙*走*石
    + *走*街串巷
    - 奔*走*相告
  ]
  #xt(answer-fill: luma(60%))[
    （校对用：答案可见）兔*走*触株
    - 慢慢地走
    + 奔跑
    - 蹦跳
  ]

#pagebreak()
= 排序题 `#px` 样例

+ 填上序号，给句子组织正确、通顺的译文。
  #px[
    因释其耒而守株（多行换行）
    + 于是
    + 放下
    + 他的
    + 耒
    + 而
    + 守着
    + 树桩
  ]
  #px(cols: 1, answer-fill: luma(55%))[
    兔不可复得，而身为宋国笑（分行）
    + 兔子
    + 不能
    + 再次
    + 得到
    + 而
    + 自己
    + 成了
    + 宋国人的笑料
  ]
  #px(cols: 2, answer-fill: luma(55%))[
    两栏等宽
    + 甲
    + 乙
    + 丙
    + 丁
  ]
