# Correção do inventário de peças

O antigo desbloqueio copiava blocos de um editor público. Eles deixavam bits de propriedade zerados e gravavam uma cauda com valores que não pertencem aos contadores e listas do inventário. Não usar esses blocos como modelo do formato.

Mapeamento conferido no executável PC v1.2 NA, SHA-256 `f9dd86c054878ce6276beb07c1fd61874f7a1e4bf1f241b084c65b73e24168a7`:

- `0x516620`: grava um carro. Grava 20 bytes de cabeçalho, 0x418 bytes de dados, um campo de 4 bytes e dois bytes antes do inventário. Portanto, o inventário começa em `record + 0x432`.
- `0x503F00`: serializa `OwnedPartInventory`. Os campos não seguem inteiramente a ordem da estrutura em memória.
- `0x504040`: desserializa a mesma estrutura.
- `0x503B10`: escolhe a palavra de propriedade por categoria e índice da peça.
- `0x503DB0`: testa o bit da peça escolhida.
- `0x515500`: o filtro de carreira aceita peças possuídas (bit 2) e/ou compráveis (bit 4). Liberar somente níveis de loja não preenche o inventário da garagem.

Offsets relativos ao inventário **serializado**:

| Intervalo, fim exclusivo | Conteúdo | Ação |
| --- | --- | --- |
| 0x000–0x15C | Categorias gerais | Bits em 1 |
| 0x15C–0x16C | Propriedade de performance | Bits em 1 |
| 0x16C–0x294 | Demais tabelas de peças | Bits em 1 |
| 0x294–0x298 | Contador adicional (memória +0x3BC) | Preservar |
| 0x298–0x2A0 | Tabela da memória +0x294 | Bits em 1 |
| 0x2A0–0x3B0 | Lista de hashes de performance | Preservar |
| 0x3B0–0x3C0 | Tabela da memória +0x29C | Bits em 1 |

O inventário termina exatamente no próximo registro: `0x432 + 0x3C0 = 0x7F2`. Isso evita atingir o próximo carro. O desbloqueio é idempotente, afeta os cinco slots e não altera pintura, peças instaladas, altura, carreira ou saldo. Os níveis globais das lojas de performance também são liberados.

Uma assinatura exata da cauda inválida das versões anteriores permite limpar somente o contador e a lista que ela corrompeu. Inventários sem essa assinatura preservam esses campos integralmente.

Validação automatizada: cobertura de todos os intervalos, preservação dos campos excluídos e peças instaladas, cinco slots, idempotência, reparo da assinatura antiga e checksums. A análise estática e os testes de arquivo não substituem a conferência de cada menu dentro da versão do jogo usada pelo jogador. Não adiciona peças que o modelo não possui nem peças de mods ausentes.

Verificação adicional local em 26/10/2026: as rotinas originais `0x504040` e `0x503F00` foram executadas em emulação x86 com os cinco inventários de um backup real editado. Todas as tabelas de propriedade em memória (`0x000–0x2AC`) ficaram com bits em 1 e a regravação dos 960 bytes de cada inventário foi idêntica à entrada. Nenhum executável ou save pessoal é distribuído neste repositório.
