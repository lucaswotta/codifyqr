# CodifyQR / Printed matter

A interface usa papel, tinta e um vermelho de sinalização. Linhas de 1 px, rótulos monoespaçados e módulos quadrados vêm da construção do QR. O código gerado continua com suas próprias opções de cor.

| Modo | Papel | Superfície | Tinta | Texto secundário | Sinal | Sinal sobre fundo | Texto no sinal |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Claro | `#F3F0E7` | `#F9F7F0` | `#171714` | `#6B6760` | `#B12B22` | 5.69:1 | 5.69:1 |
| Escuro | `#171714` | `#211F1C` | `#F3F0E7` | `#BCB7AD` | `#FF6B57` | 6.41:1 | 6.41:1 |

Texto/fundo: 15.76:1 nos dois modos. Texto secundário/fundo: 4.94:1 no claro e 8.99:1 no escuro. Os pares atendem WCAG AA para texto normal. Cálculo: luminância relativa sRGB conforme WCAG 2.2, com razão `(L_maior + 0.05) / (L_menor + 0.05)`.

Fontes: pilha de sistema para títulos e leitura; pilha monoespaçada de sistema para rótulos, navegação e estados. Nenhum arquivo de fonte é carregado.
