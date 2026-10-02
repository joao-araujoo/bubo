# ADR-024: builds Android locais, gratuitos e repetíveis

Date: 2026-10-01. Status: accepted.

## Context

Native widgets cannot be installed by Expo Go. The owner needs a simple free route on Windows
to generate an installable standalone APK and repeat it without cloud queues/accounts.
Existing work and generated projects must be preserved.

## Decision

Provide root npm commands for build, setup, diagnostics and USB installation. Use the installed
Expo CLI for incremental prebuild and Gradle assembleRelease with embedded JS; verify the repo
before building and check signature, widget receivers and JS bundle before copying the result.
Keep only public settings in mobile/build.config.json; require HTTPS and reject credentialed
or loopback endpoints for preview/production. No EAS project, subscription or deployment is
created by these commands.

Bootstrap a local Windows x64 JDK/SDK with official pinned downloads and SHA-256 validation.
Read SDK/NDK requirements from the installed React Native version catalog. Reuse Gradle/SDK
caches, cap workers (2), use a 2 GB JVM heap/1 GB metaspace and preserve the test keystore
outside disposable native projects. The larger metaspace avoids the observed daemon restart
at the SDK template's 512 MB limit.
Keep APK and metadata in gitignored build/android. Install only on an authorized, selected
device and never uninstall automatically to overcome a signature conflict.

On Windows, synchronize a source snapshot into a short physical build directory on the project's
drive (BuboBuild/<source-path-hash>). Install dependencies using the same lockfile, with a separate
success marker; reuse its native/dependency caches. Copy only source inputs, exclude local accounts
and secret files, remove only obsolete managed source files, and refuse a directory not owned by
this pipeline. This avoids CMake/Ninja failures from long paths with spaces; Node's native realpath
resolves SUBST back to the long path, so an alias alone is insufficient. Original sources,
Windows registry, global PATH and dependency versions remain untouched by staging.

Use a private CMake 3.22.1 copy with pinned Ninja 1.13.2 on Windows. The SDK's Ninja 1.10.2
cannot stat long generated gesture-handler object paths even with a short source snapshot.
Set cmake.dir in the generated project's local.properties; do not alter Windows registry
or overwrite the owner's SDK tools. Verify the Ninja download with the official release digest.
Set the app's CMake buildStagingDirectory to a short n/app directory inside that same snapshot;
the default apps/mobile/android/app/.cxx prefix leaves insufficient room for CMake to hash
gesture-handler generated filenames on Windows with LongPathsEnabled=0. Apply an idempotent
managed block only to the generated Gradle file, preserving source files and Windows settings.

## Consequences

Initial setup needs internet/disk/download time. Later builds reuse caches. ARM phone binaries
are covered by default; x86 emulators can use the existing Expo development command.
The template test key is unsuitable for store distribution. Store signing, versioning and
environment isolation remain explicit release work. Existing backend quotas/integration gaps
are not resolved by compiling an APK. Native device/launcher acceptance remains separate.
Windows does not compile iOS. The current Apple capability matrix lists App Groups for free
accounts too; host/extension signing still requires macOS/Xcode and account-specific verification.
