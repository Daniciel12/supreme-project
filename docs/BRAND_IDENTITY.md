# Supreme — Identidade visual

## Direção: Momentum Noir

O Supreme é uma central pessoal de evolução. Sua identidade combina precisão operacional com energia humana: dados devem ser claros, enquanto progresso e ação recebem uma assinatura visual reconhecível.

## Princípios

1. **Foco antes de decoração.** Cor e brilho orientam a próxima ação; não competem com o conteúdo.
2. **Profundidade contida.** Superfícies obsidianas, bordas finas e sombras amplas separam planos sem imitar um painel administrativo genérico.
3. **Progresso como assinatura.** Linhas verticais, trilhas e halos discretos representam movimento contínuo.
4. **Módulos diferentes, mesma casa.** Finanças, hábitos, metas e saúde podem ter dados distintos, mas compartilham tipografia, superfícies, ritmo e estados.
5. **Acessibilidade é parte da marca.** Contraste, foco visível, alvos de toque e movimento reduzido não são opcionais.

## Paleta funcional

- **Obsidian:** canvas e superfícies; cria concentração sem usar preto absoluto em todos os planos.
- **Ember:** ação primária, progresso e presença da marca.
- **Aurora:** informação e ação secundária; não substitui Ember como cor principal.
- **Success, Warning e Danger:** estados semânticos preservados e nunca usados apenas como ornamento.

Os valores canônicos vivem em `src/app/design-tokens-v2.css`. Componentes devem consumir tokens semânticos, evitando cores literais novas.

## Assinaturas compartilhadas

- marca com gradiente Ember e brilho interno controlado;
- cabeçalhos de página com linha vertical de progresso;
- cards com superfície em camadas, borda sutil e sombra profunda;
- ações primárias em gradiente Ember;
- navegação ativa com sinal lateral e ícone tonal;
- tipografia Geist com títulos compactos e descrições arejadas.

## Motion

Motion comunica continuidade e resposta, nunca decoração autônoma. O shell usa
uma entrada curta de conteúdo e controles respondem a hover, toque e clique com
deslocamentos mínimos. As durações e curvas canônicas vivem em
`src/app/design-tokens-v2.css`.

- `fast` responde a hover e foco;
- `base` acompanha controles e painéis;
- `slow` introduz conteúdo novo sem atrasar a interação;
- animações de entrada usam somente `opacity` e `transform`, evitando custo de
  layout;
- `prefers-reduced-motion` remove entradas e transformações de controles.

## Restrições

- não usar gradientes em textos longos;
- não introduzir uma cor de destaque por módulo;
- não depender de hover para comunicar estado;
- não reduzir contraste em nome de sutileza;
- respeitar `prefers-reduced-motion` em toda microinteração.

## Evolução

Esta fundação deve ser aplicada incrementalmente. Login, Dashboard e cada módulo podem receber refinamento editorial sem alterar APIs, dados ou contratos funcionais.
