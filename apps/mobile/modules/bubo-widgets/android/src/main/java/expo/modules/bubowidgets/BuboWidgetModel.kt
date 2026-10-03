package expo.modules.bubowidgets

import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/** What the widget shows now. `title` replaces the streak when there is no fresh data. */
internal data class WidgetMood(
  val pose: String,
  val message: String,
  val lit: Boolean,
  val alert: Boolean,
  val tone: String,
  val title: String? = null,
)

/** `state`: done, missed, frozen, today (still open) or future; today with activity is done. */
internal data class WeekDay(val letter: String, val label: String, val state: String, val today: Boolean)

internal data class MonthDay(
  val day: Int,
  val active: Boolean,
  val frozen: Boolean,
  val today: Boolean,
  val future: Boolean,
  val run: String,
)

internal data class WidgetBook(
  val title: String,
  val author: String?,
  val page: Int,
  val totalPages: Int?,
  val progress: Int?,
  val palette: Int,
  val sessionUrl: String,
)

internal data class PodiumSpot(val rank: Int, val initials: String, val xp: Int, val me: Boolean)

internal data class WidgetLeague(
  val rank: Int,
  val previousRank: Int?,
  val participants: Int,
  val weeklyXp: Int,
  val daysLeft: Int,
  val podium: List<PodiumSpot>,
)

private val MONTHS = listOf(
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
)
private val LETTERS = listOf("S", "T", "Q", "Q", "S", "S", "D")

/**
 * The snapshot published by the app (version 3, see @bubo/contracts `widgetSnapshotSchema`),
 * read with the same freshness rules as `widgetMoodNow` in @bubo/domain: data from another day
 * or past `expiresAt` is never shown as today's.
 */
internal class WidgetModel(
  val signedIn: Boolean,
  val fresh: Boolean,
  val streak: Int,
  val activeToday: Boolean,
  val mood: WidgetMood,
  val freezesAvailable: Int,
  val week: List<WeekDay>,
  val monthTitle: String,
  val monthOffset: Int,
  val monthDays: List<MonthDay>,
  val book: WidgetBook?,
  val league: WidgetLeague?,
) {
  companion object {
    fun load(raw: String?, now: Calendar): WidgetModel {
      val snapshot = raw?.let { runCatching { JSONObject(it) }.getOrNull() }?.takeIf { it.optInt("version") == 3 }
      val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(now.time)
      val fresh = snapshot != null && snapshot.optLong("expiresAt") > now.timeInMillis && snapshot.optString("today") == today
      val hour = now.get(Calendar.HOUR_OF_DAY)
      val mood = mood(snapshot, fresh, hour)
      val data = if (fresh) snapshot else null
      val weekJson = data?.optJSONArray("week")
      val week = (0 until 7).map { index ->
        val day = weekJson?.optJSONObject(index)
        val state = day?.optString("state") ?: "future"
        WeekDay(
          LETTERS[index],
          day?.optString("label") ?: LETTERS[index],
          if (state == "today" && day?.optBoolean("active") == true) "done" else state,
          state == "today",
        )
      }
      // The grid always follows the device's current month; activity only comes from fresh data.
      val first = (now.clone() as Calendar).apply { set(Calendar.DAY_OF_MONTH, 1) }
      val length = now.getActualMaximum(Calendar.DAY_OF_MONTH)
      val offset = (first.get(Calendar.DAY_OF_WEEK) + 5) % 7
      val todayNumber = now.get(Calendar.DAY_OF_MONTH)
      val monthJson = data?.optJSONObject("month")?.optJSONArray("days")
      val days = (1..length).map { number ->
        val day = monthJson?.optJSONObject(number - 1)?.takeIf { it.optInt("day") == number }
        MonthDay(
          number,
          day?.optBoolean("active") == true,
          day?.optBoolean("frozen") == true,
          number == todayNumber,
          number > todayNumber,
          day?.optString("run", "none") ?: "none",
        )
      }
      val bookJson = data?.optJSONObject("book")
      val book = bookJson?.let {
        WidgetBook(
          it.optString("title"),
          it.optString("author").takeIf { author -> !it.isNull("author") && author.isNotBlank() },
          it.optInt("page"),
          if (it.isNull("totalPages")) null else it.optInt("totalPages"),
          if (it.isNull("progress")) null else it.optInt("progress"),
          it.optInt("coverPalette"),
          it.optString("sessionUrl", "bubo:///estante"),
        )
      }
      val leagueJson = data?.optJSONObject("league")
      val league = leagueJson?.let { json ->
        val podium = json.optJSONArray("podium")
        WidgetLeague(
          json.optInt("rank", 1),
          if (json.isNull("previousRank")) null else json.optInt("previousRank"),
          json.optInt("participants", 1),
          json.optInt("weeklyXp"),
          json.optInt("daysLeft", 1),
          (0 until (podium?.length() ?: 0)).mapNotNull { index ->
            podium?.optJSONObject(index)?.let {
              PodiumSpot(it.optInt("rank"), it.optString("initials", "?"), it.optInt("xp"), it.optBoolean("me"))
            }
          },
        )
      }
      return WidgetModel(
        signedIn = snapshot != null,
        fresh = fresh,
        streak = data?.optInt("streakDays") ?: 0,
        activeToday = data?.optBoolean("activeToday") == true,
        mood = mood,
        freezesAvailable = data?.optJSONObject("freeze")?.optInt("available") ?: 0,
        week = week,
        monthTitle = "${MONTHS[now.get(Calendar.MONTH)]} ${now.get(Calendar.YEAR)}",
        monthOffset = offset,
        monthDays = days,
        book = book,
        league = league,
      )
    }

    private fun mood(snapshot: JSONObject?, fresh: Boolean, hour: Int): WidgetMood {
      val night = hour >= 22 || hour < 6
      if (snapshot == null) return WidgetMood("welcome", "Entre para ver sua sequência", false, false, "welcome", "Olá!")
      if (!fresh) {
        return if (night) WidgetMood("sleeping", "Até amanhã!", false, false, "night", "Zzz…")
        else WidgetMood("doubt", "Para atualizar sua sequência", false, false, "stale", "Abra o Bubo")
      }
      val moods = snapshot.optJSONArray("moods")
      var picked: JSONObject? = null
      for (index in 0 until (moods?.length() ?: 0)) {
        val mood = moods?.optJSONObject(index) ?: continue
        if (picked == null || mood.optInt("fromHour") <= hour) picked = mood
      }
      return WidgetMood(
        picked?.optString("pose", "happy") ?: "happy",
        picked?.optString("message") ?: "",
        picked?.optBoolean("lit") == true,
        picked?.optBoolean("alert") == true,
        picked?.optString("tone", "calm") ?: "calm",
      )
    }
  }
}
