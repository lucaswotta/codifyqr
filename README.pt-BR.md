<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/wordmark-dark.svg">
  <img src="docs/media/wordmark-light.svg" alt="CodifyQR" height="84">
</picture>

<br>
<br>

**Um gerador de QR Code gratuito e de código aberto que roda inteiro no navegador.**

Sem conta. Sem rastreio. Sem nenhuma requisição de rede depois que a página carrega.

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

[**Abrir o app**](https://lucaswotta.github.io/codifyqr/) ·
[Recursos](#recursos) ·
[Rodar você mesmo](#rodar-você-mesmo) ·
[Perguntas frequentes](#perguntas-frequentes) ·
[Contribuir](CONTRIBUTING.md) ·
[English](README.md) ·
[Español](README.es.md)

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/hero-dark.png">
  <img src="docs/media/hero-light.png" alt="Editor do CodifyQR: tipos de conteúdo à esquerda, prévia no centro, conferência de leitura e downloads à direita" width="900">
</picture>

</div>

## Por que o CodifyQR

- **Ele diz se o código lê.** Antes de baixar, o app decodifica o código pronto como a câmera de um celular faria (pequeno, borrado, de longe) e, quando falha, explica o motivo: contraste baixo, cores invertidas, logo grande demais, borda fina. Oferece a correção com um clique.
- **Nada sai do seu aparelho.** A página não faz requisição depois de carregar, e a política de segurança de conteúdo (`connect-src 'none'`) torna isso verificável, não uma promessa. Chaves Pix, senhas de Wi-Fi e dados de contato ficam na sua aba.
- **O código nunca expira.** Todo código é estático: o conteúdo está dentro da imagem. Não há serviço de redirecionamento, assinatura nem painel que você possa perder.
- **Feito para imprimir.** A saída é SVG vetorial, PNG de até 4096 px e PDF com o tamanho real em centímetros, com aviso quando os módulos ficariam pequenos demais para imprimir.
- **Fala Pix.** BR Code estático com o CRC16, com a chave validada (CPF, CNPJ inclusive o alfanumérico, telefone, e-mail, chave aleatória) antes de desenhar o código.

<div align="center">

![CodifyQR criando um QR Code estilizado, reprovando na conferência de leitura e corrigindo](docs/media/demo.gif)

</div>

## Recursos

| Área | O que você tem |
| --- | --- |
| **Conteúdo** | Link ou texto, Pix, Wi-Fi, contato (vCard), e-mail, SMS, WhatsApp, localização, evento de calendário, link de loja de apps. |
| **Estilo** | Cinco formas de módulo, três molduras e três centros de olho, degradê, fundo transparente, borda ajustável, cores com presets. |
| **Logo** | Envie PNG, JPG, WebP ou SVG. Os módulos sob o logo são removidos em vez de cobertos, e o tamanho fica limitado ao que a correção de erro consegue recuperar. |
| **Molduras** | Adesivo, cartão de visita, cartão de mesa, placa de Wi-Fi e cobrança Pix, com texto editável. |
| **Conferência de leitura** | Três qualidades simuladas de câmera, causa da falha, correção com um clique. |
| **Exportação** | PNG (512 a 4096 px), SVG, PDF com tamanho físico, copiar, compartilhar. |
| **Lote** | Cole linhas ou importe um CSV (conteúdo e nome de arquivo opcional), até 500 linhas, baixado como ZIP. |
| **Leitor** | Câmera ou imagem. Nunca abre um link sozinho e avisa sobre encurtadores, domínios com caracteres parecidos, endereços IP, `http`, credenciais embutidas e conteúdo `javascript:` ou `data:`. |
| **Estilos salvos** | Salve visuais no navegador, exporte como arquivo ou compartilhe um link (`#s=...`). Só o visual é guardado, nunca o conteúdo. |
| **Ajuda e atalhos** | Um guia embutido e atalhos de teclado para tipos, painéis, exportações, tema e idioma. Os atalhos de uma tecla podem ser desligados. |
| **App** | PWA instalável que funciona offline, temas claro e escuro, inglês, português (Brasil) e espanhol, acessível (WCAG 2.2 AA, verificado na CI). |

<div align="center">

![Formas de módulo, degradê e logo](docs/media/styles.png)

![Adesivo, cartão de visita, cartão de mesa, placa de Wi-Fi e cobrança Pix](docs/media/frames.png)

</div>

### A conferência de leitura

<div align="center">

![A conferência de leitura nos três estados: lê direitinho, lê mas não em todo lugar, provavelmente falha](docs/media/read-check.png)

</div>

A conferência desenha o código com 3, 5 e 10 pixels por módulo, suaviza com um desfoque de câmera mediana e decodifica com o `BarcodeDetector` da plataforma quando o navegador tem, e com o [jsQR](https://github.com/cozmo/jsQR) nos demais casos. Quando um código estilizado falha em um tamanho, ela tenta de novo com cópias borradas e reduzidas pela metade, porque os apps de câmera fazem o mesmo.

É uma simulação. Ela pega as causas comuns de código ilegível; não prova que todo celular vai ler o seu, então teste uma impressão antes de encomendar mil.

### No celular

Em telas estreitas a prévia fica fixa no topo e uma barra inferior alterna entre tipo, conteúdo, estilo, moldura e baixar. A página nunca rola: cada painel rola por dentro.

<div align="center">

![Layout no celular: painéis de conteúdo, estilo e download](docs/media/mobile.png)

</div>

## Rodar você mesmo

O app é um site estático. Use online, rode localmente ou copie o build para qualquer hospedagem estática.

**Requisitos:** Node 22 ou mais novo e pnpm 12 (`corepack enable`). O Google Chrome só é necessário para os testes ponta a ponta.

```sh
git clone https://github.com/lucaswotta/codifyqr.git
cd codifyqr
pnpm install
pnpm dev          # http://localhost:5173/codifyqr/
```

```sh
pnpm build        # checagem de tipos e depois o site em dist/
pnpm preview      # serve dist/ em http://localhost:4173/codifyqr/
```

**Hospedar por conta própria.** Copie `dist/` para qualquer hospedagem estática (GitHub Pages, Netlify, Cloudflare Pages, uma pasta do nginx). O build usa o caminho base `/codifyqr/`. Defina `CODIFYQR_BASE` para mudar, por exemplo `CODIFYQR_BASE=/ pnpm build` para servir da raiz de um domínio. Se a sua hospedagem envia cabeçalhos, adicione a mesma `Content-Security-Policy` que a página define em uma tag `<meta>` (veja `vite.config.ts`) e `frame-ancestors 'none'`.

## Atalhos de teclado

Aperte `?` no app para ver a lista. Os atalhos de uma tecla só funcionam quando o foco não está em um campo e podem ser desligados nessa janela.

| Teclas | Ação |
| --- | --- |
| `1` a `0` | Trocar o tipo de conteúdo |
| `C` `S` `F` | Abrir Conteúdo, Estilo ou Moldura |
| `Ctrl` `K` | Focar o campo de conteúdo |
| `X` | Aplicar a correção sugerida |
| `Ctrl` `Enter` ou `P` | Baixar PNG |
| `V` / `D` / `Y` | Baixar SVG / abrir as opções de PDF / copiar a imagem |
| `[` `]` | Ferramenta anterior ou próxima (Criar, Lote, Ler) |
| `T` / `L` / `H` | Trocar tema / idioma / abrir a ajuda |

## Perguntas frequentes

**É grátis? Qual é a pegadinha?**
É grátis e com licença MIT. Não há plano pago, conta nem servidor para pagar.

**Os códigos expiram?**
Não. São estáticos: o conteúdo está codificado na própria imagem. O custo é que um código impresso não pode ser editado depois e nada conta leituras.

**Ele me rastreia ou envia meus dados?**
Não. A página publicada não faz requisição de rede depois de carregar. Um teste ponta a ponta falha se alguma sair da origem, e a CSP bloqueia de qualquer forma. Estilos salvos e links de estilo guardam só o visual.

**Por que a conferência diz "risco" para um código que o meu celular lê?**
A conferência é mais rígida que um bom celular. Ela simula uma imagem pequena e suave. Risco quer dizer "lê em boas condições, pode falhar em condições ruins". Use a correção sugerida ou imprima maior.

**Qual tamanho devo imprimir?**
Pelo menos 2 cm de largura para um link curto. A ferramenta de PDF mostra o tamanho de um módulo em milímetros e avisa abaixo de 0,4 mm. Mais texto significa módulos menores, então encurte o conteúdo ou imprima maior.

**Por que a cidade do Pix é opcional?**
O formato do BR Code exige o campo cidade, mas os bancos não conferem o valor. Se você deixar vazio, o código leva `BRASIL`.

**Dá para fazer cobrança Pix dinâmica?**
Não. Cobranças dinâmicas exigem um prestador de serviço de pagamento. O CodifyQR cria códigos Pix estáticos.

**Quais navegadores funcionam?**
A suíte de testes roda no Chrome. O app usa APIs web padrão que o Firefox, o Edge e o Safari atuais (iOS 16 ou mais novo) também têm, mas esses navegadores ainda não estão na CI. Relatos são bem-vindos.

**Posso hospedar por conta própria?**
Sim, veja [Rodar você mesmo](#rodar-você-mesmo).

## Como funciona

O `src/qr/encoder.ts` monta a matriz de módulos (versões 1 a 40, modos numérico, alfanumérico e byte) e o `src/qr/svg.ts` a desenha como caminhos vetoriais. PNG e PDF são rasterizados desse vetor no tamanho escolhido, então exportações grandes continuam nítidas. O codificador segue o algoritmo do [gerador de QR Code do Project Nayuki](https://www.nayuki.io/page/qr-code-generator-library) (MIT), reescrito em TypeScript.

Os testes unitários decodificam de volta com o jsQR todas as versões (1 a 40) e todos os níveis de correção. A versão 23 é conferida pela estrutura, porque o jsQR lista uma posição errada para o padrão de alinhamento dela. Um script à parte (`scripts/crosscheck`) exporta 48 PNGs estilizados e os lê com o [zxing-cpp](https://github.com/zxing-cpp/zxing-cpp), um decodificador independente: 48 de 48 foram lidos.

## Privacidade e segurança

- Política de segurança de conteúdo na página publicada: `default-src 'none'`, `script-src 'self'`, `connect-src 'none'`.
- Sem analytics, sem cookies, sem fontes, scripts ou imagens externos. A fonte (Geist) vai junto com o app.
- Chaves Pix, senhas de Wi-Fi e outros conteúdos nunca são guardados, colocados em URL nem escritos em log. Os nomes dos arquivos exportados não contêm o conteúdo.
- Dados de estilo vindos de um link ou arquivo são validados campo a campo antes do uso. SVGs de logo entram como imagem, então scripts dentro deles não rodam.

Reporte vulnerabilidades em particular, veja o [SECURITY.md](SECURITY.md).

## Verificações de qualidade

A CI roda em toda branch e bloqueia o deploy quando algo falha:

- Lint e formatação com Biome, TypeScript em modo estrito.
- Testes unitários (Vitest) e ponta a ponta (Playwright, Chrome): todo tipo de conteúdo é exportado e decodificado de volta, além de estilos, sliders, molduras, PDF, lote, uma câmera falsa que filma um QR Code, uso offline, a política de segurança de conteúdo, traduções e uma checagem de que a página nunca rola em nenhum tamanho.
- Checagens de acessibilidade com axe (WCAG 2.2 AA, sem violações sérias).
- Orçamento do primeiro carregamento: 80 KB gzip, fonte incluída (`scripts/size-budget.mjs`; hoje cerca de 70 KB).
- Lighthouse: desempenho de pelo menos 95, acessibilidade, boas práticas e SEO em 100 (`scripts/lighthouse-check.mjs`).

## Limitações

- Os códigos são sempre estáticos. Não há serviço de redirecionamento, então um código não pode ser editado depois de impresso e nada conta leituras. É proposital.
- O PDF embute uma imagem de alta resolução (até 600 dpi, menos em páginas grandes). Para arquivos de impressão totalmente vetoriais, use o SVG.
- A conferência de leitura é uma simulação e não prova que todo celular vai ler o código.
- O construtor de Pix cria só códigos estáticos.
- O texto é limitado a 2000 caracteres e ao que cabe em um código versão 40 com a correção de erro escolhida.
- A ferramenta de lote processa até 500 linhas na thread principal, em passos pequenos ([issue #12](https://github.com/lucaswotta/codifyqr/issues/12)).
- O Safari anterior à 16.4 não tem `CompressionStream`; o PDF nele sai com resolução menor e sem compressão.

## Roteiro

As ideias abertas, com critérios de aceite, estão nas [issues](https://github.com/lucaswotta/codifyqr/issues): PDF vetorial para códigos simples, segmentos mistos numérico/alfanumérico/byte para reduzir os códigos, Web Worker para o lote, uma visão copiável do texto codificado e mais idiomas. As boas primeiras tarefas estão marcadas.

## Contribuir

Pull requests são bem-vindos. O [CONTRIBUTING.md](CONTRIBUTING.md) cobre a instalação, as regras, como adicionar um idioma (as traduções são arquivos JSON simples, conferidos por um teste) e onde cada coisa está no código. Relatos de segurança: [SECURITY.md](SECURITY.md).

```text
src/
  qr/         codificador, renderizador SVG com estilos, molduras
  payloads/   Pix, Wi-Fi, contato, e-mail e os outros construtores de conteúdo
  verify/     conferência de leitura, correções sugeridas, análise do leitor
  export/     PNG, PDF, ZIP, CSV
  app/        interface (editor, lote, leitor, janelas, ícones)
  locales/    en.json, pt-BR.json, es.json
scripts/      orçamentos, geração de mídia e marca, comparação com outro decodificador
brand/        fontes do logo, do mascote e da paleta
```

## Histórico do projeto

| Período | Estado |
| --- | --- |
| 2022 | Uma página que chamava uma API de terceiros para a imagem do QR. |
| 2025-08 | Geração local com `qrcodejs` e download em PNG. |
| 2025-09 | Logo, texto, cores e três tamanhos de exportação; saída com bitmap esticado. |
| 2026-10 | Reescrita: codificador próprio, renderização vetorial, conferência de leitura, dez tipos de conteúdo, PWA, interface nova. Veja o [CHANGELOG.md](CHANGELOG.md). |

![As quatro fases uma após a outra, em tela cheia, gravadas dos commits reais](docs/media/evolution/timeline.gif)

Cada fase foi gravada do próprio commit (`004d276`, `c46d0a5`, `cd6e7c9` e o build atual): [2022](docs/media/evolution/2022-10.gif), [2025-08](docs/media/evolution/2025-08.gif), [2025-09](docs/media/evolution/2025-09.gif), [2026-10](docs/media/evolution/2026-10.gif). O `scripts/media/evolution.mjs` as regenera.

## Agradecimentos

[Project Nayuki](https://www.nayuki.io/page/qr-code-generator-library) (algoritmo do QR), [jsQR](https://github.com/cozmo/jsQR) (decodificador), [zxing-cpp](https://github.com/zxing-cpp/zxing-cpp) (comparação), [Geist](https://github.com/vercel/geist-font) (fonte), [Lucide](https://lucide.dev) and [Simple Icons](https://simpleicons.org) (ícones). Licenças no [NOTICE](NOTICE). As marcas do Pix e do WhatsApp pertencem aos seus donos e são usadas só para identificar o tipo de conteúdo.

## Licença

[MIT](LICENSE) © Lucas Motta
