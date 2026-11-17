import SwiftUI
import UIKit
import WidgetKit

// RecoveryBot's Home Screen and Lock Screen widgets:
// - Day count: how many days since their sobriety date, and the next milestone. Counted here on
//   the phone, so it turns over at midnight without the app being opened. It says only the
//   number ("127 days"), never what the days are of, so it's discreet on a Lock Screen.
//   The medium and large sizes also show the next fun fact ("🪐 In 12 days: a whole year on
//   Mars"), or today's, from the list the site hands over (lib/dayFacts.json).
// - Favorite chip: their first favorite chip (else their newest sobriety chip), drawn by the site.
// The app (WidgetBridgePlugin in AppDelegate.swift) keeps what they show in the App Group both
// share; signing out of the app clears it. Tapping the day count opens Today; tapping the chip
// opens that chip full size on the Chips page, where it spins in 3D (a widget can only turn a
// flat picture). Both share one set of styles (WidgetStyle), each with its own colors and one of
// the site's fonts for the big number (bundled in Fonts/, listed under UIAppFonts in Info.plist).
// They're picked only in the app (This phone > Widgets,
// components/profile/WidgetSettings.jsx), never from Edit Widget: WidgetBridgePlugin keeps them
// in the App Group as "widgetStyle" for every widget, and "widgetStyle.<day|chip>.<size>" for the
// placed widgets of one kind and size that have their own (Shared.style).

enum Shared {
    static let group = "group.com.hmblbot.recoverybot"
    static var defaults: UserDefaults? { UserDefaults(suiteName: group) }
    static var signedIn: Bool { defaults?.bool(forKey: "signedIn") ?? false }
    static var soberSince: String { defaults?.string(forKey: "soberSince") ?? "" }
    static var chipLabel: String { defaults?.string(forKey: "chipLabel") ?? "" }
    // The style picked in the app for a widget ("day" or "chip") of a size: that size's own
    // ("widgetStyle.day.small"), else the kind's own (kept by app builds before per-widget picks,
    // "widgetStyle.day"), else the one for every widget ("widgetStyle"); Classic blue until one
    // is picked
    static func style(_ widget: String, _ family: WidgetFamily) -> WidgetStyle {
        for key in ["widgetStyle.\(widget).\(family.styleKey)", "widgetStyle.\(widget)", "widgetStyle"] {
            if let raw = defaults?.string(forKey: key), let style = WidgetStyle(rawValue: raw) { return style }
        }
        return .classic
    }

    // The fun day-count facts from the day the site sent them on, in day order
    static func funFacts() -> [FunFact] {
        guard let json = defaults?.string(forKey: "funFacts"), let data = json.data(using: .utf8) else { return [] }
        return (try? JSONDecoder().decode([FunFact].self, from: data)) ?? []
    }

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

    // The chip on the widget, opened full size on the Chips page, where it spins in 3D
    static var chipLink: URL {
        let id = defaults?.string(forKey: "chipId") ?? ""
        var parts = URLComponents(string: "recoverybot://open/recovery")!
        if !id.isEmpty { parts.queryItems = [URLQueryItem(name: "chip", value: id), URLQueryItem(name: "from", value: "widget")] }
        return parts.url ?? chipsPage
    }
    // native_app.js opens the Today panel for #today, on whatever page the app is on
    static let todayPanel = URL(string: "recoverybot://open/#today")!
}

// MARK: - Counting

// A fun comparison for a day count (lib/dayFacts.json): its day, emoji, title and detail
struct FunFact: Decodable {
    let d: Int
    let e: String
    let t: String
    let x: String?
}

// Today's fact, else the next one, and how many days off it is (0 for today)
struct FactLine {
    let emoji: String
    let title: String
    let detail: String
    let inDays: Int

    static let sample = FactLine(emoji: "🐾", title: "Longer than an elephant's pregnancy", detail: "", inDays: 12)

    static func pick(_ facts: [FunFact], days: Int) -> FactLine? {
        guard let f = facts.first(where: { $0.d == days }) ?? facts.first(where: { $0.d > days }) else { return nil }
        return FactLine(emoji: f.e, title: f.t, detail: f.x ?? "", inDays: f.d - days)
    }

    // "Today" or "In 12 days" / "Tomorrow"
    var when: String {
        switch inDays {
        case 0: return "Today"
        case 1: return "Tomorrow"
        default: return "In \(inDays.formatted()) days"
        }
    }

