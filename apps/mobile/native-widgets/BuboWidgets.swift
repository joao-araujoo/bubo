import SwiftUI
import WidgetKit
import UIKit

struct BuboBook: Decodable {
  let title: String
  let page: Int
  let totalPages: Int?
  let progress: Int?
  let url: String
  let sessionUrl: String
}

struct BuboWeekDay: Decodable {
  let label: String
  let date: String
  let active: Bool
  let read: Bool
  let state: String
}

struct BuboMonthDay: Decodable {
  let day: Int
  let active: Bool
  let today: Bool
  let future: Bool
  let run: String
}

struct BuboMonth: Decodable {
  let label: String
  let offset: Int
  let days: [BuboMonthDay]
}

struct BuboMoodData: Decodable {
  let fromHour: Int
  let scene: String
  let pose: String
  let message: String
  let lit: Bool
  let alert: Bool
}

struct BuboSnapshot: Decodable {
  let version: Int
  let today: String
  let expiresAt: Double
  let updatedAt: Double
  let hideBookOnLockScreen: Bool
  let streakDays: Int
  let activeToday: Bool
  let weeklyGoal: Int
  let activeDays: Int
  let week: [BuboWeekDay]
  let month: BuboMonth
  let moods: [BuboMoodData]
  let availableReviews: Int
  let nextDueDate: String?
  let book: BuboBook?
}

enum BuboStorage {
  static var group: String {
    Bundle.main.object(forInfoDictionaryKey: "BuboAppGroup") as? String ?? "group.com.joaoaraujo.bubo.widgets"
  }
  static func snapshot() -> BuboSnapshot? {
    guard let value = UserDefaults(suiteName: group)?.string(forKey: "snapshot"),
          let data = value.data(using: .utf8),
          let snapshot = try? JSONDecoder().decode(BuboSnapshot.self, from: data),
          snapshot.version == 2 else { return nil }
    return snapshot
  }
  static func cover() -> UIImage? {
    guard let directory = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else { return nil }
    return UIImage(contentsOfFile: directory.appendingPathComponent("cover").path)
  }
}

/// What the widget shows now. `title` replaces the streak number when there is no fresh data.
struct BuboMood {
  let scene: String
  let pose: String
  let message: String
  let lit: Bool
  let alert: Bool
  var title: String? = nil
}

struct BuboEntry: TimelineEntry {
  let date: Date
  let snapshot: BuboSnapshot?
  var fresh: Bool {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.dateFormat = "yyyy-MM-dd"
    return (snapshot?.expiresAt ?? 0) > date.timeIntervalSince1970 * 1000 && snapshot?.today == formatter.string(from: date)
  }
  var hour: Int { Calendar.current.component(.hour, from: date) }
  var mood: BuboMood {
    guard let snapshot = snapshot else {
      return BuboMood(scene: "lavender", pose: "welcome", message: "Entre no app para começar", lit: false, alert: false, title: "Olá!")
    }
    if !fresh {
      return hour >= 22 || hour < 6
        ? BuboMood(scene: "night", pose: "sleeping", message: "Até amanhã!", lit: false, alert: false, title: "Zzz…")
        : BuboMood(scene: "slate", pose: "doubt", message: "Para atualizar sua sequência", lit: false, alert: false, title: "Abra o Bubo")
    }
    let current = snapshot.moods.reduce(snapshot.moods.first) { picked, mood in mood.fromHour <= hour ? mood : picked }
    guard let mood = current else { return BuboMood(scene: "lavender", pose: "welcome", message: "", lit: false, alert: false) }
    return BuboMood(scene: mood.scene, pose: mood.pose, message: mood.message, lit: mood.lit, alert: mood.alert)
  }
  var streak: Int { fresh ? snapshot?.streakDays ?? 0 : 0 }
  var days: String { streak == 1 ? "1 dia" : "\(streak) dias" }
  var book: BuboBook? { fresh ? snapshot?.book : nil }
}

