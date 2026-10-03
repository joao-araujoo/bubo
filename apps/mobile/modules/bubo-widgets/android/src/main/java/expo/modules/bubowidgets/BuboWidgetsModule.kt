package expo.modules.bubowidgets

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class BuboWidgetsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BuboWidgets")
    AsyncFunction("update") { json: String, coverPath: String? ->
      val context = requireNotNull(appContext.reactContext)
      val cover = File(context.filesDir, "bubo-widget-cover")
      cover.delete()
      if (coverPath != null) {
        val source = File(coverPath.removePrefix("file://"))
        if (source.isFile) runCatching { source.copyTo(cover, overwrite = true) }
      }
      context.getSharedPreferences("bubo-widgets", 0).edit().putString("snapshot", json).commit()
      BuboWidgetProvider.refreshAll(context)
    }
    AsyncFunction("clear") {
      val context = requireNotNull(appContext.reactContext)
      context.getSharedPreferences("bubo-widgets", 0).edit().clear().commit()
      File(context.filesDir, "bubo-widget-cover").delete()
      BuboWidgetProvider.refreshAll(context)
    }
    AsyncFunction("requestPin") { kind: String ->
      val context = requireNotNull(appContext.reactContext)
      val manager = AppWidgetManager.getInstance(context)
      val provider = when (kind) {
        "streak" -> StreakWidget::class.java
        "rhythm" -> RhythmWidget::class.java
        "calendar" -> CalendarWidget::class.java
        "reading" -> ReadingWidget::class.java
        "league" -> LeagueWidget::class.java
        else -> null
      }
      if (Build.VERSION.SDK_INT >= 26 && provider != null && manager.isRequestPinAppWidgetSupported) {
        manager.requestPinAppWidget(ComponentName(context, provider), null, null)
      } else false
    }
  }
}
