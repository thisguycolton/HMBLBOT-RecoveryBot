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
// - Daily Reflection: today's reading (its title, opening quote and where it's from), from the
//   two weeks of them the site hands over, so it turns over at midnight by itself.
// The app (WidgetBridgePlugin in AppDelegate.swift) keeps what they show in the App Group they
// share; signing out of the app clears it. Tapping the day count opens Today, the chip opens it
// full size on the Chips page, the Daily Reflection opens the day's page.
//
// Home Screen widgets are drawn from layouts (Layouts/widget-layouts.json, written from the
// site's lib/widgetLayouts.js by bin/widget-layouts): one per style, kind and size, the designs
// from the widgets' Figma file. WidgetCanvas draws them; the site's settings previews
// (lib/widgetDraw.js) and the Android widgets (WidgetPainter.java) draw the same ones.
// Each style's big number is one of the site's fonts (Fonts/, listed under UIAppFonts in
// Info.plist); the smaller lines are the system's faces.
// Styles are picked only in the app (This phone > Widgets, components/profile/WidgetSettings.jsx),
// never from Edit Widget: WidgetBridgePlugin keeps them in the App Group as "widgetStyle" for
// every widget, and "widgetStyle.<day|chip|reflection>.<size>" for the placed widgets of one
// kind and size that have their own (Shared.style).

enum Shared {
    static let group = "group.com.hmblbot.recoverybot"
    static var defaults: UserDefaults? { UserDefaults(suiteName: group) }
    static var signedIn: Bool { defaults?.bool(forKey: "signedIn") ?? false }
    static var soberSince: String { defaults?.string(forKey: "soberSince") ?? "" }
    static var chipLabel: String { defaults?.string(forKey: "chipLabel") ?? "" }
    static var chipOn: String { defaults?.string(forKey: "chipOn") ?? "" }
    // The style picked in the app for a widget ("day", "chip" or "reflection") of a size: that
    // size's own ("widgetStyle.day.small"), else the kind's own (kept by app builds before
    // per-widget picks, "widgetStyle.day"), else the one for every widget ("widgetStyle");
    // Classic blue until one is picked
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

    // The Daily Reflections the site sent, one for each of the next two weeks
    static func reflections() -> [Reflection] {
        guard let json = defaults?.string(forKey: "reflections"), let data = json.data(using: .utf8) else { return [] }
        return (try? JSONDecoder().decode([Reflection].self, from: data)) ?? []
    }

    static func chipImage() -> UIImage? {
        guard defaults?.bool(forKey: "hasChip") == true,
              let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?.appendingPathComponent("chip.png")
        else { return nil }
        return UIImage(contentsOfFile: url.path)
    }

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
    static let library = URL(string: "recoverybot://open/books/daily-reflections")!
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

    // "🪐 In 12 days: a whole year on Mars"
    var line: String { "\(emoji) \(when): \(lowered)" }
}

struct DayCount {
    let days: Int
    let today: String? // a milestone reached today ("1 year")
    let next: String?
    let nextIn: Int
    let progress: Double // from the last milestone (or the start) to the next
    var start: Date = Date()
    var fact: FactLine? = nil

    static let sample = DayCount(days: 127, today: nil, next: "6 months", nextIn: 55, progress: 0.6,
                                 start: Calendar.current.date(byAdding: .day, value: -127, to: Date()) ?? Date(), fact: .sample)

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
        return DayCount(days: days, today: reached, next: next?.label, nextIn: nextIn, progress: progress, start: start)
    }
}

func plural(_ n: Int, _ one: String, _ many: String) -> String { n == 1 ? one : many }

// A day's Daily Reflection (Api::WidgetReflectionsController on the site)
struct Reflection: Decodable {
    let date: String
    let title: String
    let quote: String
    let source: String
    let minutes: Int
    let path: String

    static let sample = Reflection(date: "", title: "Overcoming Loneliness",
                                   quote: "Almost without exception, alcoholics are tortured by loneliness. Even before our drinking got bad and people began to cut us off, nearly all of us suffered the feeling that we didn't quite belong.",
                                   source: "As Bill Sees It, p. 90", minutes: 2, path: "")

    static func isoDay(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    var link: URL { path.isEmpty ? Shared.library : (URL(string: "recoverybot://open\(path)") ?? Shared.library) }
}

// MARK: - Styles

// The widgets' styles, the same for every widget, and the same list as the app's picker
// (lib/widgetStyles.js) and the Android widgets (WidgetStyles.java): change them together.
enum WidgetStyle: String {
    case classic, night, ocean, forest, sunrise, midnight, black, light, paper, paperLight, paperDark

