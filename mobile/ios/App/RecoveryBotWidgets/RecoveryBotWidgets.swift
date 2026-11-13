import AppIntents
import SwiftUI
import UIKit
import WidgetKit

// RecoveryBot's Home Screen and Lock Screen widgets:
// - Day count: how many days since their sobriety date, and the next milestone. Counted here on
//   the phone, so it turns over at midnight without the app being opened. It says only the
//   number ("127 days"), never what the days are of, so it's discreet on a Lock Screen.
// - Favorite chip: their first favorite chip (else their newest sobriety chip), drawn by the site.
// The app (WidgetBridgePlugin in AppDelegate.swift) keeps what they show in the App Group both
// share; signing out of the app clears it. Tapping either opens the Chips page, except the chip
// itself, which turns over (FlipChipIntent) to show its back.

enum Shared {
    static let group = "group.com.hmblbot.recoverybot"
    static var defaults: UserDefaults? { UserDefaults(suiteName: group) }
    static var signedIn: Bool { defaults?.bool(forKey: "signedIn") ?? false }
    static var soberSince: String { defaults?.string(forKey: "soberSince") ?? "" }
    static var chipLabel: String { defaults?.string(forKey: "chipLabel") ?? "" }

    static func chipImage() -> UIImage? {
        guard defaults?.bool(forKey: "hasChip") == true,
              let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?.appendingPathComponent("chip.png")
        else { return nil }
        return UIImage(contentsOfFile: url.path)
    }

    // The back, drawn by the site beside the front (lib/appWidgets.js); older app builds have none
    static func chipBackImage() -> UIImage? {
        guard let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?.appendingPathComponent("chip-back.png")
        else { return nil }
        return UIImage(contentsOfFile: url.path)
    }

    static var chipFlipped: Bool { defaults?.bool(forKey: "chipFlipped") ?? false }

    static let chipsPage = URL(string: "recoverybot://open/recovery")!
}

// MARK: - Counting

struct DayCount {
    let days: Int
    let today: String? // a milestone reached today ("1 year")
    let next: String?
    let nextIn: Int
    let progress: Double // from the last milestone (or the start) to the next

    static let sample = DayCount(days: 127, today: nil, next: "6 months", nextIn: 55, progress: 0.6)

    // The milestones most groups give chips for, the same as the site's (lib/milestones.js):
    // 24 hours, 30, 60 and 90 days, 6, 9 and 18 months, then every year
    static func from(_ iso: String, on now: Date) -> DayCount? {
        let parts = iso.split(separator: "-").compactMap { Int($0) }
        let cal = Calendar.current
        guard parts.count == 3, let start = cal.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])) else { return nil }
        let today = cal.startOfDay(for: now)
        guard let days = cal.dateComponents([.day], from: start, to: today).day, days >= 0 else { return nil }

        var list: [(label: String, on: Date)] = []
        func add(_ label: String, _ step: DateComponents) {
            if let on = cal.date(byAdding: step, to: start) { list.append((label, on)) }
        }
        add("24 hours", DateComponents(day: 1))
        for n in [30, 60, 90] { add("\(n) days", DateComponents(day: n)) }
        for n in [6, 9, 18] { add("\(n) months", DateComponents(month: n)) }
        for y in 1...(days / 365 + 2) { add(y == 1 ? "1 year" : "\(y) years", DateComponents(year: y)) }
        list.sort { $0.on < $1.on }

        let reached = list.first { cal.isDate($0.on, inSameDayAs: today) }?.label
        let next = list.first { $0.on > today }
        let last = list.last { $0.on <= today }?.on ?? start
        var progress = 1.0
        var nextIn = 0
        if let next {
            nextIn = cal.dateComponents([.day], from: today, to: next.on).day ?? 0
            let span = max(1, cal.dateComponents([.day], from: last, to: next.on).day ?? 1)
            progress = Double(span - nextIn) / Double(span)
        }
        return DayCount(days: days, today: reached, next: next?.label, nextIn: nextIn, progress: progress)
    }
}

func plural(_ n: Int, _ one: String, _ many: String) -> String { n == 1 ? one : many }

// MARK: - Day count widget

enum DayState {
    case signedOut, noDate, counting(DayCount)
}

struct DayEntry: TimelineEntry {
    let date: Date
    let state: DayState
}

struct DayProvider: TimelineProvider {
    func placeholder(in context: Context) -> DayEntry { DayEntry(date: Date(), state: .counting(.sample)) }

    func getSnapshot(in context: Context, completion: @escaping (DayEntry) -> Void) {
        completion(context.isPreview && !Shared.signedIn ? placeholder(in: context) : entry(at: Date()))
    }

