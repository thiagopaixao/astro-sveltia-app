Aqui está o conteúdo formatado em **Markdown**:

---

# Visão Geral Rápida

O `main.js` concentra praticamente toda a lógica do aplicativo:

* Logging
* Rastreamento de processos
* Criação de janelas
* Inicialização do banco SQLite
* Autenticação GitHub
* Gerenciamento de dependências Node
* Dezenas de tratadores IPC

Isso dificulta evoluções específicas por plataforma e confunde colaboradores quando precisam tocar em pontos isolados.

O `preload` expõe uma grande superfície de APIs ao *renderer*, amarrando ainda mais a camada de UI ao backend atual, o que torna arriscado mudar endpoints sem sincronizar cada tela.

O projeto já está explicitamente configurado como **CommonJS** no `package.json`, mas o script de testes é apenas um *placeholder*, o que inviabiliza TDD na forma atual.

---

# Objetivos Imediatos

* Manter o app funcional enquanto refatora, preservando **CommonJS** para evitar conflitos.
* Criar uma malha de testes mínima para apoiar TDD e proteger cada extração modular.
* Reorganizar o código em camadas (*domínio → aplicação → infraestrutura/adapters*) com pontos de extensão claros por plataforma.
* Encapsular responsabilidades sensíveis a SO (ex.: inspeção de processos) para facilitar ajustes de Windows e futura adaptação a macOS.

---

# Plano Atualizado com Vitest

## Fase 0 — Preparação

* Mantenha a decisão explícita de continuar em **CommonJS** (já definida por `"type": "commonjs"` no `package.json`) e documente essa convenção para toda a equipe.
* Mapeie as responsabilidades hoje concentradas no `main.js` (logging, rastreamento de processos, bootstrap do Electron, IPCs, integração Git/GitHub) para guiar as extrações modulares subsequentes.

---

## Fase 1 — Guarda-Chuva de TDD com Vitest

* Troque o script `"test"` existente por `vitest/vitest run` e adicione o pacote **Vitest** (e `@vitest/coverage-v8` se desejar cobertura) nas `devDependencies`.
* Use um `vitest.config.cjs` para manter a coerência com CommonJS.
* Crie uma pasta `tests/` com casos mínimos (ex.: logger) utilizando CommonJS:

  ```js
  const { describe, it, expect } = require('vitest');
  ```
* Configure *mocks* para `electron`, `fs`, `child_process`, etc., priorizando injeção de dependências nos novos módulos para facilitar *stubs*.
* Adote o ciclo **TDD (vermelho–verde–refatorar)** em cada extração: escreva o teste desejado, implemente o módulo, redirecione o trecho legado do `main.js` e só então remova o código antigo.

---

## Fase 2 — Extrações Iniciais (Infraestrutura)

* **Logger:** mova o bloco de logging e buffer do `main.js` para `src/main/logging/logger.js`, expondo funções específicas; cubra asserções de buffer/broadcast.
* **Persistência de processos:** isole `loadDocumentalProcesses`, `saveDocumentalProcesses`, etc., em `src/main/processes/documentalTracker.js`, com testes para leitura/escrita *cross-platform*.
* **Detectores por SO:** crie *adapters* `platform/processInspector/{windows.js, unix.js}` encapsulando `tasklist`, `/proc`, etc.; o módulo principal escolhe conforme `process.platform`. Garanta cobertura simulando cada SO.
* **SQLite e bootstrap:** extraia inicialização do banco e rotinas de criação de janelas para módulos dedicados, mantendo `main.js` apenas como orquestrador.

---

## Fase 3 — Camada de Aplicação / Hexagonal

* Modele entidades de domínio em `src/domain/` (ex.: `Project`, `GitRepository`) independentes de Electron/SQLite.
* Centralize a orquestração em serviços de aplicação (`src/application/`), recebendo *adapters* de infraestrutura (`src/infrastructure/`), todos facilmente *mockáveis* pelo Vitest.
* Simplifique o `preload` para expor APIs nomeadas e alinhadas aos serviços para reduzir acoplamento com IPCs.

---

## Fase 4 — Organização dos IPCs

* Divida os *handlers* por feature (`ipc/projects.js`, `ipc/git.js`, etc.), cada um recebendo seu serviço por injeção.
* Mantenha um registrador central (`registerIpcHandlers`) chamado pelo bootstrap.
* Escreva testes Vitest simulando chamadas `ipcMain.handle` com *mocks* dos serviços.

---

## Fase 5 — Endurecimento Cross-Platform

* Com os *adapters* isolados, adicione implementações/macros para Windows e macOS (ex.: uso de `ps`/`lsof` no macOS), validando os comandos esperados via testes.
* Encapsule ações dependentes de shell/paths em `platform/shell.js` e adicione *smoke builds* (`npm run build:win`, `npm run build:linux`, etc.) como checagens manuais rápidas.

---

## Fase 6 — Documentação e Fechamento

* Atualize `docs/architecture.md` e o `README` com o mapa de camadas, uso do Vitest, convenção CommonJS e o fluxo TDD incremental.
* Planeje uma rodada final de testes automatizados + *smoke manual* nas três plataformas antes do *merge* da refatoração principal.

---
