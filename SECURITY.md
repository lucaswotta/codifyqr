# Security

## Reporting

Use [GitHub private vulnerability reporting](https://github.com/lucaswotta/codifyqr/security/advisories/new). Do not open a public issue for a vulnerability. Expect a first answer within 7 days.

## Scope and design

- The app runs only in the browser. There is no server and no account.
- The production page sets `Content-Security-Policy` through a `<meta>` tag: `default-src 'none'`, `script-src 'self'`, `connect-src 'none'`. After the page loads it cannot send data anywhere.
- No analytics, no cookies, no third party scripts, fonts or images.
- Saved styles, style links and exported style files hold the look only. Pix keys, Wi-Fi passwords and other content are never stored or placed in a URL.
- Logo files are read locally. SVG logos are embedded as images, so scripts inside them do not run.
- Style data from a link or a file is validated field by field before it is used.
- The reader never opens a link on its own. It warns about shorteners, look-alike (punycode) domains, raw IP addresses, `http`, embedded credentials, and `javascript:` or `data:` content.

## Known limits

- GitHub Pages cannot send HTTP headers, so `frame-ancestors` and other header-only protections are not available.
- The read check simulates scanners; it does not prove that every phone will read a code.
