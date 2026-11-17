import UIKit
import Capacitor
import WidgetKit
import AuthenticationServices
import CryptoKit
import WebKit
import LocalAuthentication

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }

    // Notifications (@capacitor-firebase/messaging): Apple's device token and the messages that
    // arrive go on to the plugin, which hands the token to Firebase
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any],
                     fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        NotificationCenter.default.post(name: Notification.Name("didReceiveRemoteNotification"), object: completionHandler, userInfo: userInfo)
    }
}

// MARK: - The app's own screen and plugins
// Kept in this file so the Xcode project needs no new file entries.

// The app's one screen: the web view sits below the status bar, and the strip behind the status
// bar takes the page's theme-color (the top bar's color, set by the site), so pages never show
// through behind the clock. The web view's height is left alone once set, since the Keyboard
// plugin shrinks it while the keyboard is up.
class AppShellViewController: UIViewController {
    let main = MainViewController()
    private var themeObservation: NSKeyValueObservation?

    // The app's own light or dark ground, following Light/Dark Mode (the offline page's colors).
    // Behind the clock and under the page (the home indicator's strip) until a page says otherwise.
    static let ground = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0x29 / 255, green: 0x25 / 255, blue: 0x24 / 255, alpha: 1)
            : UIColor(red: 0xf5 / 255, green: 0xf5 / 255, blue: 0xf4 / 255, alpha: 1)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Self.ground
        addChild(main)
        main.view.frame = view.bounds
        view.addSubview(main.view)
        main.didMove(toParent: self)
        AppLock.shared.attach(to: self)
        if let webView = main.webView {
            // The web view's own ground shows below the page, in the home indicator's strip: it was
            // always the light gray, a white bar under dark pages
            webView.isOpaque = false
            webView.backgroundColor = Self.ground
            webView.scrollView.backgroundColor = Self.ground
            main.view.backgroundColor = Self.ground
            // A page's theme-color (the site's top bar) colors the strip behind the clock and the
            // ground under the page; a page without one (the offline page) gets the app's own
            themeObservation = webView.observe(\.themeColor, options: [.initial, .new]) { [weak self] webView, _ in
                DispatchQueue.main.async {
                    let color = webView.themeColor ?? Self.ground
                    self?.view.backgroundColor = color
                    webView.backgroundColor = color
                    webView.scrollView.backgroundColor = color
                    self?.main.view.backgroundColor = color
                }
            }
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let top = view.safeAreaInsets.top
        let frame = main.view.frame
        if frame.origin.y != top || frame.width != view.bounds.width {
            main.view.frame = CGRect(x: 0, y: top, width: view.bounds.width, height: view.bounds.height - top)
        }
    }

    override var childForStatusBarStyle: UIViewController? { main }
    override var childForStatusBarHidden: UIViewController? { main }
}

// The web view that shows recoverybot.hmblbot.com, with the app's own plugins added
class MainViewController: CAPBridgeViewController {
    private var serverErrorGuard: ServerErrorGuard?

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PrinterPlugin())
        bridge?.registerPluginInstance(AppClipboardPlugin())
        bridge?.registerPluginInstance(WidgetBridgePlugin())
        bridge?.registerPluginInstance(NativeAuthPlugin())
        bridge?.registerPluginInstance(AppLockPlugin())
        AppLock.shared.webView = webView
        AppLock.shared.serverURL = bridge?.config.serverURL
        let curtainPlugin = PageCurtainPlugin()
        bridge?.registerPluginInstance(curtainPlugin)
        // Runs before the first page loads, so even the first one is covered
        if let webView, let inner = webView.navigationDelegate as? (NSObject & WKNavigationDelegate) {
            let guardDelegate = ServerErrorGuard(inner: inner, errorURL: bridge?.config.errorPathURL)
            guardDelegate.curtain = curtain
            serverErrorGuard = guardDelegate
            webView.navigationDelegate = guardDelegate
        }
        curtainPlugin.curtain = curtain
    }
    private let curtain = PageCurtain()

    // Status bar style changes (StatusBar plugin) reach the screen through AppShellViewController
    override open func setStatusBarStyle(_ statusBarStyle: UIStatusBarStyle) {
        super.setStatusBarStyle(statusBarStyle)
        parent?.setNeedsStatusBarAppearanceUpdate()
    }
}