    // The layout it draws with: Paper follows Light/Dark Mode
    func layoutKey(_ scheme: ColorScheme) -> String {
        if self == .paper { return scheme == .dark ? "paperDark" : "paperLight" }
        return rawValue
    }
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

// MARK: - Layouts

// widget-layouts.json: { version, looks: { style: { number, text, ink } }, layouts: { "classic.day.small": { w, h, ops } } }
enum Layouts {
    static let all: [String: Any] = {
        guard let url = Bundle.main.url(forResource: "widget-layouts", withExtension: "json", subdirectory: "Layouts")
                ?? Bundle.main.url(forResource: "widget-layouts", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
        return json
    }()

    static func layout(_ style: String, _ kind: String, _ size: String) -> [String: Any]? {
        let layouts = all["layouts"] as? [String: Any]
        return (layouts?["\(style).\(kind).\(size)"] ?? layouts?["classic.\(kind).\(size)"]) as? [String: Any]
    }

    static func look(_ style: String) -> [String: Any] {
        ((all["looks"] as? [String: Any])?[style] ?? (all["looks"] as? [String: Any])?["classic"]) as? [String: Any] ?? [:]
    }
}

extension Color {
    init(hex: String, opacity: Double = 1) {
        let n = UInt64(hex, radix: 16) ?? 0
        self.init(.sRGB, red: Double((n >> 16) & 255) / 255, green: Double((n >> 8) & 255) / 255, blue: Double(n & 255) / 255, opacity: opacity)
    }
}

// The values a layout's texts fill in (SAMPLE_VALUES in lib/widgetLayouts.js lists them all)
enum WidgetValues {
    static func mediumDate(_ date: Date) -> String {
        date.formatted(.dateTime.month(.abbreviated).day().year())
    }

    static func isoDate(_ iso: String) -> Date? {
        let parts = iso.prefix(10).split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    // "6 months" -> "6 MO", "1 year" -> "1 YR", for the small chip's line
    static func short(_ label: String) -> String {
        label.replacingOccurrences(of: "months", with: "mo").replacingOccurrences(of: "month", with: "mo")
            .replacingOccurrences(of: "years", with: "yrs").replacingOccurrences(of: "year", with: "yr").uppercased()
    }

    static func day(_ c: DayCount) -> ([String: String], Double?) {
        var v: [String: String] = [:]
        let unit = plural(c.days, "DAY", "DAYS")
        v["days"] = c.days.formatted()
        v["daysCaps"] = unit
        v["daysSober"] = "\(unit) SOBER"
        let since = mediumDate(c.start)
        v["since"] = "Since \(since)"
        v["sinceCaps"] = "SOBER SINCE \(since.uppercased())"
        var progress: Double? = nil
        if let today = c.today {
            v["nextHead"] = "Today"
            v["nextName"] = today
            v["nextIn"] = "today"
            v["nextLine"] = "Today: \(today)"
            v["nextShort"] = "\(short(today)) TODAY"
            v["nextBoth"] = "\(today) today"
            v["nextChip"] = "Today: your \(today) chip"
            v["nextDaysUnit"] = "today"
            v["nextTo"] = today
            v["percent"] = "100%"
            progress = 1
        } else if let next = c.next {
            let days = "\(c.nextIn.formatted()) \(plural(c.nextIn, "day", "days"))"
            v["nextHead"] = "Next chip"
            v["nextName"] = next
            v["nextIn"] = "in \(days)"
            v["nextLine"] = "\(days) to \(next)"
            v["nextShort"] = "\(short(next)) IN \(days.uppercased())"
            v["nextBoth"] = "\(next) in \(days)"
            v["nextChip"] = "Next chip: \(next)"
            v["nextDays"] = c.nextIn.formatted()
            v["nextDaysUnit"] = plural(c.nextIn, "day", "days")
            v["nextTo"] = "to \(next)"
            v["percent"] = "\(Int((c.progress * 100).rounded()))%"
            v["chipNext"] = "Next: \(next) · \(days)"
            progress = c.progress
        }
        if let fact = c.fact { v["fact"] = fact.line }
        return (v, progress)
    }

    static func chip(label: String, on: String) -> [String: String] {
        var v: [String: String] = ["chipName": label]
        if let date = isoDate(on) { v["chipEarned"] = "Earned \(mediumDate(date))" }
        return v
    }

    static func reflection(_ r: Reflection, on date: Date) -> ([String: String], Double) {
        let cal = Calendar.current
        let dayOfYear = cal.ordinality(of: .day, in: .year, for: date) ?? 1
        let daysInYear = cal.range(of: .day, in: .year, for: date)?.count ?? 365
        let short = date.formatted(.dateTime.month(.abbreviated).day())
        let read = "~\(max(1, r.minutes)) min read"
        let v: [String: String] = [
            "rDate": short,
            "rDay": "\(short) · \(dayOfYear)/\(daysInYear)",
            "rTitle": r.title,
            "rQuote": r.quote,
            "rSource": r.source,
            "rSourceCaps": r.source.uppercased(),
            "rRead": read,
            "rBand": "\(short) · \(read)",
        ]
        return (v, Double(dayOfYear) / Double(daysInYear))
    }
}

// Draws a layout (see lib/widgetLayouts.js for what each thing is) at the widget's real size,
// the same way lib/widgetDraw.js does in the browser. iOS rounds a widget's corners itself
// (about 22 points), so the layout's outer corners and its edge use that.
struct WidgetCanvas: View {
    let style: String
    let layout: [String: Any]
    let values: [String: String]
    var progress: [String: Double] = [:]
    var chip: UIImage? = nil

