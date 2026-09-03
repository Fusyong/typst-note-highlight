/// 田字格抄写（#tzg）
///
/// 用法：
/// ```
/// #tzg[守株待兔][shǒu|zhū|dài|tù]
/// #tzg[守株待兔！][shǒu|zhū|dài|tù|]  // 标点也占一格
/// #tzg[守株待兔][|||]                 // 四格皆无拼音；格子数 = | 的个数 + 1
/// ```
/// - 第一块：字符（汉字、标点等均各占一格；不足则空格，多余截断）
/// - 第二块：用 `|` 分隔的拼音；分隔段数即格子数，段可为空
/// - 每格：上方拼音带 + 田字格（十字虚线）+ 居中字符
/// - 默认格边长 1.5cm、格间距 0（左右搭接共线）

#let _tzg-plain(it) = {
  if type(it) == str {
    it
  } else if it == none {
    ""
  } else if type(it) != content {
    str(it)
  } else if it.has("text") {
    it.text
  } else if it.has("children") {
    let s = it.children.map(_tzg-plain).join()
    if s == none { "" } else { s }
  } else if it.has("body") {
    _tzg-plain(it.body)
  } else {
    let tag = repr(it)
    if tag == "space" { " " } else { "" }
  }
}

/// 单格：拼音带 + 田字格
/// - omit-left：搭接时省略左边框，避免与左邻双线
#let _tzg-cell(
  ch,
  reading,
  size,
  color,
  char-font,
  pinyin-font,
  pinyin-ratio: 0.30,
  guide-thickness: 0.35pt,
  border-thickness: 0.65pt,
  omit-left: false,
) = {
  let edge = (paint: color, thickness: border-thickness)
  let frame = if omit-left {
    (top: edge, right: edge, bottom: edge, left: none)
  } else {
    edge
  }
  let guide = (paint: color, thickness: guide-thickness, dash: "dashed")
  let py-h = size * pinyin-ratio * 1.4
  let py-size = size * pinyin-ratio
  stack(
    dir: ttb,
    spacing: 0pt,
    box(
      width: size,
      height: py-h,
      {
        set align(center + bottom)
        set text(
          font: pinyin-font,
          size: py-size,
          fill: color,
          top-edge: "ascender",
          bottom-edge: "descender",
        )
        reading
      },
    ),
    box(
      width: size,
      height: size,
      stroke: frame,
      inset: 0pt,
      clip: true,
      {
        place(line(start: (0%, 50%), end: (100%, 50%), stroke: guide))
        place(line(start: (50%, 0%), end: (50%, 100%), stroke: guide))
        set align(center + horizon)
        set text(
          font: char-font,
          size: size * 0.72,
          fill: black,
          top-edge: "ascender",
          bottom-edge: "descender",
        )
        ch
      },
    ),
  )
}

/// 田字格抄写行
/// - chars：字符内容块（汉字、标点等均各占一格；仅去掉换行缩进）
/// - yin：拼音内容块（`|` 分格；格子数 = 分段数）
/// - size：单格边长（默认 1.5cm）
/// - gap：格间距（默认 0，左右搭接）
/// - color：格线 / 拼音色
/// - char-font / pinyin-font：字体
#let tzg(
  chars,
  yin,
  size: 1.5cm,
  gap: 0pt,
  color: cmyk(0%, 70%, 45%, 0%),
  char-font: ("KaiTi", "FZKaiS-Extended", "Noto Serif CJK SC"),
  pinyin-font: ("Wukong Pinyin Sans", "Gentium Basic", "Arial"),
  pinyin-ratio: 0.30,
) = {
  let yin-plain = _tzg-plain(yin).replace(regex("[\n\t\r]+"), "")
  let parts = yin-plain.split("|")
  let n = parts.len()
  assert(n >= 1, message: "tzg 拼音至少保留一个格子（可用空串或 | 分格）")

  let glyphs = _tzg-plain(chars)
    .replace(regex("[\n\t\r]+"), "")
    .clusters()

  layout(bounds => {
    let cell-w = size.to-absolute()
    let gap-abs = gap.to-absolute()
    let cols = if cell-w <= 0pt {
      1
    } else if gap-abs <= 0pt {
      calc.max(1, calc.floor((bounds.width + 0.01pt) / cell-w))
    } else {
      calc.max(1, calc.floor((bounds.width + gap-abs) / (cell-w + gap-abs)))
    }
    let cols = calc.min(cols, n)

    grid(
      columns: (size,) * cols,
      column-gutter: gap,
      row-gutter: gap,
      ..range(n).map(i => {
        let ch = if i < glyphs.len() { glyphs.at(i) } else { "" }
        let reading = parts.at(i).trim()
        let col = calc.rem(i, cols)
        _tzg-cell(
          ch,
          reading,
          size,
          color,
          char-font,
          pinyin-font,
          pinyin-ratio: pinyin-ratio,
          omit-left: gap-abs <= 0pt and col > 0,
        )
      }),
    )
  })
}
