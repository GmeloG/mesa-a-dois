# Mesa a Dois

Aplicação web para o Gonçalo e a Inês planearem as refeições da semana, acompanharem calorias e macronutrientes e gerarem a lista de compras. Funciona no telemóvel e pode ser instalada no ecrã inicial (PWA).

## Hoje

- Refeições do dia, organizadas por pequeno-almoço, lanche da manhã, almoço, lanche da tarde, jantar e ceia.
- Totais do dia de cada pessoa (calorias, proteína, hidratos de carbono e gordura) comparados com os objetivos pessoais.
- Para cada refeição: pessoas incluídas, quantidades de cada uma, valores nutricionais por pessoa e quantidade total a preparar.
- Sugestões de refeições da biblioteca para o próximo horário vazio.
- Número de artigos em falta na lista de compras.

## Plano semanal

- Plano de segunda a domingo, com acesso rápido a cada dia.
- Adicionar, substituir, remover, copiar e mover refeições entre dias e horários.
- Refeições diferentes para cada pessoa no mesmo horário, ou refeições só para uma pessoa.
- Duplicar uma semana inteira para a semana seguinte.
- Opção «Fora de casa»: a refeição sai das compras e os valores nutricionais ficam como desconhecidos, salvo se forem introduzidos.
- Resumo semanal por pessoa: total da semana, média diária e objetivo.

## Receitas e alimentos

- Biblioteca de receitas com pesquisa (por nome, etiqueta ou ingrediente), categorias e favoritas.
- Cada receita tem ingredientes com quantidades, número de porções, passos de preparação, tempo e valores nutricionais no total e por porção.
- Refeições simples e lanches são tratados como receitas, com quantidades e valores próprios.
- Receitas de exemplo editáveis, com ingredientes comuns em supermercados portugueses.
- Proposta de receita a partir de ingredientes escolhidos, gerada por regras predefinidas (não por IA), para rever e editar antes de guardar ou planear.
- Alimentos com nome, marca, unidade, estado de pesagem (cru, cozinhado, escorrido, parte comestível…), base nutricional (100 g, 100 ml ou unidade), fonte dos valores, secção do supermercado e tamanho de embalagem.

## Quantidades e nutrição

- Quantidades ajustáveis por pessoa e por ingrediente em cada refeição (ex.: Gonçalo 90 g de arroz, Inês 60 g → 150 g a preparar).
- Calorias, macros e compras recalculados imediatamente ao alterar quantidades.
- Ao editar uma refeição, escolhe-se entre alterar apenas essa refeição ou também a receita guardada.
- Alimentos sem dados nutricionais nunca contam como zero: os totais aparecem como «≥» e indicam o que falta.
- Valores de exemplo aparecem como estimados («≈») até serem substituídos pelos do rótulo.
- Não há conversões entre peso cru e cozinhado: são alimentos distintos.

## Preparação para vários dias

- Preparar várias porções de uma receita e distribuí-las por diferentes refeições.
- Os ingredientes contam uma única vez nas compras, no dia da preparação.
- Mostra o que foi preparado, reservado e o que ainda está disponível; não é possível distribuir mais do que o preparado.

## Lista de compras

- Gerada automaticamente a partir das refeições de uma semana ou de um intervalo de dias, incluindo lanches.
- Soma ingredientes iguais, apresenta quantidades em g/kg e ml/l e mantém separados produtos e estados diferentes.
- Organizada por secção do supermercado, com a origem de cada quantidade (refeição e quantidade).
- Para cada artigo: necessário, existente em casa, em falta, embalagens a comprar e sobra prevista.
- O que existe em casa é descontado uma única vez no intervalo.
- Marcar artigos como comprados, com aviso se a quantidade mudar depois.
- Artigos manuais (ex.: detergente), que se mantêm quando o plano muda.

## Perfis

- Objetivos diários de calorias, proteína, hidratos de carbono e gordura de cada pessoa, definidos pelo próprio.
- Preferências alimentares e alimentos a evitar, usados nas sugestões.

## Partilha e sincronização

- Duas contas individuais com acesso ao mesmo plano privado; contas não autorizadas são bloqueadas.
- Alterações sincronizadas entre os dois telemóveis.
- Alterações simultâneas são detetadas: nada é sobrescrito sem aviso.
- Consulta offline do último plano e lista de compras, com indicação da hora da última sincronização. Guardar exige ligação.
- Desfazer eliminações de refeições, receitas, preparações e artigos.
- Demonstração com dados de exemplo, separada do plano real.
- Aviso quando há uma versão nova da aplicação.