    static let corner: CGFloat = 22

    var body: some View {
        Canvas { ctx, size in draw(&ctx, size) }
    }

    private func num(_ op: [String: Any], _ key: String, _ fallback: CGFloat = 0) -> CGFloat {
        (op[key] as? NSNumber).map { CGFloat(truncating: $0) } ?? fallback
    }

    private func shading(_ fill: [String: Any], _ rect: CGRect) -> GraphicsContext.Shading {
        let kind = fill["k"] as? String ?? "s"
        if kind == "s" {
            return .color(Color(hex: fill["c"] as? String ?? "000000", opacity: Double(num(fill, "a", 1))))
        }
        let colors = (fill["c"] as? [String]) ?? []
        let stops = (fill["p"] as? [NSNumber])?.map { CGFloat(truncating: $0) } ?? []
        let gradient = Gradient(stops: colors.enumerated().map { i, c in
            Gradient.Stop(color: Color(hex: c), location: min(1, max(0, i < stops.count ? stops[i] : CGFloat(i))))
        })
        if kind == "r" {
            return .radialGradient(gradient, center: CGPoint(x: rect.midX, y: rect.midY), startRadius: 0, endRadius: 0.8 * max(rect.width, rect.height))
        }
        let from = (fill["from"] as? [NSNumber])?.map { CGFloat(truncating: $0) } ?? [0, 0]
        let to = (fill["to"] as? [NSNumber])?.map { CGFloat(truncating: $0) } ?? [1, 1]
        return .linearGradient(gradient,
                               startPoint: CGPoint(x: rect.minX + from[0] * rect.width, y: rect.minY + from[1] * rect.height),
                               endPoint: CGPoint(x: rect.minX + to[0] * rect.width, y: rect.minY + to[1] * rect.height))
    }

    // "{days} days" filled in; nil when every value it names is empty
    static func fill(_ template: String, _ values: [String: String]) -> String? {
        var out = ""
        var names = 0
        var any = false
        var rest = Substring(template)
        while let open = rest.firstIndex(of: "{"), let close = rest[open...].firstIndex(of: "}") {
            out += rest[..<open]
            let name = String(rest[rest.index(after: open)..<close])
            names += 1
            let v = values[name] ?? ""
            if !v.isEmpty { any = true }
            out += v
            rest = rest[rest.index(after: close)...]
        }
        out += rest
        return names > 0 && !any ? nil : out
    }

    // Lines no wider than max, at most `lines`, the last cut with "…" (wrap() in lib/widgetDraw.js)
    static func wrap(_ text: String, max: CGFloat, lines: Int, measure: (String) -> CGFloat) -> [String] {
        var out: [String] = []
        for paragraph in text.components(separatedBy: "\n") {
            var line = ""
            for word in paragraph.split(separator: " ", omittingEmptySubsequences: false).map(String.init) {
                let next = line.isEmpty ? word : "\(line) \(word)"
                if max <= 0 || measure(next) <= max || line.isEmpty { line = next } else { out.append(line); line = word }
            }
            out.append(line)
        }
        guard out.count > lines else { return out }
        var kept = Array(out.prefix(lines))
        var last = kept[lines - 1]
        while !last.isEmpty && max > 0 && measure("\(last)…") > max {
            if let space = last.lastIndex(of: " ") { last = String(last[..<space]) } else { last = "" }
        }
        kept[lines - 1] = (last.isEmpty ? kept[lines - 1] : last) + "…"
        return kept
    }

