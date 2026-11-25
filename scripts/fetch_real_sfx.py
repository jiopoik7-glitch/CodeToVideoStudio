import os, re, subprocess, urllib.request

OUT_DIR = "app/src/main/assets/sfx"
os.makedirs(OUT_DIR, exist_ok=True)
TMP_MP3 = os.path.join(OUT_DIR, "_tmp_dl.mp3")
HEADERS = {"User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"}

GROUPS = [
    (["whoosh", "swoosh", "wind"], [
        ("air_whoosh", 0.95), ("whoosh", 0.95), ("whip", 0.65), ("glass_slide", 0.75),
        ("swoosh_soft", 0.95), ("swoosh_deep", 1.25), ("liquid_morph", 0.90), ("page_flip", 0.65)
    ]),
    (["click", "interface", "mouse"], [
        ("click", 0.35), ("tactile_tick", 0.35), ("tick", 0.35), ("glass_tap", 0.45),
        ("snap", 0.40), ("type_key", 0.30)
    ]),
    (["pop", "bubble", "water"], [
        ("pop", 0.50), ("bubble", 0.55), ("water_drop", 0.65)
    ]),
    (["camera", "shutter"], [
        ("shutter", 0.55), ("camera_focus", 0.55)
    ]),
    (["bell", "chime", "notification", "magic"], [
        ("chime", 1.50), ("crystal_bloom", 1.75), ("bloom", 1.75), ("glass_shimmer", 1.50),
        ("sparkle", 1.35), ("ding", 1.00), ("felt_pluck", 0.95)
    ]),
    (["cinematic", "impact", "hit", "drum"], [
        ("cinema_boom", 1.70), ("sub_drop", 1.60), ("bass_hit", 1.15), ("thud", 0.75),
        ("riser", 1.75), ("tape_stop", 1.00)
    ])
]

def scrape_urls(slugs):
    urls, seen = [], set()
    for slug in slugs:
        page = f"https://mixkit.co/free-sound-effects/{slug}/"
        try:
            req = urllib.request.Request(page, headers=HEADERS)
            html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", "ignore")
            for u in re.findall(r"https://assets\.mixkit\.co/active_storage/sfx/\d+/\d+-preview\.mp3", html):
                if u not in seen:
                    seen.add(u)
                    urls.append(u)
            if len(urls) >= 12:
                break
        except Exception as e:
            print(f"[skip] {slug}: {e}")
    return urls

ok = 0
for slugs, targets in GROUPS:
    print(f"\n==> Mengunduh SFX asli: {', '.join(slugs)}")
    pool = scrape_urls(slugs)
    print(f"    Pool: {len(pool)} sampel")
    if not pool:
        continue
    for idx, (name, max_dur) in enumerate(targets):
        mp3_url = pool[idx % len(pool)]
        out_wav = os.path.join(OUT_DIR, f"{name}.wav")
        try:
            req = urllib.request.Request(mp3_url, headers=HEADERS)
            with open(TMP_MP3, "wb") as f:
                f.write(urllib.request.urlopen(req, timeout=20).read())
            fade_st = max(0.05, round(max_dur - 0.10, 3))
            af = f"silenceremove=start_periods=1:start_threshold=-42dB,atrim=0:{max_dur},afade=t=in:st=0:d=0.004,afade=t=out:st={fade_st}:d=0.10,alimiter=limit=0.92"
            res = subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", TMP_MP3, "-af", af, "-ar", "44100", "-ac", "2", "-sample_fmt", "s16", out_wav],
                check=False
            )
            if res.returncode == 0 and os.path.exists(out_wav) and os.path.getsize(out_wav) > 2000:
                print(f"    [OK] {name}.wav ({os.path.getsize(out_wav) // 1024} KB)")
                ok += 1
            else:
                if os.path.exists(out_wav): os.remove(out_wav)
                print(f"    [FAIL] {name}.wav")
        except Exception as e:
            print(f"    [ERR] {name}: {e}")

if os.path.exists(TMP_MP3):
    os.remove(TMP_MP3)
print(f"\n=== LANGKAH 1 SELESAI: {ok} / 32 SFX STUDIO ASLI TERSIMPAN ===")
