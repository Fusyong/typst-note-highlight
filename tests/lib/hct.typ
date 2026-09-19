/// 划掉错误选项（#hct）
///
/// 用法（句中嵌入）：
/// ```
/// 因#hct[释][+ 放下 | - 释放]其耒而守株
/// 冀#hct[复][+ 再、又 | - 复杂]得兔
/// ```
/// - 第一块：被注词（原句中的字词，可加 `*着重*`）
/// - 第二块：选项，`|` 分隔；`+` 事实上正确，`-` 事实上错误
/// - 选项排成（放下   释放），无序号；错误项的文字上叠 `\`（默认透明，便于透印）
/// - 答案以 metadata 记录（kind: "hct"）

#import "exercise.typ": exercise-resolve-fill
#import "opt-inline.typ": _oi-inline, _oi-parse

/// 划掉错误选项
/// - answer-fill：划掉符 `\` 的颜色（`auto`＝练习题隐藏/调试色；见 #exercise-debug）
/// - mark：划掉记号，默认 `\`（与 #gzt 的 ✓ 一样直接叠符号，不拉伸）
#let hct(
  word,
  opts,
  answer-fill: auto,
  mark: "\\",
) = context {
  let answer-fill = exercise-resolve-fill(answer-fill)
  let items = _oi-parse(opts)
  metadata((
    kind: "hct",
    crossed: range(items.len()).filter(i => not items.at(i).correct),
    n: items.len(),
  ))
  _oi-inline(
    word,
    items,
    it => if it.correct { none } else { mark },
    answer-fill,
    overlay-size: 1.05em,
  )
}