    private func font(_ op: [String: Any], _ size: CGFloat) -> Font {
        let face = op["font"] as? String ?? "rounded"
        if face == "number" {
            let name = Layouts.look(style)["number"] as? String ?? "PublicSans-ExtraBold"
            return .custom(name, fixedSize: size)
        }
        let weight: Font.Weight
        switch Int(num(op, "weight", 400)) {
        case ..<250: weight = .light
        case ..<450: weight = .regular
        case ..<550: weight = .medium
        case ..<650: weight = .semibold
        case ..<750: weight = .bold
        default: weight = .heavy
        }
        let design: Font.Design
        switch face {
        case "serif": design = .serif
        case "mono": design = .monospaced
        case "plain": design = .default
        default: design = .rounded
        }
        return .system(size: size, weight: weight, design: design)
    }

    // The widget's own outline, inset by `inset`: the same smooth (continuous) corners iOS clips
    // a widget to, so the edge hugs the real corners
    static func edgePath(_ size: CGSize, radius: CGFloat, inset: CGFloat) -> Path {
        let rect = CGRect(origin: .zero, size: size).insetBy(dx: inset, dy: inset)
        return Path(roundedRect: rect, cornerRadius: max(0, radius - inset), style: .continuous)
    }

    // Where the top middle falls along a path (0-1), and whether the path runs clockwise from it.
    // SwiftUI picks a rounded rectangle's starting point itself, so it's found by sampling.
    static func topMiddle(of path: Path, in size: CGSize) -> (start: CGFloat, clockwise: Bool) {
        let target = CGPoint(x: size.width / 2, y: path.boundingRect.minY)
        var best: CGFloat = 0
        var bestDistance = CGFloat.greatestFiniteMagnitude
        for i in 1...400 {
            let t = CGFloat(i) / 400
            guard let point = path.trimmedPath(from: 0, to: t).currentPoint else { continue }
            let d = hypot(point.x - target.x, point.y - target.y)
            if d < bestDistance { bestDistance = d; best = t }
        }
        let ahead = path.trimmedPath(from: 0, to: min(1, best + 0.01)).currentPoint?.x ?? target.x + 1
        return (best, ahead > target.x)
    }

    // The stretch of the edge for `p` (0-1), clockwise from the top middle, as one or two pieces
    static func progressPieces(of path: Path, in size: CGSize, _ amount: CGFloat) -> [Path] {
        let p = min(1, max(0, amount))
        guard p > 0 else { return [] }
        let (start, clockwise) = topMiddle(of: path, in: size)
        let from = clockwise ? start : start - p
        let to = clockwise ? start + p : start
        if from >= 0 && to <= 1 { return [path.trimmedPath(from: from, to: to)] }
        if to > 1 { return [path.trimmedPath(from: from, to: 1), path.trimmedPath(from: 0, to: to - 1)] }
        return [path.trimmedPath(from: from + 1, to: 1), path.trimmedPath(from: 0, to: to)]
    }

