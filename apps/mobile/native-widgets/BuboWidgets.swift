import SwiftUI
import WidgetKit
import UIKit

// Bubo widgets for iOS (ADR-029): the same compositions as the Android canvas widgets, drawn with
// SwiftUI, Plus Jakarta Sans (UIAppFonts) and tokens generated from src/theme/colors.ts.

struct BuboBook: Decodable {
  let title: String
  let author: String?
  let page: Int
  let totalPages: Int?
  let progress: Int?
  let coverPalette: Int
  let url: String
  let sessionUrl: String
}

struct BuboWeekDay: Decodable {
  let label: String
  let letter: String
  let date: String
  let active: Bool
  let frozen: Bool
  let state: String
}

struct BuboMonthDay: Decodable {
  let day: Int
  let active: Bool
  let frozen: Bool
  let today: Bool
  let future: Bool
  let run: String
}

struct BuboMonth: Decodable {
  let title: String
  let offset: Int
  let days: [BuboMonthDay]
}

struct BuboMoodData: Decodable {
  let fromHour: Int
  let pose: String
  let message: String
  let lit: Bool
  let alert: Bool
  let tone: String
}

struct BuboFreeze: Decodable {
  let available: Int
  let max: Int
  let frozenYesterday: Bool
}

struct BuboPodiumSpot: Decodable {
  let rank: Int
  let initials: String
  let xp: Int
  let me: Bool
}

struct BuboLeague: Decodable {
  let rank: Int
  let previousRank: Int?
  let participants: Int
  let weeklyXp: Int
  let daysLeft: Int
  let podium: [BuboPodiumSpot]
}

struct BuboSnapshot: Decodable {
  let version: Int
  let today: String
  let expiresAt: Double
  let hideBookOnLockScreen: Bool
  let streakDays: Int
  let activeToday: Bool
  let freeze: BuboFreeze
  let week: [BuboWeekDay]
  let month: BuboMonth
  let moods: [BuboMoodData]
  let availableReviews: Int
  let book: BuboBook?
  let league: BuboLeague?
}

enum BuboStorage {
  static var group: String {
    Bundle.main.object(forInfoDictionaryKey: "BuboAppGroup") as? String ?? "group.com.joaoaraujo.bubo.widgets"
  }
  static func snapshot() -> BuboSnapshot? {
    guard let value = UserDefaults(suiteName: group)?.string(forKey: "snapshot"),
          let data = value.data(using: .utf8),
          let snapshot = try? JSONDecoder().decode(BuboSnapshot.self, from: data),
          snapshot.version == 3 else { return nil }
    return snapshot
  }
  static func cover() -> UIImage? {
    guard let directory = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else { return nil }
    return UIImage(contentsOfFile: directory.appendingPathComponent("cover").path)
  }
}

/// What the widget shows now. `title` replaces the streak when there is no fresh data.
struct BuboMood {
  let pose: String
  let message: String
  let lit: Bool
  let alert: Bool
  let tone: String
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
      return BuboMood(pose: "welcome", message: "Entre para ver sua sequência", lit: false, alert: false, tone: "welcome", title: "Olá!")
    }
    if !fresh {
      return hour >= 22 || hour < 6
        ? BuboMood(pose: "sleeping", message: "Até amanhã!", lit: false, alert: false, tone: "night", title: "Zzz…")
        : BuboMood(pose: "doubt", message: "Para atualizar sua sequência", lit: false, alert: false, tone: "stale", title: "Abra o Bubo")
    }
    let current = snapshot.moods.reduce(snapshot.moods.first) { picked, mood in mood.fromHour <= hour ? mood : picked }
    guard let mood = current else { return BuboMood(pose: "happy", message: "", lit: false, alert: false, tone: "calm") }
    return BuboMood(pose: mood.pose, message: mood.message, lit: mood.lit, alert: mood.alert, tone: mood.tone)
  }
  var streak: Int { fresh ? snapshot?.streakDays ?? 0 : 0 }
  var days: String { streak == 1 ? "1 dia" : "\(streak) dias" }
  var book: BuboBook? { fresh ? snapshot?.book : nil }
  var league: BuboLeague? { fresh ? snapshot?.league : nil }
  var freezes: Int { fresh ? snapshot?.freeze.available ?? 0 : 0 }
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
    // Mood changes and expiry, without a JS timer or an authenticated background request.
    // Hours match WIDGET_MOOD_HOURS in @bubo/domain.
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