// Moving between pages in the app. A web view clears the screen as each page starts and then
// draws it in pieces (blank, then skeletons, then the page), which is what makes a site feel like
// a site. So as a page starts loading, a picture of the one they're leaving is laid over the web
// view, and once the new page says it has drawn (PageCurtainPlugin, from native_app.js) the
// picture fades away to show it. Pages that never say so are shown after a few seconds anyway.
// The first page of a run has the site's own loading screen instead.
final class PageCurtain {
    private var cover: UIView?
    private var isCommitted = false
    private var giveUp: DispatchWorkItem?
    // Only once the site has said "ready" (a site from before this would never say it, and every
    // page would sit behind the picture until the time runs out)
    private var siteSaysReady = false

    func drop(over webView: WKWebView) {
        guard siteSaysReady, cover == nil, webView.url?.scheme?.hasPrefix("http") == true, let host = webView.superview,
              let picture = webView.snapshotView(afterScreenUpdates: false) else { return }
        picture.frame = webView.frame
        picture.isUserInteractionEnabled = true // taps on the old page do nothing while the new one loads
        host.insertSubview(picture, aboveSubview: webView)
        cover = picture
        isCommitted = false
        wait(8) // a slow connection: the page comes through as it is
    }

    // The new page has replaced the old one in the web view; from here its "ready" counts
    func committed() {
        guard cover != nil else { return }
        isCommitted = true
        wait(3)
    }

    func ready() {
        siteSaysReady = true
        guard isCommitted else { return }
        lift(animated: true)
    }

    func lift(animated: Bool) {
        giveUp?.cancel()
        guard let picture = cover else { return }
        cover = nil
        guard animated, !UIAccessibility.isReduceMotionEnabled else {
            picture.removeFromSuperview()
            return
        }
        UIView.animate(withDuration: 0.22, delay: 0, options: [.curveEaseOut, .allowUserInteraction], animations: {
            picture.alpha = 0
        }, completion: { _ in picture.removeFromSuperview() })
    }

    private func wait(_ seconds: Double) {
        giveUp?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.lift(animated: true) }
        giveUp = work
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: work)
    }
}

// The page saying it has drawn (native_app.js, installPageReady)
@objc(PageCurtainPlugin)
public class PageCurtainPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PageCurtainPlugin"
    public let jsName = "PageCurtain"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "ready", returnType: CAPPluginReturnPromise)
    ]
    weak var curtain: PageCurtain?

    @objc func ready(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.curtain?.ready() }
        call.resolve()
    }
}

// While the server restarts (a deploy), nginx answers with its own "502 Error" page. WebKit
// counts that as a page that loaded, so Capacitor would show it. This sits in front of
// Capacitor's navigation delegate (passing everything else through) and sends a server error on
// a whole page to the app's offline page instead (www/offline.html?reason=server), which says
// RecoveryBot is updating and tries again by itself.
final class ServerErrorGuard: NSObject, WKNavigationDelegate {
    private let inner: NSObject & WKNavigationDelegate
    private let errorURL: URL?
    private var redirectedAt: Date?

    init(inner: NSObject & WKNavigationDelegate, errorURL: URL?) {
        self.inner = inner
        self.errorURL = errorURL
    }

    override func responds(to aSelector: Selector!) -> Bool {
        super.responds(to: aSelector) || inner.responds(to: aSelector)
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        inner.responds(to: aSelector) ? inner : nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        guard navigationResponse.isForMainFrame,
              let http = navigationResponse.response as? HTTPURLResponse, (500...599).contains(http.statusCode),
              let errorURL, var parts = URLComponents(url: errorURL, resolvingAgainstBaseURL: false)
        else {
            decisionHandler(.allow)
            return
        }
        parts.queryItems = [URLQueryItem(name: "reason", value: "server"), URLQueryItem(name: "from", value: http.url?.absoluteString)]
        redirectedAt = Date()
        decisionHandler(.cancel)
        if let url = parts.url { webView.load(URLRequest(url: url)) }
    }