    private func draw(_ ctx: inout GraphicsContext, _ size: CGSize) {
        let lw = num(layout, "w", 170), lh = num(layout, "h", 170)
        let sx = size.width / lw, sy = size.height / lh, s = min(sx, sy)
        let ops = layout["ops"] as? [[String: Any]] ?? []
        // How far a title that took more lines than its first ("grow") pushes the ops after it
        // that "follow" it, in layout points
        var shift: CGFloat = 0
        for op in ops {
            let follow = (op["follow"] as? Bool) == true
            switch op["t"] as? String ?? "" {
            case "rect":
                let rect = CGRect(x: num(op, "x") * sx, y: num(op, "y") * sy, width: num(op, "w") * sx, height: num(op, "h") * sy)
                var r = num(op, "r") * s
                if num(op, "r") >= 24 { r = Self.corner } // the widget's own corners
                let path = Path(roundedRect: rect, cornerRadius: r, style: .continuous)
                if (op["mask"] as? Bool) == true { ctx.clip(to: path); continue }
                ctx.fill(path, with: shading(op["fill"] as? [String: Any] ?? [:], rect))
            case "text":
                let drawn = drawText(&ctx, op, sx: sx, sy: sy, s: s, shift: follow ? shift : 0)
                if (op["grow"] as? Bool) == true && drawn > 1 {
                    shift += CGFloat(drawn - 1) * num(op, "line", num(op, "size", 12) * 1.2)
                }
            case "bar":
                guard let p = progress[op["p"] as? String ?? ""] else { continue }
                let x = num(op, "x") * sx, y = num(op, "y") * sy, w = num(op, "w") * sx, h = num(op, "h") * s
                let square = (op["square"] as? Bool) == true
                let track = op["track"] as? [String: Any] ?? [:]
                ctx.fill(Path(roundedRect: CGRect(x: x, y: y, width: w, height: h), cornerRadius: square ? 0 : h / 2),
                         with: .color(Color(hex: track["c"] as? String ?? "FFFFFF", opacity: Double(num(track, "a", 0.13)))))
                let filled = max(square ? 0 : h, w * CGFloat(p))
                ctx.fill(Path(roundedRect: CGRect(x: x, y: y, width: filled, height: h), cornerRadius: square ? 0 : h / 2),
                         with: .color(Color(hex: op["color"] as? String ?? "FFFFFF")))
            case "ring":
                guard let p = progress[op["p"] as? String ?? ""] else { continue }
                let center = CGPoint(x: num(op, "cx") * sx, y: num(op, "cy") * sy)
                let th = num(op, "th") * s, r = num(op, "r") * s - th / 2
                let track = op["track"] as? [String: Any] ?? [:]
                var full = Path()
                full.addArc(center: center, radius: r, startAngle: .degrees(0), endAngle: .degrees(360), clockwise: false)
                ctx.stroke(full, with: .color(Color(hex: track["c"] as? String ?? "FFFFFF", opacity: Double(num(track, "a", 0.13)))), lineWidth: th)
                var arc = Path()
                arc.addArc(center: center, radius: r, startAngle: .degrees(-90), endAngle: .degrees(-90 + 360 * p), clockwise: false)
                ctx.stroke(arc, with: .color(Color(hex: op["color"] as? String ?? "FFFFFF")), style: StrokeStyle(lineWidth: th, lineCap: .butt))
            case "edge":
                guard let p = progress[op["p"] as? String ?? ""] else { continue }
                let th = num(op, "th") * s
                let path = Self.edgePath(size, radius: Self.corner, inset: th / 2)
                let track = op["track"] as? [String: Any] ?? [:]
                ctx.stroke(path, with: .color(Color(hex: track["c"] as? String ?? "FFFFFF", opacity: Double(num(track, "a", 0.13)))), lineWidth: th)
                for piece in Self.progressPieces(of: path, in: size, CGFloat(p)) {
                    ctx.stroke(piece, with: .color(Color(hex: op["color"] as? String ?? "FFFFFF")), style: StrokeStyle(lineWidth: th, lineCap: .butt))
                }
            case "rule":
                let n = Int(num(op, "w") / 7.1)
                let color = Color(hex: op["color"] as? String ?? "FFFFFF", opacity: Double(num(op, "a", 0.35)))
                for i in 0..<max(0, n) {
                    ctx.fill(Path(CGRect(x: (num(op, "x") + CGFloat(i) * 7.1) * sx, y: (num(op, "y") + (follow ? shift : 0)) * sy, width: 3 * s, height: 1.5 * s)), with: .color(color))
                }
            case "coin":
                drawCoin(&ctx, center: CGPoint(x: num(op, "cx") * sx, y: num(op, "cy") * sy), d: num(op, "d") * s)
            default:
                continue
            }
        }
    }

    // Draws a text op moved down by `shift` layout points; gives the number of lines drawn
    @discardableResult
    private func drawText(_ ctx: inout GraphicsContext, _ op: [String: Any], sx: CGFloat, sy: CGFloat, s: CGFloat, shift: CGFloat = 0) -> Int {
        guard let text = Self.fill(op["s"] as? String ?? "", values), !text.isEmpty else { return 0 }
        let color = Color(hex: op["color"] as? String ?? "FFFFFF", opacity: Double(num(op, "a", 1)))
        let spacing = num(op, "spacing") / 100
        var size = num(op, "size", 12) * s
        let base = ctx // a copy for measuring, so nothing below holds on to the inout context
        func resolved(_ t: String, _ sz: CGFloat) -> GraphicsContext.ResolvedText {
            base.resolve(Text(t).font(font(op, sz)).tracking(spacing * sz).foregroundColor(color))
        }
        func width(_ t: String) -> CGFloat {
            resolved(t, size).measure(in: CGSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)).width
        }
        let max = num(op, "maxW") * sx
        let fit = (op["fit"] as? Bool) == true
        if fit && max > 0 {
            let w = width(text)
            if w > max { size = Swift.max(size * 0.4, size * max / w) }
        }
        let opY = num(op, "y") + shift
        let designLine = num(op, "line", num(op, "size", 12) * 1.2)
        var most = Int(num(op, "lines", 1))
        // "until": no line may end below this, however far it was pushed down
        if op["until"] != nil { most = Swift.max(1, Swift.min(most, Int(((num(op, "until") - opY) / designLine).rounded(.down)))) }
        let lines = fit ? [text] : Self.wrap(text, max: max, lines: most, measure: width)
        let lineHeight = num(op, "line", num(op, "size", 12) * 1.2) * s * (size / (num(op, "size", 12) * s))
        let align = op["align"] as? String ?? "left"
        let x = num(op, "x") * sx
        for (i, line) in lines.enumerated() {
            let r = resolved(line, size)
            let measured = r.measure(in: CGSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude))
            let baseline = opY * sy + CGFloat(i) * lineHeight + (lineHeight - size) / 2 + size * 0.8
            let top = baseline - r.firstBaseline(in: measured)
            let left = align == "center" ? x - measured.width / 2 : align == "right" ? x - measured.width : x
            ctx.draw(r, in: CGRect(x: left, y: top, width: measured.width + 1, height: measured.height))
        }
        return lines.count
    }

