package expo.modules.bubostories

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.FileProvider
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.UUID

class BuboStoriesModule : Module() {
  private val instagramPackage = "com.instagram.android"

  override fun definition() = ModuleDefinition {
    Name("BuboStories")

    AsyncFunction("shareInstagram") { uri: String, appId: String, promise: Promise ->
      if (!appId.matches(Regex("^[0-9]{5,30}$"))) {
        promise.resolve(result("unavailable", "app-id"))
      } else {
        share(uri, promise, appId)
      }
    }

    AsyncFunction("shareImage") { uri: String, promise: Promise ->
      share(uri, promise, null)
    }

    AsyncFunction("saveImage") { uri: String ->
      save(uri)
    }
  }

  private fun result(status: String, reason: String? = null): Map<String, String> =
    if (reason == null) mapOf("status" to status) else mapOf("status" to status, "reason" to reason)

  // Capture accepts only this app's cache, never remote URLs, content providers or private files.
  // Canonical paths also reject symlinks that leave the cache directory.
  private fun image(context: Context, input: String): File? {
    val uri = Uri.parse(input)
    if (uri.scheme != "file" || !uri.host.isNullOrEmpty() || uri.query != null || uri.fragment != null) return null
    val source = File(uri.path ?: return null).canonicalFile
    val cache = context.cacheDir.canonicalFile
    if (!source.path.startsWith(cache.path + File.separator) || !source.isFile ||
      source.length() !in 24L..(24L * 1024 * 1024)) return null
    val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(source.path, options)
    if (options.outMimeType != "image/png" || options.outWidth != 1080 || options.outHeight != 1920) return null
    return source
  }

  // The provider exposes only this directory. Preserve a copy after React Native releases its
  // capture, since receiving apps may read it after the handoff promise resolves.
  private fun preparedImage(context: Context, input: String): File? {
    val source = image(context, input) ?: return null
    val directory = File(context.cacheDir, "bubo-stories")
    if (!directory.exists() && !directory.mkdirs()) return null
    val expiry = System.currentTimeMillis() - 24L * 60 * 60 * 1000
    directory.listFiles()?.filter { it.isFile && it.lastModified() < expiry }?.forEach { it.delete() }
    return source.copyTo(File(directory, "bubo-${UUID.randomUUID()}.png"))
  }

  private fun share(input: String, promise: Promise, appId: String?) {
    val context = appContext.reactContext
    val activity = appContext.currentActivity
    if (context == null || activity == null) {
      promise.resolve(result("unavailable", "share"))
      return
    }
    val file = runCatching { preparedImage(context, input) }.getOrNull()
    if (file == null) {
      promise.resolve(result("error", "image"))
      return
    }
    val content = runCatching {
      FileProvider.getUriForFile(context, "${context.packageName}.bubo-stories", file)
    }.getOrNull()
    if (content == null) {
      promise.resolve(result("error", "image"))
      return
    }
    activity.runOnUiThread {
      try {
        val intent = if (appId != null) {
          Intent("com.instagram.share.ADD_TO_STORY").apply {
            setPackage(instagramPackage)
            setDataAndType(content, "image/png")
            putExtra("source_application", appId)
          }
        } else {
          Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, content)
            putExtra(Intent.EXTRA_TITLE, "Meu Story no Bubo")
          }
        }
        intent.clipData = ClipData.newRawUri("Bubo Story", content)
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        if (appId != null) {
          if (intent.resolveActivity(context.packageManager) == null) {
            promise.resolve(result("unavailable", "instagram"))
            return@runOnUiThread
          }
          context.grantUriPermission(instagramPackage, content, Intent.FLAG_GRANT_READ_URI_PERMISSION)
          activity.startActivity(intent)
        } else {
          activity.startActivity(Intent.createChooser(intent, "Compartilhar Story").apply {
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          })
        }
        // This confirms the editor/share sheet opened, never that the person posted anything.
        promise.resolve(result("opened"))
      } catch (_: ActivityNotFoundException) {
        promise.resolve(result("unavailable", if (appId != null) "instagram" else "share"))
      } catch (_: Exception) {
        promise.resolve(result("error", "share"))
      }
    }
  }

  private fun save(input: String): Map<String, String> {
    val context = appContext.reactContext ?: return result("unavailable", "share")
    val source = runCatching { image(context, input) }.getOrNull() ?: return result("error", "image")
    // Android 10+ can add our image without requesting access to anyone's existing photos.
    if (Build.VERSION.SDK_INT < 29) return result("unavailable", "android-version")
    val values = ContentValues().apply {
      put(MediaStore.Images.Media.DISPLAY_NAME, "Bubo-${UUID.randomUUID()}.png")
      put(MediaStore.Images.Media.MIME_TYPE, "image/png")
      put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/Bubo")
      put(MediaStore.Images.Media.IS_PENDING, 1)
    }
    val resolver = context.contentResolver
    var destination: Uri? = null
    return try {
      destination = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
        ?: return result("error", "share")
      val output = resolver.openOutputStream(destination) ?: throw IllegalStateException("output")
      output.use { stream -> source.inputStream().use { it.copyTo(stream) } }
      val published = ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) }
      if (resolver.update(destination, published, null, null) != 1) throw IllegalStateException("publish")
      result("saved")
    } catch (_: Exception) {
      destination?.let { runCatching { resolver.delete(it, null, null) } }
      result("error", "share")
    }
  }
}
