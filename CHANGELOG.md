# Changelog

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
- Fixed from 1.x: PNG logos with transparency turned black; the 2000 character limit exceeded what the QR format can hold; each preview leaked a hidden canvas into the page.

## 1.0.0 (2025-09-07)

Client side generator with `qrcodejs`, logo, text and color options.

## 0.1.0 (2022-10-17)

First version, built on a third party QR image API.
