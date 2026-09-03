#import "lib/book-setup.typ": (
  ntp, bz, exercise-debug, fonts, notes, nt, ntc, ntj, ntw, px, py, setup-book, sizes, snt, translation, upnote, xt,
)

/// 三段字号下限16、14、12，注释下限10.5
/// 如果出现译文混乱的情况，可尝试微调宽度
#show: setup-book.with(width: 210mm, height: 297mm, size: 14pt)

// 打开后练习题透明答案改为深红色；正式出片请注释掉
#exercise-debug()

#ntp[
  #snt(notes: (
    [勤勉],
    [喜爱学习],
    [以……为羞耻],
    [向地位、学问不如自己的人请教],
  ))[
    #ntc[敏]而#ntc[好学]，不#ntc[耻]#ntc[下问]。
  ][
    勤勉向地位、学问不如自己的人请教为羞耻。
  ][
    sòng rén yǒu gēng zhě tián zhōng yǒu zhū
  ]
  #snt(notes: (
    [知道，了解。],
  ))[
    #ntc[知]之为知之，不知为不知，是知也。
  ][
    知道就是知道，不知道就是不知道，这才是真正的智慧。
  ][
    sòng rén yǒu gēng zhě tián zhōng yǒu zhū
  ]
  #snt(notes: (
    [记住],
    [满足],
    [教导],
    [疲倦],
  ))[
    默而#ntc[识]之，学而不#ntc[厌]，#ntc[诲]人不#ntc[倦]。
  ][
    默默地把所见所闻记在心里，勤奋学习而不满足，教导别人而不知疲倦。
  ][
    sòng rén yǒu gēng zhě tián zhōng yǒu zhū
  ]
]

#v(2em)

#ntp[
  #snt(notes: (
    [勤勉],
    [喜爱学习],
    [以……为羞耻],
    [向地位、学问不如自己的人请教],
  ))[
    #ntc[敏]而#ntc[好学]，不#ntc[耻]#ntc[下问]。
  ][
    勤勉向地位、学问不如自己的人请教为羞耻。
  ][
    sòng rén yǒu gēng zhě tián zhōng yǒu zhū
  ]
  #snt(notes: (
    [知道，了解。],
  ))[
    #ntc[知]之为知之，不知为不知，是知也。
  ][
    知道就是知道，不知道就是不知道，这才是真正的智慧。
  ][
    sòng rén yǒu gēng zhě tián zhōng yǒu zhū
  ]
  #snt(notes: (
    [记住],
    [满足],
    [教导],
    [疲倦],
  ))[
    默而#ntc[识]之，学而不#ntc[厌]，#ntc[诲]人不#ntc[倦]。
  ][
    默默地把所见所闻记在心里，勤奋学习而不满足，教导别人而不知疲倦。
  ][
    sòng rén yǒu gēng zhě tián zhōng yǒu zhū
  ]
]
