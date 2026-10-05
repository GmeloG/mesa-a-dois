# Mesa a Dois — GitHub Pages + Firebase

Aplicação em português de Portugal para Gonçalo e Inês planearem refeições, quantidades individuais, calorias/macros e compras. React + TypeScript + Vite. O site é estático e fica no **GitHub Pages**; o **Firebase Authentication e Cloud Firestore** guardam a sessão e o plano privado partilhado. Não precisa de Firebase Hosting, Cloudflare, servidor próprio ou chaves de IA.

## Experimentar no computador

Requisitos: Node.js 22.13+ e pnpm (versão declarada em package.json).

```sh
npx.cmd --yes pnpm@11.25.0 install --frozen-lockfile
npx.cmd --yes pnpm@11.25.0 dev
```

Abrir o endereço mostrado no terminal. Escolher **Experimentar demonstração**: inclui uma semana de exemplo e guarda as alterações apenas nesse navegador. Não é necessário configurar Firebase para experimentar. Os dados de demonstração não são transferidos para o plano real.

Os comandos acima são para Windows e evitam permissões de administrador. Em macOS/Linux, usa `npx` em vez de `npx.cmd`.

Nos restantes comandos deste README, `pnpm X` corresponde no Windows a `npx.cmd --yes pnpm@11.25.0 X`.

Se a pasta do projeto estiver no OneDrive, a pasta `node_modules/` (dezenas de milhares de ficheiros) será sincronizada. É preferível trabalhar numa cópia fora do OneDrive (por exemplo `C:\Users\<nome>\dev\mesa-a-dois`) e usar o GitHub como cópia de segurança.

O ZIP contém apenas o código e a configuração necessários. `node_modules/` é criada ao instalar dependências; `dist/` é criada ao compilar. Não é necessário carregar nenhuma dessas pastas para o GitHub. Não abrir index.html por duplo clique.

Se já configuraste o Firebase numa versão anterior, guarda uma cópia de `public/firebase-config.js` e repõe-a na pasta nova depois de extrair o ZIP.

## 1. Configurar o Firebase

1. Na consola Firebase, criar um projeto e registar uma **aplicação Web**. Não ativar Hosting.
2. Em Definições do projeto → As tuas aplicações, copiar **apenas os valores** da configuração Web para **public/firebase-config.js** (há um modelo em `firebase-config.example.js`). O ficheiro deve ter a forma `window.MESA_FIREBASE_CONFIG = { apiKey: "...", authDomain: "...", projectId: "...", appId: "..." };`. **Não colar o exemplo da consola com `import { initializeApp } ...`**: esse formato não funciona aqui e a aplicação mostra "Falta configurar o Firebase". Os valores Web são identificadores públicos; a proteção dos dados está nas regras e na autenticação. Nunca colocar ficheiros de conta de serviço, chaves privadas ou palavras-passe no repositório.
3. Em **Authentication → Sign-in method**, ativar Email/Password. Em **Users**, criar as duas contas, uma para cada pessoa. Guardar as palavras-passe de forma privada e copiar os dois UID.
4. Em **Firestore Database**, criar a base `(default)` em modo de produção. Usar Cloud Firestore Standard/Native. Escolher a região adequada antes de criar a base.
5. No separador **Rules**, substituir as regras pelo conteúdo de `firestore.rules` e publicar. Não usar regras de acesso público ou modo de teste.
6. No separador **Data**, criar a coleção `access`. Criar um documento cujo ID seja o UID do Gonçalo, com um campo de tipo string: `householdId = goncalo-ines`. Criar outro documento com o UID da Inês e exatamente o mesmo campo e valor. Estes documentos são criados pelo proprietário na consola; a aplicação não pode conceder acesso.
7. Em Authentication → Settings → Authorized domains, adicionar `O_TEU_UTILIZADOR.github.io` (só domínio, sem https nem nome do repositório). Adicionar `localhost` se quiseres testar login local.

Ao entrar pela primeira vez, a aplicação cria o documento `households/goncalo-ines/state/main`. Os dois utilizadores consultam e editam esse mesmo plano. As metas começam por definir e o plano real começa vazio. O botão **Usar semana de exemplo** é opcional.

As regras têm testes automáticos para o emulador (`pnpm test:rules`): apenas membros autorizados acedem ao respetivo plano, ninguém consegue conceder acesso a si próprio e gravações com uma revisão antiga são recusadas. Os valores nutricionais e o formato completo dos dados são validados pela aplicação; as regras validam o acesso, o limite do documento, os campos e as revisões.

## 2. Publicar no GitHub Pages

