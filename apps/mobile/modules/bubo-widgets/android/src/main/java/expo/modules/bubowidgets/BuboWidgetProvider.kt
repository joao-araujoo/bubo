package expo.modules.bubowidgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.widget.RemoteViews
import java.util.Calendar

class StreakWidget : BuboWidgetProvider("streak")
class RhythmWidget : BuboWidgetProvider("rhythm")
class CalendarWidget : BuboWidgetProvider("calendar")
class ReadingWidget : BuboWidgetProvider("reading")
class LeagueWidget : BuboWidgetProvider("league")

open class BuboWidgetProvider(private val kind: String) : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { render(context, manager, it) }
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    render(context, manager, id)
  }

  private fun render(context: Context, manager: AppWidgetManager, id: Int) {
    val raw = context.getSharedPreferences("bubo-widgets", 0).getString("snapshot", null)
    val model = WidgetModel.load(raw, Calendar.getInstance())
    val (width, height) = size(context, manager.getAppWidgetOptions(id))
    val wide = width >= 200f
    val views = RemoteViews(context.packageName, R.layout.bubo_widget_canvas)
    try {
      val painter = BuboPainter(context, width, height)
      when {
        kind == "rhythm" && wide -> painter.week(model)
        kind == "calendar" && wide -> painter.calendar(model)
        kind == "reading" && wide -> painter.reading(model)
        kind == "reading" -> painter.readingCompact(model)
        kind == "league" && wide -> painter.league(model)
        kind == "league" -> painter.leagueCompact(model)
        else -> painter.streak(model)
      }
      views.setImageViewBitmap(R.id.bubo_canvas, painter.bitmap)
    } catch (error: Throwable) {
      // The rounded surface stays visible; never leave the launcher with "Can't load widget".
      Log.w("BuboWidgets", "render failed for $kind", error)
    }
    views.setContentDescription(R.id.bubo_canvas, describe(model))
    views.setOnClickPendingIntent(android.R.id.background, open(context, url(model)))
    manager.updateAppWidget(id, views)
  }

  /** Current size in dp: portrait uses min width × max height, landscape the opposite. */
  private fun size(context: Context, options: Bundle): Pair<Float, Float> {
    val landscape = context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
    val width = options.getInt(if (landscape) AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH else AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
    val height = options.getInt(if (landscape) AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT else AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)
    if (width > 0 && height > 0) return width.toFloat() to height.toFloat()
    return if (kind == "streak") 150f to 150f else 330f to 160f
  }

  private fun url(model: WidgetModel): String = when {
    !model.signedIn -> "bubo:///"
    kind == "reading" -> model.book?.sessionUrl ?: "bubo:///estante"
    kind == "league" -> "bubo:///liga"
    else -> "bubo:///"
  }

  /** One spoken summary: the canvas is a single image for accessibility services. */
  private fun describe(model: WidgetModel): String {
    if (!model.fresh) return "Bubo: ${model.mood.title ?: "Abra o Bubo"}. ${model.mood.message}"
    val streak = if (model.streak == 1) "1 dia seguido" else "${model.streak} dias seguidos"
    val freeze = when (model.freezesAvailable) {
      0 -> ""
      1 -> " 1 proteção de sequência pronta."
      else -> " ${model.freezesAvailable} proteções de sequência prontas."
    }
    return when (kind) {
      "rhythm" -> {
        val done = model.week.count { it.state == "done" }
        "Sequência: $streak. ${model.mood.message}. $done dias com atividade nesta semana.$freeze"
      }
      "calendar" -> {
        val days = model.monthDays.count { it.active }
        "${model.monthTitle}: $days dias com atividade. Sequência: $streak.$freeze"
      }
      "reading" -> model.book?.let { book ->
        val pages = book.totalPages?.let { "página ${book.page} de $it" } ?: "página ${book.page}"
        "Continuar leitura: ${book.title}${book.author?.let { ", de $it" } ?: ""}, $pages."
      } ?: "Nenhuma leitura ativa. Abrir Estante."
      "league" -> model.league?.let { league ->
        if (league.participants > 1) "Liga semanal: posição ${league.rank} entre ${league.participants}, ${league.weeklyXp} XP. ${league.daysLeft} dias restantes."
        else "Liga semanal: ${league.weeklyXp} XP nesta semana. Adicione amigos nos clubes."
      } ?: "Liga semanal indisponível. Abra o Bubo para atualizar."
      else -> "Sequência: $streak. ${model.mood.message}.$freeze"
    }
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
      listOf(StreakWidget(), RhythmWidget(), CalendarWidget(), ReadingWidget(), LeagueWidget()).forEach { provider ->
        val ids = manager.getAppWidgetIds(ComponentName(context, provider.javaClass))
        provider.onUpdate(context, manager, ids)
      }
    }
  }
}
