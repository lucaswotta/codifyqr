# CodifyQR / Printed matter

A interface usa papel, tinta e um vermelho de sinalização. Linhas de 1 px, rótulos monoespaçados e módulos quadrados vêm da construção do QR. O código gerado continua com suas próprias opções de cor.

| Modo | Papel | Superfície | Tinta | Texto secundário | Sinal | Sinal sobre fundo | Texto no sinal |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Claro | `#F5F4EF` | `#F9F7F0` | `#000000` | `#6B6760` | `#C8231A` | 5.69:1 | 5.69:1 |
| Escuro | `#000000` | `#211F1C` | `#F5F4EF` | `#BCB7AD` | `#FF6B57` | 6.41:1 | 6.41:1 |

Texto/fundo: 15.76:1 nos dois modos. Texto secundário/fundo: 4.94:1 no claro e 8.99:1 no escuro. Os pares atendem WCAG AA para texto normal. Cálculo: luminância relativa sRGB conforme WCAG 2.2, com razão `(L_maior + 0.05) / (L_menor + 0.05)`.

Fontes: pilha de sistema para títulos e leitura; pilha monoespaçada de sistema para rótulos, navegação e estados. Nenhum arquivo de fonte é carregado.