    // Cancelling that page is itself reported as a failed load, which would have Capacitor load
    // the plain offline page over ours; that one report is dropped
    // swiftlint:disable:next implicitly_unwrapped_optional
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        curtain?.lift(animated: false)
        if let at = redirectedAt, Date().timeIntervalSince(at) < 3 {
            redirectedAt = nil
            return
        }
        showOffline(webView, error)
    }

    // A page that couldn't be reached (no signal, or the server restarting): the offline page,
    // told which page it was (?from=) so "Try again" and its own retries go back there. Capacitor
    // would open it without that, and the page can't find the site's address by itself (inside
    // the app, Capacitor's getServerUrl() is the app's own local address, not the site).
    private func showOffline(_ webView: WKWebView, _ error: Error) {
        let nsError = error as NSError
        // Not failures: another page took over (a quick second tap), or the load turned into a
        // download or an outside link
        if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled { return }
        if nsError.domain == "WebKitErrorDomain" && nsError.code == 102 { return }
        guard let errorURL, var parts = URLComponents(url: errorURL, resolvingAgainstBaseURL: false) else { return }
        let failed = (nsError.userInfo[NSURLErrorFailingURLStringErrorKey] as? String)
            ?? (nsError.userInfo[NSURLErrorFailingURLErrorKey] as? URL)?.absoluteString
            ?? startedURL?.absoluteString
        if let failed, failed.hasPrefix("http") { parts.queryItems = [URLQueryItem(name: "from", value: failed)] }
        if let url = parts.url { webView.load(URLRequest(url: url)) }
    }

    // Moving between pages (PageCurtain): a picture of the page they were on stays up until the
    // new one has drawn
    weak var curtain: PageCurtain?
    private var startedURL: URL?

    // swiftlint:disable:next implicitly_unwrapped_optional
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        startedURL = webView.url // the page being opened, for the offline page if it can't be reached
        curtain?.drop(over: webView)
        inner.webView?(webView, didStartProvisionalNavigation: navigation)
    }

    // swiftlint:disable:next implicitly_unwrapped_optional
    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        curtain?.committed()
        inner.webView?(webView, didCommit: navigation)
    }

    // swiftlint:disable:next implicitly_unwrapped_optional
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        curtain?.lift(animated: false)
        inner.webView?(webView, didFail: navigation, withError: error)
    }
}

// Copy buttons: the web clipboard (navigator.clipboard) doesn't reliably write from an iPhone web
// view, so the site calls this instead (entrypoints/native_app.js). Keeps formatting (HTML) when
// it's given, for pasting into Zoom chat or notes, with plain text beside it.
@objc(AppClipboardPlugin)
public class AppClipboardPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppClipboardPlugin"
    public let jsName = "AppClipboard"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise)
    ]

    @objc func write(_ call: CAPPluginCall) {
        let text = call.getString("text") ?? ""
        let html = call.getString("html")
        DispatchQueue.main.async {
            var item: [String: Any] = ["public.utf8-plain-text": text]
            if let html = html, !html.isEmpty { item["public.html"] = html }
            UIPasteboard.general.setItems([item], options: [:])
            call.resolve()
        }
    }
}

// window.print() does nothing in an iPhone web view, so the site calls this instead
// (entrypoints/native_app.js): the iOS print sheet for the page as it prints (its print styles)
@objc(PrinterPlugin)
public class PrinterPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PrinterPlugin"
    public let jsName = "Printer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "print", returnType: CAPPluginReturnPromise)
    ]

    @objc func print(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let webView = self.bridge?.webView else {
                call.reject("There's no page to print")
                return
            }
            let info = UIPrintInfo(dictionary: nil)
            info.outputType = .general
            info.jobName = call.getString("title") ?? webView.title ?? "RecoveryBot"
            let controller = UIPrintInteractionController.shared
            controller.printInfo = info
            controller.printFormatter = webView.viewPrintFormatter()
            controller.present(animated: true) { _, completed, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                } else {
                    call.resolve(["printed": completed])
                }
            }
        }
    }
}

