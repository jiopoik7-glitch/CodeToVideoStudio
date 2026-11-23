# Code-to-Video Studio — Android project

Native Android implementation based on **Code-to-Video Studio Technical Blueprint V2**.

## Stack

- Kotlin + Jetpack Compose / Material 3 for the native app UI.
- WebViewAssetLoader + Dedicated Web Worker + OffscreenCanvas 2D for deterministic frame drawing.
- AndroidX WebMessageListener + ArrayBuffer for the RGBA frame bridge (no Base64).
- EGL14 / OpenGL ES + MediaCodec Surface input + MediaMuxer for H.264 MP4 export.
- App-private JSON projects; MediaStore output at `Movies/CodeToVideoStudio`.
- GitHub Actions debug APK workflow.

Dependency versions and the Android API baseline are pinned in `gradle/libs.versions.toml` and `app/build.gradle.kts` in line with the blueprint's November 23, 2026 baseline.

## Implemented in this source package

- Five native tabs: Editor, Render, Galeri, Simpan, Docs.
- Canvas JavaScript editor with a 64 KiB limit, static `studio-meta` JSON parsing, and four Prop types: text, color, range, boolean.
- Local JSON project save/autosave, duplicate, rename, delete, import, and export.
- Local WebView assets, worker-based frame rendering, deterministic time/progress helpers, and a preview scrubber.
- One-frame-at-a-time native H.264 export using MediaCodec + EGL + MediaMuxer, with a per-frame timeout, cancellation, output validation, and MediaStore pending-row cleanup.
- Gallery listing for the app's own export folder, playback hand-off to an installed video player, share, and delete.
- Bundled Canvas Body Contract documentation with copy and Save As.
- CI workflow to build an installable debug APK.

## Build requirements

- JDK 17.
- Android SDK Platform 37 and Build Tools 36.0.0.
- Gradle 9.5.0 (the included `gradlew` bootstrap downloads this distribution when it is not already cached).
- Android System WebView with OffscreenCanvas Worker and WebMessage ArrayBuffer support for export.

### Build from Android Studio or a shell

Open this directory as an Android Gradle project, make sure the Android SDK is installed, then run:

```bash
./gradlew --no-daemon assembleDebug
```

Debug APK output:

```text
app/build/outputs/apk/debug/app-debug.apk
```

The build requires downloading Gradle and Android dependencies at least once. The installed app itself is designed to render locally and does not need an application server or Internet permission.

### Build with GitHub Actions

Push the project to a GitHub repository on branch `main`, or run the workflow manually from the Actions tab. Download the `Code-to-Video-Studio-debug` artifact after the build succeeds. This workflow builds a debug-signed APK for internal testing; it is not a production release signing pipeline.

## Current limitations and test gates

This package is an **implementation baseline for device testing**, not a claim of a fully certified/stable release. The build environment used to generate this ZIP did not contain Android SDK/Gradle or network access, so an APK could not be compiled here.

Before calling the MVP stable, run the blueprint acceptance matrix on at least two or three real Android devices:

1. Confirm OffscreenCanvas 2D, `transferToImageBitmap`, `WEB_MESSAGE_LISTENER`, and `WEB_MESSAGE_ARRAY_BUFFER` in that device's WebView.
2. Confirm H.264 encoder capability for exact dimensions/FPS; some device/codec combinations will reject high resolution or frame rate.
3. Inspect exported video orientation, color, timestamps, playback duration, and final frame in a real player.
4. Exercise cancellation, worker infinite-loop termination, WebView renderer crash recovery, storage-full behavior, and thermal throttling.
5. Profile RAM and frame throughput; the renderer intentionally holds only one RGBA frame in flight.

Additional scope not included in this baseline: audio/SFX mixing (Blueprint P6), optional PWA (P7), broad cross-device pixel identity, 4K/60 FPS guarantees, and Android 8–9 Save As fallback via SAF. On Android 10+, the app writes to MediaStore. For a device that does not support the selected codec/size/FPS, lower the output settings rather than forcing another codec silently.

## Safety and trust boundaries

User code runs in a dedicated Worker, without DOM access or a direct native bridge. Common network/storage/timer APIs are disabled, source size is bounded, and the host can terminate a stuck Worker. This is a constrained execution environment, **not a general-purpose security sandbox**: do not paste secrets or execute code from untrusted parties.

## Project structure

```text
CodeToVideoStudio/
├── app/
│   └── src/main/
│       ├── assets/web/             # Local HTML/CSS/JS worker runtime
│       ├── assets/docs/            # Canvas Body Contract
│       ├── java/app/codetovideo/studio/
│       │   ├── core/               # Project model, repository, metadata parser
│       │   ├── render/             # WebView runtime, MediaCodec/EGL export
│       │   ├── storage/            # MediaStore gallery
│       │   └── ui/                 # Compose screens and theme
│       └── AndroidManifest.xml
├── gradle/
├── .github/workflows/android-apk.yml
└── README.md
```