1. Criar ou escolher o repositório no GitHub com branch `main`.
2. Extrair o ZIP. Colocar **o conteúdo da pasta mesa-a-dois na raiz do repositório**: package.json, index.html, app/, lib/, public/, scripts/ e os restantes ficheiros. Incluir `.github/workflows/pages.yml`, `.env.example` e `pnpm-lock.yaml`; podem estar ocultos no explorador. Não carregar node_modules.
3. Preencher `public/firebase-config.js` com a configuração do passo anterior e guardar no repositório.
4. Abrir **Settings → Pages → Build and deployment → Source → GitHub Actions**.
5. Fazer push/commit em main. Se o primeiro workflow correu antes de ativar Pages, abrir **Actions → Publicar no GitHub Pages → Run workflow**.
6. Quando o workflow terminar, abrir o endereço apresentado em Settings → Pages ou no deployment. Esse é o endereço para os dois telemóveis.

O workflow instala dependências, executa os testes dos cálculos, compila a aplicação e publica a pasta dist. Os caminhos são relativos e funcionam tanto no domínio principal como numa pasta de repositório. Atualizações posteriores em main voltam a publicar automaticamente. `dist/` é ignorada pelo Git porque o workflow a gera.

O repositório/site contêm apenas código, configuração pública e exemplos. Os dados das refeições ficam no Firebase. A disponibilidade de Pages em repositórios privados depende do plano GitHub; o acesso ao plano pessoal continua protegido pelo Firebase mesmo que o site/código sejam públicos.

## 3. Instalar no telemóvel

Abrir o endereço HTTPS do GitHub Pages. No iPhone: Safari → Partilhar → Adicionar ao ecrã principal. No Android: menu do navegador → Instalar aplicação/Adicionar ao ecrã principal. Entrar com a respetiva conta Firebase.

Depois de abrir o plano com ligação, pode consultar-se a última cópia guardada sem rede. A cópia mostra a data da sincronização e não permite editar offline. Terminar sessão elimina a cópia local dessa conta. A instalação e o comportamento offline devem ser confirmados nos dois telemóveis após a publicação.

## Funcionalidades

- Hoje, plano semanal, receitas, compras e perfis, com navegação móvel.
- Pequeno-almoço, dois lanches, almoço, jantar e ceia opcional.
- Quantidades por pessoa e por ingrediente; refeições só para um ou para os dois; copiar/mover refeições e duplicar a semana.
- Calorias, proteína, hidratos de carbono e gordura por refeição e por pessoa, total a preparar, totais diários dos dois, resumo semanal (total e média diária) por pessoa face às metas.
- Alimentos sem dados nutricionais nunca contam como 0 kcal: os totais aparecem como «≥» e indicam o que falta. Valores de exemplo aparecem como estimados («≈»). Refeições fora de casa ficam com nutrição desconhecida, a menos que se introduzam os valores. Metas pessoais editáveis, sem objetivos prescritos.
- Biblioteca de receitas e alimentos editáveis, favoritos e pesquisa; 10 receitas e 25 alimentos de exemplo.
- Sugestões a partir da biblioteca para o próximo horário vazio, considerando categoria, preferências, alimentos a evitar, despensa e variedade. Identificadas como sugestões baseadas em regras; nunca substituem refeições automaticamente.
- Receita a partir de ingredientes escolhidos: proposta gerada por **regras predefinidas** (não IA), com quantidades indicativas e passos, que se revê e edita antes de guardar ou planear. Criação manual sempre disponível. Não há serviços de IA externos nem chaves no código.
- Lista de compras por secção, com origem das quantidades, despensa descontada uma vez, embalagens apenas quando definidas, artigos manuais e aviso de quantidades alteradas após marcar comprado.
- Preparações para vários dias, com quantidades preparadas, reservadas e disponíveis; não é possível distribuir mais do que o preparado e os ingredientes contam uma só vez nas compras.
- Desfazer eliminações de refeições, receitas, preparações e artigos manuais.
- Sincronização Firestore em tempo real e transações para detetar alterações concorrentes.
- PWA, ícones, manifesto e service worker gerado na compilação; cache limitada à pasta deste site.

## Cálculos e modelo de dados

`lib/model.ts` contém os tipos e os cálculos; `lib/validation.ts` valida o estado com Zod. `Food` guarda unidade, estado (cru/cozinhado/etc.), base nutricional e fonte. `Recipe` guarda ingredientes e porções da receita base. `Meal` guarda uma cópia das quantidades escolhidas para cada pessoa. `Batch` guarda o total preparado. `Profile` guarda metas e preferências. Despensa, compras marcadas e artigos manuais completam o documento.

