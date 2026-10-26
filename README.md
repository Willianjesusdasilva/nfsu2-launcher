# NFSU2 Launcher / Save Workshop

Editor de saves de **Need for Speed Underground 2** em HTML, CSS e JavaScript. Estático, sem build obrigatório, sem backend e pronto para GitHub Pages.

**Site:** https://willianjesusdasilva.github.io/nfsu2-launcher/

## O que faz

- Importa backups ZIP do NFSU2 web e arquivos de perfil sem extensão.
- Reconhece vários perfis em um único backup.
- Edita o saldo até **999.999.999**, com atalho de **999 milhões**.
- Seleciona os **31 modelos originais/regionais** nos cinco slots.
- Aplica upgrades máximos e flags de upgrades únicos, ou restaura o desempenho original.
- Edita pintura, rodas, cor das rodas, vidros e altura nos cinco perfis de acerto.
- Preset **OEM+**: peças visuais de fábrica e rebaixamento leve, preservando a pintura e o desempenho.
- Atalhos para catálogo/peças especiais, concessionária, lojas e vagas.
- Recalcula os três checksums do perfil ao exportar.
- Mantém os demais arquivos do ZIP e oferece o download exato do original.

Os arquivos são lidos **apenas na memória do navegador**. Não há envio de saves, analytics, login ou armazenamento persistente. As dependências do editor estão incluídas no repositório; o link para o jogo é externo e não transfere o save automaticamente.

## Usar

1. Encerre o jogo e baixe um backup em **Saves → Download backup**.
2. Abra o editor e importe esse ZIP (ou o arquivo binário do perfil, sem extensão).
3. Escolha o perfil, edite os campos e baixe a cópia editada.
4. No NFSU2 web, restaure o ZIP em **Saves → Restore** e carregue seu perfil.
5. Confira a garagem e mantenha o backup original.

Trocar o modelo restaura as peças visuais e o acerto daquele slot para os originais; aplique o tuning desejado depois. Os outros carros e a progressão da carreira são preservados. Para adicionar carros em slots vazios, o perfil deve ter ao menos um carro comprado na carreira.

## Compatibilidade e limites

Suporta o formato de perfil de PC **54.966 bytes**, versão `0x10D`, usado pelo port web. Rejeita outros formatos, ZIPs com senha e backups acima dos limites documentados no código. Não converte saves de console nem adiciona modelos, peças ou texturas ao jogo. Um modelo de mod já presente é preservado enquanto não for substituído.

As cores são as opções existentes na paleta do jogo; “Dolphin” é uma aproximação de cinza metálico. Altura e aparência dependem do modelo, dos upgrades e da versão. Os desenhos nas vagas são ilustrações esquemáticas, não previews do jogo. O desbloqueio marca os bitmaps de propriedade de peças nos cinco inventários, preservando contadores e listas de performance. A estrutura foi conferida nas rotinas nativas de gravação e leitura; o resultado final deve ser conferido dentro do jogo. Nenhuma função conclui automaticamente a história ou as corridas.

## Rodar localmente

Com Node.js 22 ou mais recente:

```sh
npm run dev
```

Abra `http://127.0.0.1:4173`. Também é possível usar qualquer servidor HTTP estático (por exemplo, `python -m http.server`). Módulos JavaScript precisam de HTTP; não abra o HTML por `file://`.

```sh
npm test
```

Os testes usam perfis sintéticos e verificam checksums, limites, isolamento entre slots, 31 modelos, OEM+, desbloqueios, ZIPs e preservação dos arquivos. Nenhum save pessoal ou binário do jogo é publicado.

## GitHub Pages

Publique a branch `main`, diretório `/`, em **Settings → Pages**. Não há etapa de compilação ou serviço externo. `.nojekyll` está incluído. O workflow em `.github/workflows/test.yml` roda os testes em pushes e pull requests.

## Estrutura

- `index.html`, `styles.css`, `app.js`: interface e interações.
- `save.js`: edição binária e checksums.
- `archive.js`: validação, importação e exportação ZIP.
- `data/`: referências numéricas dos carros, estilos e desbloqueios. Não contém assets do jogo.
- `vendor/`: fflate 0.8.2 e licenças de terceiros.
- `tests/`: testes sem dependências de instalação.

## Créditos

- [fflate](https://github.com/101arrowz/fflate), por Arjun Barrett: compressão ZIP, licença MIT.
- [NFSU2 Save Editor](https://github.com/Starladdey/nfsu2-save-editor), por Starladdey: referência dos padrões de desbloqueio, licença MIT incluída em `vendor/starladdey.LICENSE`.
- [NFSU2 Profile Master](https://github.com/GabriLex/nfsu2profilemaster): referência de layouts de presets e offsets; a implementação deste editor é independente.
- [nfsu2-web](https://github.com/th0mk/nfsu2-web), `web/src/app/profile.ts`: documentação pública do formato e dos checksums nativos.

Projeto de fã, não afiliado à Electronic Arts. Nomes dos jogos, marcas e veículos pertencem aos respectivos titulares.
