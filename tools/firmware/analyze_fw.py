"""Feasibility report for a TCL MStar (MS6586) firmware file.

Usage: python3 analyze_fw.py <firmware.bin|.zip> <work dir>

Read-only: unpacks into <work dir>, never writes to the input, never flashes.
Answers three questions:
  1. Is the package signed/encrypted (can a modified image be accepted)?
  2. What renders the home UI (HTML/JS, Qt, DirectFB, ...)?
  3. Is there any screen-mirroring stack (AirPlay / Miracast / DLNA)?
"""
import os
import re
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
UNPACK = os.path.join(HERE, "mstar-bin-tool", "unpack.py")

MAGICS = [
    (0, b"hsqs", "squashfs (LE)"),
    (0, b"sqsh", "squashfs (BE)"),
    (0, b"UBI#", "UBI"),
    (0, b"ANDROID!", "Android boot image"),
    (0, b"\x27\x05\x19\x56", "U-Boot uImage"),
    (0, b"\x89LZO", "LZO"),
    (0, b"\x1f\x8b", "gzip"),
    (0, b"PK\x03\x04", "zip"),
    (0, b"070701", "cpio"),
    (0, b"\x85\x19", "JFFS2"),
    (1080, b"\x53\xef", "ext2/3/4"),
]

# path regex -> what it tells us about the UI / mirroring stack
UI_CLUES = [
    (r"\.html?$", "HTML page"),
    (r"\.js$", "JavaScript"),
    (r"libQt5?\w*\.so", "Qt"),
    (r"libdirectfb", "DirectFB"),
    (r"libwebkit|WebKit|qtwebkit", "WebKit"),
    (r"opera|vewd|libblink|chromium|cobalt", "Opera/Chromium/Cobalt browser engine"),
    (r"launcher|homepage|home_ui|portal", "launcher-named file"),
    (r"libSDL|libgtk|libefl|libevas", "other GUI toolkit"),
]
MIRROR_CLUES = [
    (r"airplay|raop|shairport|uxplay", "AirPlay"),
    (r"miracast|wfd|wifidisplay|p2p_supplicant", "Miracast"),
    (r"dlna|dmr|upnp|platinum", "DLNA/UPnP"),
    (r"gst|gstreamer", "GStreamer"),
]
SECURE_RE = re.compile(r"secure|sign|verify|aes|rsa|encrypt", re.I)


def magic_of(path):
    with open(path, "rb") as f:
        head = f.read(2048)
    for off, sig, name in MAGICS:
        if head[off:off + len(sig)] == sig:
            return name
    return "unknown"


def is_mstar(path):
    with open(path, "rb") as f:
        head = f.read(16 * 1024)
    end = head.find(b"\xff")
    script = head[:end if end != -1 else len(head)]
    return b"filepartload" in script or b"mmc write" in script


def match_clues(paths, clues):
    hits = {}
    for p in paths:
        for rx, label in clues:
            if re.search(rx, p, re.I):
                hits.setdefault(label, []).append(p)
    return hits


def list_squashfs(path):
    from PySquashfsImage import SquashFsImage
    img = SquashFsImage.from_file(path)
    try:
        return [f.path for f in img]
    finally:
        img.close()


def analyze_mstar(fw, out, report):
    subprocess.run([sys.executable, UNPACK, fw, out], check=True,
                   stdout=subprocess.DEVNULL)
    with open(os.path.join(out, "~header_script")) as f:
        script = f.read()
    secure = [l for l in script.splitlines() if SECURE_RE.search(l)]
    report.append("## Header script: security lines")
    report += [f"    {l}" for l in secure] or ["    (none)"]

    report.append("\n## Partitions")
    all_paths = []
    for name in sorted(os.listdir(out)):
        p = os.path.join(out, name)
        if name.startswith("~") or not os.path.isfile(p):
            continue
        kind = magic_of(p)
        report.append(f"- {name}: {os.path.getsize(p):,} bytes, {kind}")
        if kind.startswith("squashfs"):
            try:
                files = list_squashfs(p)
                all_paths += [f"{name}:{x}" for x in files]
                report.append(f"    {len(files):,} files")
            except Exception as e:  # corrupt/encrypted images are a finding, not a crash
                report.append(f"    could not read: {e}")
    if any(re.search(r"sign", n, re.I) for n in os.listdir(out)):
        report.append("\n[!] signature files present next to partitions")
    return all_paths


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    fw, out = (os.path.abspath(a) for a in sys.argv[1:])
    os.makedirs(out, exist_ok=True)
    report = [f"# Firmware report: {os.path.basename(fw)}",
              f"size {os.path.getsize(fw):,} bytes, outer type: {magic_of(fw)}\n"]

    targets = [fw]
    if zipfile.is_zipfile(fw):
        with zipfile.ZipFile(fw) as z:
            report.append("## Zip contents")
            report += [f"- {i.filename} ({i.file_size:,})" for i in z.infolist()]
            z.extractall(os.path.join(out, "zip"))
        targets = [os.path.join(dp, f) for dp, _, fs in os.walk(os.path.join(out, "zip"))
                   for f in fs if f.lower().endswith((".bin", ".img", ".pkg"))]

    all_paths = []
    for t in targets:
        if is_mstar(t):
            report.append(f"\n# MStar package: {os.path.basename(t)}")
            all_paths += analyze_mstar(t, os.path.join(out, os.path.basename(t) + ".d"), report)
        else:
            report.append(f"\n# {os.path.basename(t)}: not an MStar header package ({magic_of(t)})")

    for title, clues in (("UI stack clues", UI_CLUES), ("Mirroring stack clues", MIRROR_CLUES)):
        report.append(f"\n## {title}")
        hits = match_clues(all_paths, clues)
        for label, ps in hits.items():
            report.append(f"- {label}: {len(ps)} files, e.g. " + ", ".join(ps[:5]))
        if not hits:
            report.append("- none found in readable partitions")

    text = "\n".join(report)
    with open(os.path.join(out, "REPORT.md"), "w") as f:
        f.write(text + "\n")
    print(text)


if __name__ == "__main__":
    main()
