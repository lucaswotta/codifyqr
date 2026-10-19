<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/wordmark-dark.svg">
  <img src="docs/media/wordmark-light.svg" alt="CodifyQR" height="84">
</picture>

<br>
<br>

**Un generador de códigos QR gratuito y de código abierto que funciona por completo en el navegador.**
Sin cuenta. Sin rastreo. Sin ninguna petición de red después de cargar la página.

<br>

<a href="https://github.com/lucaswotta/codifyqr/stargazers"><img src="https://img.shields.io/github/stars/lucaswotta/codifyqr?style=flat-square&logo=github&labelColor=000000&color=C8231A" alt="GitHub stars"></a>
<a href="https://github.com/lucaswotta/codifyqr/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/lucaswotta/codifyqr/ci.yml?branch=main&style=flat-square&label=CI&labelColor=000000&color=C8231A" alt="CI"></a>
<a href="https://github.com/lucaswotta/codifyqr/commits/main"><img src="https://img.shields.io/github/last-commit/lucaswotta/codifyqr?style=flat-square&labelColor=000000&color=C8231A" alt="Last commit"></a>
<a href="https://github.com/lucaswotta/codifyqr/issues"><img src="https://img.shields.io/github/issues/lucaswotta/codifyqr?style=flat-square&labelColor=000000&color=C8231A" alt="Open issues"></a>
<a href="LICENSE"><img src="https://img.shields.io/github/license/lucaswotta/codifyqr?style=flat-square&labelColor=000000&color=C8231A" alt="MIT license"></a>
<a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-C8231A?style=flat-square&labelColor=000000" alt="Pull requests welcome"></a>
<img src="https://img.shields.io/badge/tracking-none-C8231A?style=flat-square&labelColor=000000" alt="No tracking">
<img src="https://img.shields.io/badge/works-offline-C8231A?style=flat-square&labelColor=000000" alt="Works offline">

<br>

