#!/usr/bin/env python3
"""
Generates 24 curated, studio-mastered 44.1kHz stereo 16-bit PCM WAV core SFX
for CodeToVideoStudio v2.1.0 (Cinema Engine Pro).
All samples use clean acoustic/modal synthesis with soft saturation and stereo width.
"""
import math
import os
import random
import struct

SR = 44100
TWO_PI = 2.0 * math.pi
OUT_DIR = "app/src/main/assets/sfx"
os.makedirs(OUT_DIR, exist_ok=True)


def write_wav(name, left, right):
    n = min(len(left), len(right))
    peak = max((max(abs(left[i]), abs(right[i])) for i in range(n)), default=1e-6)
    scale = 0.86 / max(peak, 0.25)
    pcm = bytearray(n * 4)
    for i in range(n):
        l = max(-1.0, min(1.0, math.tanh(left[i] * scale)))
        r = max(-1.0, min(1.0, math.tanh(right[i] * scale)))
        struct.pack_into("<hh", pcm, i * 4, int(l * 32767), int(r * 32767))
    path = os.path.join(OUT_DIR, f"{name}.wav")
    data_size = len(pcm)
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE",
        b"fmt ", 16, 1, 2, SR, SR * 4, 4, 16,
        b"data", data_size
    )
    with open(path, "wb") as f:
        f.write(header)
        f.write(pcm)


def make_noise_whoosh(dur, f_start, f_peak, f_end, pan_sweep=0.55, seed=1):
    rng = random.Random(seed)
    n = int(dur * SR)
    L, R = [0.0] * n, [0.0] * n
    lp1 = lp2 = hp = prev = 0.0
    pink = [0.0] * 7
    for i in range(n):
        u = i / max(1, n - 1)
        w = rng.uniform(-1.0, 1.0)
        pink[0] = 0.99886 * pink[0] + w * 0.0555179
        pink[1] = 0.99332 * pink[1] + w * 0.0750759
        pink[2] = 0.96900 * pink[2] + w * 0.1538520
        pink[3] = 0.86650 * pink[3] + w * 0.3104856
        pink[4] = 0.55000 * pink[4] + w * 0.5329522
        pink[5] = -0.7616 * pink[5] - w * 0.0168980
        p = (sum(pink) + w * 0.5362) * 0.18
        pink[6] = w * 0.115926
        env = math.sin(math.pi * u) ** 1.65
        fc = f_start + (f_peak - f_start) * math.sin(math.pi * u) + (f_end - f_start) * (u * 0.4)
        a_lp = 1.0 - math.exp(-TWO_PI * max(120.0, min(12000.0, fc)) / SR)
        a_hp = math.exp(-TWO_PI * 110.0 / SR)
        hp = a_hp * (hp + p - prev)
        prev = p
        lp1 += a_lp * (hp - lp1)
        lp2 += a_lp * (lp1 - lp2)
        pan = (u * 2.0 - 1.0) * pan_sweep
        s = lp2 * env * 2.4
        L[i] = s * math.sqrt(0.5 * (1.0 - pan))
        R[i] = s * math.sqrt(0.5 * (1.0 + pan))
    return L, R


def make_modal(dur, partials, attack=0.002, noise_ms=0.008, seed=10):
    rng = random.Random(seed)
    n = int(dur * SR)
    L, R = [0.0] * n, [0.0] * n
    lp = 0.0
    for i in range(n):
        t = i / SR
        env_in = min(1.0, t / max(1e-4, attack))
        val_l = val_r = 0.0
        for idx, (freq, amp, decay, pan) in enumerate(partials):
            d = math.exp(-t * decay)
            ph = TWO_PI * freq * t
            sig = math.sin(ph) * amp * d
            val_l += sig * (1.0 - max(0.0, pan) * 0.5)
            val_r += sig * (1.0 - max(0.0, -pan) * 0.5)
        if t < noise_ms:
            w = rng.uniform(-1.0, 1.0) * math.exp(-t / max(1e-4, noise_ms * 0.35))
            lp += 0.28 * (w - lp)
            val_l += lp * 0.25
            val_r += lp * 0.25
        fade = 1.0 if t < dur - 0.03 else max(0.0, (dur - t) / 0.03)
        L[i] = val_l * env_in * fade
        R[i] = val_r * env_in * fade
    return L, R


def make_pop(dur, f0, f1, decay, seed=20):
    n = int(dur * SR)
    L, R = [0.0] * n, [0.0] * n
    phase = 0.0
    for i in range(n):
        t = i / SR
        u = min(1.0, t / max(0.04, dur * 0.45))
        f = f0 + (f1 - f0) * (1.0 - (1.0 - u) ** 2.4)
        phase += TWO_PI * f / SR
        env = min(1.0, t / 0.0025) * math.exp(-t * decay)
        s = (math.sin(phase) * 0.85 + math.sin(phase * 2.0) * 0.15) * env
        L[i] = s
        R[i] = s * 0.98
    return L, R