    // "a whole year on Mars", to follow "In 12 days:"
    var lowered: String { title.prefix(1).lowercased() + title.dropFirst() }
}

struct DayCount {
    let days: Int
    let today: String? // a milestone reached today ("1 year")
    let next: String?
    let nextIn: Int
    let progress: Double // from the last milestone (or the start) to the next
    var fact: FactLine? = nil

    static let sample = DayCount(days: 127, today: nil, next: "6 months", nextIn: 55, progress: 0.6, fact: .sample)

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

// The widgets' styles, the same for the day count and the chip, and the same list as the app's
// picker (lib/widgetStyles.js) and the Android widgets (WidgetStyles.java): change them together.
enum WidgetStyle: String {
    case classic, night, ocean, forest, sunrise, midnight, black, light, paper, paperLight, paperDark
}

extension WidgetFamily {
    // The size in a style's key ("widgetStyle.day.small"); Lock Screen widgets take the system's look
    var styleKey: String {
        switch self {
        case .systemMedium: return "medium"
        case .systemLarge, .systemExtraLarge: return "large"
        default: return "small"
        }
    }
}

// Colors and type for a style. The big number is one of the site's fonts (Fonts/): Classic and
// Light are Public Sans, the site's own; Night is airy Figtree Light; Ocean heavy Montserrat
// Black; Forest TikTok Sans; Sunrise tall TikTok Sans Condensed; Midnight DM Mono in amber;
// Charcoal a thin Inter; Paper Gentium Book Plus, the site's reading serif. The smaller lines
// stay in the system's faces: rounded, or serif on Paper, monospaced on Midnight, plain on Sunrise.
struct WidgetTheme {
    let background: AnyShapeStyle
    let ink: Color
    let accent: Color
    var numberInk: Color? = nil
    let numberFont: String
    var design: Font.Design = .rounded
    var numberTracking: CGFloat = 0

    func number(_ size: CGFloat) -> Font { .custom(numberFont, fixedSize: size) }

    func text(_ style: Font.TextStyle, _ weight: Font.Weight = .regular) -> Font {
        Font.system(style, design: design).weight(weight)
    }

    // "days" under the number
    func unit(_ style: Font.TextStyle) -> Font { text(style, .semibold) }

    static let paperLight = WidgetTheme(background: AnyShapeStyle(Color(red: 0.96, green: 0.94, blue: 0.89)), ink: Color(red: 0.23, green: 0.18, blue: 0.13),
                                        accent: Color(red: 0.72, green: 0.42, blue: 0.16), numberFont: "GentiumBookPlus-Bold", design: .serif)
    static let paperDark = WidgetTheme(background: AnyShapeStyle(Color(red: 0.16, green: 0.14, blue: 0.12)), ink: Color(red: 0.95, green: 0.91, blue: 0.83),
                                       accent: Color(red: 0.87, green: 0.6, blue: 0.3), numberFont: "GentiumBookPlus-Bold", design: .serif)

    private static func radial(_ a: Color, _ b: Color) -> AnyShapeStyle {
        AnyShapeStyle(RadialGradient(colors: [a, b], center: .center, startRadius: 5, endRadius: 220))
    }

