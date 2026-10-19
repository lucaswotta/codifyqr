# CodifyQR

CodifyQR es un generador de códigos QR gratuito y de código abierto que funciona por completo en el navegador: sin cuenta, sin rastreo y sin ninguna petición de red después de cargar la página.

[Abrir la app](https://lucaswotta.github.io/codifyqr/) · [English](README.md) · [Português](README.pt-BR.md)

![CodifyQR creando un código QR con estilo, fallando la revisión de lectura y corrigiéndola](docs/media/demo.gif)

## Qué hace

- **Diez tipos de contenido**: enlace o texto, Pix (BR Code con CRC16), Wi-Fi, contacto (vCard), correo, SMS, WhatsApp, ubicación, evento de calendario, enlace a tienda de apps.
- **Estilos**: cinco formas de módulo, tres marcos y tres centros de ojo, degradado, fondo transparente, borde ajustable y un logo que reemplaza los módulos bajo él en vez de taparlos. Marcos para pegatina, tarjeta de visita, tarjeta de mesa, cartel de Wi-Fi y cobro Pix.
- **Revisión de lectura**: decodifica el código terminado en tres calidades simuladas de cámara (3, 5 y 10 píxeles por módulo, con desenfoque), explica por qué falla (contraste, colores invertidos, tamaño del logo, borde, densidad, forma) y ofrece la corrección con un clic.
- **Exportación**: PNG de 512 a 4096 px, SVG, PDF con el tamaño de impresión en centímetros y aviso cuando los módulos quedan bajo 0,4 mm, copiar al portapapeles, compartir.
- **Lote**: pega líneas o importa un CSV (contenido y nombre de archivo opcional), hasta 500 filas, descargado como ZIP de archivos PNG o SVG.
- **Lector**: lee con la cámara o desde una imagen y muestra el contenido. Nunca abre un enlace por sí solo y avisa de acortadores, dominios con caracteres parecidos, direcciones IP, `http`, credenciales incrustadas y contenido `javascript:` o `data:`.
- **PWA sin conexión** con temas claro y oscuro en inglés, portugués (Brasil) y español.

| Estilos | Marcos |
| --- | --- |
| ![Formas de módulo, degradado y logo](docs/media/styles.png) | ![Marcos de pegatina, tarjeta, mesa, Wi-Fi y Pix](docs/media/frames.png) |

![La revisión de lectura en sus tres estados](docs/media/read-check.png)

## Por qué las imágenes salen nítidas

El codificador de `src/qr/encoder.ts` produce la matriz de módulos y `src/qr/svg.ts` la dibuja como trazados vectoriales. PNG y PDF se rasterizan desde ese vector al tamaño elegido. La versión 1.x dibujaba un mapa de bits de 500 px y lo estiraba, lo que desenfocaba los módulos en 1024 y 2048 px.

El codificador sigue el algoritmo del [generador de códigos QR de Project Nayuki](https://www.nayuki.io/page/qr-code-generator-library) (MIT), reescrito en TypeScript. Las pruebas unitarias decodifican de vuelta con jsQR todas las versiones (1 a 40) y todos los niveles de corrección. La versión 23 se comprueba por estructura, porque jsQR lista una posición errónea para su patrón de alineación. Un script aparte (`scripts/crosscheck`) exporta 48 PNG con estilo y los lee con zxing-cpp: se leyeron 48 de 48.

## Privacidad

- La página publicada define `Content-Security-Policy` con `connect-src 'none'` y `script-src 'self'`. No puede enviar datos a ningún sitio, y una prueba de extremo a extremo falla si una petición sale del origen.
- Sin analítica, sin cookies, sin fuentes ni scripts externos.
- Los estilos guardados, los enlaces de estilo (`#s=...`) y los archivos de estilo exportados llevan solo el aspecto. Las claves Pix, las contraseñas de Wi-Fi y otros contenidos nunca se guardan, se ponen en una URL ni se escriben en un registro.
- Los nombres de los archivos exportados no contienen el contenido.

## Pix

El constructor de Pix escribe un BR Code estático (`br.gov.bcb.pix`, reutilizable) y valida la clave antes de dibujar: dígitos verificadores de CPF y CNPJ (incluido el CNPJ alfanumérico), teléfono, correo y clave aleatoria. Un CPF escrito con puntuación que falla en los dígitos verificadores se rechaza, en lugar de leerse como teléfono. Nombre y ciudad salen sin tildes, en mayúsculas y cortados a 25 y 15 caracteres, como exige la especificación. El payload termina con el CRC16/CCITT-FALSE, probado contra el ejemplo del manual del Banco Central.

## Requisitos e instalación

- Node 22 o más nuevo, pnpm 12 (`corepack enable`), Google Chrome para las pruebas de extremo a extremo.

```sh
pnpm install
pnpm dev                 # http://localhost:5173/codifyqr/
pnpm build               # comprobación de tipos y build de producción en dist/
pnpm preview             # sirve dist/ en http://localhost:4173/codifyqr/
pnpm lint && pnpm typecheck && pnpm test
pnpm test:e2e            # necesita un build antes
```

`CODIFYQR_BASE` cambia la ruta base del build (por defecto `/codifyqr/`). Usa `CODIFYQR_BASE=/` para servir desde la raíz de un dominio.

## Controles de calidad

La CI (`.github/workflows/ci.yml`) corre en cada push:

- Lint y formato con Biome, TypeScript en modo estricto.
- Pruebas unitarias (Vitest) y de extremo a extremo (Playwright, Chrome), incluidas imágenes exportadas decodificadas de vuelta a su texto, uso sin conexión, política de seguridad de contenido, traducciones y comprobaciones de accesibilidad con axe (WCAG 2.2 AA, sin violaciones graves).
- Presupuesto de la primera carga: 60 KB gzip (`scripts/size-budget.mjs`; hoy unos 35 KB).
- Metas de Lighthouse: rendimiento de al menos 95, accesibilidad, buenas prácticas y SEO en 100 (`scripts/lighthouse-check.mjs`).

## Limitaciones

- Los códigos son siempre estáticos. No hay servicio de redirección, así que un código no se puede editar después de imprimirlo y nada cuenta lecturas. Es deliberado: un código impreso nunca depende de un servidor ni de una suscripción.
- El PDF incrusta una imagen de alta resolución (hasta 600 dpi, menos en páginas grandes). Para archivos de impresión totalmente vectoriales, usa el SVG.
- La revisión de lectura simula lectores; no prueba que todos los móviles lean el código. Decodifica con el `BarcodeDetector` de la plataforma cuando el navegador lo tiene y con jsQR en los demás casos.
- El constructor de Pix crea solo códigos estáticos. Los cobros dinámicos necesitan un proveedor de servicios de pago.
- El texto se limita a 2000 caracteres y a lo que cabe en un código versión 40 con la corrección de errores elegida.
- La herramienta de lote procesa hasta 500 filas en el hilo principal, en pasos pequeños.
- Safari anterior a 16.4 no tiene `CompressionStream`; el PDF allí sale con menor resolución y sin compresión.

## Historia del proyecto

| Período | Estado |
| --- | --- |
| 2022 | Una página que llamaba a una API de terceros para la imagen del QR. |
| 2025-08 | Generación local con `qrcodejs` y descarga en PNG. |
| 2025-09 | Logo, texto, colores y tres tamaños de exportación; salida con mapa de bits estirado. |
| 2026-10 | Reescritura: codificador propio, render vectorial, revisión de lectura, diez tipos de contenido, PWA. Ver [CHANGELOG.md](CHANGELOG.md). |

## Contribuir, seguridad, licencia

Ver [CONTRIBUTING.md](CONTRIBUTING.md) (incluye cómo añadir un idioma) y [SECURITY.md](SECURITY.md). Licencia MIT, ver [LICENSE](LICENSE) y [NOTICE](NOTICE).