Nutrição = quantidade / base × valor do rótulo. Os totais somam sem arredondamentos intermédios. Preservam-se as calorias declaradas, sem forçar igualdade com 4P + 4HC + 9G. Os valores dos exemplos são estimativas: substituir pelos rótulos dos produtos utilizados.

Compras = refeições + preparações na respetiva data − despensa. As porções associadas a preparações não são somadas novamente. Exemplo: 90 g + 60 g de arroz, duas vezes = 300 g; 100 g em casa → 200 g em falta. Estados diferentes são alimentos distintos. Não há conversões automáticas entre cru/cozinhado, massa/volume ou carne com/sem osso. Quantidades em g são apresentadas em kg quando adequado.

O stock corresponde ao que declaras disponível para o intervalo selecionado. Marcar uma compra não altera o stock nem regista consumo. Os totais nutricionais representam o planeamento, não um diário de ingestão. Refeições fora de casa são excluídas das compras e sinalizadas como nutrição desconhecida.

O MVP usa um documento JSON por agregado, com limite preventivo de 800 KB e revisão monotónica. Para vários anos de histórico ou muitos utilizadores, deverá dividir-se o estado em documentos próprios. A consulta offline fica no armazenamento local do navegador por conta. Não existe importação automática da anterior versão D1.

## Erros e atualizações

- Se o JavaScript não carregar, se o site estiver a servir o código-fonte (GitHub Pages com a origem errada) ou se ocorrer um erro antes de o React arrancar, aparece uma mensagem com **Tentar novamente** e **Limpar cache e recarregar** — nunca uma página branca.
- Configuração Firebase ausente, por preencher ou com `import` mostra uma mensagem específica no ecrã de entrada (a demonstração continua disponível).
- Quando é publicada uma versão nova, o service worker ativa-se de imediato e a aplicação mostra **Nova versão disponível · Atualizar agora**, sem recarregar a meio de uma edição.

## Desenvolvimento e testes

```sh
pnpm test          # 20 testes de quantidades, macros, compras, preparações e validação
pnpm typecheck
pnpm build         # dist estático, manifesto e cache offline
pnpm preview
pnpm test:rules    # 8 testes das permissões; requer Java 17+ (21 recomendado)
```

Os testes de regras usam exclusivamente o projeto de emulador `demo-mesa-a-dois`, sem credenciais de produção. `firebase.json` configura os emuladores e os ficheiros de regras/índices. Opcionalmente, copiar `.env.example` para `.env` e definir VITE_FIREBASE_EMULATORS=true para ligar o desenvolvimento aos emuladores locais (Auth 9099 e Firestore 8080). Nunca ativar essa opção numa publicação.

### Validação desta entrega (v0.3)

Executado localmente (Linux, Node 22):

- `pnpm test`: 20/20 testes de cálculo, incluindo o caso obrigatório (90 g + 60 g de arroz × 2 = 300 g; com 100 g em casa faltam 200 g), lanches nas compras, substituir/remover refeições, despensa descontada uma vez, preparações sem duplicação, fora de casa e nutrição desconhecida.
- `pnpm typecheck` e `pnpm build`: sem erros.
- Teste no navegador (Chromium, ecrã de telemóvel 390×844, compilação de produção, modo demonstração): porções 90/60 g de arroz e 200/150 g de frango com total a preparar 150 g/350 g; compras com lanches; resumo semanal; proposta de receita por regras; fora de casa; persistência após recarregar; deteção de alteração concorrente entre dois separadores; abertura offline pelo service worker; mensagens para configuração Firebase com `import`, ausente ou por preencher, JavaScript que não carrega e Pages a servir o código-fonte. Sem erros na consola.

**Não testado nesta entrega:** `pnpm test:rules` (o emulador do Firestore não pôde ser descarregado neste ambiente — correr no teu computador, requer Java), login e sincronização com o Firebase real, partilha entre as duas contas reais, bloqueio de contas não autorizadas no projeto real, publicação no GitHub Pages e instalação nos telemóveis. Estes passos dependem da tua configuração e devem ser confirmados depois de publicar.

## Documentação oficial

- https://vite.dev/guide/static-deploy.html#github-pages
- https://firebase.google.com/docs/web/setup
- https://firebase.google.com/docs/auth/web/password-auth
- https://firebase.google.com/docs/firestore/security/rules-conditions

## Imagem

Fotografia ilustrativa de joe boshra, Unsplash. Não representa exatamente as receitas ou porções do plano.
https://unsplash.com/photos/sliced-grilled-chicken-breast-with-rice-and-salad-3f4KbOE9M1w
https://unsplash.com/license