/// Generated geometry (opcodes 0 M, 1 L, 2 Q, 3 C, 4 Z) in a 24 × 24 box, scaled to the frame.
struct OpsShape: Shape {
  let ops: [Double]
  func path(in rect: CGRect) -> Path {
    let scale = min(rect.width, rect.height) / 24
    let dx = rect.minX + (rect.width - 24 * scale) / 2
    let dy = rect.minY + (rect.height - 24 * scale) / 2
    let point = { (x: Double, y: Double) in CGPoint(x: dx + x * scale, y: dy + y * scale) }
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
    let radius = rect.height / 2
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

func buboFont(_ weight: String, _ size: CGFloat) -> Font { .custom("PlusJakartaSans-\(weight)", size: size) }

func buboPoseLabel(_ pose: String) -> String {
  [
    "welcome": "Bubo dando boas-vindas", "happy": "Bubo feliz", "reading": "Bubo lendo",
    "review": "Bubo revisando", "celebrating": "Bubo comemorando", "achievement": "Bubo com uma conquista",
    "cheering": "Bubo animando", "worried": "Bubo preocupado", "surprised": "Bubo surpreso",
    "sleeping": "Bubo dormindo", "doubt": "Bubo com dúvida", "curious": "Bubo curioso",
    "confident": "Bubo confiante", "thinking": "Bubo pensando", "deep-reading": "Bubo em leitura profunda",
  ][pose] ?? "Bubo"
}

struct FlameView: View {
  let lit: Bool
  let alert: Bool
  let size: CGFloat
  var body: some View {
    ZStack(alignment: .bottomTrailing) {
      if lit {
        ZStack {
          OpsShape(ops: BuboTokens.flameOuter).fill(BuboTokens.flame)
          OpsShape(ops: BuboTokens.flameInner).fill(BuboTokens.flameGlow)
        }
      } else {
        ZStack {
          OpsShape(ops: BuboTokens.flameOuter).fill(BuboTokens.flame.opacity(0.18))
          OpsShape(ops: BuboTokens.flameOuter).stroke(BuboTokens.flame, lineWidth: size * 0.075)
        }
      }
      if alert {
        ZStack {
          Circle().fill(BuboTokens.white).frame(width: size * 0.56, height: size * 0.56)
          Circle().fill(BuboTokens.alert).frame(width: size * 0.48, height: size * 0.48)
          OpsShape(ops: BuboTokens.alertMark).fill(BuboTokens.white).frame(width: size * 0.48, height: size * 0.48)
        }
        .offset(x: size * 0.12, y: size * 0.04)
      }
    }
    .frame(width: size, height: size)
    .accessibilityHidden(true)
  }
}

/// An official pose entering from the corner: the widget edge clips it; the image is never edited.
struct CornerMascot: View {
  let pose: String
  let size: CGFloat
  /// Fraction of the image beyond the right and bottom edges.
  var right: CGFloat = 0.1
  var bottom: CGFloat = 0.2
  var body: some View {
    Image("bubo-\(pose)").renderingMode(.original).resizable().scaledToFit()
      .frame(width: size, height: size)
      .offset(x: size * right, y: size * bottom)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
      .accessibilityLabel(buboPoseLabel(pose))
  }
}

struct FreezeChip: View {
  let count: Int
  var body: some View {
    HStack(spacing: 3) {
      OpsShape(ops: BuboTokens.snowflake).stroke(BuboTokens.freeze, style: StrokeStyle(lineWidth: 1.4, lineCap: .round, lineJoin: .round))
        .frame(width: 13, height: 13)
      Text("\(count)").font(buboFont("Bold", 12)).foregroundStyle(BuboTokens.freezeText)
    }
    .padding(.horizontal, 7).frame(height: 22)
    .background(BuboTokens.freezeSoft, in: Capsule())
    .accessibilityLabel(count == 1 ? "1 proteção pronta" : "\(count) proteções prontas")
  }
}

struct DayCircle: View {
  let day: BuboWeekDay?
  let size: CGFloat
  var body: some View {
    let state = day?.state ?? "future"
    let done = state == "done" || (state == "today" && day?.active == true)
    ZStack {
      if done {
        Circle().fill(BuboTokens.flame)
        OpsShape(ops: BuboTokens.check).stroke(BuboTokens.white, style: StrokeStyle(lineWidth: size * 0.1, lineCap: .round, lineJoin: .round))
          .frame(width: size * 0.86, height: size * 0.86)
      } else if state == "frozen" {
        Circle().fill(BuboTokens.freezeSoft)
        OpsShape(ops: BuboTokens.snowflake).stroke(BuboTokens.freeze, style: StrokeStyle(lineWidth: size * 0.07, lineCap: .round, lineJoin: .round))
          .frame(width: size * 0.62, height: size * 0.62)
      } else if state == "today" {
        Circle().fill(BuboTokens.empty).overlay(Circle().inset(by: size * 0.045).stroke(BuboTokens.flame, lineWidth: size * 0.09))
      } else {
        Circle().fill(BuboTokens.empty).opacity(state == "future" ? 0.6 : 1)
      }
    }
    .frame(width: size, height: size)
  }
}

struct CoverView: View {
  let book: BuboBook
  let width: CGFloat
  let height: CGFloat
  var body: some View {
    let index = Swift.max(0, Swift.min(book.coverPalette, BuboTokens.coverFace.count - 1))
    ZStack(alignment: .topLeading) {
      if let image = BuboStorage.cover(), image.size.width >= 20, image.size.height >= 20 {
        Image(uiImage: image).resizable().scaledToFill().frame(width: width, height: height).clipped()
      } else {
        BuboTokens.coverFace[index]
        BuboTokens.coverSpine[index].frame(width: width * 0.08)
        VStack(alignment: .leading, spacing: 3) {
          Text(book.title).font(buboFont("ExtraBold", Swift.max(7, width / 6.2))).foregroundStyle(BuboTokens.coverText[index]).lineLimit(4)
          BuboTokens.coverAccent[index].frame(width: width / 5, height: 2).clipShape(Capsule())
        }
        .padding(width * 0.16)
      }
    }
    .frame(width: width, height: height)
    .clipShape(RoundedRectangle(cornerRadius: 6))
    .shadow(color: BuboTokens.shadow.opacity(0.18), radius: 3, x: 0, y: 2)
    .accessibilityLabel("Capa de \(book.title)")
  }
}

// MARK: - Views

struct BuboWidgetView: View {
  let entry: BuboEntry
  let kind: String
  @Environment(\.widgetFamily) private var family

  private var mood: BuboMood { entry.mood }
  private var homeURL: URL { URL(string: "bubo:///")! }
  private var tapURL: URL {
    guard entry.snapshot != nil else { return homeURL }
    switch kind {
    case "reading": return entry.book.flatMap { URL(string: $0.sessionUrl) } ?? URL(string: "bubo:///estante")!
    case "league": return URL(string: "bubo:///liga")!
    default: return homeURL
    }
  }
  private var captionColor: Color { mood.tone == "risk" ? BuboTokens.flameText : BuboTokens.muted }
  private var streakTitle: String {
    if !entry.fresh { return mood.title ?? "Abra o Bubo" }
    if entry.streak == 1 { return "1 dia seguido" }
    if entry.streak > 1 { return "\(entry.streak) dias seguidos" }
    return "Comece sua sequência"
  }
  private func pages(_ book: BuboBook) -> String {
    book.totalPages.map { "Página \(book.page) de \($0)" } ?? "Página \(book.page)"
  }

  /// Compact (small): flame + number, a short label and Bubo in the corner.
  private var streakView: some View {
    GeometryReader { geo in
      let side = Swift.min(geo.size.width, geo.size.height)
      ZStack(alignment: .topLeading) {
        CornerMascot(pose: mood.pose, size: side * 0.86, right: 0.2, bottom: 0.34)
        VStack(alignment: .leading, spacing: 2) {
          HStack(spacing: 5) {
            FlameView(lit: mood.lit, alert: mood.alert, size: 28)
            Text(entry.fresh ? "\(entry.streak)" : mood.title ?? "Abra o Bubo")
              .font(buboFont("ExtraBold", entry.fresh ? 32 : 18))
              .foregroundStyle(entry.fresh && entry.streak > 0 ? BuboTokens.flameText : BuboTokens.ink)
              .lineLimit(1).minimumScaleFactor(0.6)
            Spacer(minLength: 0)
            if entry.freezes > 0 { FreezeChip(count: entry.freezes) }
          }
          Text(!entry.fresh || mood.tone == "risk" ? mood.message : entry.streak == 1 ? "dia seguido" : entry.streak > 1 ? "dias seguidos" : "Que tal começar hoje?")
            .font(buboFont("SemiBold", 12.5)).foregroundStyle(captionColor).lineLimit(2)
            .frame(width: geo.size.width * 0.62, alignment: .leading)
        }
        .padding(14)
      }
      .accessibilityElement(children: .combine)
    }
  }

  /// Day Streak (medium): "12 dias seguidos", a caption and the week; Bubo on the right.
  private var weekView: some View {
    GeometryReader { geo in
      let size = Swift.min(geo.size.height * 0.86, geo.size.width * 0.38)
      let contentWidth = geo.size.width - size * 0.84 - 16
      let circle = Swift.min(contentWidth / 7 * 0.8, geo.size.height * 0.2, 34)
      ZStack(alignment: .topLeading) {
        CornerMascot(pose: mood.pose, size: size, right: 0.1, bottom: 0.2)
        if entry.freezes > 0 {
          FreezeChip(count: entry.freezes).frame(maxWidth: .infinity, alignment: .trailing).padding(14)
        }
        VStack(alignment: .leading, spacing: 0) {
          Spacer(minLength: 0)
          HStack(spacing: 7) {
            FlameView(lit: mood.lit, alert: mood.alert, size: 27)
            Text(streakTitle).font(buboFont("ExtraBold", 23))
              .foregroundStyle(entry.fresh && entry.streak > 0 ? BuboTokens.flameText : BuboTokens.ink)
              .lineLimit(1).minimumScaleFactor(0.55)
          }
          Text(mood.message).font(buboFont("SemiBold", 13.5)).foregroundStyle(captionColor).lineLimit(2)
            .padding(.leading, 34).frame(width: contentWidth, alignment: .leading)
          if entry.fresh {
            HStack(spacing: 0) {
              ForEach(0..<7, id: \.self) { index in
                let day = entry.snapshot?.week[safe: index]
                VStack(spacing: 5) {
                  Text(day?.letter ?? ["S", "T", "Q", "Q", "S", "S", "D"][index]).font(buboFont("Bold", 11))
                    .foregroundStyle(day?.state == "today" ? BuboTokens.ink : BuboTokens.faint)
                  DayCircle(day: day, size: circle)
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(day?.label ?? "Dia"): \(day?.active == true ? "com atividade" : day?.frozen == true ? "protegido" : "sem atividade")")
              }
            }
            .frame(width: contentWidth)
            .padding(.top, 14)
          }
          Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .frame(height: geo.size.height)
      }
    }
  }

  /// Calendar (medium): the month on the left; flame, streak and Bubo on the right.
  private var calendarView: some View {
    GeometryReader { geo in
      let size = Swift.min(geo.size.height * 0.66, geo.size.width * 0.36)
      ZStack {
        CornerMascot(pose: mood.pose, size: size, right: 0.14, bottom: 0.28)
        HStack(spacing: 0) {
          monthGrid.padding(.leading, 12).padding(.vertical, 12).frame(width: geo.size.width * 0.6)
          BuboTokens.divider.frame(width: 1).padding(.vertical, 16)
          VStack(spacing: 1) {
            if entry.fresh {
              HStack(spacing: 3) {
                FlameView(lit: mood.lit, alert: mood.alert, size: 26)
                Text("\(entry.streak)").font(buboFont("ExtraBold", 36)).foregroundStyle(BuboTokens.flameText)
                  .lineLimit(1).minimumScaleFactor(0.6)
              }
              Text(entry.streak == 1 ? "dia seguido" : "dias seguidos").font(buboFont("SemiBold", 12.5)).foregroundStyle(BuboTokens.ink)
              if entry.freezes > 0 {
                HStack(spacing: 3) {
                  OpsShape(ops: BuboTokens.snowflake).stroke(BuboTokens.freeze, style: StrokeStyle(lineWidth: 1.2, lineCap: .round))
                    .frame(width: 11, height: 11)
                  Text(entry.freezes == 1 ? "1 proteção" : "\(entry.freezes) proteções").font(buboFont("Bold", 10.5)).foregroundStyle(BuboTokens.freezeText)
                }
              }
            } else {
              Text(mood.title ?? "Abra o Bubo").font(buboFont("ExtraBold", 15)).foregroundStyle(BuboTokens.ink).multilineTextAlignment(.center)
              Text(mood.message).font(buboFont("SemiBold", 11)).foregroundStyle(BuboTokens.muted).multilineTextAlignment(.center).lineLimit(2)
            }
            Spacer(minLength: 0)
          }
          .padding(.top, 12).padding(.horizontal, 6)
          .frame(maxWidth: .infinity)
        }
      }
      .accessibilityElement(children: .combine)
    }
  }

  private var monthGrid: some View {
    let month = entry.snapshot?.month
    let offset = month?.offset ?? 0
    let days = month?.days ?? []
    let rows = Swift.max(5, (offset + days.count + 6) / 7)
    return VStack(alignment: .leading, spacing: 0) {
      Text(month?.title ?? "").font(buboFont("ExtraBold", 15)).foregroundStyle(BuboTokens.ink).lineLimit(1).minimumScaleFactor(0.7)
      HStack(spacing: 0) {
        ForEach(0..<7, id: \.self) { index in
          Text(["S", "T", "Q", "Q", "S", "S", "D"][index]).font(buboFont("Bold", 9))
            .foregroundStyle(BuboTokens.faint).frame(maxWidth: .infinity)
        }
      }
      .padding(.top, 4).padding(.bottom, 2)
      ForEach(0..<rows, id: \.self) { row in
        HStack(spacing: 0) {
          ForEach(0..<7, id: \.self) { column in
            dayCell(days[safe: row * 7 + column - offset], label: month?.title ?? "")
          }
        }
        .frame(maxHeight: .infinity)
      }
    }
  }

  @ViewBuilder private func dayCell(_ day: BuboMonthDay?, label: String) -> some View {
    if let day = day {
      let active = entry.fresh && day.active
      let frozen = entry.fresh && day.frozen
      let today = entry.fresh && day.today
      ZStack {
        if active {
          RunShape(leading: day.run == "start" || day.run == "single", trailing: day.run == "end" || day.run == "single")
            .fill(BuboTokens.streakSoft).padding(.vertical, 1)
            .padding(.leading, day.run == "start" || day.run == "single" ? 2 : 0)
            .padding(.trailing, day.run == "end" || day.run == "single" ? 2 : 0)
        }
        if frozen {
          RoundedRectangle(cornerRadius: 5).fill(BuboTokens.freezeSoft).padding(.vertical, 1).padding(.horizontal, 2)
        }
        if today {
          if active { Circle().fill(BuboTokens.flame).frame(width: 18, height: 18) }
          else { Circle().stroke(BuboTokens.flame, lineWidth: 1.4).frame(width: 18, height: 18) }
        }
        Text("\(day.day)").font(buboFont(active || frozen || today ? "Bold" : "Medium", 9.5))
          .foregroundStyle(active && today ? BuboTokens.white : active ? BuboTokens.streakText : frozen ? BuboTokens.freezeText : day.future ? BuboTokens.faint : BuboTokens.ink)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .accessibilityLabel("\(day.day) de \(label)\(active ? ", com atividade" : frozen ? ", protegido" : "")")
    } else {
      Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }

  private func action(_ label: String) -> some View {
    HStack(spacing: 2) {
      Text(label).font(buboFont("Bold", 12.5))
      OpsShape(ops: BuboTokens.chevron).stroke(BuboTokens.purple, style: StrokeStyle(lineWidth: 1.8, lineCap: .round, lineJoin: .round))
        .frame(width: 14, height: 14)
    }
    .foregroundStyle(BuboTokens.purple)
  }

  /// Continue reading (medium): no inner card; cover, title, author, page, progress, quiet action.
  private var readingView: some View {
    GeometryReader { geo in
      let size = Swift.min(geo.size.height * 0.8, geo.size.width * 0.34)
      let pose = !entry.fresh ? mood.pose : entry.book == nil ? "deep-reading" : mood.lit ? "celebrating" : "reading"
      let coverH = Swift.min(geo.size.height - 60, geo.size.height * 0.6)
      ZStack(alignment: .topLeading) {
        CornerMascot(pose: pose, size: size, right: 0.2, bottom: 0.26)
        VStack(alignment: .leading, spacing: 10) {
          HStack(spacing: 4) {
            if entry.fresh {
              FlameView(lit: mood.lit, alert: mood.alert, size: 16)
              Text("\(entry.streak)").font(buboFont("ExtraBold", 13)).foregroundStyle(entry.streak > 0 ? BuboTokens.flameText : BuboTokens.muted)
              Spacer().frame(width: 6)
              Text(mood.message).font(buboFont("Medium", 12)).foregroundStyle(captionColor).lineLimit(1)
            }
          }
          Spacer(minLength: 0)
          if let book = entry.book {
            HStack(alignment: .center, spacing: 12) {
              CoverView(book: book, width: coverH * 0.68, height: coverH)
              VStack(alignment: .leading, spacing: 1) {
                Text(book.title).font(buboFont("ExtraBold", 15.5)).foregroundStyle(BuboTokens.ink).lineLimit(2).privacySensitive()
                if let author = book.author {
                  Text(author).font(buboFont("Medium", 12)).foregroundStyle(BuboTokens.muted).lineLimit(1)
                }
                Text(pages(book)).font(buboFont("SemiBold", 11.5)).foregroundStyle(BuboTokens.ink).padding(.top, 5)
                if let progress = book.progress {
                  ZStack(alignment: .leading) {
                    Capsule().fill(BuboTokens.empty)
                    GeometryReader { bar in
                      Capsule().fill(BuboTokens.purple).frame(width: Swift.max(6, bar.size.width * CGFloat(progress) / 100))
                    }
                  }
                  .frame(maxWidth: 150).frame(height: 6).padding(.top, 4)
                  .accessibilityLabel("\(progress) por cento lido")
                }
                action("Continuar leitura").padding(.top, 9)
              }
              .padding(.trailing, size * 0.55)
            }
          } else {
            VStack(alignment: .leading, spacing: 3) {
              Text(entry.fresh ? "Nenhuma leitura ativa" : mood.title ?? "Abra o Bubo").font(buboFont("ExtraBold", 15.5)).foregroundStyle(BuboTokens.ink)
              Text(entry.fresh ? "Escolha um livro na Estante para continuar daqui." : mood.message)
                .font(buboFont("Medium", 12)).foregroundStyle(BuboTokens.muted).lineLimit(2)
              action(entry.fresh ? "Abrir Estante" : "Abrir o Bubo").padding(.top, 8)
            }
            .padding(.trailing, size * 0.6)
          }
          Spacer(minLength: 0)
        }
        .padding(15)
      }
    }
  }

  /// League (medium): rank, today's movement, the week and a small podium around the reader.
  private var leagueView: some View {
    GeometryReader { geo in
      let league = entry.league
      let friends = (league?.participants ?? 0) > 1
      ZStack {
        if !friends {
          CornerMascot(pose: !entry.fresh ? mood.pose : league == nil ? "doubt" : "cheering", size: geo.size.height * 0.86, right: 0.12, bottom: 0.3)
        }
        HStack(spacing: 0) {
          VStack(alignment: .leading, spacing: 7) {
            Spacer(minLength: 0)
            HStack(spacing: 8) {
              ZStack {
                OpsShape(ops: BuboTokens.badge).fill(BuboTokens.purple)
                OpsShape(ops: BuboTokens.badgeInner).fill(BuboTokens.purpleLight)
                OpsShape(ops: BuboTokens.gemCut).fill(BuboTokens.gem)
                OpsShape(ops: BuboTokens.gemShine).fill(BuboTokens.white)
              }
              .frame(width: 34, height: 34).accessibilityHidden(true)
              Text(leagueTitle(league, friends: friends)).font(buboFont("ExtraBold", 21)).foregroundStyle(BuboTokens.purple)
                .lineLimit(1).minimumScaleFactor(0.55)
            }
            if let league = league {
              if friends { movementLine(league) }
              line(icon: AnyView(trophy), text: friends ? "Liga semanal" : "\(league.weeklyXp) XP nesta semana", color: BuboTokens.purple)
              line(icon: AnyView(OpsShape(ops: BuboTokens.clock).stroke(BuboTokens.time, style: StrokeStyle(lineWidth: 1.8, lineCap: .round))),
                   text: league.daysLeft == 1 ? "Último dia" : "\(league.daysLeft) dias restantes", color: BuboTokens.time)
              if !friends {
                Text("Adicione amigos nos clubes").font(buboFont("Medium", 12)).foregroundStyle(BuboTokens.muted)
              }
            } else {
              Text(entry.fresh ? "Abra o Bubo para atualizar" : mood.message).font(buboFont("SemiBold", 13)).foregroundStyle(BuboTokens.muted).lineLimit(2)
            }
            Spacer(minLength: 0)
          }
          .padding(.leading, 16)
          .frame(width: geo.size.width * (friends ? 0.53 : 0.66), alignment: .leading)
          if let league = league, friends {
            podium(league, height: geo.size.height)
          }
        }
      }
      .accessibilityElement(children: .combine)
    }
  }

  private func leagueTitle(_ league: BuboLeague?, friends: Bool) -> String {
    if !entry.fresh { return mood.title ?? "Abra o Bubo" }
    guard let league = league else { return "Liga semanal" }
    return friends ? "#\(league.rank) entre amigos" : "Sua liga semanal"
  }

  private var trophy: some View {
    ZStack {
      OpsShape(ops: BuboTokens.trophy).fill(BuboTokens.purple)
      OpsShape(ops: BuboTokens.trophyHandles).stroke(BuboTokens.purple, lineWidth: 1.6)
    }
  }

  private func line(icon: AnyView, text: String, color: Color, weight: String = "Bold") -> some View {
    HStack(spacing: 8) {
      icon.frame(width: 16, height: 16)
      Text(text).font(buboFont(weight, 13.5)).foregroundStyle(color).lineLimit(1).minimumScaleFactor(0.8)
    }
  }

  @ViewBuilder private func movementLine(_ league: BuboLeague) -> some View {
    if let previous = league.previousRank, previous != league.rank {
      let delta = previous - league.rank
      if delta > 0 {
        line(icon: AnyView(OpsShape(ops: BuboTokens.arrowUp).fill(BuboTokens.up)), text: "+\(delta) \(delta == 1 ? "posição" : "posições") hoje", color: BuboTokens.up)
      } else {
        line(icon: AnyView(OpsShape(ops: BuboTokens.arrowDown).fill(BuboTokens.faint)), text: "Caiu \(-delta) \(delta == -1 ? "posição" : "posições")", color: BuboTokens.muted, weight: "SemiBold")
      }
    } else {
      line(icon: AnyView(OpsShape(ops: BuboTokens.equal).fill(BuboTokens.faint)), text: league.previousRank == nil ? "Semana começando" : "Mesma posição", color: BuboTokens.muted, weight: "SemiBold")
    }
  }

  private func podium(_ league: BuboLeague, height: CGFloat) -> some View {
    let steps: [CGFloat] = [0.16, 0.24, 0.32]
    let empty = 3 - league.podium.count
    return HStack(alignment: .bottom, spacing: 4) {
      ForEach(0..<3, id: \.self) { column in
        VStack(spacing: 4) {
          if column >= empty, let spot = league.podium[safe: column - empty] {
            if spot.me {
              HStack(alignment: .lastTextBaseline, spacing: 1) {
                Text("\(spot.xp)").font(buboFont("ExtraBold", 17))
                Text("XP").font(buboFont("ExtraBold", 9))
              }
              .foregroundStyle(BuboTokens.purple).lineLimit(1).minimumScaleFactor(0.6)
            } else {
              Text("\(spot.xp)").font(buboFont("Bold", 13)).foregroundStyle(BuboTokens.muted).lineLimit(1).minimumScaleFactor(0.6)
            }
            Text(spot.initials).font(buboFont("ExtraBold", 14)).foregroundStyle(BuboTokens.purpleInk)
              .frame(width: spot.me ? 44 : 40, height: spot.me ? 44 : 40)
              .background(BuboTokens.avatar, in: Circle())
              .overlay(Circle().stroke(spot.me ? BuboTokens.purple : BuboTokens.podium, lineWidth: spot.me ? 2.6 : 1.2))
              .accessibilityLabel("\(spot.rank)º lugar\(spot.me ? ", você" : ""), \(spot.xp) XP")
          }
          ZStack(alignment: .top) {
            UnevenTop().fill(BuboTokens.podium)
            BuboTokens.podiumTop.frame(height: 5).clipShape(UnevenTop())
          }
          .frame(height: height * steps[column])
        }
        .frame(maxWidth: .infinity)
      }
    }
    .padding(.trailing, 6)
    .frame(maxHeight: .infinity, alignment: .bottom)
  }

  @ViewBuilder private var lockView: some View {
    if family == .accessoryCircular {
      ZStack {
        AccessoryWidgetBackground()
        VStack(spacing: 0) {
          OpsShape(ops: BuboTokens.flameOuter + BuboTokens.flameInner).fill(style: FillStyle(eoFill: !mood.lit)).frame(width: 16, height: 16)
          Text(entry.fresh ? "\(entry.streak)" : "–").font(buboFont("ExtraBold", 18)).minimumScaleFactor(0.6)
        }
      }
      .accessibilityLabel(entry.fresh ? "Sequência de \(entry.days)" : "Abra o Bubo para atualizar")
    } else if family == .accessoryInline {
      Label(entry.fresh ? "\(entry.days) seguidos" : "Bubo · abra para atualizar", systemImage: "flame.fill")
    } else {
      HStack(spacing: 6) {
        OpsShape(ops: BuboTokens.flameOuter + BuboTokens.flameInner).fill(style: FillStyle(eoFill: !mood.lit)).frame(width: 26, height: 26)
        VStack(alignment: .leading, spacing: 0) {
          Text(entry.fresh ? "\(entry.days) seguidos" : "Bubo").font(buboFont("ExtraBold", 15)).lineLimit(1)
          Text(mood.message).font(buboFont("Bold", 12)).lineLimit(1)
          if let book = entry.book {
            // Lock screen privacy (on by default): the page instead of the title.
            if entry.snapshot?.hideBookOnLockScreen == false {
              Text(book.title).font(buboFont("Regular", 11)).lineLimit(1).privacySensitive()
            } else { Text(pages(book)).font(buboFont("Regular", 11)).lineLimit(1) }
          } else if entry.freezes > 0 {
            Text(entry.freezes == 1 ? "1 proteção pronta" : "\(entry.freezes) proteções prontas").font(buboFont("Regular", 11)).lineLimit(1)
          }
        }
      }
    }
  }

  /// Compact reading (small): cover, title and page.
  private var readingCompact: some View {
    VStack(alignment: .leading, spacing: 2) {
      if let book = entry.book {
        HStack(alignment: .top, spacing: 10) {
          CoverView(book: book, width: 46, height: 68)
          if entry.fresh {
            HStack(spacing: 3) {
              FlameView(lit: mood.lit, alert: mood.alert, size: 15)
              Text("\(entry.streak)").font(buboFont("ExtraBold", 13)).foregroundStyle(entry.streak > 0 ? BuboTokens.flameText : BuboTokens.muted)
            }
          }
        }
        Spacer(minLength: 4)
        Text(book.title).font(buboFont("ExtraBold", 13)).foregroundStyle(BuboTokens.ink).lineLimit(1).privacySensitive()
        Text(book.totalPages.map { "Pág. \(book.page) de \($0)" } ?? "Página \(book.page)").font(buboFont("SemiBold", 11)).foregroundStyle(BuboTokens.muted)
      } else {
        Text(entry.fresh ? "Nenhuma leitura ativa" : mood.title ?? "Abra o Bubo").font(buboFont("ExtraBold", 14)).foregroundStyle(BuboTokens.ink)
        Text(entry.fresh ? "Escolha um livro na Estante" : mood.message).font(buboFont("Medium", 11.5)).foregroundStyle(BuboTokens.muted).lineLimit(3)
      }
    }
    .padding(12)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  private var lock: Bool { family == .accessoryCircular || family == .accessoryRectangular || family == .accessoryInline }

  @ViewBuilder private var homeView: some View {
    switch (kind, family) {
    case ("rhythm", .systemMedium), ("rhythm", .systemLarge): weekView
    case ("calendar", .systemMedium), ("calendar", .systemLarge): calendarView
    case ("reading", .systemMedium), ("reading", .systemLarge): readingView
    case ("reading", _): readingCompact
    case ("league", .systemMedium), ("league", .systemLarge): leagueView
    default: streakView
    }
  }

  var body: some View {
    Group { if lock { lockView } else { homeView } }
      .widgetURL(tapURL)
      .modifier(BuboBackground(league: kind == "league", lock: lock))
  }
}

/// Podium step: rounded top corners only.
struct UnevenTop: Shape {
  func path(in rect: CGRect) -> Path {
    let r = Swift.min(9, rect.height / 2)
    var path = Path()
    path.move(to: CGPoint(x: rect.minX, y: rect.maxY))
    path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + r))
    path.addArc(center: CGPoint(x: rect.minX + r, y: rect.minY + r), radius: r, startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false)
    path.addLine(to: CGPoint(x: rect.maxX - r, y: rect.minY))
    path.addArc(center: CGPoint(x: rect.maxX - r, y: rect.minY + r), radius: r, startAngle: .degrees(270), endAngle: .degrees(0), clockwise: false)
    path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
    path.closeSubpath()
    return path
  }
}

struct BuboSurface: View {
  let league: Bool
  var body: some View {
    LinearGradient(colors: league ? [BuboTokens.leagueTop, BuboTokens.leagueBottom] : [BuboTokens.surface, BuboTokens.surfaceEnd], startPoint: .top, endPoint: .bottom)
  }
}

struct BuboBackground: ViewModifier {
  let league: Bool
  let lock: Bool
  @ViewBuilder func body(content: Content) -> some View {
    if #available(iOS 17.0, *) {
      content.containerBackground(for: .widget) {
        if lock { Color.clear } else { BuboSurface(league: league) }
      }
    } else if lock {
      content
    } else {
      content.background(BuboSurface(league: league))
    }
  }
}

extension Array {
  subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}

struct BuboStreakWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "BuboStreak", provider: BuboProvider()) { BuboWidgetView(entry: $0, kind: "streak") }
      .configurationDisplayName("Sequência").description("Seus dias seguidos com o Bubo, também na tela bloqueada.")
      .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
      .contentMarginsDisabled() // full bleed: Bubo enters from the very edge
  }
}
struct BuboRhythmWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "BuboRhythm", provider: BuboProvider()) { BuboWidgetView(entry: $0, kind: "rhythm") }
      .configurationDisplayName("Sequência da semana").description("Dias seguidos e os checks da semana.")
      .supportedFamilies([.systemSmall, .systemMedium])
      .contentMarginsDisabled()
  }
}
struct BuboCalendarWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "BuboCalendar", provider: BuboProvider()) { BuboWidgetView(entry: $0, kind: "calendar") }
      .configurationDisplayName("Calendário de leitura").description("O mês de leitura, a sequência e as proteções.")
      .supportedFamilies([.systemMedium])
      .contentMarginsDisabled()
  }
}
struct BuboReadingWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "BuboReading", provider: BuboProvider()) { BuboWidgetView(entry: $0, kind: "reading") }
      .configurationDisplayName("Continuar leitura").description("Seu livro, sua página e um toque para continuar.")
      .supportedFamilies([.systemSmall, .systemMedium])
      .contentMarginsDisabled()
  }
}
struct BuboLeagueWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "BuboLeague", provider: BuboProvider()) { BuboWidgetView(entry: $0, kind: "league") }
      .configurationDisplayName("Liga semanal").description("Sua posição na liga semanal dos amigos.")
      .supportedFamilies([.systemMedium])
      .contentMarginsDisabled()
  }
}
@main struct BuboWidgetsBundle: WidgetBundle {
  var body: some Widget {
    BuboStreakWidget(); BuboRhythmWidget(); BuboCalendarWidget(); BuboReadingWidget(); BuboLeagueWidget()
  }
}
