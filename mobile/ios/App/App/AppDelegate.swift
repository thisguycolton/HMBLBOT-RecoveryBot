import UIKit
import Capacitor
import WidgetKit
import AuthenticationServices
import CryptoKit

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

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0xf5 / 255, green: 0xf5 / 255, blue: 0xf4 / 255, alpha: 1)
        addChild(main)
        main.view.frame = view.bounds
        view.addSubview(main.view)
        main.didMove(toParent: self)
        if let webView = main.webView {
            themeObservation = webView.observe(\.themeColor, options: [.initial, .new]) { [weak self] webView, _ in
                DispatchQueue.main.async {
                    if let color = webView.themeColor { self?.view.backgroundColor = color }
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
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PrinterPlugin())
        bridge?.registerPluginInstance(AppClipboardPlugin())
        bridge?.registerPluginInstance(WidgetBridgePlugin())
        bridge?.registerPluginInstance(NativeAuthPlugin())
    }

    // Status bar style changes (StatusBar plugin) reach the screen through AppShellViewController
    override open func setStatusBarStyle(_ statusBarStyle: UIStatusBarStyle) {
        super.setStatusBarStyle(statusBarStyle)
        parent?.setNeedsStatusBarAppearanceUpdate()
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
// soberSince "YYYY-MM-DD" (the widget counts the days itself), the chip as a PNG, its name.
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]
    static let group = "group.com.hmblbot.recoverybot"

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
        if let base64 = call.getString("chipImage"), !base64.isEmpty, let data = Data(base64Encoded: base64) {
            try? data.write(to: chipFile, options: .atomic)
            defaults.set(true, forKey: "hasChip")
        } else {
            try? FileManager.default.removeItem(at: chipFile)
            defaults.set(false, forKey: "hasChip")
        }
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    @objc func clear(_ call: CAPPluginCall) {
        if let (defaults, chipFile) = shared() {
            ["signedIn", "soberSince", "chipLabel", "chipId", "hasChip"].forEach { defaults.removeObject(forKey: $0) }
            try? FileManager.default.removeItem(at: chipFile)
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
