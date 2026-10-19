# Changelog

## 2.1.0 (2026-10-19)

- Paste an image (`Ctrl+V`) in `Scan` to decode it directly from the clipboard, and click `Edit in Create` on any decoded result to load its text into the editor.
- Theme switches update the page in place without resetting active camera streams or batch jobs; language switches keep `Batch` and `Scan` content.
- Pix payloads encode CRC16 over UTF-8 bytes and restrict recipient name and city to printable ASCII so TLV field lengths always match byte counts.
- Large SVG logos encode in 32 KB chunks without overflowing the call stack and persist up to the 2 MB upload limit.
- Batch ZIP exports build the `Blob` directly from file chunks without allocating a duplicate contiguous buffer.
- Replaced runtime inline `.style.setProperty` calls with static CSS selectors and `data-cols` attributes under `style-src 'self'`.
- Fixed duplicate `"batch.empty"` locale key and mid-width/mobile layout sizing.

## 2.0.0 (2026-10-19)

Rewrite. The project changed from a one-page tool to a PWA with its own QR engine.

- Own QR encoder (versions 1 to 40) that renders vector SVG; PNG and PDF come from the vector, so large exports stay sharp. The previous version stretched a 500 px bitmap.
- Ten content types: link or text, Pix, Wi-Fi, contact, email, SMS, WhatsApp, location, event, app store.
- Styles: five module shapes, eye shapes, gradients, transparent background, logo with the modules under it removed, frames for stickers, cards, table signs, Wi-Fi signs and Pix charges.
- Read check: decodes the code at three simulated camera qualities, explains why it fails and suggests fixes.
- Exports: PNG at any size, SVG, PDF with physical size, copy, share, CSV batch to ZIP.
- Reader for camera and image files, with warnings for risky links.
- Offline PWA, light and dark themes, English, Portuguese (Brazil) and Spanish.
- Strict content security policy, no requests after load.
- New interface: a three column workbench that fills the screen and never scrolls the page; the preview is pinned on narrow screens with a bottom bar. Pure black and paper palette with one signal red, Geist font bundled with the app, Lucide icons plus the Pix and WhatsApp marks.
- Help dialog with steps, print tips and a glossary; complete keyboard shortcuts with a switch for single-key ones.
- The Pix city is optional and becomes BRASIL when empty.
- Language menu with the full language names; PNG size and batch options as segmented controls.
- `404.html` page with the brand.
- Fixed from 1.x: PNG logos with transparency turned black; the 2000 character limit exceeded what the QR format can hold; each preview leaked a hidden canvas into the page.

## 1.0.0 (2025-09-07)

Client side generator with `qrcodejs`, logo, text and color options.

## 0.1.0 (2022-10-17)

First version, built on a third party QR image API.
