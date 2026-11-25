import os, re, subprocess, urllib.request

OUT_DIR = "app/src/main/assets/sfx"
os.makedirs(OUT_DIR, exist_ok=True)
TMP_MP3 = os.path.join(OUT_DIR, "_tmp_dl.mp3")
HEADERS = {"User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"}

# Blacklist keras untuk membuang jingle game, kartun, alarm, dan melodi murahan
HARD_BAN = [
    "game", "arcade", "retro", "8-bit", "cartoon", "comedy", "funny", "comic",
    "win", "bonus", "coin", "level", "unlock", "fanfare", "melody", "jingle",
    "ringtone", "alarm", "siren", "horn", "laser", "sci-fi", "robot", "monster",
    "scream", "laugh", "gun", "explosion", "applause", "crowd", "error", "fail",
    "wrong", "buzzer", "slot", "casino", "fairy", "spell", "power", "jump",
    "boing", "squeak", "whistle", "cheering", "trumpet", "guitar", "phone"
]
SOFT_PENALTY = ["notification", "alert", "message", "sms", "ring", "magic", "video", "intro", "logo"]

# Format target: (nama_sfx, durasi_maks_detik, lowpass_hz, gain_norm)
GROUPS = [
    (["whoosh", "swoosh", "transition", "wind"], ["soft", "fast", "light", "air", "smooth", "sweep", "whoosh", "swoosh", "transition"], [
        ("air_whoosh", 0.55, 6500, 0.72), ("whoosh", 0.58, 6800, 0.72), ("whip", 0.36, 7500, 0.76),
        ("glass_slide", 0.45, 7200, 0.68), ("swoosh_soft", 0.58, 5200, 0.66), ("swoosh_deep", 0.85, 3800, 0.74),
        ("liquid_morph", 0.52, 5800, 0.70), ("page_flip", 0.38, 7000, 0.68)
    ]),
    (["click", "interface", "mouse", "keyboard"], ["click", "mouse", "soft", "subtle", "tap", "type", "key", "switch", "select", "modern"], [
        ("click", 0.16, 7200, 0.64), ("tactile_tick", 0.14, 6400, 0.60), ("tick", 0.14, 6200, 0.58),
        ("glass_tap", 0.22, 6800, 0.62), ("snap", 0.20, 7400, 0.66), ("type_key", 0.12, 6800, 0.56)
    ]),
    (["water", "bubble", "pop"], ["water", "drop", "droplet", "bubble", "pop", "liquid", "plop"], [
        ("pop", 0.24, 6200, 0.64), ("bubble", 0.28, 5800, 0.62), ("water_drop", 0.34, 5600, 0.66)
    ]),
    (["camera", "shutter"], ["camera", "shutter", "photo", "lens", "focus", "click"], [
        ("shutter", 0.32, 7600, 0.68), ("camera_focus", 0.28, 7000, 0.62)
    ]),
    (["bell", "chime", "harp", "piano"], ["soft", "gentle", "single", "bell", "chime", "glass", "crystal", "warm", "harp", "piano", "pluck"], [
        ("felt_pluck", 0.55, 4800, 0.64), ("ding", 0.75, 5800, 0.60), ("chime", 1.05, 6200, 0.62),
        ("crystal_bloom", 1.25, 6400, 0.64), ("bloom", 1.25, 6000, 0.64), ("glass_shimmer", 1.05, 6800, 0.58),
        ("sparkle", 0.90, 6800, 0.58)
    ]),
    (["cinematic", "impact", "hit", "bass"], ["cinematic", "deep", "boom", "sub", "bass", "impact", "thud", "riser", "swell", "hit"], [
        ("cinema_boom", 1.35, 3200, 0.78), ("sub_drop", 1.25, 2800, 0.76), ("bass_hit", 0.85, 3400, 0.74),
        ("thud", 0.42, 3000, 0.72), ("riser", 1.30, 5600, 0.70), ("tape_stop", 0.65, 4500, 0.68)
    ])
]

def scrape_ranked(slugs, prefer_words):
    candidates = {}
    for slug in slugs:
        page = f"https://mixkit.co/free-sound-effects/{slug}/"
        try:
            req = urllib.request.Request(page, headers=HEADERS)
            html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", "ignore")
            for m in re.finditer(r"https://assets\.mixkit\.co/active_storage/sfx/(\d+)/\1-preview\.mp3", html):
                url = m.group(0)
                if url in candidates:
                    continue
                win = html[max(0, m.start() - 1500):min(len(html), m.end() + 500)]
                tm = re.search(r'item-grid-card__title[^>]*>([^<]+)<', win) or re.search(r'<h[23][^>]*>([^<]+)</h[23]>', win)
                title = re.sub(r"\s+", " ", tm.group(1)).strip() if tm else f"sfx-{m.group(1)}"
                tl = title.lower()
                if any(b in tl for b in HARD_BAN):
                    continue
                score = 0
                for pw in prefer_words:
                    if pw in tl:
                        score += 12
                for sp in SOFT_PENALTY:
                    if sp in tl:
                        score -= 18
                # Penalti jika judul menyiratkan banyak nada / panjang
                if any(w in tl for w in ["melodic", "musical", "musical", "loop", "beat", "song", "chords"]):
                    score -= 25
                candidates[url] = (score, title, url)
        except Exception as e:
            print(f"[skip] {slug}: {e}")
    ranked = sorted(candidates.values(), key=lambda x: x[0], reverse=True)
    return ranked

ok = 0
for slugs, prefers, targets in GROUPS:
    print(f"\n==> Menyaring SFX editorial: {', '.join(slugs)}")
    pool = scrape_ranked(slugs, prefers)
    print(f"    Lolos filter bersih: {len(pool)} sampel")
    if not pool:
        continue
    for idx, (name, max_dur, lp_hz, vol_mul) in enumerate(targets):
        score, title, mp3_url = pool[idx % len(pool)]
        out_wav = os.path.join(OUT_DIR, f"{name}.wav")
        try:
            req = urllib.request.Request(mp3_url, headers=HEADERS)
            with open(TMP_MP3, "wb") as f:
                f.write(urllib.request.urlopen(req, timeout=20).read())
            fade_d = min(0.18, round(max_dur * 0.36, 3))
            fade_st = max(0.03, round(max_dur - fade_d, 3))
            af = (
                f"silenceremove=start_periods=1:start_threshold=-40dB,"
                f"atrim=0:{max_dur},"
                f"highpass=f=45,lowpass=f={lp_hz},"
                f"afade=t=in:st=0:d=0.005,"
                f"afade=t=out:st={fade_st}:d={fade_d}:curve=qsin,"
                f"volume={vol_mul},alimiter=limit=0.80"
            )
            res = subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", TMP_MP3, "-af", af, "-ar", "44100", "-ac", "2", "-sample_fmt", "s16", out_wav],
                check=False
            )
            if res.returncode == 0 and os.path.exists(out_wav) and os.path.getsize(out_wav) > 1500:
                print(f"    [OK] {name}.wav <- \"{title}\" ({max_dur}s, {os.path.getsize(out_wav)//1024} KB)")
                ok += 1
            else:
                if os.path.exists(out_wav): os.remove(out_wav)
                print(f"    [FAIL] {name}.wav")
        except Exception as e:
            print(f"    [ERR] {name}: {e}")

if os.path.exists(TMP_MP3):
    os.remove(TMP_MP3)
print(f"\n=== LANGKAH 1 SELESAI: {ok} / 32 SFX EDITORIAL BERSIH TERSIMPAN ===")
