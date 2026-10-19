# Cross-check with an independent decoder

The unit tests decode with jsQR, a small pure JavaScript reader that misses some styled codes
at large sizes. This script exports the style matrix from the running app and reads every PNG
with zxing-cpp, which shares its algorithms with the readers used by most phones.

```sh
pnpm build && pnpm preview --port 4173 &
node scripts/crosscheck/export-matrix.mjs /tmp/codifyqr-pngs      # needs a folder that exists
python scripts/crosscheck/decode_all.py /tmp/codifyqr-pngs        # pip install zxing-cpp pillow
```

Last run: 48 of 48 images read (five module shapes, three eye styles, 512, 1024 and 2048 px,
plus gradient and the largest allowed logo).
