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

O ZIP contém apenas o código e a configuração necessários. `node_modules/` é criada ao instalar dependências; `dist/` é criada ao compilar. Não é necessário carregar nenhuma dessas pastas para o GitHub. Não abrir index.html por duplo clique.

Se já configuraste o Firebase numa versão anterior, guarda uma cópia de `public/firebase-config.js` e repõe-a na pasta nova depois de extrair o ZIP.

## 1. Configurar o Firebase

1. Na consola Firebase, criar um projeto e registar uma **aplicação Web**. Não ativar Hosting.
2. Em Definições do projeto → As tuas aplicações, copiar a configuração Web para **public/firebase-config.js**. Preencher apiKey, authDomain, projectId e appId. Os valores Web são identificadores públicos; a proteção dos dados está nas regras e na autenticação. Nunca colocar ficheiros de conta de serviço, chaves privadas ou palavras-passe no repositório.
3. Em **Authentication → Sign-in method**, ativar Email/Password. Em **Users**, criar as duas contas, uma para cada pessoa. Guardar as palavras-passe de forma privada e copiar os dois UID.
4. Em **Firestore Database**, criar a base `(default)` em modo de produção. Usar Cloud Firestore Standard/Native. Escolher a região adequada antes de criar a base.
5. No separador **Rules**, substituir as regras pelo conteúdo de `firestore.rules` e publicar. Não usar regras de acesso público ou modo de teste.
6. No separador **Data**, criar a coleção `access`. Criar um documento cujo ID seja o UID do Gonçalo, com um campo de tipo string: `householdId = goncalo-ines`. Criar outro documento com o UID da Inês e exatamente o mesmo campo e valor. Estes documentos são criados pelo proprietário na consola; a aplicação não pode conceder acesso.
7. Em Authentication → Settings → Authorized domains, adicionar `O_TEU_UTILIZADOR.github.io` (só domínio, sem https nem nome do repositório). Adicionar `localhost` se quiseres testar login local.

Ao entrar pela primeira vez, a aplicação cria o documento `households/goncalo-ines/state/main`. Os dois utilizadores consultam e editam esse mesmo plano. As metas começam por definir e o plano real começa vazio. O botão **Usar semana de exemplo** é opcional.

As regras estão testadas com o emulador: apenas membros autorizados acedem ao respetivo plano, ninguém consegue conceder acesso a si próprio e gravações com uma revisão antiga são recusadas. Os valores nutricionais e o formato completo dos dados são validados pela aplicação; as regras validam o acesso, o limite do documento, os campos e as revisões.

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
- Calorias, proteína, hidratos de carbono e gordura por refeição e totais diários por pessoa. Metas pessoais editáveis, sem objetivos prescritos.
- Biblioteca de receitas e alimentos editáveis, favoritos e pesquisa; 10 receitas e 25 alimentos de exemplo.
- Sugestões a partir da biblioteca, considerando preferências, despensa e variedade. A criação de receitas é manual; não se apresenta como geração por IA.
- Lista de compras por secção, com origem das quantidades, despensa descontada uma vez, embalagens apenas quando definidas, artigos manuais e aviso de quantidades alteradas após marcar comprado.
- Preparações para vários dias, sem somar duas vezes os ingredientes das porções reservadas.
- Sincronização Firestore em tempo real e transações para detetar alterações concorrentes.
- PWA, ícones, manifesto e service worker gerado na compilação; cache limitada à pasta deste site.

## Cálculos e modelo de dados

`lib/model.ts` contém os tipos e os cálculos; `lib/validation.ts` valida o estado com Zod. `Food` guarda unidade, estado (cru/cozinhado/etc.), base nutricional e fonte. `Recipe` guarda ingredientes e porções da receita base. `Meal` guarda uma cópia das quantidades escolhidas para cada pessoa. `Batch` guarda o total preparado. `Profile` guarda metas e preferências. Despensa, compras marcadas e artigos manuais completam o documento.

Nutrição = quantidade / base × valor do rótulo. Os totais somam sem arredondamentos intermédios. Preservam-se as calorias declaradas, sem forçar igualdade com 4P + 4HC + 9G. Os valores dos exemplos são estimativas: substituir pelos rótulos dos produtos utilizados.

Compras = refeições + preparações na respetiva data − despensa. As porções associadas a preparações não são somadas novamente. Exemplo: 90 g + 60 g de arroz, duas vezes = 300 g; 100 g em casa → 200 g em falta. Estados diferentes são alimentos distintos. Não há conversões automáticas entre cru/cozinhado, massa/volume ou carne com/sem osso. Quantidades em g são apresentadas em kg quando adequado.

O stock corresponde ao que declaras disponível para o intervalo selecionado. Marcar uma compra não altera o stock nem regista consumo. Os totais nutricionais representam o planeamento, não um diário de ingestão. Refeições fora de casa são excluídas das compras e sinalizadas como nutrição desconhecida.

O MVP usa um documento JSON por agregado, com limite preventivo de 800 KB e revisão monotónica. Para vários anos de histórico ou muitos utilizadores, deverá dividir-se o estado em documentos próprios. A consulta offline fica no armazenamento local do navegador por conta. Não existe importação automática da anterior versão D1.

## Desenvolvimento e testes

```sh
pnpm test          # 9 testes de quantidades, macros e compras
pnpm typecheck
pnpm build         # dist estático, manifesto e cache offline
pnpm preview
pnpm test:rules    # 8 testes das permissões; requer Java 17+ (21 recomendado)
```

Os testes de regras usam exclusivamente o projeto de emulador `demo-mesa-a-dois`, sem credenciais de produção. `firebase.json` configura os emuladores e os ficheiros de regras/índices. Opcionalmente, copiar `.env.example` para `.env` e definir VITE_FIREBASE_EMULATORS=true para ligar o desenvolvimento aos emuladores locais (Auth 9099 e Firestore 8080). Nunca ativar essa opção numa publicação.

Validação desta entrega: 9 testes de cálculo e 8 testes de regras passaram; TypeScript e compilação estática concluídos. No navegador foram verificadas a demonstração, a gravação de porções diferentes (90/60 g de arroz e 200/150 g de frango), a persistência após recarregar, os macros por pessoa e a apresentação das compras. A configuração real do Firebase, a publicação no repositório e a instalação nos telemóveis ficam pendentes até serem fornecidos/configurados pelo proprietário.

## Documentação oficial

- https://vite.dev/guide/static-deploy.html#github-pages
- https://firebase.google.com/docs/web/setup
- https://firebase.google.com/docs/auth/web/password-auth
- https://firebase.google.com/docs/firestore/security/rules-conditions

## Imagem

Fotografia ilustrativa de joe boshra, Unsplash. Não representa exatamente as receitas ou porções do plano.
https://unsplash.com/photos/sliced-grilled-chicken-breast-with-rice-and-salad-3f4KbOE9M1w
https://unsplash.com/license