// The Home Screen and Lock Screen widgets (RecoveryBotWidgets): the site hands them what they
// show (lib/appWidgets.js), and this keeps it in the App Group both share, then has them redraw.
// soberSince "YYYY-MM-DD" (the widget counts the days itself), the chip and its back as PNGs,
// its name and the day it was earned, and two weeks of Daily Reflections.
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "widgetStyle", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setWidgetStyle", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "placedWidgets", returnType: CAPPluginReturnPromise)
    ]
    static let group = "group.com.hmblbot.recoverybot"
    // The widgets' styles (WidgetStyle in RecoveryBotWidgets.swift, lib/widgetStyles.js on the site)
    static let styles = ["classic", "night", "ocean", "forest", "sunrise", "midnight", "black", "light", "paper", "paperLight", "paperDark"]

    private func shared() -> (UserDefaults, URL)? {
        guard let defaults = UserDefaults(suiteName: Self.group),
              let folder = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Self.group) else { return nil }
        return (defaults, folder.appendingPathComponent("chip.png"))
    }

    @objc func update(_ call: CAPPluginCall) {
        guard let (defaults, chipFile) = shared() else {
            call.reject("This build of the app has no widgets")
            return
        }
        defaults.set(true, forKey: "signedIn")
        defaults.set(call.getString("soberSince") ?? "", forKey: "soberSince")
        defaults.set(call.getString("chipLabel") ?? "", forKey: "chipLabel")
        defaults.set(call.getString("chipId") ?? "", forKey: "chipId")
        defaults.set(call.getString("chipOn") ?? "", forKey: "chipOn")
        // Two weeks of Daily Reflections (JSON, Api::WidgetReflectionsController); older sites send none
        if let reflections = call.getString("reflections") { defaults.set(reflections, forKey: "reflections") }
        // The fun day-count facts still ahead (JSON, lib/appWidgets.js); a site from before them sends none
        if let facts = call.getString("funFacts") { defaults.set(facts, forKey: "funFacts") }
        let backFile = chipFile.deletingLastPathComponent().appendingPathComponent("chip-back.png")
        if let base64 = call.getString("chipImage"), !base64.isEmpty, let data = Data(base64Encoded: base64) {
            try? data.write(to: chipFile, options: .atomic)
            defaults.set(true, forKey: "hasChip")
        } else {
            try? FileManager.default.removeItem(at: chipFile)
            defaults.set(false, forKey: "hasChip")
        }
        if let base64 = call.getString("chipBackImage"), !base64.isEmpty, let data = Data(base64Encoded: base64) {
            try? data.write(to: backFile, options: .atomic)
        } else {
            try? FileManager.default.removeItem(at: backFile)
        }
        // A new chip starts face up
        if defaults.string(forKey: "chipId") != defaults.string(forKey: "chipShownId") {
            defaults.set(false, forKey: "chipFlipped")
            defaults.set(defaults.string(forKey: "chipId"), forKey: "chipShownId")
        }
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    // The styles picked in the app (This phone > Widgets), which the widgets draw in
    // (Shared.style in RecoveryBotWidgets.swift): "widgetStyle" for every widget, and
    // "widgetStyle.day" / "widgetStyle.chip" for a kind (kept by app builds before per-widget
    // picks; this build only clears them). They belong to the phone, so signing out keeps them.
    // "day" and "chip" answer "" while they follow the one for every widget.
    @objc func widgetStyle(_ call: CAPPluginCall) {
        let defaults = UserDefaults(suiteName: Self.group)
        func known(_ key: String) -> String? { defaults?.string(forKey: key).flatMap { Self.styles.contains($0) ? $0 : nil } }
        call.resolve(["style": known("widgetStyle") ?? "classic", "day": known("widgetStyle.day") ?? "", "chip": known("widgetStyle.chip") ?? ""])
    }

    // The sizes a placed widget's style is kept by: the system tells the app which kind and size
    // each placed widget is, not which one it is, so two small day counts share a style
    static let sizes = ["small", "medium", "large"]
    static let placedKeys = ["day", "chip", "reflection"].flatMap { kind in sizes.map { "\(kind).\($0)" } }

    // { style } sets the one for every widget and drops all the others; { style, widget: "day" |
    // "chip" } a kind's own (older pages); { style, widget: "day.small" } the placed widgets of
    // that kind and size, and with style "" they go back to the one for every widget
    @objc func setWidgetStyle(_ call: CAPPluginCall) {
        let style = call.getString("style") ?? ""
        let widget = call.getString("widget") ?? ""
        let placed = Self.placedKeys.contains(widget)
        guard Self.styles.contains(style) || (placed && style.isEmpty) else {
            call.reject("Unknown widget style")
            return
        }
        guard let defaults = UserDefaults(suiteName: Self.group) else {
            call.reject("This build of the app has no widgets")
            return
        }
        switch widget {
        case _ where placed:
            if style.isEmpty { defaults.removeObject(forKey: "widgetStyle.\(widget)") } else { defaults.set(style, forKey: "widgetStyle.\(widget)") }
        case "day", "chip":
            defaults.set(style, forKey: "widgetStyle.\(widget)")
        case "", "both", "all":
            defaults.set(style, forKey: "widgetStyle")
            (["day", "chip"] + Self.placedKeys).forEach { defaults.removeObject(forKey: "widgetStyle.\($0)") }
        default:
            call.reject("Unknown widget")
            return
        }
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve(["style": style])
    }

    // The widgets on their Home Screen, one entry for each kind and size (Lock Screen widgets
    // take the system's look, so they're left out), with the style each has of its own ("" while
    // it follows the one for every widget): { widgets: [{ id: "day.small", kind: "day",
    // size: "small", style: "" }] }
    @objc func placedWidgets(_ call: CAPPluginCall) {
        let defaults = UserDefaults(suiteName: Self.group)
        WidgetCenter.shared.getCurrentConfigurations { result in
            var seen = Set<String>()
            var widgets: [[String: Any]] = []
            for info in (try? result.get()) ?? [] {
                let kind: String
                switch info.kind {
                case "DayCount": kind = "day"
                case "FavoriteChip": kind = "chip"
                case "DailyReflection": kind = "reflection"
                default: continue
                }
                let size: String
                switch info.family {
                case .systemSmall: size = "small"
                case .systemMedium: size = "medium"
                case .systemLarge, .systemExtraLarge: size = "large"
                default: continue
                }
                let id = "\(kind).\(size)"
                guard seen.insert(id).inserted else { continue }
                let own = defaults?.string(forKey: "widgetStyle.\(id)") ?? ""
                widgets.append(["id": id, "kind": kind, "size": size, "style": Self.styles.contains(own) ? own : ""])
            }
            // day count first, then small to large
            let order = Self.placedKeys
            widgets.sort { order.firstIndex(of: $0["id"] as! String)! < order.firstIndex(of: $1["id"] as! String)! }
            call.resolve(["widgets": widgets])
        }
    }

    @objc func clear(_ call: CAPPluginCall) {
        if let (defaults, chipFile) = shared() {
            ["signedIn", "soberSince", "chipLabel", "chipId", "chipOn", "hasChip", "chipFlipped", "chipShownId", "funFacts", "reflections"].forEach { defaults.removeObject(forKey: $0) }
            try? FileManager.default.removeItem(at: chipFile)
            try? FileManager.default.removeItem(at: chipFile.deletingLastPathComponent().appendingPathComponent("chip-back.png"))
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }
}

// The sign-in sheets (Users::NativeSignInsController on the site). The page passes a nonce from
// the server; each returns an ID token carrying it, which the page posts back to the server.
// - apple: Apple's own Sign in with Apple sheet (the token holds the nonce's SHA-256)
// - google: Google's sign-in page in the system's sign-in sheet (Google blocks it inside web
//   views), for our iOS OAuth client (clientId), with PKCE; the code it returns is traded for
//   the ID token right here, as Google's own iOS library does
@objc(NativeAuthPlugin)
public class NativeAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate,
                               ASAuthorizationControllerPresentationContextProviding, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "NativeAuthPlugin"
    public let jsName = "NativeAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "apple", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "google", returnType: CAPPluginReturnPromise)
    ]
    private var appleCall: CAPPluginCall?
    private var webSession: ASWebAuthenticationSession?

    private var anchor: ASPresentationAnchor { bridge?.webView?.window ?? ASPresentationAnchor() }
    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor { anchor }
    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor { anchor }

    private static func sha256(_ text: String) -> Data { Data(SHA256.hash(data: Data(text.utf8))) }
    private static func base64url(_ data: Data) -> String {
        data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
    private static func random() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return base64url(Data(bytes))
    }

    // MARK: Apple

    @objc func apple(_ call: CAPPluginCall) {
        guard let nonce = call.getString("nonce"), !nonce.isEmpty else {
            call.reject("No nonce")
            return
        }
        DispatchQueue.main.async {
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = Self.sha256(nonce).map { String(format: "%02x", $0) }.joined()
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.appleCall = call
            controller.performRequests()
        }
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        defer { appleCall = nil }
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let data = credential.identityToken, let token = String(data: data, encoding: .utf8) else {
            appleCall?.reject("Apple didn't send a sign-in")
            return
        }
        appleCall?.resolve([
            "idToken": token,
            // traded by the server for a refresh token, so deleting the account can revoke it
            "authorizationCode": credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) } ?? "",
            "givenName": credential.fullName?.givenName ?? "",
            "familyName": credential.fullName?.familyName ?? "",
            "email": credential.email ?? ""
        ])
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        if let code = (error as? ASAuthorizationError)?.code, code == .canceled {
            appleCall?.reject("Canceled")
        } else {
            appleCall?.reject(error.localizedDescription)
        }
        appleCall = nil
    }

    // MARK: Google

    @objc func google(_ call: CAPPluginCall) {
        guard let clientId = call.getString("clientId"), clientId.hasSuffix(".apps.googleusercontent.com"),
              let nonce = call.getString("nonce"), !nonce.isEmpty else {
            call.reject("Google sign-in isn't set up")
            return
        }
        // An iOS client's own return address: its ID, reversed
        let scheme = "com.googleusercontent.apps." + clientId.replacingOccurrences(of: ".apps.googleusercontent.com", with: "")
        let redirect = "\(scheme):/oauth2redirect"
        let verifier = Self.random()
        let state = Self.random()
        var url = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        url.queryItems = [
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "redirect_uri", value: redirect),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "openid email profile"),
            URLQueryItem(name: "code_challenge", value: Self.base64url(Self.sha256(verifier))),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "nonce", value: nonce),
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "prompt", value: "select_account")
        ]
        DispatchQueue.main.async {
            let session = ASWebAuthenticationSession(url: url.url!, callbackURLScheme: scheme) { [weak self] answer, error in
                self?.webSession = nil
                if let error {
                    let canceled = (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin
                    call.reject(canceled ? "Canceled" : error.localizedDescription)
                    return
                }
                let items = answer.flatMap { URLComponents(url: $0, resolvingAgainstBaseURL: false)?.queryItems } ?? []
                guard items.first(where: { $0.name == "state" })?.value == state,
                      let code = items.first(where: { $0.name == "code" })?.value else {
                    call.reject("Google didn't finish signing in")
                    return
                }
                Self.trade(code: code, clientId: clientId, redirect: redirect, verifier: verifier, call: call)
            }
            session.presentationContextProvider = self
            self.webSession = session
            if !session.start() { call.reject("Couldn't open Google's sign-in") }
        }
    }

    // The code for the ID token (an iOS client has no secret; the PKCE verifier proves it's us)
    private static func trade(code: String, clientId: String, redirect: String, verifier: String, call: CAPPluginCall) {
        var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-._~"))
        let form = ["code": code, "client_id": clientId, "redirect_uri": redirect, "code_verifier": verifier, "grant_type": "authorization_code"]
        request.httpBody = form.map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: allowed) ?? "")" }
            .joined(separator: "&").data(using: .utf8)
        URLSession.shared.dataTask(with: request) { data, _, error in
            guard error == nil, let data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let token = json["id_token"] as? String else {
                call.reject("Google's sign-in couldn't be finished")
                return
            }
            call.resolve(["idToken": token])
        }.resume()
    }
}

