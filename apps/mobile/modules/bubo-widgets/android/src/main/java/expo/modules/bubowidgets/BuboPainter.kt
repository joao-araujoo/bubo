package expo.modules.bubowidgets

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.os.Build
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import android.text.TextUtils
import java.io.File
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Draws a Bubo widget on a bitmap (ADR-029). RemoteViews ignore `android:fontFamily="@font/…"`,
 * so text is drawn here with the official Plus Jakarta Sans files from the module's assets.
 * Every measure is in dp of the real widget size, so layouts follow resizes instead of a mockup.
 */
internal class BuboPainter(private val context: Context, private val w: Float, private val h: Float) {
  private val scale: Float
  val bitmap: Bitmap
  private val canvas: Canvas
  /** User text size preference, bounded so a widget never overflows its cells. */
  private val textScale = context.resources.configuration.fontScale.coerceIn(1f, 1.15f)

  init {
    val density = context.resources.displayMetrics.density
    // Bound bitmap memory (RemoteViews limit): ~1.4 MP is plenty for a 4×2 widget.
    val pixels = w * h * density * density
    scale = if (pixels > 1_400_000f) density * kotlin.math.sqrt(1_400_000f / pixels) else density
    bitmap = Bitmap.createBitmap(max(1, (w * scale).roundToInt()), max(1, (h * scale).roundToInt()), Bitmap.Config.ARGB_8888)
    canvas = Canvas(bitmap)
    canvas.scale(scale, scale)
  }

  // region Primitives

  private fun font(weight: String): Typeface = synchronized(typefaces) {
    typefaces.getOrPut(weight) {
      runCatching { Typeface.createFromAsset(context.assets, BuboTokens.fonts.getValue(weight)) }
        .getOrElse { Typeface.create("sans-serif", if (weight == "regular" || weight == "medium") Typeface.NORMAL else Typeface.BOLD) }
    }
  }