    // Now, then each midnight for a week (the app asks for a new one whenever it opens)
    func getTimeline(in context: Context, completion: @escaping (Timeline<DayEntry>) -> Void) {
        let cal = Calendar.current
        var entries = [entry(at: Date())]
        var day = cal.startOfDay(for: Date())
        for _ in 0..<7 {
            guard let next = cal.date(byAdding: .day, value: 1, to: day) else { break }
            day = next
            entries.append(entry(at: day))
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    private func entry(at date: Date) -> DayEntry {
        guard Shared.signedIn else { return DayEntry(date: date, state: .signedOut) }
        guard let count = DayCount.from(Shared.soberSince, on: date) else { return DayEntry(date: date, state: .noDate) }
        return DayEntry(date: date, state: .counting(count))
    }
}

let dayGradient = LinearGradient(colors: [Color(red: 0.36, green: 0.55, blue: 0.73), Color(red: 0.17, green: 0.31, blue: 0.47)],
                                 startPoint: .topLeading, endPoint: .bottomTrailing)

struct DayCountView: View {
    @Environment(\.widgetFamily) var family
    let entry: DayEntry

    var body: some View {
        content
            .widgetURL(Shared.chipsPage)
            .widgetBackground(family, dayGradient)
    }

    @ViewBuilder var content: some View {
        switch entry.state {
        case .signedOut: message("Sign in to RecoveryBot to see your day count.", short: "Sign in")
        case .noDate: message("Add your sobriety date in RecoveryBot to start your count.", short: "Add date")
        case .counting(let count): counted(count)
        }
    }

    @ViewBuilder func message(_ text: String, short: String) -> some View {
        switch family {
        case .accessoryInline: Text("RecoveryBot: \(short)")
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "calendar").font(.title3)
            }
        case .accessoryRectangular:
            VStack(alignment: .leading) {
                Text("Day count").font(.headline)
                Text(text).font(.caption).lineLimit(2)
            }.frame(maxWidth: .infinity, alignment: .leading)
        default:
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: "calendar").font(.title2)
                Spacer(minLength: 0)
                Text(text).font(.footnote.weight(.medium))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
    }

    func nextLine(_ c: DayCount) -> String? {
        if let today = c.today { return "Today: \(today)" }
        guard let next = c.next else { return nil }
        return "\(next) in \(c.nextIn) \(plural(c.nextIn, "day", "days"))"
    }

    @ViewBuilder func counted(_ c: DayCount) -> some View {
        let unit = plural(c.days, "day", "days")
        switch family {
        case .accessoryInline:
            Text("\(c.days) \(unit)")
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: -2) {
                    Text("\(c.days)").font(.system(size: 22, weight: .bold, design: .rounded)).minimumScaleFactor(0.5).lineLimit(1)
                    Text(unit).font(.system(size: 10, weight: .semibold))
                }.padding(.horizontal, 4)
            }
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text("\(c.days) \(unit)").font(.system(.headline, design: .rounded))
                if let line = nextLine(c) { Text(line).font(.caption) }
                if c.next != nil && c.today == nil { ProgressView(value: c.progress) }
            }.frame(maxWidth: .infinity, alignment: .leading)
        case .systemMedium:
            HStack(alignment: .center, spacing: 16) {
                VStack(alignment: .leading, spacing: 0) {
                    Text("\(c.days)").font(.system(size: 60, weight: .bold, design: .rounded)).minimumScaleFactor(0.4).lineLimit(1)
                    Text(unit).font(.title3.weight(.semibold)).opacity(0.9)
                }
                Spacer(minLength: 0)
                VStack(alignment: .leading, spacing: 6) {
                    if let today = c.today {
                        Text("Today").font(.caption.weight(.semibold)).opacity(0.8)
                        Text(today).font(.title3.weight(.bold))
                    } else if let next = c.next {
                        Text("Next").font(.caption.weight(.semibold)).opacity(0.8)
                        Text(next).font(.headline)
                        ProgressView(value: c.progress).tint(.white)
                        Text("in \(c.nextIn) \(plural(c.nextIn, "day", "days"))").font(.caption).opacity(0.85)
                    }
                }.frame(maxWidth: 140)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        default:
            VStack(alignment: .leading, spacing: 0) {
                Text("\(c.days)").font(.system(size: 54, weight: .bold, design: .rounded)).minimumScaleFactor(0.4).lineLimit(1)
                Text(unit).font(.headline).opacity(0.9)
                Spacer(minLength: 0)
                if let line = nextLine(c) { Text(line).font(.caption.weight(.medium)).opacity(0.9).lineLimit(2) }
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
    }
}