// MARK: - App lock (Face ID / Touch ID)

// Turned on in Account settings > This phone (AppLockSettings.jsx on the site). The app then
// covers itself whenever it goes to the background, and coming back (or opening it from cold)
// asks for Face ID or Touch ID, with the phone's passcode as the fallback, before the cover
// lifts. They stay signed in the whole time: nothing about their account is kept here, only
// "on", when to lock, and whether the site last said someone is signed in (a signed-out app
// has nothing to hide). Their face or fingerprint never leaves iOS: the app only hears yes or no.
// A cover that can't be unlocked offers "Sign out" (the site's own /users/sign_out), which turns
// the lock off. Android: AppLockPlugin.java.
final class AppLock {
    static let shared = AppLock()
    private let defaults = UserDefaults.standard

    var enabled: Bool {
        get { defaults.bool(forKey: "appLock.enabled") }
        set { defaults.set(newValue, forKey: "appLock.enabled") }
    }
    // Seconds away before it locks: 0 (right away), 60, 300 or 900
    var after: Double {
        get { defaults.double(forKey: "appLock.after") }
        set { defaults.set(newValue, forKey: "appLock.after") }
    }
    // What the site last said (native_app.js, on every page)
    var signedIn: Bool {
        get { defaults.bool(forKey: "appLock.signedIn") }
        set { defaults.set(newValue, forKey: "appLock.signedIn") }
    }
    var applies: Bool { enabled && signedIn }