  private fun paint(weight: String, size: Float, color: Int) = TextPaint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG).apply {
    typeface = font(weight)
    textSize = size
    this.color = color
  }

  private fun fill(color: Int, alpha: Int = 255) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    this.color = color
    this.alpha = alpha
    style = Paint.Style.FILL
  }

  private fun stroke(color: Int, width: Float) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    this.color = color
    style = Paint.Style.STROKE
    strokeWidth = width
    strokeCap = Paint.Cap.ROUND
    strokeJoin = Paint.Join.ROUND
  }

  /** Largest size ≤ [size] (down to [min]) at which [text] fits in [width]. */
  private fun fit(text: String, weight: String, size: Float, min: Float, width: Float): Float {
    var current = size
    val probe = paint(weight, current, 0)
    while (current > min && probe.measureText(text) > width) {
      current -= 0.5f
      probe.textSize = current
    }
    return current
  }

  private fun height(paint: TextPaint) = paint.fontMetrics.let { it.descent - it.ascent }

  /** One line from its top-left (or centre/right), ellipsized to [maxWidth]. Returns its height. */
  private fun text(
    value: String,
    x: Float,
    top: Float,
    paint: TextPaint,
    maxWidth: Float = Float.MAX_VALUE,
    align: Paint.Align = Paint.Align.LEFT,
  ): Float {
    val line = TextUtils.ellipsize(value, paint, max(1f, maxWidth), TextUtils.TruncateAt.END).toString()
    paint.textAlign = align
    canvas.drawText(line, x, top - paint.fontMetrics.ascent, paint)
    return height(paint)
  }

  private fun textWidth(value: String, paint: TextPaint) = paint.measureText(value)

  private fun layout(value: String, paint: TextPaint, width: Float, lines: Int) =
    StaticLayout.Builder.obtain(value, 0, value.length, paint, max(1, width.toInt()))
      .setAlignment(Layout.Alignment.ALIGN_NORMAL)
      .setIncludePad(false)
      .setLineSpacing(0f, 0.96f)
      .setMaxLines(lines)
      .setEllipsize(TextUtils.TruncateAt.END)
      .build()

  private fun paragraphHeight(value: String, paint: TextPaint, width: Float, lines: Int) =
    layout(value, paint, width, lines).height.toFloat()

  /** Up to [lines] lines with an ellipsis; returns the height used. */
  private fun paragraph(value: String, x: Float, top: Float, paint: TextPaint, width: Float, lines: Int): Float {
    val layout = layout(value, paint, width, lines)
    canvas.save()
    canvas.translate(x, top)
    layout.draw(canvas)
    canvas.restore()
    return layout.height.toFloat()
  }

  /** Builds a path from generated opcodes (0 M, 1 L, 2 Q, 3 C, 4 Z) in a 24 × 24 box. */
  private fun ops(values: FloatArray, x: Float, y: Float, size: Float): Path {
    val s = size / 24f
    val path = Path()
    var i = 0
    while (i < values.size) {
      when (values[i].toInt()) {
        0 -> { path.moveTo(x + values[i + 1] * s, y + values[i + 2] * s); i += 3 }
        1 -> { path.lineTo(x + values[i + 1] * s, y + values[i + 2] * s); i += 3 }
        2 -> { path.quadTo(x + values[i + 1] * s, y + values[i + 2] * s, x + values[i + 3] * s, y + values[i + 4] * s); i += 5 }
        3 -> {
          path.cubicTo(
            x + values[i + 1] * s, y + values[i + 2] * s, x + values[i + 3] * s, y + values[i + 4] * s,
            x + values[i + 5] * s, y + values[i + 6] * s,
          )
          i += 7
        }
        else -> { path.close(); i += 1 }
      }
    }
    return path
  }

  private fun icon(values: FloatArray, x: Float, y: Float, size: Float, color: Int) =
    canvas.drawPath(ops(values, x, y, size), fill(color))

  private fun iconStroke(values: FloatArray, x: Float, y: Float, size: Float, color: Int, width: Float) =
    canvas.drawPath(ops(values, x, y, size), stroke(color, width))

  private fun background(top: Int, bottom: Int) {
    val radius = cornerRadius()
    val shape = Path().apply { addRoundRect(RectF(0f, 0f, w, h), radius, radius, Path.Direction.CW) }
    canvas.clipPath(shape)
    canvas.drawRect(0f, 0f, w, h, Paint().apply { shader = LinearGradient(0f, 0f, 0f, h, top, bottom, Shader.TileMode.CLAMP) })
  }

  /** The launcher's widget corner radius (Android 12+), otherwise a soft 22 dp. */
  private fun cornerRadius(): Float {
    if (Build.VERSION.SDK_INT >= 31) {
      val px = runCatching { context.resources.getDimension(android.R.dimen.system_app_widget_background_radius) }.getOrNull()
      if (px != null && px > 0f) return px / context.resources.displayMetrics.density
    }
    return 22f
  }

  /** An official pose, never redrawn: the widget edge clips it so Bubo "enters" the layout. */
  private fun mascot(pose: String, left: Float, top: Float, size: Float) {
    val name = "bubo_widget_" + pose.replace('-', '_')
    var id = context.resources.getIdentifier(name, "drawable", context.packageName)
    if (id == 0) id = context.resources.getIdentifier("bubo_widget_happy", "drawable", context.packageName)
    if (id == 0) return
    val target = size * scale
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeResource(context.resources, id, bounds)
    var sample = 1
    while (bounds.outWidth / (sample * 2) >= target) sample *= 2
    val image = BitmapFactory.decodeResource(context.resources, id, BitmapFactory.Options().apply { inSampleSize = sample; inScaled = false }) ?: return
    canvas.drawBitmap(image, null, RectF(left, top, left + size, top + size), Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
    image.recycle()
  }

  /** Streak flame: orange when today already counts; a soft outline before that. */
  private fun flame(x: Float, y: Float, size: Float, lit: Boolean, alert: Boolean) {
    if (lit) {
      icon(BuboTokens.flameOuter, x, y, size, BuboTokens.flame)
      icon(BuboTokens.flameInner, x, y, size, BuboTokens.flameGlow)
    } else {
      val path = ops(BuboTokens.flameOuter, x, y, size)
      canvas.drawPath(path, fill(BuboTokens.flame, 46))
      canvas.drawPath(path, stroke(BuboTokens.flame, size * 0.075f))
    }
    if (alert) {
      val r = size * 0.24f
      val cx = x + size - r * 0.6f
      val cy = y + size - r * 0.8f
      canvas.drawCircle(cx, cy, r + size * 0.04f, fill(BuboTokens.white))
      canvas.drawCircle(cx, cy, r, fill(BuboTokens.alert))
      icon(BuboTokens.alertMark, cx - r, cy - r, r * 2, BuboTokens.white)
    }
  }

  /** "❄ 2": protections ready to cover a missed day. */
  private fun freezeChip(right: Float, top: Float, count: Int, size: Float) {
    val label = paint("bold", size * 0.62f, BuboTokens.freezeText)
    val textW = textWidth("$count", label)
    val chipW = size * 0.42f + size * 0.62f + textW + size * 0.5f
    val rect = RectF(right - chipW, top, right, top + size)
    canvas.drawRoundRect(rect, size / 2, size / 2, fill(BuboTokens.freezeSoft))
    val iconSize = size * 0.66f
    iconStroke(BuboTokens.snowflake, rect.left + size * 0.3f, top + (size - iconSize) / 2, iconSize, BuboTokens.freeze, size * 0.075f)
    text("$count", rect.left + size * 0.3f + iconSize + size * 0.14f, top + (size - height(label)) / 2, label)
  }

  // endregion

  // region Widgets

  private fun streakTitle(model: WidgetModel): String = when {
    !model.fresh -> model.mood.title ?: "Abra o Bubo"
    model.streak == 1 -> "1 dia seguido"
    model.streak > 1 -> "${model.streak} dias seguidos"
    else -> "Comece sua sequência"
  }

  private fun captionColor(model: WidgetModel) = if (model.mood.tone == "risk") BuboTokens.flameText else BuboTokens.muted

  /** Day Streak (4×2): "12 dias seguidos", a caption and the week as circles. Bubo on the right. */
  fun week(model: WidgetModel) {
    background(BuboTokens.surface, BuboTokens.surfaceEnd)
    val pad = (h * 0.1f).coerceIn(12f, 18f)
    // Bubo keeps the reference's proportion (about a third of the width), however tall the widget.
    val size = min(h * 0.86f, w * 0.38f)
    mascot(model.mood.pose, w - size * 0.9f, h - size * 0.8f, size)
    if (model.fresh && model.freezesAvailable > 0) freezeChip(w - pad, pad, model.freezesAvailable, (h * 0.12f).coerceIn(18f, 24f))
    val right = w - size * 0.84f
    val width = right - pad
    val flameSize = min(h * 0.17f, w * 0.085f).coerceIn(20f, 30f)
    val numbered = model.fresh && model.streak > 0
    val title = streakTitle(model)
    val chip = if (model.fresh && model.freezesAvailable > 0) 52f else 0f
    val titleWidth = w - pad - chip - (pad + flameSize + 7f)
    val titlePaint = paint("extrabold", fit(title, "extrabold", flameSize * 0.86f * textScale, 13f, titleWidth), if (numbered) BuboTokens.flameText else BuboTokens.ink)
    val caption = paint("semibold", (h * 0.085f).coerceIn(11.5f, 14.5f) * textScale, captionColor(model))
    val column = width / 7f
    val circle = minOf(column * 0.8f, h * 0.2f, 34f)
    val letter = paint("bold", (circle * 0.44f).coerceIn(9.5f, 12.5f) * textScale, BuboTokens.faint)
    // One block (title, caption, week) centred in the height, like the reference's balance.
    val captionLines = if (paint("semibold", caption.textSize, 0).measureText(model.mood.message) > right - pad - flameSize - 7f) 2 else 1
    val headH = flameSize + 2f + height(caption) * captionLines
    val weekH = if (model.fresh) height(letter) + 5f + circle else 0f
    val gap = if (model.fresh) ((h - 2 * pad - headH - weekH) * 0.45f).coerceIn(10f, 26f) else 0f
    val top = max(pad, (h - (headH + gap + weekH)) / 2)
    flame(pad, top, flameSize, model.mood.lit, model.mood.alert)
    text(title, pad + flameSize + 7f, top + (flameSize - height(titlePaint)) / 2, titlePaint, titleWidth)
    paragraph(model.mood.message, pad + flameSize + 7f, top + flameSize + 2f, caption, right - pad - flameSize - 7f, 2)
    if (!model.fresh) return
    val letterTop = top + headH + gap
    val cy = letterTop + height(letter) + 5f + circle / 2
    model.week.forEachIndexed { index, day ->
      val cx = pad + column * (index + 0.5f)
      letter.color = if (day.today) BuboTokens.ink else BuboTokens.faint
      text(day.letter, cx, letterTop, letter, align = Paint.Align.CENTER)
      dayCircle(cx, cy, circle, day.state)
    }
  }

  private fun dayCircle(cx: Float, cy: Float, d: Float, state: String) {
    val r = d / 2
    when (state) {
      "done" -> {
        canvas.drawCircle(cx, cy, r, fill(BuboTokens.flame))
        iconStroke(BuboTokens.check, cx - r * 0.86f, cy - r * 0.86f, d * 0.86f, BuboTokens.white, d * 0.1f)
      }
      "frozen" -> {
        canvas.drawCircle(cx, cy, r, fill(BuboTokens.freezeSoft))
        iconStroke(BuboTokens.snowflake, cx - r * 0.62f, cy - r * 0.62f, d * 0.62f, BuboTokens.freeze, d * 0.07f)
      }
      "today" -> {
        canvas.drawCircle(cx, cy, r, fill(BuboTokens.empty))
        canvas.drawCircle(cx, cy, r - d * 0.045f, stroke(BuboTokens.flame, d * 0.09f))
      }
      "future" -> canvas.drawCircle(cx, cy, r, fill(BuboTokens.empty, 150))
      else -> canvas.drawCircle(cx, cy, r, fill(BuboTokens.empty))
    }
  }

  /** Compact streak (2×2): flame + number, a short label and Bubo peeking from the corner. */
  fun streak(model: WidgetModel) {
    background(BuboTokens.surface, BuboTokens.surfaceEnd)
    val pad = (min(w, h) * 0.1f).coerceIn(11f, 16f)
    val size = min(w, h) * 0.86f
    mascot(model.mood.pose, w - size * 0.8f, h - size * 0.66f, size)
    val flameSize = (h * 0.19f).coerceIn(20f, 30f)
    flame(pad, pad, flameSize, model.mood.lit, model.mood.alert)
    val textX = pad + flameSize + 5f
    val numbered = model.fresh && model.streak > 0
    val title = if (model.fresh) "${model.streak}" else model.mood.title ?: "Abra o Bubo"
    val titlePaint = paint("extrabold", fit(title, "extrabold", flameSize * (if (model.fresh) 1.2f else 0.72f), 12f, w - textX - pad), if (numbered) BuboTokens.flameText else BuboTokens.ink)
    text(title, textX, pad + (flameSize - height(titlePaint)) / 2, titlePaint, w - textX - pad)
    if (model.fresh && model.freezesAvailable > 0 && w >= 130f) freezeChip(w - pad, pad + 2f, model.freezesAvailable, 18f)
    val label = when {
      !model.fresh || model.mood.tone == "risk" -> model.mood.message
      model.streak == 1 -> "dia seguido"
      model.streak > 1 -> "dias seguidos"
      else -> "Que tal começar hoje?"
    }
    paragraph(label, pad, pad + flameSize + 4f, paint("semibold", 12.5f * textScale, captionColor(model)), w * 0.62f, 2)
  }

  /** Calendar (4×2): the month on the left; flame, streak and Bubo on the right. */
  fun calendar(model: WidgetModel) {
    background(BuboTokens.surface, BuboTokens.surfaceEnd)
    val pad = (h * 0.09f).coerceIn(11f, 16f)
    val split = w * 0.6f
    // Right side first, so the grid is drawn over Bubo's edge if a tiny widget makes them meet.
    val size = min(h * 0.66f, w * 0.36f)
    mascot(model.mood.pose, w - size * 0.86f, h - size * 0.72f, size)
    canvas.drawRect(split + 3f, pad + 4f, split + 4f, h - pad - 4f, fill(BuboTokens.divider))
    val cx = (split + 4f + w - pad * 0.6f) / 2
    if (model.fresh) {
      val flameSize = (h * 0.15f).coerceIn(18f, 30f)
      val number = "${model.streak}"
      val numberPaint = paint("extrabold", flameSize * 1.45f, BuboTokens.flameText)
      val rowW = flameSize + 4f + textWidth(number, numberPaint)
      val rowTop = pad + 2f
      flame(cx - rowW / 2, rowTop + (height(numberPaint) - flameSize) / 2, flameSize, model.mood.lit, model.mood.alert)
      text(number, cx - rowW / 2 + flameSize + 4f, rowTop, numberPaint)
      var y = rowTop + height(numberPaint) - 2f
      val label = paint("semibold", (h * 0.075f).coerceIn(10.5f, 13.5f) * textScale, BuboTokens.ink)
      y += text(if (model.streak == 1) "dia seguido" else "dias seguidos", cx, y, label, w - split - pad, Paint.Align.CENTER)
      if (model.freezesAvailable > 0) {
        val freeze = paint("bold", 10.5f * textScale, BuboTokens.freezeText)
        val words = if (model.freezesAvailable == 1) "1 proteção" else "${model.freezesAvailable} proteções"
        val iconSize = 11f
        val lineW = iconSize + 3f + textWidth(words, freeze)
        iconStroke(BuboTokens.snowflake, cx - lineW / 2, y + 3f + (height(freeze) - iconSize) / 2, iconSize, BuboTokens.freeze, 1.2f)
        text(words, cx - lineW / 2 + iconSize + 3f, y + 3f, freeze)
      }
    } else {
      val title = paint("extrabold", 15f, BuboTokens.ink)
      val top = pad + 4f
      val used = text(model.mood.title ?: "Abra o Bubo", cx, top, title, w - split - pad, Paint.Align.CENTER)
      val caption = paint("semibold", 11f * textScale, BuboTokens.muted)
      caption.textAlign = Paint.Align.LEFT
      val width = w - split - pad - 4f
      paragraph(model.mood.message, split + 8f, top + used + 3f, caption, width, 2)
    }
    monthGrid(model, pad, split - 4f)
  }

  private fun monthGrid(model: WidgetModel, pad: Float, right: Float) {
    val title = paint("extrabold", (h * 0.095f).coerceIn(12.5f, 16.5f) * textScale, BuboTokens.ink)
    val titleH = text(model.monthTitle, pad + 2f, pad, title, right - pad)
    val left = pad - 2f
    val column = (right - left) / 7f
    val header = paint("bold", (h * 0.058f).coerceIn(8.5f, 10.5f) * textScale, BuboTokens.faint)
    val headerTop = pad + titleH + 5f
    listOf("S", "T", "Q", "Q", "S", "S", "D").forEachIndexed { index, letter ->
      text(letter, left + column * (index + 0.5f), headerTop, header, align = Paint.Align.CENTER)
    }
    val rows = (model.monthOffset + model.monthDays.size + 6) / 7
    val gridTop = headerTop + height(header) + 2f
    val row = (h - pad * 0.7f - gridTop) / rows
    val pill = min(row * 0.86f, column * 0.94f)
    val numberSize = (min(row, column) * 0.47f).coerceIn(8f, 12f) * textScale
    model.monthDays.forEach { day ->
      val cell = model.monthOffset + day.day - 1
      val cx = left + column * (cell % 7 + 0.5f)
      val cy = gridTop + row * (cell / 7 + 0.5f)
      val active = model.fresh && day.active
      val frozen = model.fresh && day.frozen
      if (active) {
        val l = if (day.run == "start" || day.run == "single") cx - pill / 2 else cx - column / 2 - 0.5f
        val r = if (day.run == "end" || day.run == "single") cx + pill / 2 else cx + column / 2 + 0.5f
        val rect = RectF(l, cy - pill / 2, r, cy + pill / 2)
        val path = Path()
        val round = pill / 2
        val radii = floatArrayOf(
          if (day.run == "start" || day.run == "single") round else 0f, if (day.run == "start" || day.run == "single") round else 0f,
          if (day.run == "end" || day.run == "single") round else 0f, if (day.run == "end" || day.run == "single") round else 0f,
          if (day.run == "end" || day.run == "single") round else 0f, if (day.run == "end" || day.run == "single") round else 0f,
          if (day.run == "start" || day.run == "single") round else 0f, if (day.run == "start" || day.run == "single") round else 0f,
        )
        path.addRoundRect(rect, radii, Path.Direction.CW)
        canvas.drawPath(path, fill(BuboTokens.streakSoft))
      }
      if (frozen) {
        canvas.drawRoundRect(RectF(cx - pill / 2, cy - pill / 2, cx + pill / 2, cy + pill / 2), pill * 0.3f, pill * 0.3f, fill(BuboTokens.freezeSoft))
        val badge = pill * 0.24f
        val bx = cx + pill / 2 - badge * 0.55f
        val by = cy - pill / 2 + badge * 0.55f
        canvas.drawCircle(bx, by, badge + 0.8f, fill(BuboTokens.white))
        canvas.drawCircle(bx, by, badge, fill(BuboTokens.freeze))
        iconStroke(BuboTokens.snowflake, bx - badge * 0.8f, by - badge * 0.8f, badge * 1.6f, BuboTokens.white, badge * 0.16f)
      }
      val todayDisc = day.today && active
      if (todayDisc) canvas.drawCircle(cx, cy, pill / 2, fill(BuboTokens.flame))
      else if (day.today && model.fresh) canvas.drawCircle(cx, cy, pill / 2 - 0.8f, stroke(BuboTokens.flame, 1.4f))
      val color = when {
        todayDisc -> BuboTokens.white
        active -> BuboTokens.streakText
        frozen -> BuboTokens.freezeText
        day.future -> BuboTokens.faint
        else -> BuboTokens.ink
      }
      val number = paint(if (active || frozen || day.today) "bold" else "medium", numberSize, color)
      text("${day.day}", cx, cy - height(number) / 2, number, align = Paint.Align.CENTER)
    }
  }

  /** Continue reading (4×2): no inner card. Cover, title, author, page, progress, a quiet action. */
  fun reading(model: WidgetModel) {
    background(BuboTokens.surface, BuboTokens.surfaceEnd)
    val pad = (h * 0.1f).coerceIn(12f, 17f)
    val book = model.book
    val pose = when {
      !model.fresh -> model.mood.pose
      book == null -> "deep-reading"
      model.mood.lit -> "celebrating"
      else -> "reading"
    }
    val size = min(h * 0.8f, w * 0.34f)
    mascot(pose, w - size * 0.8f, h - size * 0.74f, size)
    // Top row: the streak, small, and today's caption.
    val flameSize = 15f
    var x = pad
    if (model.fresh) {
      flame(x, pad, flameSize, model.mood.lit, model.mood.alert)
      x += flameSize + 4f
      val number = paint("extrabold", 13f * textScale, if (model.streak > 0) BuboTokens.flameText else BuboTokens.muted)
      text("${model.streak}", x, pad + (flameSize - height(number)) / 2, number)
      x += textWidth("${model.streak}", number) + 9f
    }
    val caption = paint("medium", 12f * textScale, captionColor(model))
    text(if (model.fresh) model.mood.message else "", x, pad + (flameSize - height(caption)) / 2, caption, w - x - pad)
    val top = pad + flameSize + (h * 0.07f).coerceIn(8f, 14f)
    val bottom = h - pad
    val textRight = max(w - size * 0.56f, w * 0.62f)
    if (book == null) {
      val title = paint("extrabold", 15.5f * textScale, BuboTokens.ink)
      val sub = paint("medium", 12f * textScale, BuboTokens.muted)
      val subText = if (model.fresh) "Escolha um livro na Estante para continuar daqui." else model.mood.message
      val blockH = height(title) + 3f + paragraphHeight(subText, sub, textRight - pad, 2) + 8f + 18f
      var y = top + max(0f, (bottom - top - blockH) / 2)
      y += text(if (model.fresh) "Nenhuma leitura ativa" else model.mood.title ?: "Abra o Bubo", pad, y, title, textRight - pad) + 3f
      y += paragraph(subText, pad, y, sub, textRight - pad, 2) + 8f
      action(if (model.fresh) "Abrir Estante" else "Abrir o Bubo", pad, y)
      return
    }
    val coverH = min(bottom - top, h * 0.6f)
    val coverW = coverH * 0.68f
    val tx = pad + coverW + 12f
    val width = textRight - tx
    val title = paint("extrabold", 15.5f * textScale, BuboTokens.ink)
    val lines = if (coverH >= 96f) 2 else 1
    val author = paint("medium", 12f * textScale, BuboTokens.muted)
    val page = paint("semibold", 11.5f * textScale, BuboTokens.ink)
    val actionPaint = paint("bold", 12.5f * textScale, BuboTokens.purple)
    val pageText = book.totalPages?.let { "Página ${book.page} de $it" } ?: "Página ${book.page}"
    val blockH = paragraphHeight(book.title, title, width, lines) + 2f +
      (if (book.author != null) height(author) else 0f) + 6f + height(page) + 5f +
      (if (book.progress != null) 6f else 0f) + 10f + height(actionPaint)
    // The cover and the text block share one centre line, whatever the widget height.
    val coverTop = top + max(0f, (bottom - top - max(coverH, blockH)) / 2)
    cover(book, pad, coverTop, coverW, coverH)
    var y = coverTop + max(0f, (coverH - blockH) / 2)
    y += paragraph(book.title, tx, y, title, width, lines) + 2f
    book.author?.let { y += text(it, tx, y, author, width) }
    y += 6f
    y += text(pageText, tx, y, page, width) + 5f
    book.progress?.let { progress ->
      val barW = min(width, 150f)
      canvas.drawRoundRect(RectF(tx, y, tx + barW, y + 6f), 3f, 3f, fill(BuboTokens.empty))
      if (progress > 0) canvas.drawRoundRect(RectF(tx, y, tx + max(6f, barW * progress / 100f), y + 6f), 3f, 3f, fill(BuboTokens.purple))
      y += 6f
    }
    action("Continuar leitura", tx, y + 10f)
  }

  /** "Continuar leitura ›": a quiet text action, the whole widget is the touch target. */
  private fun action(label: String, x: Float, top: Float) {
    val paint = paint("bold", 12.5f * textScale, BuboTokens.purple)
    val used = text(label, x, top, paint)
    val size = used * 0.9f
    iconStroke(BuboTokens.chevron, x + textWidth(label, paint) + 1f, top + (used - size) / 2, size, BuboTokens.purple, 1.8f)
  }

  /** The cached real cover; without it, the app's typographic fallback (BookCover). */
  private fun cover(book: WidgetBook, x: Float, y: Float, width: Float, height: Float) {
    val rect = RectF(x, y, x + width, y + height)
    val radius = 6f
    val shadow = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = BuboTokens.surface
      setShadowLayer(5f, 0f, 2f, (BuboTokens.shadow and 0x00FFFFFF) or (0x2E shl 24))
    }
    canvas.drawRoundRect(rect, radius, radius, shadow)
    canvas.save()
    canvas.clipPath(Path().apply { addRoundRect(rect, radius, radius, Path.Direction.CW) })
    val file = File(context.filesDir, "bubo-widget-cover")
    val image = if (file.isFile) {
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeFile(file.path, bounds)
      var sample = 1
      while (bounds.outHeight / (sample * 2) >= height * scale) sample *= 2
      BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample })
    } else null
    if (image != null && image.width >= 20 && image.height >= 20) {
      // Centre-crop to the cover frame.
      val ratio = max(width / image.width, height / image.height)
      val dw = image.width * ratio
      val dh = image.height * ratio
      canvas.drawBitmap(image, null, RectF(x + (width - dw) / 2, y + (height - dh) / 2, x + (width + dw) / 2, y + (height + dh) / 2), Paint(Paint.FILTER_BITMAP_FLAG))
      image.recycle()
    } else {
      val index = book.palette.coerceIn(0, BuboTokens.coverFace.size - 1)
      canvas.drawRect(rect, fill(BuboTokens.coverFace[index]))
      canvas.drawRect(x, y, x + width * 0.08f, y + height, fill(BuboTokens.coverSpine[index]))
      val inset = width * 0.16f
      val titlePaint = paint("extrabold", max(7f, width / 6.2f), BuboTokens.coverText[index])
      val used = paragraph(book.title, x + inset, y + inset, titlePaint, width - inset * 1.5f, 4)
      canvas.drawRoundRect(RectF(x + inset, y + inset + used + 3f, x + inset + width / 5f, y + inset + used + 5f), 1f, 1f, fill(BuboTokens.coverAccent[index]))
    }
    canvas.restore()
  }

  /** Compact reading (2×2): cover, title and page. */
  fun readingCompact(model: WidgetModel) {
    background(BuboTokens.surface, BuboTokens.surfaceEnd)
    val pad = 12f
    val book = model.book
    if (book == null) {
      streak(model)
      return
    }
    val coverH = h * 0.46f
    cover(book, pad, pad, coverH * 0.68f, coverH)
    if (model.fresh) {
      val x = pad + coverH * 0.68f + 10f
      flame(x, pad + 2f, 15f, model.mood.lit, model.mood.alert)
      text("${model.streak}", x + 19f, pad + 2f, paint("extrabold", 13f, if (model.streak > 0) BuboTokens.flameText else BuboTokens.muted))
    }
    var y = pad + coverH + 8f
    y += text(book.title, pad, y, paint("extrabold", 13f * textScale, BuboTokens.ink), w - 2 * pad) + 1f
    val pageText = book.totalPages?.let { "Pág. ${book.page} de $it" } ?: "Página ${book.page}"
    y += text(pageText, pad, y, paint("semibold", 11f * textScale, BuboTokens.muted), w - 2 * pad) + 5f
    book.progress?.let { progress ->
      val barW = w - 2 * pad
      canvas.drawRoundRect(RectF(pad, y, pad + barW, y + 5f), 2.5f, 2.5f, fill(BuboTokens.empty))
      if (progress > 0) canvas.drawRoundRect(RectF(pad, y, pad + max(5f, barW * progress / 100f), y + 5f), 2.5f, 2.5f, fill(BuboTokens.purple))
    }
  }

  private fun badge(x: Float, y: Float, size: Float) {
    icon(BuboTokens.badge, x, y, size, BuboTokens.purple)
    icon(BuboTokens.badgeInner, x, y, size, BuboTokens.purpleLight)
    icon(BuboTokens.gemCut, x, y, size, BuboTokens.gem)
    icon(BuboTokens.gemShine, x, y, size, BuboTokens.white)
  }

  /** League (4×2): rank, today's movement, the week and a small podium around the reader. */
  fun league(model: WidgetModel) {
    background(BuboTokens.leagueTop, BuboTokens.leagueBottom)
    val pad = (h * 0.11f).coerceIn(12f, 18f)
    val league = model.league
    val friends = league != null && league.participants > 1
    val split = if (friends) w * 0.53f else w * 0.66f
    val badgeSize = (h * 0.2f).coerceIn(24f, 38f)
    val lineGap = (h * 0.15f).coerceIn(18f, 28f)
    val lineCount = when {
      !model.fresh || league == null -> 2
      friends -> 3
      else -> 3
    }
    // Badge, title and lines form one block centred in the height (balanced on tall 4×2 cells).
    val blockH = badgeSize + (h * 0.07f).coerceIn(6f, 12f) + lineGap * lineCount
    val top = max(pad, (h - blockH) / 2)
    badge(pad, top, badgeSize)
    val title = when {
      !model.fresh -> model.mood.title ?: "Abra o Bubo"
      league == null -> "Liga semanal"
      friends -> "#${league.rank} entre amigos"
      else -> "Sua liga semanal"
    }
    val titleX = pad + badgeSize + 8f
    val titlePaint = paint("extrabold", fit(title, "extrabold", badgeSize * 0.68f * textScale, 12f, split - titleX - 4f), BuboTokens.purple)
    text(title, titleX, top + (badgeSize - height(titlePaint)) / 2, titlePaint, split - titleX - 4f)
    val iconSize = (h * 0.09f).coerceIn(13f, 17f)
    val textSize = (h * 0.082f).coerceIn(11f, 14.5f) * textScale
    var y = top + badgeSize + (h * 0.07f).coerceIn(6f, 12f)
    fun line(draw: (Float, Float) -> Unit, label: String, color: Int, weight: String = "bold") {
      draw(pad + 1f, y + (lineGap - iconSize) / 2 - 2f)
      val paint = paint(weight, textSize, color)
      text(label, pad + iconSize + 8f, y + (lineGap - height(paint)) / 2 - 2f, paint, split - pad - iconSize - 10f)
      y += lineGap
    }
    if (!model.fresh || league == null) {
      val message = if (!model.fresh) model.mood.message else "Abra o Bubo para atualizar"
      paragraph(message, pad, y, paint("semibold", textSize, BuboTokens.muted), split - pad, 2)
      val size = h * 0.86f
      mascot(if (model.fresh) "doubt" else model.mood.pose, w - size * 0.84f, h - size * 0.7f, size)
      return
    }
    if (friends) {
      val previous = league.previousRank
      when {
        previous == null -> line({ x, t -> icon(BuboTokens.equal, x, t, iconSize, BuboTokens.faint) }, "Semana começando", BuboTokens.muted, "semibold")
        previous > league.rank -> {
          val n = previous - league.rank
          line({ x, t -> icon(BuboTokens.arrowUp, x, t, iconSize, BuboTokens.up) }, "+$n ${if (n == 1) "posição" else "posições"} hoje", BuboTokens.up)
        }
        previous < league.rank -> {
          val n = league.rank - previous
          line({ x, t -> icon(BuboTokens.arrowDown, x, t, iconSize, BuboTokens.faint) }, "Caiu $n ${if (n == 1) "posição" else "posições"}", BuboTokens.muted, "semibold")
        }
        else -> line({ x, t -> icon(BuboTokens.equal, x, t, iconSize, BuboTokens.faint) }, "Mesma posição", BuboTokens.muted, "semibold")
      }
      line({ x, t ->
        icon(BuboTokens.trophy, x, t, iconSize, BuboTokens.purple)
        iconStroke(BuboTokens.trophyHandles, x, t, iconSize, BuboTokens.purple, iconSize * 0.1f)
      }, "Liga semanal", BuboTokens.purple)
    } else {
      line({ x, t ->
        icon(BuboTokens.trophy, x, t, iconSize, BuboTokens.purple)
        iconStroke(BuboTokens.trophyHandles, x, t, iconSize, BuboTokens.purple, iconSize * 0.1f)
      }, "${league.weeklyXp} XP nesta semana", BuboTokens.purple)
    }
    val days = if (league.daysLeft == 1) "Último dia" else "${league.daysLeft} dias restantes"
    line({ x, t -> iconStroke(BuboTokens.clock, x, t, iconSize, BuboTokens.time, iconSize * 0.12f) }, days, BuboTokens.time)
    if (!friends) {
      val hint = paint("medium", textSize * 0.92f, BuboTokens.muted)
      text("Adicione amigos nos clubes", pad, y - 2f, hint, split - pad)
      val size = h * 0.86f
      mascot("cheering", w - size * 0.84f, h - size * 0.7f, size)
      return
    }
    podium(league, split, pad)
  }

  private fun podium(league: WidgetLeague, left: Float, pad: Float) {
    val right = w - 6f
    val column = (right - left) / 3f
    val avatar = min(column * 0.74f, h * 0.27f)
    val base = h * 0.16f
    val steps = listOf(base, base * 1.5f, base * 2.0f)
    val spots = league.podium
    val first = 3 - spots.size
    spots.forEachIndexed { index, spot ->
      val col = first + index
      val l = left + column * col
      val stepTop = h - steps[col]
      val rect = RectF(l + 2f, stepTop, l + column - 2f, h + 12f)
      canvas.drawRoundRect(rect, 9f, 9f, fill(BuboTokens.podium))
      canvas.drawRoundRect(RectF(rect.left, stepTop, rect.right, stepTop + 5f), 4f, 4f, fill(BuboTokens.podiumTop))
      val cx = l + column / 2
      val d = if (spot.me) avatar * 1.08f else avatar
      val cy = stepTop - 5f - d / 2
      canvas.drawCircle(cx, cy, d / 2, fill(BuboTokens.avatar))
      if (spot.me) canvas.drawCircle(cx, cy, d / 2 - 1.3f, stroke(BuboTokens.purple, 2.6f))
      else canvas.drawCircle(cx, cy, d / 2 - 0.6f, stroke(BuboTokens.podium, 1.2f))
      val initials = paint("extrabold", d * 0.34f, BuboTokens.purpleInk)
      text(spot.initials, cx, cy - height(initials) / 2, initials, align = Paint.Align.CENTER)
      val labelTop = cy - d / 2 - 3f
      if (spot.me) {
        val number = paint("extrabold", (avatar * 0.4f).coerceIn(12f, 19f), BuboTokens.purple)
        val unit = paint("extrabold", (avatar * 0.22f).coerceIn(8f, 11f), BuboTokens.purple)
        val total = textWidth("${spot.xp}", number) + 2f + textWidth("XP", unit)
        val top = max(pad * 0.5f, labelTop - height(number))
        text("${spot.xp}", cx - total / 2, top, number)
        text("XP", cx - total / 2 + textWidth("${spot.xp}", number) + 2f, top + height(number) - height(unit) - 1.5f, unit)
      } else {
        val number = paint("bold", (avatar * 0.32f).coerceIn(10f, 15f), BuboTokens.muted)
        text("${spot.xp}", cx, max(pad * 0.5f, labelTop - height(number)), number, column, Paint.Align.CENTER)
      }
    }
  }

  /** Compact league (2×2): rank and the week, no podium. */
  fun leagueCompact(model: WidgetModel) {
    background(BuboTokens.leagueTop, BuboTokens.leagueBottom)
    val pad = 12f
    val league = model.league
    badge(pad, pad, 26f)
    if (!model.fresh || league == null) {
      text(model.mood.title ?: "Liga semanal", pad, pad + 34f, paint("extrabold", 14f, BuboTokens.purple), w - 2 * pad)
      paragraph(if (!model.fresh) model.mood.message else "Abra o Bubo para atualizar", pad, pad + 54f, paint("semibold", 11.5f, BuboTokens.muted), w - 2 * pad, 3)
      return
    }
    val friends = league.participants > 1
    val big = paint("extrabold", 30f, BuboTokens.purple)
    var y = pad + 30f
    y += text(if (friends) "#${league.rank}" else "${league.weeklyXp} XP", pad, y, big, w - 2 * pad)
    y += text(if (friends) "entre amigos" else "nesta semana", pad, y, paint("semibold", 12f * textScale, BuboTokens.muted), w - 2 * pad) + 4f
    val days = if (league.daysLeft == 1) "Último dia" else "${league.daysLeft} dias restantes"
    iconStroke(BuboTokens.clock, pad, y + 1f, 13f, BuboTokens.time, 1.5f)
    text(days, pad + 17f, y, paint("bold", 11.5f * textScale, BuboTokens.time), w - 2 * pad - 17f)
  }

  // endregion

  companion object {
    private val typefaces = HashMap<String, Typeface>()
  }
}