struct BuboProvider: TimelineProvider {
  func placeholder(in context: Context) -> BuboEntry { BuboEntry(date: Date(), snapshot: nil) }
  func getSnapshot(in context: Context, completion: @escaping (BuboEntry) -> Void) {
    completion(BuboEntry(date: Date(), snapshot: context.isPreview ? nil : BuboStorage.snapshot()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<BuboEntry>) -> Void) {
    let now = Date()
    let snapshot = BuboStorage.snapshot()
    var dates = [now]
    // Mood changes (morning, evening nudge, last chance, night) and expiry, without a JS timer
    // or an authenticated background request. Hours match WIDGET_MOOD_HOURS in @bubo/domain.
    for hour in [0, 6, 18, 21, 22] {
      if let next = Calendar.current.nextDate(after: now, matching: DateComponents(hour: hour), matchingPolicy: .nextTime) { dates.append(next) }
    }
    if let snapshot = snapshot {
      let expiry = Date(timeIntervalSince1970: snapshot.expiresAt / 1000)
      if expiry > now { dates.append(expiry) }
    }
    let entries = dates.sorted().map { BuboEntry(date: $0, snapshot: snapshot) }
    completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(1800))))
  }
}

// MARK: - Art

/// Generated geometry (opcodes 0 M, 1 L, 2 Q, 3 C, 4 Z) scaled uniformly from a `box`-tall viewport.
struct OpsShape: Shape {
  let ops: [Double]
  var box: Double = 24
  var viewportWidth: Double? = nil
  func path(in rect: CGRect) -> Path {
    let scale = rect.height / box
    let dx = rect.minX + (rect.width - (viewportWidth ?? box) * scale) / 2
    let point = { (x: Double, y: Double) in CGPoint(x: dx + x * scale, y: rect.minY + y * scale) }
    var path = Path()
    var index = 0
    while index < ops.count {
      switch Int(ops[index]) {
      case 0: path.move(to: point(ops[index + 1], ops[index + 2])); index += 3
      case 1: path.addLine(to: point(ops[index + 1], ops[index + 2])); index += 3
      case 2:
        path.addQuadCurve(to: point(ops[index + 3], ops[index + 4]), control: point(ops[index + 1], ops[index + 2]))
        index += 5
      case 3:
        path.addCurve(to: point(ops[index + 5], ops[index + 6]), control1: point(ops[index + 1], ops[index + 2]), control2: point(ops[index + 3], ops[index + 4]))
        index += 7
      default: path.closeSubpath(); index += 1
      }
    }
    return path
  }
}

/// A calendar run cell: rounded only where the run starts or ends (iOS 16 has no uneven rectangle).
struct RunShape: Shape {
  let leading: Bool
  let trailing: Bool
  func path(in rect: CGRect) -> Path {
    let radius = min(9, rect.height / 2)
    var path = Path()
    path.move(to: CGPoint(x: rect.minX + (leading ? radius : 0), y: rect.minY))
    path.addLine(to: CGPoint(x: rect.maxX - (trailing ? radius : 0), y: rect.minY))
    if trailing {
      path.addArc(center: CGPoint(x: rect.maxX - radius, y: rect.midY), radius: radius, startAngle: .degrees(-90), endAngle: .degrees(90), clockwise: false)
    } else { path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY)) }
    path.addLine(to: CGPoint(x: rect.minX + (leading ? radius : 0), y: rect.maxY))
    if leading {
      path.addArc(center: CGPoint(x: rect.minX + radius, y: rect.midY), radius: radius, startAngle: .degrees(90), endAngle: .degrees(270), clockwise: false)
    } else { path.addLine(to: CGPoint(x: rect.minX, y: rect.minY)) }
    path.closeSubpath()
    return path
  }
}

struct SceneBackground: View {
  let scene: BuboScene
  var wide = false
  var decorated = true
  var body: some View {
    ZStack {
      LinearGradient(colors: [scene.top, scene.bottom], startPoint: .top, endPoint: .bottom)
      if decorated {
        ForEach(Array((wide ? scene.wide : scene.square).enumerated()), id: \.offset) { _, shape in
          OpsShape(ops: shape.ops, box: 100, viewportWidth: wide ? 220 : 100)
            .fill(shape.cover ?? scene.deco).opacity(shape.alpha)
        }
      }
    }
  }
}