    private func drawCoin(_ ctx: inout GraphicsContext, center: CGPoint, d: CGFloat) {
        let rect = CGRect(x: center.x - d / 2, y: center.y - d / 2, width: d, height: d)
        if let chip {
            let image = ctx.resolve(Image(uiImage: chip))
            ctx.drawLayer { layer in
                layer.addFilter(.shadow(color: .black.opacity(0.45), radius: d * 0.05, x: 0, y: d * 0.06))
                layer.addFilter(.brightness(-0.38))
                layer.draw(image, in: rect.offsetBy(dx: 0, dy: d * 0.03))
            }
            ctx.draw(image, in: rect)
            return
        }
        // the widget gallery's preview: a plain brass coin
        ctx.fill(Path(ellipseIn: rect.offsetBy(dx: 0, dy: d * 0.04)), with: .color(Color(hex: "634B20")))
        ctx.fill(Path(ellipseIn: rect), with: .linearGradient(Gradient(colors: [Color(hex: "EDCC78"), Color(hex: "9E7833")]),
                                                             startPoint: CGPoint(x: rect.minX, y: rect.minY), endPoint: CGPoint(x: rect.maxX, y: rect.maxY)))
        ctx.stroke(Path(ellipseIn: rect.insetBy(dx: d * 0.08, dy: d * 0.08)), with: .color(.white.opacity(0.35)), lineWidth: max(1, d * 0.02))
        let letter = ctx.resolve(Text("I").font(.system(size: d * 0.38, weight: .bold, design: .serif)).foregroundColor(Color(hex: "5C4214")))
        ctx.draw(letter, at: CGPoint(x: center.x, y: center.y + d * 0.02), anchor: .center)
    }
}

// A style's own background for the container (the corners iOS rounds), and its ink, from the layout
extension WidgetCanvas {
    static func baseColor(_ layout: [String: Any]?) -> Color {
        let first = (layout?["ops"] as? [[String: Any]])?.first { ($0["t"] as? String) == "rect" }
        guard let fill = first?["fill"] as? [String: Any] else { return Color(hex: "2B4F78") }
        if let c = fill["c"] as? String { return Color(hex: c) }
        return Color(hex: (fill["c"] as? [String])?.last ?? "2B4F78")
    }
}

// A widget drawn from its layout, filling the whole widget
struct LayoutWidget: View {
    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) var colorScheme
    let kind: String
    let values: [String: String]
    var progress: [String: Double] = [:]
    var chip: UIImage? = nil
    var message: String? = nil

    var body: some View {
        let style = Shared.style(kind, family).layoutKey(colorScheme)
        let layout = Layouts.layout(style, kind, family.styleKey)
        Group {
            if let message {
                MessageCard(style: style, layout: layout, text: message, icon: kind == "chip" ? "star.circle" : kind == "reflection" ? "book" : "calendar")
            } else if let layout {
                WidgetCanvas(style: style, layout: layout, values: values, progress: progress, chip: chip)
            } else {
                MessageCard(style: style, layout: nil, text: "Open RecoveryBot to finish setting up this widget.")
            }
        }
        .containerBackground(for: .widget) { WidgetCanvas.baseColor(layout) }
    }
}

// Signed out, no date yet, nothing to show: a short note on the style's background
struct MessageCard: View {
    let style: String
    let layout: [String: Any]?
    let text: String
    var icon = "calendar"

