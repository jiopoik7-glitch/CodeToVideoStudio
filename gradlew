#!/usr/bin/env sh
# Small Gradle 9.5 bootstrap for environments where the official wrapper JAR is unavailable.
# Uses the version pinned in gradle/wrapper/gradle-wrapper.properties.
set -eu
ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
GRADLE_USER_HOME=${GRADLE_USER_HOME:-"$HOME/.gradle"}
VERSION="9.5"
BASE="$GRADLE_USER_HOME/manual-distributions"
DIST="$BASE/gradle-$VERSION"
BIN="$DIST/bin/gradle"
if [ ! -x "$BIN" ]; then
  mkdir -p "$BASE"
  ARCHIVE="$BASE/gradle-$VERSION-bin.zip"
  echo "Gradle $VERSION belum ada. Mengunduh distribusi resmi…"
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl diperlukan untuk mengunduh Gradle $VERSION." >&2
    exit 1
  fi
  curl -fL --retry 3 "https://services.gradle.org/distributions/gradle-$VERSION-bin.zip" -o "$ARCHIVE"
  if ! command -v unzip >/dev/null 2>&1; then
    echo "unzip diperlukan untuk mengekstrak Gradle." >&2
    exit 1
  fi
  unzip -q -o "$ARCHIVE" -d "$BASE"
fi
exec "$BIN" -p "$ROOT_DIR" "$@"
