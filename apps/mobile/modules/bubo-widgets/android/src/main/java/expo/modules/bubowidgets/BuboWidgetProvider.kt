package expo.modules.bubowidgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

class StreakWidget : BuboWidgetProvider("streak")
class RhythmWidget : BuboWidgetProvider("rhythm")
class CalendarWidget : BuboWidgetProvider("calendar")
class ReadingWidget : BuboWidgetProvider("reading")

/** What the widget shows now. `title` replaces the streak number when there is no fresh data. */
private data class Mood(
  val scene: String,
  val pose: String,
  val message: String,
  val lit: Boolean,
  val alert: Boolean,
  val title: String? = null,
)

private val POSE_LABELS = mapOf(
  "welcome" to "Bubo dando boas-vindas",
  "happy" to "Bubo feliz",
  "reading" to "Bubo lendo",
  "review" to "Bubo revisando",
  "celebrating" to "Bubo comemorando",
  "achievement" to "Bubo com uma conquista",
  "cheering" to "Bubo animando",
  "worried" to "Bubo preocupado",
  "surprised" to "Bubo surpreso",
  "sleeping" to "Bubo dormindo",
  "doubt" to "Bubo com dúvida",
)
private val WEEK_LETTERS = listOf("S", "T", "Q", "Q", "S", "S", "D")

