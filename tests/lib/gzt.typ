/// 勾选正确选项（#gzt）
///
/// 用法（句中嵌入）：
/// ```
/// 因#gzt[释][+ 放下 | - 释放]其耒而守株
/// 冀#gzt[复][+ 再、又 | - 复杂]得兔
/// ```
/// - 第一块：被注词（原句中的字词，可加 `*着重*`）
/// - 第二块：选项，`|` 分隔；`+` 事实上正确，`-` 事实上错误
/// - 选项排成（放下   释放），无序号；正确项的文字上叠 ✓（默认透明，便于透印）
/// - 答案以 metadata 记录（kind: "gzt"）

#import "exercise.typ": exercise-resolve-fill
#import "opt-inline.typ": _oi-inline, _oi-parse

/// 勾选正确选项
/// - answer-fill：勾选 ✓ 的颜色（`auto`＝练习题隐藏/调试色；见 #exercise-debug）
/// - mark：勾选记号，默认 ✓
#let gzt(
  word,
  opts,
  answer-fill: auto,
  mark: "✓",
) = context {
  let answer-fill = exercise-resolve-fill(answer-fill)
  let items = _oi-parse(opts)
  metadata((
    kind: "gzt",
    checked: range(items.len()).filter(i => items.at(i).correct),
    n: items.len(),
  ))
  _oi-inline(
    word,
    items,
    it => if it.correct { mark } else { none },
    answer-fill,
    overlay-size: 1.05em,
  )
}