struct FlameView: View {
  let lit: Bool
  let alert: Bool
  let scene: BuboScene
  let size: CGFloat
  var body: some View {
    ZStack(alignment: .bottomTrailing) {
      if lit {
        ZStack {
          OpsShape(ops: BuboTokens.flameOuter).fill(BuboTokens.flame)
          OpsShape(ops: BuboTokens.flameInner).fill(BuboTokens.flameGlow)
        }
      } else {
        OpsShape(ops: BuboTokens.flameOuter + BuboTokens.flameInner)
          .fill(scene.number.opacity(0.92), style: FillStyle(eoFill: true))
      }
      if alert {
        ZStack {
          Circle().fill(BuboTokens.alert)
          OpsShape(ops: BuboTokens.alertMark).fill(BuboTokens.white)
        }
        .frame(width: size / 2, height: size / 2)
      }
    }
    .frame(width: size, height: size)
    .accessibilityHidden(true)
  }
}

/// Bubo peeking from the bottom edge (about 70% visible), always an official pose.
struct MascotPeek: View {
  let pose: String
  let size: CGFloat
  var visible: CGFloat = 0.7
  var body: some View {
    Image("bubo-\(pose)").renderingMode(.original).resizable().scaledToFit()
      .frame(width: size, height: size)
      .offset(y: size * (1 - visible))
      .accessibilityLabel(BuboWidgetView.poseLabel(pose))
  }
}

// MARK: - Views

struct BuboWidgetView: View {
  let entry: BuboEntry
  let kind: String
  @Environment(\.widgetFamily) private var family

  static func poseLabel(_ pose: String) -> String {
    [
      "welcome": "Bubo dando boas-vindas", "happy": "Bubo feliz", "reading": "Bubo lendo",
      "review": "Bubo revisando", "celebrating": "Bubo comemorando", "achievement": "Bubo com uma conquista",
      "cheering": "Bubo animando", "worried": "Bubo preocupado", "surprised": "Bubo surpreso",
      "sleeping": "Bubo dormindo", "doubt": "Bubo com dúvida",
    ][pose] ?? "Bubo"
  }

  private var mood: BuboMood { entry.mood }
  private var calendarScene: String {
    entry.fresh ? (entry.snapshot?.activeToday == true ? "mint" : "periwinkle") : mood.scene
  }
  private var sceneId: String { kind == "calendar" && family == .systemMedium ? calendarScene : mood.scene }
  private var scene: BuboScene { BuboScene.named(sceneId) }
  private var homeURL: URL { URL(string: "bubo:///")! }
  private var bookURL: URL { entry.book.flatMap { URL(string: $0.url) } ?? homeURL }
  private func font(_ weight: String, _ size: CGFloat) -> Font { .custom("PlusJakartaSans-\(weight)", size: size) }
  private func pages(_ book: BuboBook) -> String {
    book.totalPages.map { "Página \(book.page) de \($0)" } ?? "Página \(book.page)"
  }

  private func header(number: String, size: CGFloat, flame: CGFloat) -> some View {
    HStack(spacing: 4) {
      FlameView(lit: mood.lit, alert: mood.alert, scene: scene, size: flame)
      Text(mood.title ?? number)
        .font(font("ExtraBold", mood.title == nil ? size : min(size, 18)))
        .foregroundStyle(scene.number).lineLimit(1).minimumScaleFactor(0.6)
    }
    .accessibilityElement(children: .combine)
    .accessibilityLabel(mood.title ?? "Sequência de \(entry.days)")
  }

  private var caption: some View {
    Text(mood.message).font(font("Bold", 12)).foregroundStyle(scene.muted).lineLimit(2)
  }

