# Paletas CodifyQR

Cores sRGB. Cada paleta tem um único acento, ajustado por modo.

## A / Pátio

Azulejo, papel e verde: próximo, calmo e preciso.

| Modo | Fundo | Texto | Acento | Texto/fundo | Acento/fundo | Texto no acento | Contraste no acento |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Claro | `#F5F3EA` | `#183C36` | `#167568` | 10.87:1 | 5.00:1 | `#F5F3EA` | 5.00:1 |
| Escuro | `#102A27` | `#EDF6F1` | `#63DCC2` | 13.78:1 | 9.08:1 | `#102A27` | 9.08:1 |

## B / Pulso

Violeta e gelo: digital, expressivo e experimental.

| Modo | Fundo | Texto | Acento | Texto/fundo | Acento/fundo | Texto no acento | Contraste no acento |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Claro | `#F5F3FF` | `#211A3A` | `#5B3FD6` | 15.03:1 | 6.12:1 | `#F5F3FF` | 6.12:1 |
| Escuro | `#151123` | `#F4F0FF` | `#B5A0FF` | 16.50:1 | 8.30:1 | `#151123` | 8.30:1 |

## C / Barro

Terracota e areia: tátil, acolhedor e editorial.

| Modo | Fundo | Texto | Acento | Texto/fundo | Acento/fundo | Texto no acento | Contraste no acento |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Claro | `#FFF4E8` | `#39241E` | `#AD442D` | 13.40:1 | 5.32:1 | `#FFF4E8` | 5.32:1 |
| Escuro | `#251914` | `#FFF0E4` | `#FFAB7F` | 15.34:1 | 9.27:1 | `#251914` | 9.27:1 |

## Cálculo e uso

Cálculo WCAG: linearizar cada canal sRGB (`c/12.92` se `c ≤ 0.04045`; `((c + 0.055)/1.055)^2.4` nos demais casos), calcular `L = 0.2126R + 0.7152G + 0.0722B` e `(L_maior + 0.05)/(L_menor + 0.05)`.

As decisões usam valores sem arredondamento; a tabela mostra duas casas. Todos os pares da tabela atendem AA para texto normal (4.5:1). Todos os pares texto/fundo também atendem AAA (7:1). Os resultados pressupõem cores opacas, sem imagem ou padrão atrás do texto.

O texto de um botão preenchido usa a coluna ‘Texto no acento’. Não aplique automaticamente a cor de texto da página sobre o acento.

Recomendação: A / Pátio. O verde diferencia a marca sem depender de cores de alerta, e o papel aproxima o azulejo de um objeto impresso.

Os SVGs principais usam A. No mascote, a carcaça clara e o visor escuro formam um núcleo opaco que funciona nos seis fundos. Para adaptar à paleta, substitua a tinta, o papel e o detalhe de acento. A folha `palettes.svg` mostra as seis adaptações; no modo escuro, mantenha a carcaça clara e o visor escuro.

A expressão e o rótulo comunicam o estado; o acento é igual em OK, risco e falha. No produto, acompanhe o mascote de texto acessível. O padrão é decorativo e não deve entrar na área livre do QR nem servir de fundo para texto corrido.

A validação de contraste desta paleta não mede a leitura de QR. A leitura deve ser conferida sobre o QR final exportado.
