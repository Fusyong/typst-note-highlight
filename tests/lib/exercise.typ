/// 练习题答案色与调试开关（供 #lx / #xt / #px 共用）
///
/// ```
/// #exercise-debug()        // 打开：隐藏色 → 深红色
/// #exercise-debug(false)   // 关闭
/// ```
/// 亦可 CLI：`--input exercise-debug=1`

/// 隐藏答案色（全透明，便于透印）
#let exercise-hidden = rgb(0%, 0%, 0%, 0%)

/// 调试色（深红）
#let exercise-debug-color = cmyk(0%, 95%, 90%, 25%)

#let _exercise-debug = state("exercise-debug", false)

/// 练习题调试开关：打开后透明答案改为深红色
/// - `#exercise-debug()` / `#exercise-debug(true)` 打开
/// - `#exercise-debug(false)` 关闭
#let exercise-debug(on: true) = {
  _exercise-debug.update(on)
}

/// 是否处于练习题调试（CLI 或 #exercise-debug）
/// 须在 context 中调用
#let exercise-debug-on() = {
  let inp = sys.inputs.at("exercise-debug", default: "0")
  if inp == "1" or inp == "true" or inp == "on" or inp == "yes" {
    true
  } else {
    _exercise-debug.get()
  }
}

/// 当前练习题答案色：调试开 → 深红；否则全透明
/// 须在 context 中调用
#let exercise-answer-color() = {
  if exercise-debug-on() { exercise-debug-color } else { exercise-hidden }
}

/// 解析 answer-fill：`auto` → 当前练习题答案色；否则原样
/// 须在 context 中调用
#let exercise-resolve-fill(answer-fill) = {
  if answer-fill == auto { exercise-answer-color() } else { answer-fill }
}