    weak var webView: WKWebView?
    var serverURL: URL?
    private weak var host: UIViewController?
    private var cover: AppLockCover?
    private var locked = false
    private var asked = false // asked once by itself for this lock; after a cancel, the Unlock button asks
    private var authenticating = false
    private var leftAt: Date?
    private var loadingObservation: NSKeyValueObservation?

    func attach(to host: UIViewController) {
        self.host = host
        let center = NotificationCenter.default
        center.addObserver(forName: UIScene.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in self?.wentAway() }
        center.addObserver(forName: UIScene.willEnterForegroundNotification, object: nil, queue: .main) { [weak self] _ in self?.cameBack() }
        center.addObserver(forName: UIScene.didActivateNotification, object: nil, queue: .main) { [weak self] _ in self?.active() }
        // Opened from cold: covered before the first page can show
        if applies { lock() }
    }

    // MARK: What the phone can check with

    // "faceID", "touchID", "opticID", "biometric", "passcode" (no Face ID or Touch ID set up,
    // just the passcode) or "none" (no passcode either: nothing to lock with)
    static func kind() -> String {
        let context = LAContext()
        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) {
            switch context.biometryType {
            case .faceID: return "faceID"
            case .touchID: return "touchID"
            default:
                if #available(iOS 17.0, *), context.biometryType == .opticID { return "opticID" }
                return "biometric"
            }
        }
        return LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: nil) ? "passcode" : "none"
    }

    // Face ID or Touch ID, then the passcode if that fails. done(true) when it's them,
    // done(false, "Canceled") when they backed out, done(false, "Unavailable") with nothing to
    // check with.
    static func check(reason: String, done: @escaping (Bool, String?) -> Void) {
        let context = LAContext()
        context.localizedFallbackTitle = "Use Passcode"
        var problem: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &problem) else {
            done(false, "Unavailable")
            return
        }
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { ok, error in
            DispatchQueue.main.async {
                if ok { return done(true, nil) }
                let code = (error as? LAError)?.code
                switch code {
                case .passcodeNotSet, .biometryNotAvailable, .biometryNotEnrolled: done(false, "Unavailable")
                default: done(false, "Canceled")
                }
            }
        }
    }

    // MARK: Going away and coming back

    private func wentAway() {
        guard applies, !authenticating else { return }
        leftAt = Date()
        // Covered now, so the app switcher's picture of the app shows the cover, not the page
        showCover()
    }

    private func cameBack() {
        guard cover != nil, !locked else { return }
        let away = leftAt.map { Date().timeIntervalSince($0) } ?? .infinity
        if applies && away >= after { lock() } else { unlock() }
    }

    private func active() {
        guard locked, !asked, !authenticating else { return }
        asked = true
        ask()
    }

    private func lock() {
        locked = true
        asked = false
        showCover()
    }

    func ask() {
        guard locked, !authenticating else { return }
        authenticating = true
        Self.check(reason: "Unlock RecoveryBot") { [weak self] ok, problem in
            guard let self else { return }
            self.authenticating = false
            if ok {
                self.unlock()
            } else if problem == "Unavailable" {
                // The passcode was turned off since: there's nothing left to check with, and a
                // phone without one is open to anyone anyway
                self.enabled = false
                self.unlock()
            }
        }
    }

    private func unlock() {
        locked = false
        leftAt = nil
        guard let view = cover else { return }
        cover = nil
        UIView.animate(withDuration: UIAccessibility.isReduceMotionEnabled ? 0 : 0.2, animations: { view.alpha = 0 }, completion: { _ in view.removeFromSuperview() })
    }

    // The lock's own way out: sign out on the site (which turns the lock off), and lift the cover
    // once the signed-out page has loaded
    func signOut() {
        enabled = false
        signedIn = false
        cover?.showWorking()
        let base = serverURL ?? URL(string: "https://recoverybot.hmblbot.com")!
        guard let webView else { return unlock() }
        webView.load(URLRequest(url: base.appendingPathComponent("users/sign_out")))
        var started = false
        loadingObservation = webView.observe(\.isLoading, options: [.new]) { [weak self] web, _ in
            DispatchQueue.main.async {
                if web.isLoading { started = true; return }
                guard started else { return }
                self?.loadingObservation = nil
                self?.unlock()
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
            guard self?.loadingObservation != nil else { return }
            self?.loadingObservation = nil
            self?.unlock()
        }
    }

    private func showCover() {
        guard cover == nil, let host else { return }
        let view = AppLockCover(kind: Self.kind())
        view.frame = host.view.bounds
        view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.onUnlock = { [weak self] in self?.ask() }
        view.onSignOut = { [weak self] in self?.signOut() }
        host.view.addSubview(view)
        cover = view
    }
}