    static func of(_ style: WidgetStyle, scheme: ColorScheme = .light) -> WidgetTheme {
        switch style {
        case .classic:
            return WidgetTheme(background: AnyShapeStyle(dayGradient), ink: .white, accent: .white,
                               numberFont: "PublicSans-ExtraBold", numberTracking: -1)
        case .night:
            return WidgetTheme(background: AnyShapeStyle(chipBackdrop), ink: .white, accent: Color(red: 0.6, green: 0.76, blue: 1),
                               numberFont: "Figtree-Light", numberTracking: -1)
        case .ocean:
            return WidgetTheme(background: radial(Color(red: 0.16, green: 0.5, blue: 0.85), Color(red: 0.03, green: 0.2, blue: 0.43)), ink: .white,
                               accent: Color(red: 0.62, green: 0.86, blue: 1), numberFont: "Montserrat-Black")
        case .forest:
            return WidgetTheme(background: radial(Color(red: 0.2, green: 0.5, blue: 0.36), Color(red: 0.04, green: 0.2, blue: 0.13)), ink: .white,
                               accent: Color(red: 0.6, green: 0.9, blue: 0.68), numberFont: "TikTokSans-ExtraBold")
        case .black:
            // a deep charcoal with a little light in the middle, rather than flat black
            return WidgetTheme(background: radial(Color(red: 0.2, green: 0.2, blue: 0.22), Color(red: 0.09, green: 0.09, blue: 0.1)), ink: .white,
                               accent: Color(red: 0.82, green: 0.82, blue: 0.85), numberFont: "Inter-ExtraLight",
                               numberTracking: -2)
        case .light:
            return WidgetTheme(background: radial(.white, Color(red: 0.89, green: 0.89, blue: 0.87)), ink: Color(red: 0.12, green: 0.14, blue: 0.2),
                               accent: Color(red: 0.23, green: 0.44, blue: 0.65), numberInk: Color(red: 0.23, green: 0.44, blue: 0.65),
                               numberFont: "PublicSans-ExtraBold", numberTracking: -1)
        case .paperLight: return paperLight
        case .paperDark: return paperDark
        case .paper:
            return scheme == .dark ? paperDark : paperLight
        case .midnight:
            return WidgetTheme(background: AnyShapeStyle(Color(red: 0.04, green: 0.04, blue: 0.06)), ink: .white,
                               accent: Color(red: 0.96, green: 0.62, blue: 0.04), numberInk: Color(red: 0.96, green: 0.62, blue: 0.04),
                               numberFont: "DMMono-Light", design: .monospaced, numberTracking: -2)
        case .sunrise:
            return WidgetTheme(background: AnyShapeStyle(LinearGradient(colors: [Color(red: 0.98, green: 0.45, blue: 0.09), Color(red: 0.86, green: 0.15, blue: 0.47)],
                                                                        startPoint: .topLeading, endPoint: .bottomTrailing)),
                               ink: .white, accent: .white, numberFont: "TikTokSansCondensed-Black", design: .default)
        }
    }
}

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
        completion(context.isPreview && !Shared.signedIn ? DayEntry(date: Date(), state: .counting(.sample)) : entry(at: Date()))
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
        guard var count = DayCount.from(Shared.soberSince, on: date) else { return DayEntry(date: date, state: .noDate) }
        count.fact = FactLine.pick(Shared.funFacts(), days: count.days)
        return DayEntry(date: date, state: .counting(count))
    }
}

let dayGradient = LinearGradient(colors: [Color(red: 0.36, green: 0.55, blue: 0.73), Color(red: 0.17, green: 0.31, blue: 0.47)],
                                 startPoint: .topLeading, endPoint: .bottomTrailing)