    var body: some View {
        let ink = Color(hex: Layouts.look(style)["ink"] as? String ?? "FFFFFF")
        ZStack(alignment: .topLeading) {
            if let layout {
                // only the background of the layout
                WidgetCanvas(style: style, layout: ["w": layout["w"] ?? 170, "h": layout["h"] ?? 170,
                                                    "ops": Array(((layout["ops"] as? [[String: Any]]) ?? []).prefix { ($0["t"] as? String) == "rect" })],
                             values: [:])
            }
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: icon).font(.title2).foregroundStyle(ink).opacity(0.9)
                Spacer(minLength: 0)
                Text(text).font(.system(.footnote, design: .rounded).weight(.semibold)).foregroundStyle(ink)
            }
            .padding(16)
        }
    }
}

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
        completion(context.isPreview && !Shared.signedIn ? DayEntry(date: Date(), state: .counting(.sample)) : entry(at: Date()))
    }

    // Now, then each midnight for a week (the app asks for a new one whenever it opens)
    func getTimeline(in context: Context, completion: @escaping (Timeline<DayEntry>) -> Void) {
        completion(Timeline(entries: midnights().map(entry(at:)), policy: .atEnd))
    }

    private func entry(at date: Date) -> DayEntry {
        guard Shared.signedIn else { return DayEntry(date: date, state: .signedOut) }
        guard var count = DayCount.from(Shared.soberSince, on: date) else { return DayEntry(date: date, state: .noDate) }
        count.fact = FactLine.pick(Shared.funFacts(), days: count.days)
        return DayEntry(date: date, state: .counting(count))
    }
}

// Now and each of the next seven midnights
func midnights() -> [Date] {
    let cal = Calendar.current
    var dates = [Date()]
    var day = cal.startOfDay(for: Date())
    for _ in 0..<7 {
        guard let next = cal.date(byAdding: .day, value: 1, to: day) else { break }
        day = next
        dates.append(day)
    }
    return dates
}

struct DayCountView: View {
    @Environment(\.widgetFamily) var family
    let entry: DayEntry

    var body: some View {
        switch family {
        case .accessoryInline, .accessoryCircular, .accessoryRectangular:
            lockScreen.widgetURL(Shared.todayPanel).containerBackground(for: .widget) { Color.clear }
        default:
            home.widgetURL(Shared.todayPanel)
        }
    }

    @ViewBuilder var home: some View {
        switch entry.state {
        case .signedOut: LayoutWidget(kind: "day", values: [:], message: "Sign in to RecoveryBot to see your day count.")
        case .noDate: LayoutWidget(kind: "day", values: [:], message: "Add your sobriety date in RecoveryBot to start your count.")
        case .counting(let count): counted(count)
        }
    }

    func counted(_ count: DayCount) -> LayoutWidget {
        let (values, progress) = WidgetValues.day(count)
        return LayoutWidget(kind: "day", values: values, progress: progress.map { ["progress": $0] } ?? [:])
    }

    func nextLine(_ c: DayCount) -> String? {
        if let today = c.today { return "Today: \(today)" }
        guard let next = c.next else { return nil }
        return "\(next) in \(c.nextIn) \(plural(c.nextIn, "day", "days"))"
    }

    var signedOutShort: String {
        if case .signedOut = entry.state { return "Sign in" }
        return "Add date"
    }