  /// Small: flame + number, caption, Bubo peeking (image 1 of the reference board).
  private var streakView: some View {
    GeometryReader { geo in
      ZStack(alignment: .topLeading) {
        MascotPeek(pose: mood.pose, size: geo.size.height * 0.95)
          .frame(width: geo.size.width, height: geo.size.height, alignment: .bottom)
        VStack(alignment: .leading, spacing: 2) {
          header(number: "\(entry.streak)", size: 26, flame: 26)
          if kind == "reading", let book = entry.book {
            Text(pages(book)).font(font("Bold", 12)).foregroundStyle(scene.muted).lineLimit(2)
          } else { caption }
        }
        .padding(.leading, 12).padding(.top, 11).padding(.trailing, 10)
      }
    }
  }

  /// Medium: "N dias de sequência", caption, week checks and Bubo on the right.
  private var weekView: some View {
    GeometryReader { geo in
      ZStack(alignment: .topLeading) {
        MascotPeek(pose: mood.pose, size: geo.size.height * 1.05)
          .frame(width: geo.size.width, height: geo.size.height, alignment: .bottomTrailing)
          .offset(x: 10)
        VStack(alignment: .leading, spacing: 3) {
          header(number: "\(entry.days) de sequência", size: 18, flame: 24)
          Text(mood.message).font(font("Bold", 13)).foregroundStyle(scene.muted).lineLimit(1)
          Spacer(minLength: 0)
          HStack(spacing: 0) {
            ForEach(0..<7, id: \.self) { index in
              let day = entry.fresh ? entry.snapshot?.week[safe: index] : nil
              let state = day?.state ?? "future"
              VStack(spacing: 3) {
                Text(["S", "T", "Q", "Q", "S", "S", "D"][index]).font(font("Bold", 10))
                  .foregroundStyle(state == "today" ? scene.text : scene.muted)
                ZStack {
                  if day?.active == true {
                    Circle().fill(BuboTokens.flame)
                    OpsShape(ops: BuboTokens.check).stroke(BuboTokens.white, style: StrokeStyle(lineWidth: 2.8, lineCap: .round, lineJoin: .round))
                  } else if state == "today" {
                    Circle().fill(scene.pill).overlay(Circle().stroke(scene.text, lineWidth: 2))
                  } else {
                    Circle().fill(scene.pill).opacity(state == "future" ? 0.55 : 1)
                  }
                }
                .frame(width: 24, height: 24)
              }
              .frame(maxWidth: .infinity)
              .accessibilityElement(children: .ignore)
              .accessibilityLabel("\(day?.label ?? "Dia"): \(day?.active == true ? "com atividade" : "sem atividade")")
            }
          }
        }
        .padding(.leading, 14).padding(.vertical, 12).padding(.trailing, geo.size.width * 0.34)
      }
    }
  }

  /// Medium: month runs on the left; streak, caption and Bubo on the right (image 3).
  private var calendarView: some View {
    GeometryReader { geo in
      HStack(spacing: 0) {
        monthGrid.padding(.leading, 10).padding(.vertical, 10).frame(width: geo.size.width * 0.58)
        ZStack(alignment: .top) {
          MascotPeek(pose: mood.pose, size: geo.size.height * 0.85)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
          VStack(spacing: 2) {
            header(number: "\(entry.streak)", size: 28, flame: 28)
            Text(mood.message).font(font("Bold", 12)).foregroundStyle(scene.muted)
              .multilineTextAlignment(.center).lineLimit(2)
          }
          .padding(.top, 12).padding(.horizontal, 6)
        }
      }
    }
  }

  private var monthGrid: some View {
    let month = entry.snapshot?.month
    let offset = month?.offset ?? 0
    let days = month?.days ?? []
    let rows = (offset + days.count + 6) / 7
    return VStack(spacing: 0) {
      HStack(spacing: 0) {
        ForEach(0..<7, id: \.self) { index in
          Text(["S", "T", "Q", "Q", "S", "S", "D"][index]).font(font("ExtraBold", 9))
            .foregroundStyle(scene.muted).frame(maxWidth: .infinity)
        }
      }
      .padding(.bottom, 2)
      ForEach(0..<max(rows, 5), id: \.self) { row in
        HStack(spacing: 0) {
          ForEach(0..<7, id: \.self) { column in
            dayCell(days[safe: row * 7 + column - offset], label: month?.label ?? "")
          }
        }
        .frame(maxHeight: .infinity)
      }
    }
  }