struct DayCountView: View {
    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) var colorScheme
    let entry: DayEntry
    var theme: WidgetTheme { WidgetTheme.of(Shared.style("day", family), scheme: colorScheme) }

    var body: some View {
        content
            .widgetURL(Shared.todayPanel)
            .widgetBackground(family, theme)
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
                Text(text).font(theme.text(.footnote, .medium))
            }
            .foregroundStyle(theme.ink)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
    }

    // The count, in the style's number face and (on Light and Midnight) its own color
    func numberText(_ days: Int, _ size: CGFloat) -> some View {
        Text("\(days)").font(theme.number(size)).tracking(theme.numberTracking)
            .foregroundStyle(theme.numberInk ?? theme.ink)
            .minimumScaleFactor(0.4).lineLimit(1)
    }

    func nextLine(_ c: DayCount) -> String? {
        if let today = c.today { return "Today: \(today)" }
        guard let next = c.next else { return nil }
        return "\(next) in \(c.nextIn) \(plural(c.nextIn, "day", "days"))"
    }

    // "🪐 In 12 days: a whole year on Mars", one line along the bottom of the medium size
    func factLine(_ f: FactLine) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(f.emoji)
            Text("\(f.when): \(f.lowered)").font(theme.text(.caption, .medium)).opacity(0.9).lineLimit(1).minimumScaleFactor(0.85)
        }
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
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .center, spacing: 16) {
                    VStack(alignment: .leading, spacing: 0) {
                        numberText(c.days, 60)
                        Text(unit).font(theme.unit(.title3)).opacity(0.9)
                    }
                    Spacer(minLength: 0)
                    VStack(alignment: .leading, spacing: 6) {
                        if let today = c.today {
                            Text("Today").font(theme.text(.caption, .semibold)).opacity(0.8)
                            Text(today).font(theme.text(.title3, .bold))
                        } else if let next = c.next {
                            Text("Next").font(theme.text(.caption, .semibold)).opacity(0.8)
                            Text(next).font(theme.text(.headline, .semibold))
                            ProgressView(value: c.progress).tint(theme.accent)
                            Text("in \(c.nextIn) \(plural(c.nextIn, "day", "days"))").font(theme.text(.caption)).opacity(0.85)
                        }
                    }.frame(maxWidth: 140)
                }
                if let fact = c.fact { factLine(fact) }
            }
            .foregroundStyle(theme.ink)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .systemLarge:
            VStack(alignment: .leading, spacing: 0) {
                numberText(c.days, 96)
                Text(unit).font(theme.unit(.title2)).opacity(0.9)
                Spacer(minLength: 8)
                if let today = c.today {
                    Text("Today").font(theme.text(.caption, .semibold)).opacity(0.8)
                    Text(today).font(theme.text(.title2, .bold))
                } else if let next = c.next {
                    Text("Next: \(next)").font(theme.text(.headline, .semibold))
                    ProgressView(value: c.progress).tint(theme.accent).padding(.vertical, 4)
                    Text("in \(c.nextIn) \(plural(c.nextIn, "day", "days"))").font(theme.text(.caption)).opacity(0.85)
                }
                if let fact = c.fact {
                    Spacer(minLength: 8)
                    HStack(alignment: .top, spacing: 10) {
                        Text(fact.emoji).font(.system(size: 30))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(fact.when).font(theme.text(.caption, .semibold)).opacity(0.8)
                            Text(fact.title).font(theme.text(.subheadline, .semibold)).lineLimit(2)
                            if !fact.detail.isEmpty {
                                Text(fact.detail).font(theme.text(.caption)).opacity(0.85).lineLimit(3)
                            }
                        }
                    }
                }
            }
            .foregroundStyle(theme.ink)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        default:
            VStack(alignment: .leading, spacing: 0) {
                numberText(c.days, 54)
                Text(unit).font(theme.unit(.headline)).opacity(0.9)
                Spacer(minLength: 0)
                if let line = nextLine(c) { Text(line).font(theme.text(.caption, .medium)).opacity(0.9).lineLimit(2) }
                if c.next != nil && c.today == nil {
                    ProgressView(value: c.progress).tint(theme.accent).padding(.top, 4)
                }
            }
            .foregroundStyle(theme.ink)
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
        .description("Your days, counted on your phone, your next milestone and, in the larger sizes, the next fun fact. It shows only the number. Pick its style in RecoveryBot's settings, under Widgets.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryRectangular, .accessoryInline])
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

struct ChipProvider: TimelineProvider {
    func placeholder(in context: Context) -> ChipEntry { ChipEntry(date: Date(), signedIn: true, image: nil, label: "1 year", sample: true) }

    func getSnapshot(in context: Context, completion: @escaping (ChipEntry) -> Void) {
        let now = current()
        completion(context.isPreview && now.image == nil ? ChipEntry(date: Date(), signedIn: true, image: nil, label: "1 year", sample: true) : now)
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
    @Environment(\.colorScheme) var colorScheme
    let entry: ChipEntry
    var theme: WidgetTheme { WidgetTheme.of(Shared.style("chip", family), scheme: colorScheme) }

    var body: some View {
        content
            .foregroundStyle(theme.ink)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .widgetURL(entry.image == nil ? Shared.chipsPage : Shared.chipLink)
            .widgetBackground(family, theme)
    }

    // Depth: a darker copy just below it for the coin's rim, and a soft shadow under the whole chip
    func coin(_ picture: UIImage) -> some View {
        ZStack {
            Image(uiImage: picture).resizable().scaledToFit()
                .brightness(-0.38).offset(y: 3)
            Image(uiImage: picture).resizable().scaledToFit()
        }
        .shadow(color: .black.opacity(0.45), radius: 7, x: 0, y: 6)
    }

    @ViewBuilder var chip: some View {
        if let image = entry.image {
            coin(image)
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
        .description("The first chip you starred on your Chips page. Tap the chip to turn it over; pick its style in RecoveryBot's settings, under Widgets.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: - Shared

extension View {
    // A Home Screen widget gets its style's backdrop; a Lock Screen one takes the system's
    @ViewBuilder func widgetBackground(_ family: WidgetFamily, _ theme: WidgetTheme) -> some View {
        switch family {
        case .accessoryCircular, .accessoryRectangular, .accessoryInline:
            containerBackground(for: .widget) { Color.clear }
        default:
            containerBackground(theme.background, for: .widget)
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
