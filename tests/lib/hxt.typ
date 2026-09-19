/// 文中画线（#hxt）
///
/// 用法（句中嵌入）：
/// ```
/// #hxt[于是]放下#hxt[他的]农具守在树桩旁
/// ```
/// - 在指定词语下方画线（默认透明，便于透印/校对；`#exercise-debug` 打开时为深红色）
/// - 答案以 metadata 记录（kind: "hxt"）

#import "exercise.typ": exercise-resolve-fill

/// 文中画线
/// - answer-fill：下划线色（`auto`＝练习题隐藏/调试色；见 #exercise-debug）
/// - stroke-width：线宽（默认 0.7pt）
/// - offset：相对基线的偏移（默认 0.18em，略低于汉字底）
#let hxt(
  body,
  answer-fill: auto,
  stroke-width: 0.7pt,
  offset: 0.18em,
) = context {
  let answer-fill = exercise-resolve-fill(answer-fill)
  metadata((kind: "hxt"))
  underline(
    stroke: stroke-width + answer-fill,
    offset: offset,
    // 汉字下连续画线，不随字形缺口断开
    evade: false,
    body,
  )
}