// What shows while the app is locked: the app's own light or dark ground, a lock, and buttons to
// try again or sign out instead
final class AppLockCover: UIView {
    var onUnlock: (() -> Void)?
    var onSignOut: (() -> Void)?
    private let stack = UIStackView()
    private let unlockButton = UIButton(type: .system)
    private let signOutButton = UIButton(type: .system)

    init(kind: String) {
        super.init(frame: .zero)
        backgroundColor = AppShellViewController.ground
        let accent = UIColor(red: 0x4c / 255, green: 0x7b / 255, blue: 0xa6 / 255, alpha: 1)
        let (symbol, name): (String, String) = {
            switch kind {
            case "faceID": return ("faceid", "Face ID")
            case "touchID": return ("touchid", "Touch ID")
            case "opticID": return ("opticid", "Optic ID")
            default: return ("lock.fill", "Passcode")
            }
        }()
        let icon = UIImageView(image: UIImage(systemName: symbol, withConfiguration: UIImage.SymbolConfiguration(pointSize: 56, weight: .light)))
        icon.tintColor = accent
        let title = UILabel()
        title.text = "RecoveryBot is locked"
        title.font = UIFontMetrics(forTextStyle: .title2).scaledFont(for: .systemFont(ofSize: 22, weight: .semibold))
        title.textColor = .label
        title.adjustsFontForContentSizeCategory = true
        let note = UILabel()
        note.text = "You're still signed in. Unlock to pick up where you left off."
        note.font = .preferredFont(forTextStyle: .subheadline)
        note.textColor = .secondaryLabel
        note.numberOfLines = 0
        note.textAlignment = .center
        note.adjustsFontForContentSizeCategory = true

        var filled = UIButton.Configuration.filled()
        filled.title = "Unlock with \(name)"
        filled.baseBackgroundColor = accent
        filled.cornerStyle = .large
        filled.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 28, bottom: 12, trailing: 28)
        unlockButton.configuration = filled
        unlockButton.addAction(UIAction { [weak self] _ in self?.onUnlock?() }, for: .touchUpInside)

