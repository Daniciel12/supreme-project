# Supreme — revisão de acessibilidade e performance

## Escopo concluído

A revisão transversal do Frontend v3 valida os contratos compartilhados que
afetam todas as rotas autenticadas e o login:

- um título único e descritivo para cada rota, usado também pelo anunciador de
  navegação do Next.js;
- hierarquia com um `h1` por página e conteúdo principal sem duplicação de
  landmarks;
- foco visível, atalho para o conteúdo, menu móvel com foco contido e retorno ao
  controle de origem;
- estados de carregamento e erro anunciados semanticamente;
- alvos de toque globais e layouts responsivos;
- motion limitado a `opacity` e `transform`, removido por
  `prefers-reduced-motion`;
- imagens do quadro com proporção intrínseca, carregamento tardio e decodificação
  assíncrona.

As garantias são cobertas por lint, typecheck, build e testes versionados. O
smoke autenticado continua sendo obrigatório depois do deploy.

## Decisão sobre imagens remotas

O Vision Board aceita os formatos de imagem permitidos pelo UploadThing,
inclusive SVG, e persiste hoje somente a URL final. O componente nativo `img`
foi mantido porque ativar o otimizador do Next.js sem MIME e dimensões reais
armazenados poderia quebrar imagens SVG já existentes.

O caminho atual evita deslocamento de layout com dimensões 4:3, posterga imagens
fora da tela e solicita decodificação assíncrona. Uma evolução futura pode
persistir MIME, largura e altura no callback autenticado e então usar
`next/image` somente para formatos raster seguros, por meio de uma migration
aditiva.

## Critérios para mudanças futuras

- manter títulos únicos para novas rotas;
- não remover foco visível, link de salto ou semântica de estados;
- não depender de cor, hover ou movimento para transmitir informação;
- preferir propriedades de composição em animações;
- documentar e medir qualquer aumento relevante de JavaScript ou mídia;
- validar desktop, mobile, teclado e movimento reduzido antes do deploy.