[**Abrir la app**](https://lucaswotta.github.io/codifyqr/) ·
[Funciones](#funciones) ·
[Ejecútalo tú mismo](#ejecútalo-tú-mismo) ·
[Preguntas frecuentes](#preguntas-frecuentes) ·
[Contribuir](CONTRIBUTING.md) ·
[English](README.md) ·
[Português](README.pt-BR.md)

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/hero-dark.png">
  <img src="docs/media/hero-light.png" alt="Editor de CodifyQR: tipos de contenido a la izquierda, vista previa en el centro, revisión de lectura y descargas a la derecha" width="900">
</picture>

</div>

## Por qué CodifyQR

- **Te dice si el código se lee.** Antes de descargar, la app decodifica el código terminado como lo haría la cámara de un móvil (pequeño, borroso, desde lejos) y, cuando falla, explica el motivo: poco contraste, colores invertidos, un logo demasiado grande, un borde fino. Ofrece la corrección con un clic.
- **Nada sale de tu dispositivo.** La página no hace peticiones después de cargar, y la política de seguridad de contenido (`connect-src 'none'`) lo hace verificable, no una promesa. Las claves Pix, las contraseñas de Wi-Fi y los datos de contacto se quedan en tu pestaña.
- **El código nunca caduca.** Todo código es estático: el contenido está dentro de la imagen. No hay servicio de redirección, suscripción ni panel al que puedas perder el acceso.
- **Hecho para imprimir.** La salida es SVG vectorial, PNG de hasta 4096 px y PDF con el tamaño real en centímetros, con un aviso cuando los módulos serían demasiado pequeños para imprimir.
- **Habla Pix.** BR Code estático con el CRC16, con la clave validada (CPF, CNPJ incluido el alfanumérico, teléfono, correo, clave aleatoria) antes de dibujar el código.

<div align="center">

![CodifyQR creando un código QR con estilo, fallando la revisión de lectura y corrigiéndola](docs/media/demo.gif)

</div>

## Funciones

| Área | Qué obtienes |
| --- | --- |
| **Contenido** | Enlace o texto, Pix, Wi-Fi, contacto (vCard), correo, SMS, WhatsApp, ubicación, evento de calendario, enlace a tienda de apps. |
| **Estilo** | Cinco formas de módulo, tres marcos y tres centros de ojo, degradado, fondo transparente, borde ajustable, colores con ajustes predefinidos. |
| **Logo** | Sube PNG, JPG, WebP o SVG. Los módulos bajo el logo se quitan en lugar de taparse, y el tamaño se limita a lo que la corrección de errores puede recuperar. |
| **Marcos** | Pegatina, tarjeta de visita, tarjeta de mesa, cartel de Wi-Fi y cobro Pix, con texto editable. |
| **Revisión de lectura** | Tres calidades simuladas de cámara, causa del fallo, corrección con un clic. |
| **Exportación** | PNG (512 a 4096 px), SVG, PDF con tamaño físico, copiar al portapapeles, compartir. |
| **Lote** | Pega líneas o importa un CSV (contenido y nombre de archivo opcional), hasta 500 filas, descargado como ZIP. |
| **Lector** | Cámara o imagen. Nunca abre un enlace por sí solo y avisa de acortadores, dominios con caracteres parecidos, direcciones IP, `http`, credenciales incrustadas y contenido `javascript:` o `data:`. |
| **Estilos guardados** | Guarda estilos en el navegador, expórtalos como archivo o comparte un enlace (`#s=...`). Solo se guarda el aspecto, nunca el contenido. |
| **Ayuda y atajos** | Una guía integrada y atajos de teclado para tipos, paneles, exportaciones, tema e idioma. Los atajos de una tecla se pueden desactivar. |
| **App** | PWA instalable que funciona sin conexión, temas claro y oscuro, inglés, portugués (Brasil) y español, accesible (WCAG 2.2 AA, comprobado en la CI). |

<div align="center">

![Formas de módulo, degradado y logo](docs/media/styles.png)

![Pegatina, tarjeta de visita, tarjeta de mesa, cartel de Wi-Fi y cobro Pix](docs/media/frames.png)

</div>

### La revisión de lectura

<div align="center">

![La revisión de lectura en sus tres estados: se lee bien, se lee pero no en todas partes, probablemente falla](docs/media/read-check.png)

</div>

La revisión dibuja el código con 3, 5 y 10 píxeles por módulo, lo suaviza con un desenfoque de cámara mediocre y lo decodifica con el `BarcodeDetector` de la plataforma cuando el navegador lo tiene, y con [jsQR](https://github.com/cozmo/jsQR) en los demás casos. Cuando un código con estilo falla en un tamaño, también reintenta con copias desenfocadas y reducidas a la mitad, porque las apps de cámara hacen lo mismo.

Es una simulación. Detecta las causas comunes de códigos ilegibles; no prueba que todos los móviles lean el tuyo, así que prueba una impresión antes de pedir mil.

### En el móvil

En pantallas estrechas la vista previa queda fija arriba y una barra inferior cambia entre tipo, contenido, estilo, marco y descargar. La página nunca se desplaza: cada panel se desplaza por dentro.

<div align="center">

![Diseño en el móvil: paneles de contenido, estilo y descarga](docs/media/mobile.png)

</div>

## Ejecútalo tú mismo

La app es un sitio estático. Úsala en línea, ejecútala localmente o copia el build a cualquier alojamiento estático.

**Requisitos:** Node 22 o más nuevo y pnpm 12 (`corepack enable`). Google Chrome solo hace falta para las pruebas de extremo a extremo.

```sh
git clone https://github.com/lucaswotta/codifyqr.git
cd codifyqr
pnpm install
pnpm dev          # http://localhost:5173/codifyqr/
```

```sh
pnpm build        # comprobación de tipos y luego el sitio en dist/
pnpm preview      # sirve dist/ en http://localhost:4173/codifyqr/
```

**Alojarlo tú mismo.** Copia `dist/` a cualquier alojamiento estático (GitHub Pages, Netlify, Cloudflare Pages, una carpeta de nginx). El build usa la ruta base `/codifyqr/`. Define `CODIFYQR_BASE` para cambiarla, por ejemplo `CODIFYQR_BASE=/ pnpm build` para servir desde la raíz de un dominio. Si tu alojamiento puede enviar cabeceras, añade la misma `Content-Security-Policy` que la página define en una etiqueta `<meta>` (ver `vite.config.ts`) y `frame-ancestors 'none'`.

## Atajos de teclado

Pulsa `?` en la app para verlos. Los atajos de una tecla solo funcionan cuando el foco no está en un campo y se pueden desactivar en esa ventana.

| Teclas | Acción |
| --- | --- |
| `1` a `0` | Cambiar el tipo de contenido |
| `C` `S` `F` | Abrir Contenido, Estilo o Marco |
| `Ctrl` `K` | Enfocar el campo de contenido |
| `X` | Aplicar la corrección sugerida |
| `Ctrl` `Enter` o `P` | Descargar PNG |
| `V` / `D` / `Y` | Descargar SVG / abrir las opciones de PDF / copiar la imagen |
| `[` `]` | Herramienta anterior o siguiente (Crear, Lote, Leer) |
| `T` / `L` / `H` | Cambiar tema / idioma / abrir la ayuda |

## Preguntas frecuentes

**¿Es gratis? ¿Cuál es la trampa?**
Es gratis y con licencia MIT. No hay plan de pago, cuenta ni servidor que pagar.

**¿Los códigos caducan?**
No. Son estáticos: el contenido está codificado en la propia imagen. El costo es que un código impreso no se puede editar después y nada cuenta las lecturas.

**¿Me rastrea o sube mis datos?**
No. La página publicada no hace peticiones de red después de cargar. Una prueba de extremo a extremo falla si alguna sale del origen, y la CSP la bloquea de todos modos. Los estilos guardados y los enlaces de estilo llevan solo el aspecto.

**¿Por qué la revisión dice "riesgo" para un código que mi móvil lee?**
La revisión es más estricta que un buen móvil. Simula una imagen pequeña y suave. Riesgo significa "se lee en buenas condiciones, puede fallar en malas". Usa la corrección sugerida o imprime más grande.

**¿Qué tamaño debo imprimir?**
Al menos 2 cm de ancho para un enlace corto. La herramienta de PDF muestra el tamaño de un módulo en milímetros y avisa por debajo de 0,4 mm. Más texto significa módulos más pequeños, así que acorta el contenido o imprime más grande.

**¿Por qué la ciudad de Pix es opcional?**
El formato BR Code exige el campo ciudad, pero los bancos no comprueban su valor. Si lo dejas vacío, el código lleva `BRASIL`.

**¿Puedo hacer un cobro Pix dinámico?**
No. Los cobros dinámicos necesitan un proveedor de servicios de pago. CodifyQR crea códigos Pix estáticos.

**¿Qué navegadores funcionan?**
La suite de pruebas corre en Chrome. La app usa APIs web estándar que también tienen Firefox, Edge y Safari actuales (iOS 16 o más nuevo), pero esos navegadores todavía no están en la CI. Se agradecen los reportes.

**¿Puedo alojarlo yo mismo?**
Sí, ver [Ejecútalo tú mismo](#ejecútalo-tú-mismo).

## Cómo funciona

`src/qr/encoder.ts` construye la matriz de módulos (versiones 1 a 40, modos numérico, alfanumérico y byte) y `src/qr/svg.ts` la dibuja como trazados vectoriales. PNG y PDF se rasterizan desde ese vector al tamaño elegido, así que las exportaciones grandes siguen nítidas. El codificador sigue el algoritmo del [generador de códigos QR de Project Nayuki](https://www.nayuki.io/page/qr-code-generator-library) (MIT), reescrito en TypeScript.

Las pruebas unitarias decodifican de vuelta con jsQR todas las versiones (1 a 40) y todos los niveles de corrección. La versión 23 se comprueba por estructura, porque jsQR lista una posición errónea para su patrón de alineación. Un script aparte (`scripts/crosscheck`) exporta 48 PNG con estilo y los lee con [zxing-cpp](https://github.com/zxing-cpp/zxing-cpp), un decodificador independiente: se leyeron 48 de 48.

## Privacidad y seguridad

- Política de seguridad de contenido en la página publicada: `default-src 'none'`, `script-src 'self'`, `connect-src 'none'`.
- Sin analítica, sin cookies, sin fuentes, scripts ni imágenes externos. La fuente (Geist) va incluida.
- Las claves Pix, las contraseñas de Wi-Fi y otros contenidos nunca se guardan, se ponen en una URL ni se escriben en un registro. Los nombres de los archivos exportados no contienen el contenido.
- Los datos de estilo de un enlace o archivo se validan campo a campo antes de usarse. Los SVG de logo se incrustan como imagen, así que los scripts dentro de ellos no se ejecutan.

Reporta vulnerabilidades en privado, ver [SECURITY.md](SECURITY.md).

## Controles de calidad

La CI corre en cada rama y bloquea el despliegue cuando algo falla:

- Lint y formato con Biome, TypeScript en modo estricto.
- Pruebas unitarias (Vitest) y de extremo a extremo (Playwright, Chrome): cada tipo de contenido se exporta y se decodifica de vuelta, además de estilos, sliders, marcos, PDF, lote, una cámara falsa que filma un código QR, uso sin conexión, la política de seguridad de contenido, traducciones y una comprobación de que la página nunca se desplaza en ningún tamaño.
- Comprobaciones de accesibilidad con axe (WCAG 2.2 AA, sin violaciones graves).
- Presupuesto de la primera carga: 80 KB gzip, fuente incluida (`scripts/size-budget.mjs`; hoy unos 70 KB).
- Lighthouse: rendimiento de al menos 95, accesibilidad, buenas prácticas y SEO en 100 (`scripts/lighthouse-check.mjs`).

## Limitaciones

- Los códigos son siempre estáticos. No hay servicio de redirección, así que un código no se puede editar después de imprimirlo y nada cuenta las lecturas. Es deliberado.
- El PDF incrusta una imagen de alta resolución (hasta 600 dpi, menos en páginas grandes). Para archivos de impresión totalmente vectoriales, usa el SVG.
- La revisión de lectura es una simulación y no prueba que todos los móviles lean el código.
- El constructor de Pix crea solo códigos estáticos.
- El texto se limita a 2000 caracteres y a lo que cabe en un código versión 40 con la corrección de errores elegida.
- La herramienta de lote procesa hasta 500 filas en el hilo principal, en pasos pequeños ([issue #12](https://github.com/lucaswotta/codifyqr/issues/12)).
- Safari anterior a 16.4 no tiene `CompressionStream`; el PDF allí sale con menor resolución y sin compresión.

## Hoja de ruta

Las ideas abiertas, con criterios de aceptación, están en las [issues](https://github.com/lucaswotta/codifyqr/issues): PDF vectorial para códigos simples, segmentos mixtos numérico/alfanumérico/byte para reducir los códigos, un Web Worker para el lote, una vista copiable del texto codificado y más idiomas. Las buenas primeras tareas están etiquetadas.

## Contribuir

Los pull requests son bienvenidos. [CONTRIBUTING.md](CONTRIBUTING.md) cubre la instalación, las reglas, cómo añadir un idioma (las traducciones son archivos JSON simples, comprobados por una prueba) y dónde está cada cosa en el código. Reportes de seguridad: [SECURITY.md](SECURITY.md).

```text
src/
  qr/         codificador, renderizador SVG con estilos, marcos
  payloads/   Pix, Wi-Fi, contacto, correo y los otros constructores de contenido
  verify/     revisión de lectura, correcciones sugeridas, análisis del lector
  export/     PNG, PDF, ZIP, CSV
  app/        interfaz (editor, lote, lector, ventanas, iconos)
  locales/    en.json, pt-BR.json, es.json
scripts/      presupuestos, generación de medios y marca, comparación con otro decodificador
brand/        fuentes del logo, la mascota y la paleta
```

## Historia del proyecto

| Período | Estado |
| --- | --- |
| 2022 | Una página que llamaba a una API de terceros para la imagen del QR. |
| 2025-08 | Generación local con `qrcodejs` y descarga en PNG. |
| 2025-09 | Logo, texto, colores y tres tamaños de exportación; salida con mapa de bits estirado. |
| 2026-10 | Reescritura: codificador propio, render vectorial, revisión de lectura, diez tipos de contenido, PWA, interfaz nueva. Ver [CHANGELOG.md](CHANGELOG.md). |

![Las cuatro fases una tras otra, a pantalla completa, grabadas desde los commits reales](docs/media/evolution/timeline.gif)

Cada fase se grabó desde su propio commit (`004d276`, `c46d0a5`, `cd6e7c9` y el build actual): [2022](docs/media/evolution/2022-10.gif), [2025-08](docs/media/evolution/2025-08.gif), [2025-09](docs/media/evolution/2025-09.gif), [2026-10](docs/media/evolution/2026-10.gif). `scripts/media/evolution.mjs` las regenera.

## Agradecimientos

[Project Nayuki](https://www.nayuki.io/page/qr-code-generator-library) (algoritmo del QR), [jsQR](https://github.com/cozmo/jsQR) (decodificador), [zxing-cpp](https://github.com/zxing-cpp/zxing-cpp) (comparación), [Geist](https://github.com/vercel/geist-font) (fuente), [Lucide](https://lucide.dev) and [Simple Icons](https://simpleicons.org) (iconos). Licencias en [NOTICE](NOTICE). Las marcas de Pix y WhatsApp pertenecen a sus dueños y se usan solo para identificar el tipo de contenido.

## Licencia

[MIT](LICENSE) © Lucas Motta
