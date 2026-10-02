import ExpoModulesCore
import WidgetKit

public class BuboWidgetsModule: Module {
  private var group: String {
    "group.\(Bundle.main.bundleIdentifier ?? "com.joaoaraujo.bubo").widgets"
  }

  public func definition() -> ModuleDefinition {
    Name("BuboWidgets")
    AsyncFunction("update") { (json: String, coverPath: String?) in
      guard let defaults = UserDefaults(suiteName: self.group),
            let directory = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: self.group)
      else { throw NSError(domain: "BuboWidgets", code: 1) }
      let destination = directory.appendingPathComponent("cover")
      try? FileManager.default.removeItem(at: destination)
      if let coverPath = coverPath {
        let source = coverPath.hasPrefix("file://") ? URL(string: coverPath) : URL(fileURLWithPath: coverPath)
        if let source = source { try? FileManager.default.copyItem(at: source, to: destination) }
      }
      defaults.set(json, forKey: "snapshot")
      WidgetCenter.shared.reloadAllTimelines()
    }
    AsyncFunction("clear") {
      UserDefaults(suiteName: self.group)?.removeObject(forKey: "snapshot")
      if let directory = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: self.group) {
        try? FileManager.default.removeItem(at: directory.appendingPathComponent("cover"))
      }
      WidgetCenter.shared.reloadAllTimelines()
    }
    AsyncFunction("requestPin") { (_: String) -> Bool in false }
  }
}