  @ViewBuilder private func dayCell(_ day: BuboMonthDay?, label: String) -> some View {
    if let day = day {
      let active = entry.fresh && day.active
      let today = entry.fresh && day.today
      ZStack {
        if active {
          RunShape(leading: day.run == "start" || day.run == "single", trailing: day.run == "end" || day.run == "single")
            .fill(scene.pill).padding(.vertical, 1)
        }
        if today {
          if active { Circle().fill(scene.number).frame(width: 17, height: 17) }
          else { Circle().stroke(scene.number, lineWidth: 1.5).frame(width: 17, height: 17) }
        }
        Text("\(day.day)").font(font("ExtraBold", 10))
          .foregroundStyle(active && today ? BuboTokens.white : active ? scene.pillText : day.future ? scene.muted : scene.text)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .accessibilityLabel("\(day.day) de \(label)\(active ? ", com atividade" : "")")
    } else {
      Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }

  /// Medium: streak header, white book card and Bubo peeking on the right.
  private var readingView: some View {
    GeometryReader { geo in
      ZStack(alignment: .topLeading) {
        MascotPeek(pose: mood.pose, size: geo.size.height * 0.92)
          .frame(width: geo.size.width, height: geo.size.height, alignment: .bottomTrailing)
          .offset(x: 8)
        VStack(alignment: .leading, spacing: 8) {
          HStack(spacing: 8) {
            header(number: "\(entry.streak)", size: 18, flame: 22)
            Text(mood.message).font(font("Bold", 12)).foregroundStyle(scene.muted).lineLimit(1)
          }
          Link(destination: entry.book.flatMap { URL(string: $0.sessionUrl) } ?? URL(string: "bubo:///estante")!) {
            HStack(spacing: 10) {
              if let book = entry.book, let cover = BuboStorage.cover() {
                Image(uiImage: cover).resizable().scaledToFill().frame(width: 40, height: 58)
                  .clipShape(RoundedRectangle(cornerRadius: 6)).accessibilityLabel("Capa de \(book.title)")
              }
              VStack(alignment: .leading, spacing: 3) {
                Text(entry.book?.title ?? "Sua próxima leitura").font(font("ExtraBold", 14))
                  .foregroundStyle(BuboTokens.cardText).lineLimit(2).privacySensitive()
                Text(entry.book.map(pages) ?? "Adicione um livro à sua estante").font(font("Regular", 11))
                  .foregroundStyle(BuboTokens.cardMuted).lineLimit(1)
                if let progress = entry.book?.progress {
                  ProgressView(value: Double(progress), total: 100).tint(BuboTokens.cardFill)
                    .accessibilityLabel("\(progress) por cento lido")
                }
                Text(entry.book == nil ? "Abrir Estante" : "Continuar leitura").font(font("Bold", 11))
                  .foregroundStyle(BuboTokens.cardFill)
              }
              Spacer(minLength: 0)
            }
            .padding(10)
            .frame(maxHeight: .infinity)
            .background(BuboTokens.card, in: RoundedRectangle(cornerRadius: 16))
          }
          .padding(.trailing, geo.size.width * 0.27)
        }
        .padding(12)
      }
    }
  }

  @ViewBuilder private var lockView: some View {
    if family == .accessoryCircular {
      ZStack {
        AccessoryWidgetBackground()
        VStack(spacing: 0) {
          OpsShape(ops: BuboTokens.flameOuter + BuboTokens.flameInner).fill(style: FillStyle(eoFill: !mood.lit)).frame(width: 16, height: 16)
          Text(entry.fresh ? "\(entry.streak)" : "–").font(font("ExtraBold", 18)).minimumScaleFactor(0.6)
        }
      }
      .accessibilityLabel(entry.fresh ? "Sequência de \(entry.days)" : "Abra o Bubo para atualizar")
    } else if family == .accessoryInline {
      Label(entry.fresh ? "Sequência de \(entry.days)" : "Bubo · abra para atualizar", systemImage: "flame.fill")
    } else {
      HStack(spacing: 6) {
        OpsShape(ops: BuboTokens.flameOuter + BuboTokens.flameInner).fill(style: FillStyle(eoFill: !mood.lit)).frame(width: 26, height: 26)
        VStack(alignment: .leading, spacing: 0) {
          Text(entry.fresh ? "\(entry.days) de sequência" : "Bubo").font(font("ExtraBold", 15)).lineLimit(1)
          Text(mood.message).font(font("Bold", 12)).lineLimit(1)
          if let book = entry.book {
            // Lock screen privacy (on by default): the page instead of the title.
            if entry.snapshot?.hideBookOnLockScreen == false {
              Text(book.title).font(font("Regular", 11)).lineLimit(1).privacySensitive()
            } else { Text(pages(book)).font(font("Regular", 11)).lineLimit(1) }
          } else if entry.fresh, let reviews = entry.snapshot?.availableReviews, reviews > 0 {
            Text(reviews == 1 ? "1 revisão para hoje" : "\(reviews) revisões para hoje").font(font("Regular", 11)).lineLimit(1)
          }
        }
      }
    }
  }

  private var lock: Bool { family == .accessoryCircular || family == .accessoryRectangular || family == .accessoryInline }

  @ViewBuilder private var homeView: some View {
    switch (kind, family) {
    case ("rhythm", .systemMedium), ("rhythm", .systemLarge): weekView
    case ("calendar", .systemMedium), ("calendar", .systemLarge): calendarView
    case ("reading", .systemMedium), ("reading", .systemLarge): readingView
    default: streakView
    }
  }

  var body: some View {
    Group { if lock { lockView } else { homeView } }
      .widgetURL(kind == "reading" ? bookURL : homeURL)
      .modifier(BuboBackground(scene: scene, wide: family != .systemSmall, decorated: !(kind == "calendar" && family != .systemSmall), lock: lock))
  }
}

struct BuboBackground: ViewModifier {
  let scene: BuboScene
  let wide: Bool
  let decorated: Bool
  let lock: Bool
  @ViewBuilder func body(content: Content) -> some View {
    if #available(iOS 17.0, *) {
      content.containerBackground(for: .widget) {
        if lock { Color.clear } else { SceneBackground(scene: scene, wide: wide, decorated: decorated) }
      }
    } else if lock {
      content
    } else {
      content.background(SceneBackground(scene: scene, wide: wide, decorated: decorated))
    }
  }
}

extension Array {
  subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}

struct BuboStreakWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "BuboStreak", provider: BuboProvider()) { BuboWidgetView(entry: $0, kind: "streak") }
      .configurationDisplayName("Sequência").description("Sua sequência de leitura com o Bubo, também na tela bloqueada.")
      .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
      .contentMarginsDisabled() // full bleed: Bubo peeks from the very edge
  }
}
struct BuboRhythmWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "BuboRhythm", provider: BuboProvider()) { BuboWidgetView(entry: $0, kind: "rhythm") }
      .configurationDisplayName("Sequência da semana").description("Dias com leitura ou revisão nesta semana.")
      .supportedFamilies([.systemSmall, .systemMedium])
      .contentMarginsDisabled() // full bleed: Bubo peeks from the very edge
  }
}
struct BuboCalendarWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "BuboCalendar", provider: BuboProvider()) { BuboWidgetView(entry: $0, kind: "calendar") }
      .configurationDisplayName("Calendário de leitura").description("Seu mês de leituras e revisões.")
      .supportedFamilies([.systemMedium])
      .contentMarginsDisabled() // full bleed: Bubo peeks from the very edge
  }
}
struct BuboReadingWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "BuboReading", provider: BuboProvider()) { BuboWidgetView(entry: $0, kind: "reading") }
      .configurationDisplayName("Continuar leitura").description("Seu livro, sua página e o Bubo por perto.")
      .supportedFamilies([.systemSmall, .systemMedium])
      .contentMarginsDisabled() // full bleed: Bubo peeks from the very edge
  }
}
@main struct BuboWidgetsBundle: WidgetBundle {
  var body: some Widget { BuboStreakWidget(); BuboRhythmWidget(); BuboCalendarWidget(); BuboReadingWidget() }
}