open class BuboWidgetProvider(private val kind: String) : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { render(context, manager, it) }
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    render(context, manager, id)
  }

  private fun render(context: Context, manager: AppWidgetManager, id: Int) {
    val raw = context.getSharedPreferences("bubo-widgets", 0).getString("snapshot", null)
    val snapshot = raw?.let { runCatching { JSONObject(it) }.getOrNull() }?.takeIf { it.optInt("version") == 2 }
    val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
    val fresh = snapshot != null && snapshot.optLong("expiresAt") > System.currentTimeMillis() && snapshot.optString("today") == today
    val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
    val mood = currentMood(snapshot, fresh, hour)
    val options = manager.getAppWidgetOptions(id)
    val width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
    val height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)
    val wide = width >= 200
    val layout = when {
      kind == "rhythm" && wide -> R.layout.bubo_widget_rhythm
      kind == "calendar" && wide -> R.layout.bubo_widget_calendar
      kind == "reading" && wide -> R.layout.bubo_widget_reading
      else -> R.layout.bubo_widget_streak
    }
    // The calendar keeps its own light/pending palettes, like the reference widget.
    val scene = if (layout == R.layout.bubo_widget_calendar && fresh) {
      if (snapshot?.optBoolean("activeToday") == true) "mint" else "periwinkle"
    } else mood.scene
    val views = RemoteViews(context.packageName, layout)
    val res = Res(context)
    val streak = snapshot?.optInt("streakDays") ?: 0
    val book = if (fresh) snapshot?.optJSONObject("book") else null

    views.setInt(android.R.id.background, "setBackgroundResource", res.drawable("bubo_scene_$scene"))
    if (layout != R.layout.bubo_widget_calendar) {
      views.setImageViewResource(R.id.bubo_deco, res.drawable("bubo_deco_$scene" + if (wide) "_wide" else ""))
    }
    views.setImageViewResource(R.id.bubo_mascot, res.drawable("bubo_widget_${mood.pose}"))
    views.setContentDescription(R.id.bubo_mascot, POSE_LABELS[mood.pose] ?: "Bubo")
    views.setImageViewResource(R.id.bubo_flame, if (mood.lit) R.drawable.bubo_flame else res.drawable("bubo_flame_off_$scene"))
    views.setViewVisibility(R.id.bubo_alert, if (mood.alert) View.VISIBLE else View.GONE)

    val days = if (streak == 1) "1 dia" else "$streak dias"
    val number = mood.title ?: if (layout == R.layout.bubo_widget_rhythm) "$days de sequência" else "$streak"
    views.setTextViewText(R.id.bubo_number, number)
    views.setTextColor(R.id.bubo_number, res.color("bubo_scene_${scene}_number"))
    views.setContentDescription(R.id.bubo_number, mood.title ?: "Sequência de $days")
    if (mood.title != null) {
      views.setTextViewTextSize(R.id.bubo_number, TypedValue.COMPLEX_UNIT_SP, if (layout == R.layout.bubo_widget_streak) 18f else 16f)
    }
    val narrowReading = kind == "reading" && layout == R.layout.bubo_widget_streak && book != null
    views.setTextViewText(R.id.bubo_message, if (narrowReading) pages(book!!) else mood.message)
    views.setTextColor(R.id.bubo_message, res.color("bubo_scene_${scene}_muted"))

    if (layout == R.layout.bubo_widget_streak && Build.VERSION.SDK_INT >= 31 && height > 0) {
      // Bubo peeks from the bottom edge: ~70% visible whatever the widget height.
      views.setViewLayoutHeight(R.id.bubo_mascot, height * 0.95f, TypedValue.COMPLEX_UNIT_DIP)
      views.setViewLayoutMargin(R.id.bubo_mascot, RemoteViews.MARGIN_BOTTOM, -height * 0.27f, TypedValue.COMPLEX_UNIT_DIP)
    }
    when (layout) {
      R.layout.bubo_widget_rhythm -> renderWeek(views, res, snapshot, fresh, scene)
      R.layout.bubo_widget_calendar -> renderMonth(views, res, snapshot, fresh, scene)
      R.layout.bubo_widget_reading -> renderBook(context, views, book)
    }
    val url = if (kind == "reading" && book != null) book.optString("url") else "bubo:///"
    views.setOnClickPendingIntent(android.R.id.background, open(context, url))
    manager.updateAppWidget(id, views)
  }

  private fun currentMood(snapshot: JSONObject?, fresh: Boolean, hour: Int): Mood {
    val night = hour >= 22 || hour < 6
    if (snapshot == null) return Mood("lavender", "welcome", "Entre no app para começar", lit = false, alert = false, title = "Olá!")
    if (!fresh) {
      return if (night) Mood("night", "sleeping", "Até amanhã!", lit = false, alert = false, title = "Zzz…")
      else Mood("slate", "doubt", "Para atualizar sua sequência", lit = false, alert = false, title = "Abra o Bubo")
    }
    val moods = snapshot.optJSONArray("moods")
    var picked: JSONObject? = null
    for (index in 0 until (moods?.length() ?: 0)) {
      val mood = moods?.optJSONObject(index) ?: continue
      if (picked == null || mood.optInt("fromHour") <= hour) picked = mood
    }
    return Mood(
      picked?.optString("scene", "lavender") ?: "lavender",
      picked?.optString("pose", "welcome") ?: "welcome",
      picked?.optString("message") ?: "",
      picked?.optBoolean("lit") == true,
      picked?.optBoolean("alert") == true,
    )
  }

  private fun renderWeek(views: RemoteViews, res: Res, snapshot: JSONObject?, fresh: Boolean, scene: String) {
    val week = snapshot?.optJSONArray("week")
    for (index in 0 until 7) {
      val day = if (fresh) week?.optJSONObject(index) else null
      val active = day?.optBoolean("active") == true
      val state = day?.optString("state") ?: "future"
      val label = res.id("bubo_wl$index")
      val dot = res.id("bubo_wd$index")
      views.setTextViewText(label, WEEK_LETTERS[index])
      views.setTextColor(label, res.color(if (state == "today") "bubo_scene_${scene}_text" else "bubo_scene_${scene}_muted"))
      views.setImageViewResource(dot, when {
        active -> R.drawable.bubo_week_done
        state == "today" -> res.drawable("bubo_week_today_$scene")
        else -> res.drawable("bubo_week_$scene")
      })
      views.setInt(dot, "setImageAlpha", if (state == "future") 140 else 255)
      views.setContentDescription(dot, "${day?.optString("label") ?: "Dia"}: ${if (active) "com atividade" else "sem atividade"}")
    }
  }

  private fun renderMonth(views: RemoteViews, res: Res, snapshot: JSONObject?, fresh: Boolean, scene: String) {
    val month = snapshot?.optJSONObject("month")
    val days = month?.optJSONArray("days")
    val offset = month?.optInt("offset") ?: 0
    val count = days?.length() ?: 0
    val label = month?.optString("label") ?: ""
    for (index in 0 until 7) {
      views.setTextViewText(res.id("bubo_ch$index"), WEEK_LETTERS[index])
      views.setTextColor(res.id("bubo_ch$index"), res.color("bubo_scene_${scene}_muted"))
    }
    views.setViewVisibility(res.id("bubo_cr5"), if (offset + count > 35) View.VISIBLE else View.GONE)
    for (cell in 0 until 42) {
      val view = res.id("bubo_c$cell")
      val day = days?.optJSONObject(cell - offset)
      if (day == null || cell < offset) {
        views.setTextViewText(view, "")
        views.setInt(view, "setBackgroundResource", 0)
        continue
      }
      val active = fresh && day.optBoolean("active")
      val today = fresh && day.optBoolean("today")
      val run = if (active) day.optString("run", "single") else "none"
      views.setTextViewText(view, day.optInt("day").toString())
      views.setInt(view, "setBackgroundResource", when {
        active && today -> res.drawable("bubo_cal_${scene}_${run}_today")
        active -> res.drawable("bubo_cal_${scene}_$run")
        today -> res.drawable("bubo_cal_${scene}_ring")
        else -> 0
      })
      views.setTextColor(view, res.color(when {
        active && today -> "bubo_onPrimary"
        active -> "bubo_scene_${scene}_pillText"
        day.optBoolean("future") -> "bubo_scene_${scene}_muted"
        else -> "bubo_scene_${scene}_text"
      }))
      views.setContentDescription(view, "${day.optInt("day")} de $label${if (active) ", com atividade" else ""}")
    }
  }

  private fun renderBook(context: Context, views: RemoteViews, book: JSONObject?) {
    views.setTextViewText(R.id.bubo_title, book?.optString("title") ?: "Sua próxima leitura")
    views.setTextViewText(R.id.bubo_pages, if (book != null) pages(book) else "Adicione um livro à sua estante")
    val total = book?.let { if (it.isNull("totalPages")) null else it.optInt("totalPages") }
    views.setViewVisibility(R.id.bubo_progress, if (book != null && total != null) View.VISIBLE else View.GONE)
    views.setProgressBar(R.id.bubo_progress, 100, book?.optInt("progress") ?: 0, false)
    views.setContentDescription(R.id.bubo_progress, "${book?.optInt("progress") ?: 0} por cento lido")
    val cover = File(context.filesDir, "bubo-widget-cover")
    val bitmap = if (book != null && cover.isFile) {
      BitmapFactory.decodeFile(cover.path, BitmapFactory.Options().apply { inSampleSize = 2 })
    } else null
    views.setViewVisibility(R.id.bubo_cover, if (bitmap != null) View.VISIBLE else View.GONE)
    if (bitmap != null) views.setImageViewBitmap(R.id.bubo_cover, bitmap)
    views.setContentDescription(R.id.bubo_cover, book?.optString("title")?.let { "Capa de $it" } ?: "Capa do livro")
    views.setTextViewText(R.id.bubo_action, if (book != null) "Continuar leitura" else "Abrir Estante")
    views.setOnClickPendingIntent(R.id.bubo_card, open(context, book?.optString("sessionUrl") ?: "bubo:///estante"))
  }

  private fun pages(book: JSONObject): String {
    val page = book.optInt("page")
    return if (book.isNull("totalPages")) "Página $page" else "Página $page de ${book.optInt("totalPages")}"
  }

  /** Name-based lookups for generated resources (one per scene, pose and calendar run). */
  private class Res(private val context: Context) {
    fun drawable(name: String) = context.resources.getIdentifier(name, "drawable", context.packageName)
    fun id(name: String) = context.resources.getIdentifier(name, "id", context.packageName)
    fun color(name: String) = context.getColor(context.resources.getIdentifier(name, "color", context.packageName))
  }

  companion object {
    private fun open(context: Context, url: String): PendingIntent {
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
        setPackage(context.packageName)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      }
      return PendingIntent.getActivity(context, url.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      listOf(StreakWidget(), RhythmWidget(), CalendarWidget(), ReadingWidget()).forEach { provider ->
        val ids = manager.getAppWidgetIds(ComponentName(context, provider.javaClass))
        provider.onUpdate(context, manager, ids)
      }
    }
  }
}
