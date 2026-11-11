import UIKit
import Capacitor

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