def make_impact(dur, f_hi, f_lo, sub_decay, punch_decay, seed=30):
    rng = random.Random(seed)
    n = int(dur * SR)
    L, R = [0.0] * n, [0.0] * n
    ph = 0.0
    lp = 0.0
    for i in range(n):
        t = i / SR
        f = f_lo + (f_hi - f_lo) * math.exp(-t * 14.0)
        ph += TWO_PI * f / SR
        sub = math.sin(ph) * math.exp(-t * sub_decay) * 0.95
        harm = math.sin(ph * 2.02) * math.exp(-t * (sub_decay * 2.2)) * 0.24
        w = rng.uniform(-1.0, 1.0)
        lp += 0.12 * (w - lp)
        punch = lp * math.exp(-t * punch_decay) * 0.65
        env_in = min(1.0, t / 0.002)
        fade = 1.0 if t < dur - 0.05 else max(0.0, (dur - t) / 0.05)
        L[i] = (sub + harm + punch) * env_in * fade
        R[i] = (sub + harm * 0.92 + punch * 1.05) * env_in * fade
    return L, R


def build_all():
    # Cinema & Transition
    write_wav("cinema_boom", *make_impact(1.35, 138.0, 34.0, 2.3, 18.0, 1))
    write_wav("sub_drop", *make_impact(1.20, 96.0, 28.0, 2.1, 24.0, 2))
    write_wav("impact_thud", *make_impact(0.48, 165.0, 48.0, 7.2, 28.0, 3))
    write_wav("silk_swoosh", *make_noise_whoosh(0.56, 420, 3400, 320, 0.55, 4))
    write_wav("air_whoosh", *make_noise_whoosh(0.52, 500, 4200, 360, 0.60, 5))
    write_wav("whip_pan", *make_noise_whoosh(0.32, 650, 6200, 480, 0.72, 6))
    write_wav("magnifier_whoosh", *make_noise_whoosh(0.42, 720, 4800, 900, 0.42, 7))
    write_wav("paper_flip", *make_noise_whoosh(0.28, 1200, 5600, 1600, 0.35, 8))

    # Liquid Glass & Micro-UI
    write_wav("glass_clink", *make_modal(0.65, [(1860, 0.55, 7.2, -0.2), (2790, 0.38, 9.5, 0.25), (4120, 0.22, 13.0, -0.15)], 0.001, 0.005, 11))
    write_wav("crystal_tap", *make_modal(0.42, [(1480, 0.62, 11.0, 0.1), (2960, 0.32, 15.0, -0.2), (4440, 0.16, 20.0, 0.18)], 0.001, 0.004, 12))
    write_wav("glass_tap", *make_modal(0.30, [(1180, 0.68, 15.0, -0.1), (2360, 0.26, 22.0, 0.15)], 0.001, 0.004, 13))
    write_wav("glass_slide", *make_noise_whoosh(0.40, 1400, 5200, 1800, 0.45, 14))
    write_wav("taptic_thock", *make_pop(0.14, 240.0, 115.0, 34.0, 15))
    write_wav("haptic_tick", *make_modal(0.08, [(620, 0.65, 58.0, 0.0), (1680, 0.28, 82.0, 0.08)], 0.0005, 0.003, 16))
    write_wav("mech_key_click", *make_modal(0.10, [(480, 0.55, 48.0, -0.05), (2420, 0.40, 74.0, 0.05), (4100, 0.22, 95.0, 0.0)], 0.0004, 0.006, 17))

    # Explainer & Cartoon Pop
    write_wav("bubble_pop", *make_pop(0.22, 260.0, 780.0, 22.0, 21))
    write_wav("soft_boing", *make_pop(0.38, 190.0, 440.0, 9.5, 22))
    write_wav("checklist_ding", *make_modal(0.72, [(880, 0.52, 5.2, -0.18), (1318.5, 0.48, 5.8, 0.18), (1760, 0.24, 7.6, 0.0)], 0.002, 0.004, 23))
    write_wav("sparkle_chime", *make_modal(0.95, [(1046.5, 0.42, 3.8, -0.25), (1568.0, 0.36, 4.4, 0.22), (2093.0, 0.28, 5.2, -0.15), (2637.0, 0.18, 6.4, 0.20)], 0.003, 0.003, 24))
    write_wav("chime", *make_modal(1.05, [(523.25, 0.45, 3.1, -0.2), (659.25, 0.38, 3.4, 0.15), (783.99, 0.34, 3.7, -0.12), (987.77, 0.26, 4.1, 0.22)], 0.004, 0.003, 25))
    write_wav("water_drop", *make_pop(0.26, 520.0, 1480.0, 19.0, 26))
    write_wav("wood_tap", *make_modal(0.18, [(540, 0.68, 24.0, -0.05), (980, 0.34, 32.0, 0.08)], 0.001, 0.005, 27))
    write_wav("tension_riser", *make_noise_whoosh(1.25, 220, 4800, 5400, 0.25, 28))
    write_wav("glitch_burst", *make_modal(0.20, [(320, 0.45, 22.0, -0.4), (1140, 0.38, 28.0, 0.4), (3180, 0.32, 34.0, -0.3)], 0.0005, 0.045, 29))

    print(f"Built {len(os.listdir(OUT_DIR))} core studio WAV files in {OUT_DIR}")


if __name__ == "__main__":
    build_all()
