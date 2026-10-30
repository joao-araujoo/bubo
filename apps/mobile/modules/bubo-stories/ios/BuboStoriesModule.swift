import ExpoModulesCore
import ImageIO
import Photos
import UIKit

public class BuboStoriesModule: Module {
  private var sharing = false

  public func definition() -> ModuleDefinition {
    Name("BuboStories")

    AsyncFunction("shareInstagram") { (uri: String, appId: String, promise: Promise) in
      guard appId.range(of: "^[0-9]{5,30}$", options: .regularExpression) != nil else {
        promise.resolve(self.result("unavailable", "app-id"))
        return
      }
      guard let image = self.image(uri), let data = try? Data(contentsOf: image) else {
        promise.resolve(self.result("error", "image"))
        return
      }
      DispatchQueue.main.async {
        guard let url = URL(string: "instagram-stories://share?source_application=\(appId)"),
              UIApplication.shared.canOpenURL(url) else {
          promise.resolve(self.result("unavailable", "instagram"))
          return
        }
        // Instagram consumes this PNG in its editor. Expire it and keep it off Universal Clipboard.
        UIPasteboard.general.setItems(
          [["com.instagram.sharedSticker.backgroundImage": data]],
          options: [.expirationDate: Date().addingTimeInterval(300), .localOnly: true]
        )
        UIApplication.shared.open(url, options: [:]) { opened in
          promise.resolve(self.result(opened ? "opened" : "unavailable", opened ? nil : "instagram"))
        }
      }
    }

    AsyncFunction("shareImage") { (uri: String, promise: Promise) in
      guard let source = self.image(uri), let image = self.preparedImage(source) else {
        promise.resolve(self.result("error", "image"))
        return
      }
      DispatchQueue.main.async {
        guard !self.sharing, let presenter = self.presenter(), !presenter.isBeingDismissed else {
          promise.resolve(self.result("unavailable", "busy"))
          return
        }
        self.sharing = true
        let sheet = UIActivityViewController(activityItems: [image], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = presenter.view
        sheet.popoverPresentationController?.sourceRect = CGRect(
          x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1
        )
        sheet.completionWithItemsHandler = { _, completed, _, error in
          self.sharing = false
          if error != nil {
            promise.resolve(self.result("error", "share"))
          } else {
            promise.resolve(self.result(completed ? "opened" : "cancelled"))
          }
        }
        presenter.present(sheet, animated: true)
      }
    }

    AsyncFunction("saveImage") { (uri: String, promise: Promise) in
      guard let source = self.image(uri), let image = self.preparedImage(source) else {
        promise.resolve(self.result("error", "image"))
        return
      }
      // Request add-only access at the explicit Save action, never access to existing photos.
      PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
        guard status == .authorized || status == .limited else {
          promise.resolve(self.result("unavailable", "permission"))
          return
        }
        PHPhotoLibrary.shared().performChanges({
          let request = PHAssetCreationRequest.forAsset()
          request.addResource(with: .photo, fileURL: image, options: nil)
        }) { success, _ in
          promise.resolve(self.result(success ? "saved" : "error", success ? nil : "share"))
        }
      }
    }
  }

  private func result(_ status: String, _ reason: String? = nil) -> [String: String] {
    if let reason = reason { return ["status": status, "reason": reason] }
    return ["status": status]
  }

  // Validate the physical path and PNG dimensions before any sharing or photo-library operation.
  private func image(_ uri: String) -> URL? {
    guard let input = URL(string: uri), input.isFileURL,
          input.host == nil || input.host == "", input.query == nil, input.fragment == nil else { return nil }
    let source = input.resolvingSymlinksInPath().standardizedFileURL
    let roots = [FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first,
                 URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)].compactMap { $0 }
    guard roots.contains(where: {
      source.path.hasPrefix($0.resolvingSymlinksInPath().standardizedFileURL.path + "/")
    }), let attributes = try? source.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey]),
    attributes.isRegularFile == true, let size = attributes.fileSize, size >= 24, size <= 24 * 1024 * 1024,
    let data = try? Data(contentsOf: source),
    data.prefix(8).elementsEqual([137, 80, 78, 71, 13, 10, 26, 10]),
    let imageSource = CGImageSourceCreateWithData(data as CFData, nil),
    CGImageSourceGetType(imageSource) as String? == "public.png",
    let properties = CGImageSourceCopyPropertiesAtIndex(imageSource, 0, nil) as? [CFString: Any],
    (properties[kCGImagePropertyPixelWidth] as? NSNumber)?.intValue == 1080,
    (properties[kCGImagePropertyPixelHeight] as? NSNumber)?.intValue == 1920 else { return nil }
    return source
  }

  private func preparedImage(_ source: URL) -> URL? {
    guard let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else { return nil }
    let directory = cache.appendingPathComponent("bubo-stories", isDirectory: true)
    do {
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      let expiry = Date().addingTimeInterval(-24 * 60 * 60)
      let existing = (try? FileManager.default.contentsOfDirectory(
        at: directory, includingPropertiesForKeys: [.contentModificationDateKey, .isRegularFileKey]
      )) ?? []
      for file in existing {
        if let attributes = try? file.resourceValues(forKeys: [.contentModificationDateKey, .isRegularFileKey]),
           attributes.isRegularFile == true, let modified = attributes.contentModificationDate, modified < expiry {
          try? FileManager.default.removeItem(at: file)
        }
      }
      let target = directory.appendingPathComponent("bubo-\(UUID().uuidString).png")
      try FileManager.default.copyItem(at: source, to: target)
      return target
    } catch {
      return nil
    }
  }

  private func presenter() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    guard var controller = scenes.filter({ $0.activationState == .foregroundActive })
      .flatMap({ $0.windows }).first(where: { $0.isKeyWindow })?.rootViewController else { return nil }
    while let presented = controller.presentedViewController { controller = presented }
    return controller
  }
}