struct DayCountWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "DayCount", provider: DayProvider()) { entry in
            DayCountView(entry: entry)
        }
        .configurationDisplayName("Day count")
        .description("Your days, counted on your phone, and your next milestone. It shows only the number.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

// MARK: - Favorite chip widget

struct ChipEntry: TimelineEntry {
    let date: Date
    let signedIn: Bool
    let image: UIImage?
    var back: UIImage? = nil
    var flipped = false
    let label: String
    var sample = false
}

// Tapping the chip turns it over. The widget runs this itself (the app doesn't open), and
// WidgetKit then redraws the widget, which animates the turn (ChipTurn).
struct FlipChipIntent: AppIntent {
    static let title: LocalizedStringResource = "Turn the chip over"
    static let isDiscoverable = false

    func perform() async throws -> some IntentResult {
        Shared.defaults?.set(!Shared.chipFlipped, forKey: "chipFlipped")
        return .result()
    }
}

// Half a coin flip: the face turns edge-on, then the other face turns in from its edge
struct ChipTurn: ViewModifier {
    let degrees: Double
    func body(content: Content) -> some View {
        content.rotation3DEffect(.degrees(degrees), axis: (x: 0, y: 1, z: 0), perspective: 0.6)
    }
}

extension AnyTransition {
    static var chipFlip: AnyTransition {
        .asymmetric(
            insertion: .modifier(active: ChipTurn(degrees: -90), identity: ChipTurn(degrees: 0)).animation(.easeOut(duration: 0.25).delay(0.25)),
            removal: .modifier(active: ChipTurn(degrees: 90), identity: ChipTurn(degrees: 0)).animation(.easeIn(duration: 0.25))
        )
    }
}

struct ChipProvider: TimelineProvider {
    func placeholder(in context: Context) -> ChipEntry { ChipEntry(date: Date(), signedIn: true, image: nil, label: "1 year", sample: true) }

    func getSnapshot(in context: Context, completion: @escaping (ChipEntry) -> Void) {
        let now = current()
        completion(context.isPreview && now.image == nil ? placeholder(in: context) : now)
    }

    // It only changes when the app hands it a new chip, which asks for a new timeline
    func getTimeline(in context: Context, completion: @escaping (Timeline<ChipEntry>) -> Void) {
        completion(Timeline(entries: [current()], policy: .never))
    }

    private func current() -> ChipEntry {
        let signedIn = Shared.signedIn
        return ChipEntry(date: Date(), signedIn: signedIn, image: signedIn ? Shared.chipImage() : nil,
                         back: signedIn ? Shared.chipBackImage() : nil, flipped: Shared.chipFlipped, label: Shared.chipLabel)
    }
}

let chipBackdrop = RadialGradient(colors: [Color(red: 0.2, green: 0.25, blue: 0.36), Color(red: 0.06, green: 0.09, blue: 0.16)],
                                  center: .center, startRadius: 5, endRadius: 220)

struct ChipView: View {
    @Environment(\.widgetFamily) var family
    let entry: ChipEntry

    var body: some View {
        content
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .widgetURL(Shared.chipsPage)
            .widgetBackground(family, chipBackdrop)
    }

    @ViewBuilder var chip: some View {
        if let image = entry.image, let back = entry.back {
            Button(intent: FlipChipIntent()) {
                ZStack {
                    Image(uiImage: entry.flipped ? back : image).resizable().scaledToFit()
                        .id(entry.flipped)
                        .transition(.chipFlip)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(entry.flipped ? "Chip, back. Tap to turn it over." : "Chip. Tap to turn it over.")
        } else if let image = entry.image {
            Image(uiImage: image).resizable().scaledToFit()
        } else {
            // the widget gallery's preview: a plain brass coin
            Circle()
                .fill(LinearGradient(colors: [Color(red: 0.93, green: 0.8, blue: 0.47), Color(red: 0.62, green: 0.47, blue: 0.2)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(Circle().inset(by: 8).stroke(Color.white.opacity(0.35), lineWidth: 2))
                .overlay(Text("I").font(.system(size: 34, weight: .bold, design: .serif)).foregroundStyle(Color(red: 0.36, green: 0.26, blue: 0.08)))
                .padding(8)
        }
    }

    @ViewBuilder var content: some View {
        if !entry.signedIn && !entry.sample {
            empty("Sign in to RecoveryBot to show your chip here.")
        } else if entry.image == nil && !entry.sample {
            empty("Star a chip on your Chips page to show it here.")
        } else if family == .systemMedium {
            HStack(spacing: 14) {
                chip
                VStack(alignment: .leading, spacing: 4) {
                    Text(entry.label).font(.title3.weight(.bold)).lineLimit(2)
                    Text("Favorite chip").font(.caption).opacity(0.75)
                }
                Spacer(minLength: 0)
            }
        } else {
            VStack(spacing: 4) {
                chip
                if !entry.label.isEmpty && family != .systemSmall {
                    Text(entry.label).font(.headline)
                }
            }
        }
    }

    func empty(_ text: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: "star.circle").font(.title)
            Text(text).font(.footnote.weight(.medium)).multilineTextAlignment(.center)
        }
    }
}

struct ChipWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "FavoriteChip", provider: ChipProvider()) { entry in
            ChipView(entry: entry)
        }
        .configurationDisplayName("Favorite chip")
        .description("The first chip you starred on your Chips page. Tap the chip to turn it over.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: - Shared

extension View {
    // A Home Screen widget gets its own backdrop; a Lock Screen one takes the system's
    @ViewBuilder func widgetBackground<S: ShapeStyle>(_ family: WidgetFamily, _ style: S) -> some View {
        switch family {
        case .accessoryCircular, .accessoryRectangular, .accessoryInline:
            containerBackground(for: .widget) { Color.clear }
        default:
            containerBackground(style, for: .widget)
        }
    }
}

@main
struct RecoveryBotWidgets: WidgetBundle {
    var body: some Widget {
        DayCountWidget()
        ChipWidget()
    }
}
