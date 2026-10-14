"""WatchVerse simgesi: tek, kalın, altın bir W.
Netflix'in N'si gibi "katlanmış şerit": aşağı inen iki kol önde ve parlak,
yukarı çıkan iki kol arkada ve koyu; öndeki kollar arkadakilere hafif gölge düşer.
Aynı koordinatlar src/components/brand.tsx içinde SVG olarak da kullanılır.
Çalıştır: python3 scripts/make-icons.py"""
from PIL import Image, ImageChops, ImageDraw, ImageFilter
import os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets')
BG = (21, 23, 29)                                       # #15171D (uygulama zemini)
FRONT_TOP, FRONT_BOT = (247, 205, 98), (236, 178, 58)   # öndeki kollar
BACK_TOP, BACK_BOT = (176, 124, 34), (138, 94, 22)      # arkadaki kollar

# 1000'lik kutuda dört kol (sol üst, sağ üst, sağ alt, sol alt)
S1 = [(200, 220), (330, 220), (445, 780), (315, 780)]   # ön, aşağı
S2 = [(315, 780), (445, 780), (565, 360), (435, 360)]   # arka, yukarı
S3 = [(435, 360), (565, 360), (685, 780), (555, 780)]   # ön, aşağı
S4 = [(555, 780), (685, 780), (800, 220), (670, 220)]   # arka, yukarı

def vgrad(n, top, bot, y0, y1):
    g = Image.new('RGB', (n, n)); d = ImageDraw.Draw(g)
    for y in range(n):
        t = min(1, max(0, (y - y0) / max(1, y1 - y0)))
        d.line([(0, y), (n, y)], fill=tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    return g

def mask(n, polys, k, off):
    m = Image.new('L', (n, n), 0); d = ImageDraw.Draw(m)
    for p in polys: d.polygon([(x * k + off, y * k + off) for x, y in p], fill=255)
    return m

def mark(n, scale=1.0, mono=None):
    """Saydam zeminde W. scale 1 = 1000'lik kutudaki boyut."""
    N = n * 4; k = N / 1000 * scale; off = (N - 1000 * k) / 2
    mb, mf = mask(N, [S2, S4], k, off), mask(N, [S1, S3], k, off)
    y0, y1 = 220 * k + off, 780 * k + off
    out = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    if mono:
        out.paste(Image.new('RGBA', (N, N), mono + (255,)), (0, 0), ImageChops.lighter(mb, mf))
        return out.resize((n, n), Image.LANCZOS)
    out.paste(vgrad(N, BACK_TOP, BACK_BOT, y0, y1).convert('RGBA'), (0, 0), mb)
    # öndeki kolların arkadakilere düşen gölgesi
    sh = ImageChops.multiply(mf.filter(ImageFilter.GaussianBlur(N * 0.02 * scale)), mb).point(lambda v: int(v * 0.6))
    out.paste(Image.new('RGBA', (N, N), (0, 0, 0, 255)), (0, 0), sh)
    out.paste(vgrad(N, FRONT_TOP, FRONT_BOT, y0, y1).convert('RGBA'), (0, 0), mf)
    return out.resize((n, n), Image.LANCZOS)

def icon(n, scale=1.0):
    return Image.alpha_composite(Image.new('RGBA', (n, n), BG + (255,)), mark(n, scale)).convert('RGB')

icon(1024).save(os.path.join(ROOT, 'icon.png'))
for name, n in [('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180)]:
    icon(n).save(os.path.join(ROOT, 'pwa', name))
icon(48, 1.25).save(os.path.join(ROOT, 'favicon.png'))
Image.new('RGB', (1024, 1024), BG).save(os.path.join(ROOT, 'android-icon-background.png'))
mark(1024, 0.72).save(os.path.join(ROOT, 'android-icon-foreground.png'))   # uyarlanabilir simgede güvenli alan
mark(1024, 0.72, mono=(255, 255, 255)).save(os.path.join(ROOT, 'android-icon-monochrome.png'))
mark(512, 1.2).save(os.path.join(ROOT, 'splash-icon.png'))
print('ok')