        var plain = UIButton.Configuration.plain()
        plain.title = "Sign out instead"
        plain.baseForegroundColor = .secondaryLabel
        signOutButton.configuration = plain
        signOutButton.addAction(UIAction { [weak self] _ in self?.onSignOut?() }, for: .touchUpInside)

        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 12
        [icon, title, note, unlockButton, signOutButton].forEach { stack.addArrangedSubview($0) }
        stack.setCustomSpacing(20, after: note)
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -32)
        ])
        accessibilityViewIsModal = true
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func showWorking() {
        unlockButton.isEnabled = false
        signOutButton.configuration?.title = "Signing out…"
        signOutButton.isEnabled = false
    }
}

// The site's side of the lock (lib/appLock.js): what the phone can check with, turning it on
// (only after Face ID / Touch ID says it's them) and off, when to lock, and whether someone is
// signed in
@objc(AppLockPlugin)
public class AppLockPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppLockPlugin"
    public let jsName = "AppLock"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setAfter", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signedIn", returnType: CAPPluginReturnPromise)
    ]
    private static let afters: [Double] = [0, 60, 300, 900]

    private func state() -> [String: Any] {
        let lock = AppLock.shared
        let kind = AppLock.kind()
        return ["available": kind != "none", "kind": kind, "enabled": lock.enabled, "after": Int(lock.after)]
    }

    @objc func status(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(self.state()) }
    }

    @objc func enable(_ call: CAPPluginCall) {
        let after = Double(call.getInt("after") ?? 0)
        DispatchQueue.main.async {
            AppLock.check(reason: "Turn on the app lock") { ok, problem in
                guard ok else { return call.reject(problem ?? "Canceled") }
                AppLock.shared.enabled = true
                AppLock.shared.signedIn = true
                if Self.afters.contains(after) { AppLock.shared.after = after }
                call.resolve(self.state())
            }
        }
    }

    @objc func disable(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            AppLock.shared.enabled = false
            call.resolve(self.state())
        }
    }

    @objc func setAfter(_ call: CAPPluginCall) {
        let after = Double(call.getInt("after") ?? -1)
        guard Self.afters.contains(after) else { return call.reject("Unknown time") }
        DispatchQueue.main.async {
            AppLock.shared.after = after
            call.resolve(self.state())
        }
    }

    @objc func signedIn(_ call: CAPPluginCall) {
        let signedIn = call.getBool("signedIn") ?? false
        DispatchQueue.main.async {
            AppLock.shared.signedIn = signedIn
            call.resolve()
        }
    }
}