    // The Lock Screen takes the system's look
    @ViewBuilder var lockScreen: some View {
        switch entry.state {
        case .signedOut, .noDate:
            let short = signedOutShort
            switch family {
            case .accessoryInline: Text("RecoveryBot: \(short)")
            case .accessoryCircular:
                ZStack {
                    AccessoryWidgetBackground()
                    Image(systemName: "calendar").font(.title3)
                }
            default:
                VStack(alignment: .leading) {
                    Text("Day count").font(.headline)
                    Text(short).font(.caption).lineLimit(2)
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
        case .counting(let c):
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
            default:
                VStack(alignment: .leading, spacing: 1) {
                    Text("\(c.days) \(unit)").font(.system(.headline, design: .rounded))
                    if let line = nextLine(c) { Text(line).font(.caption) }
                    if c.next != nil && c.today == nil { ProgressView(value: c.progress) }
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
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
        .contentMarginsDisabled()
    }
}

// MARK: - Favorite chip widget

struct ChipEntry: TimelineEntry {
    let date: Date
    let signedIn: Bool
    let image: UIImage?
    let label: String
    let on: String
    var count: DayCount? = nil
    var sample = false
}

struct ChipProvider: TimelineProvider {
    static let sample = ChipEntry(date: Date(), signedIn: true, image: nil, label: "1 year", on: "", count: .sample, sample: true)

    func placeholder(in context: Context) -> ChipEntry { Self.sample }

    func getSnapshot(in context: Context, completion: @escaping (ChipEntry) -> Void) {
        let now = entry(at: Date())
        completion(context.isPreview && now.image == nil ? Self.sample : now)
    }

    // The chip only changes when the app hands it a new one (which asks for a new timeline), but
    // its line about the next chip moves along each midnight
    func getTimeline(in context: Context, completion: @escaping (Timeline<ChipEntry>) -> Void) {
        completion(Timeline(entries: midnights().map(entry(at:)), policy: .atEnd))
    }

    private func entry(at date: Date) -> ChipEntry {
        let signedIn = Shared.signedIn
        return ChipEntry(date: date, signedIn: signedIn, image: signedIn ? Shared.chipImage() : nil, label: Shared.chipLabel, on: Shared.chipOn,
                         count: signedIn ? DayCount.from(Shared.soberSince, on: date) : nil)
    }
}

struct ChipView: View {
    let entry: ChipEntry

    var body: some View {
        content.widgetURL(entry.image == nil ? Shared.chipsPage : Shared.chipLink)
    }

    @ViewBuilder var content: some View {
        if !entry.signedIn && !entry.sample {
            LayoutWidget(kind: "chip", values: [:], message: "Sign in to RecoveryBot to show your chip here.")
        } else if entry.image == nil && !entry.sample {
            LayoutWidget(kind: "chip", values: [:], message: "Star a chip on your Chips page to show it here.")
        } else {
            shown
        }
    }

    var shown: LayoutWidget {
        let (dayValues, progress) = entry.count.map { WidgetValues.day($0) } ?? ([:], nil)
        let values = dayValues.merging(WidgetValues.chip(label: entry.label, on: entry.on)) { _, chip in chip }
        return LayoutWidget(kind: "chip", values: values, progress: progress.map { ["progress": $0] } ?? [:], chip: entry.image)
    }
}

struct ChipWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "FavoriteChip", provider: ChipProvider()) { entry in
            ChipView(entry: entry)
        }
        .configurationDisplayName("Favorite chip")
        .description("The first chip you starred on your Chips page, and how far it is to your next. Pick its style in RecoveryBot's settings, under Widgets.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

// MARK: - Daily Reflection widget

struct ReflectionEntry: TimelineEntry {
    let date: Date
    let signedIn: Bool
    let reflection: Reflection?
}

struct ReflectionProvider: TimelineProvider {
    func placeholder(in context: Context) -> ReflectionEntry { ReflectionEntry(date: Date(), signedIn: true, reflection: .sample) }

    func getSnapshot(in context: Context, completion: @escaping (ReflectionEntry) -> Void) {
        let now = entry(at: Date())
        completion(context.isPreview && now.reflection == nil ? placeholder(in: context) : now)
    }

    // Each midnight for a week: the site sends two weeks of readings whenever the app opens
    func getTimeline(in context: Context, completion: @escaping (Timeline<ReflectionEntry>) -> Void) {
        completion(Timeline(entries: midnights().map(entry(at:)), policy: .atEnd))
    }

    private func entry(at date: Date) -> ReflectionEntry {
        let today = Reflection.isoDay(date)
        let reflection = Shared.signedIn ? Shared.reflections().first { $0.date == today } : nil
        return ReflectionEntry(date: date, signedIn: Shared.signedIn, reflection: reflection)
    }
}

struct ReflectionView: View {
    let entry: ReflectionEntry

    var body: some View {
        if let r = entry.reflection {
            reading(r).widgetURL(r.link)
        } else {
            LayoutWidget(kind: "reflection", values: [:], message: entry.signedIn
                         ? "Open RecoveryBot to bring in today's Daily Reflection."
                         : "Sign in to RecoveryBot to see today's Daily Reflection.")
                .widgetURL(Shared.library)
        }
    }
}

extension ReflectionView {
    func reading(_ r: Reflection) -> LayoutWidget {
        let (values, year) = WidgetValues.reflection(r, on: entry.date)
        return LayoutWidget(kind: "reflection", values: values, progress: ["year": year])
    }
}

struct ReflectionWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "DailyReflection", provider: ReflectionProvider()) { entry in
            ReflectionView(entry: entry)
        }
        .configurationDisplayName("Daily Reflection")
        .description("Today's Daily Reflection: its title and the quote it opens with. Tap it to read the whole page. Pick its style in RecoveryBot's settings, under Widgets.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

@main
struct RecoveryBotWidgets: WidgetBundle {
    var body: some Widget {
        DayCountWidget()
        ChipWidget()
        ReflectionWidget()
    }
}
