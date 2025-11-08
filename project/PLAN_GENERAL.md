# Plano Geral de Modularização - Documental App

## Visão Geral

Este documento contém a visão estratégica e macro-planejamento para modularização do arquivo `main.js` monolítico (~4845 linhas) do Documental App.

**Recursos Compartilhados:**
- **Metodologia TDD:** `docs/shared/methodology.md` - TDD com Vitest + ESM ES2022
- **Comandos Essenciais:** `docs/shared/commands.md` - Scripts de validação incluídos
- **Templates:** `docs/shared/templates/` - Padrões atualizados para ES2022
- **Padrões ES2022 Híbridos:** `docs/shared/es2022-hybrid-standards.md` - **NOVO E OBRIGATÓRIO**
- **Templates de Código:** `docs/shared/templates/module-template.js` - ESM/CJS híbrido
- **Templates de Teste:** `docs/shared/templates/test-template.js` - ESM ES2022 puro

Para detalhes de implementação, consulte os documentos específicos de cada fase em `project/phases/`.

## Estratégia de Implementação
Após estudar os documentos de cada fase, e seguir os principios gerais, criar um plano de execução de implementação para cada etapa de cada fase, analisar código já implementado relacionado em main.js, implementar os novos módulos com base no código legado movido de main.js para o módulo, validar (lint e ESM ES2022), testar, corrigir até que passe nos testes e validação, integrar novos módulos criados na fase em um novo main.js (que será nomeado como main_new.cjs) e que chamará as funções ainda não modularizadas direto do main.js original para manter o app funcional até a finalização do migração. O resultado espera é que conforme a implementação avance, o main_new.cjs ficará cada vez mais completo via módulo e não dependa mais do main.js e seja completamente substituido, ficando no final com um tamanhão muito menor, já que a maior parte do código já estará modularizado e integrado. Não avance para proximas fases sem ter todos os módulos da fase implementados, validados, testados, e integrados ao main_new.cjs e funcionando.

### Abordagem Híbrida CJS/ESM com ES2022
- **Fases 1-3**: Módulos maiores (200-300 linhas) para implementação rápida
- **Fases 4-5**: Refinamento para módulos ultra granulares (50-150 linhas)
- **Foco**: Preservação total de funcionalidade existente
- **Migração Gradual**: Estratégia híbrida mantendo compatibilidade total
- **TDD OBRIGATÓRIO**: 100% dos testes com Vitest + ESM ES2022

#### Convenções de Nomenclatura OBRIGATÓRIAS
| Tipo de Arquivo | Extensão | Padrão | ES2022 | JSDob | Quando Usar |
|-----------------|----------|--------|--------|-------|------------|
| Legado CJS | `.js` | Mantido | ❌ Não | Opcional | Código existente não migrado |
| Novo CJS | `.cjs` | Compatibilidade | ⚠️ Parcial | ✅ Obrigatório | Depende de módulos CJS |
| Novo ESM | `.mjs` | Preferido | ✅ Sim | ✅ Obrigatório | Todo código novo |
| Testes | `.test.mjs` | Obrigatório | ✅ Sim | ✅ Obrigatório | 100% dos testes |
| Config | `.config.mjs` | Preferido | ✅ Sim | ✅ Obrigatório | Arquivos de configuração |
| Tipos | `.types.mjs` | Preferido | ✅ Sim | ✅ Obrigatório | Definições de tipos |

#### Regras de Compatibilidade Híbrida
- **SEMPRE** usar extensões explícitas em imports/exports
- **NUNCA** misturar CJS/ESM no mesmo arquivo
- **TESTES** sempre em `.test.mjs` com ESM ES2022 puro
- **JSDoc** completo em todos os exports públicos (preparação TypeScript)
- **ES2022** features obrigatórias em código `.mjs`
- **VALIDAÇÃO** automática com scripts dedicados

#### Features ES2022 Obrigatórias em Novo Código (.mjs)
- **Top-level await** (apenas em `.mjs`)
- **Optional chaining** (`?.`)
- **Nullish coalescing** (`??`)
- **Private class fields** (`#field`)
- **Object.hasOwn()**
- **Array.prototype.at()**

#### Validação Automática Obrigatória
```bash
# Verificar conformidade ES2022
npm run validate:es2022

# Verificar extensões corretas
npm run validate:extensions

# Verificar JSDob completo
npm run validate:jsdoc

# Validação completa da estratégia híbrida
npm run validate:hybrid
```

### Metodologia TDD com Vitest + ESM ES2022
- **Red**: Escrever testes que falham em `.test.mjs` com ES2022
- **Green**: Implementar código mínimo em `.mjs`/`.cjs` com ES2022 features
- **Refactor**: Melhorar código mantendo testes verdes e JSDob completo

*Para metodologia completa, veja: `docs/shared/methodology.md`*  
*Para padrões ES2022 híbridos, veja: `docs/shared/es2022-hybrid-standards.md`*  
*Para templates de código/teste, veja: `docs/shared/templates/`*

## Estrutura Atual vs Nova Estrutura

### Estrutura Atual (main.js ~4845 linhas)
```
main.js (~4845 linhas)
├── Sistema de logging (linhas 22-80)
├── Gerenciamento de processos (linhas 85-618)
├── Operações Git (linhas 620-1230)
├── Autenticação GitHub (linhas 1232-1756)
├── Detecção Node.js (linhas 1757-2892)
├── Gerenciamento de janelas (linhas 2893-3200)
├── Banco de dados SQLite (linhas 3201-3700)
└── IPC handlers (linhas 3701-4845)
```

### Nova Estrutura Modular (Híbrida com ES2022)
```
src/
├── core/                    # Infraestrutura central
│   ├── app-logger.cjs      # Sistema de logging (CJS legado)
│   ├── database/           # Sistema de banco de dados
│   │   ├── connection.cjs  # Conexão (CJS para compatibilidade)
│   │   ├── operations.mjs  # Operações (ESM com ES2022)
│   │   └── types.mjs       # Tipos do banco (ESM + JSDob)
│   ├── events/             # Sistema de eventos
│   │   ├── emitter.mjs     # Event emitter (ESM + ES2022)
│   │   └── handlers.cjs    # Handlers (CJS)
│   └── ipc/                # Comunicação inter-processos
│       ├── main.cjs        # IPC main (CJS)
│       ├── renderer.mjs    # IPC renderer (ESM + ES2022)
│       └── types.mjs       # Tipos IPC (ESM + JSDob)
├── services/               # Camada de negócio
│   ├── git/                # Operações Git
│   │   ├── operations.cjs  # Operações Git (CJS legado)
│   │   ├── utils.mjs       # Utilitários Git (ESM + ES2022)
│   │   └── types.mjs       # Tipos Git (ESM + JSDob)
│   ├── github/             # Integração GitHub
│   │   ├── auth.cjs        # Autenticação (CJS)
│   │   ├── api.mjs         # API client (ESM + ES2022)
│   │   └── types.mjs       # Tipos GitHub (ESM + JSDob)
│   ├── node/               # Gerenciamento Node.js
│   │   ├── manager.cjs     # Manager (CJS)
│   │   ├── installer.mjs   # Installer (ESM + ES2022)
│   │   └── types.mjs       # Tipos Node.js (ESM + JSDob)
│   └── process/            # Gerenciamento de processos
│       ├── manager.cjs     # Process manager (CJS)
│       ├── watcher.mjs     # Process watcher (ESM + ES2022)
│       └── types.mjs       # Tipos Process (ESM + JSDob)
├── ui/                     # Camada de apresentação
│   ├── components/         # Componentes UI
│   │   └── *.mjs          # Componentes (ESM + ES2022)
│   ├── windows/            # Gerenciamento de janelas
│   │   ├── manager.cjs     # Window manager (CJS)
│   │   └── types.mjs       # Tipos UI (ESM + JSDob)
│   └── browser-views/      # BrowserViews
│       └── *.mjs          # BrowserViews (ESM + ES2022)
├── utils/                  # Utilitários gerais
│   ├── system.cjs         # System utils (CJS)
│   ├── string.mjs         # String utils (ESM + ES2022)
│   ├── async.mjs          # Async utils (ESM + ES2022)
│   └── types.mjs          # Tipos Utils (ESM + JSDob)
├── config/                 # Configurações
│   ├── app-config.cjs     # App config (CJS)
│   ├── constants.mjs      # Constants (ESM + ES2022)
│   ├── environment.mjs    # Environment (ESM + ES2022)
│   └── types.mjs          # Tipos Config (ESM + JSDob)
└── types/                  # Definições de tipos globais
    ├── index.mjs          # Tipos exportados centralizados
    └── *.types.mjs        # Tipos específicos (ESM + JSDob)
```

### Estrutura de Testes (100% ESM ES2022)
```
tests/
├── unit/                   # Testes unitários
│   ├── *.test.mjs         # Todos os testes em ESM ES2022
├── integration/            # Testes de integração
│   ├── *.test.mjs         # Testes híbridos (ESM ES2022)
├── e2e/                    # Testes end-to-end
│   └── *.test.mjs         # Testes completos (ESM ES2022)
├── setup.mjs              # Setup global (ESM ES2022)
├── helpers/               # Helpers de teste
│   └── *.mjs              # Helpers (ESM ES2022)
└── mocks/                 # Mocks centralizados
    └── *.mjs              # Mocks (ESM ES2022)
```


## Mapeamento de Fases para Áreas do main.js (Estratégia Híbrida)

### Fase 1 - Foundation → Áreas Base (ES2022 Parcial)
- **Logging (linhas 22-80)** → `src/core/app-logger.cjs` (manter CJS legado)
- **Constantes globais** → `src/config/constants.mjs` (ESM + ES2022 + JSDob)
- **Utilitários básicos** → `src/utils/system.cjs` (manter CJS para compatibilidade)
- **Tipos base** → `src/types/index.mjs` (ESM + ES2022 + JSDob)

### Fase 2 - Backend Services → Serviços Core (ES2022 Progressivo)
- **Gerenciamento de processos (linhas 85-618)** → `src/services/process/manager.cjs` + `src/services/process/watcher.mjs` (ESM + ES2022)
- **Operações Git (linhas 620-1230)** → `src/services/git/operations.cjs` + `src/services/git/utils.mjs` (ESM + ES2022)
- **Autenticação GitHub (linhas 1232-1756)** → `src/services/github/auth.cjs` + `src/services/github/api.mjs` (ESM + ES2022)
- **Detecção Node.js (linhas 1757-2892)** → `src/services/node/manager.cjs` + `src/services/node/installer.mjs` (ESM + ES2022)

### Fase 3 - External Integrations → Integrações (ES2022 Completo)
- **Banco de dados SQLite (linhas 3201-3700)** → `src/core/database/connection.cjs` + `src/core/database/operations.mjs` (ESM + ES2022)
- **Sistema IPC (linhas 3701-4845)** → `src/core/ipc/main.cjs` + `src/core/ipc/renderer.mjs` (ESM + ES2022)
- **Gerenciamento de janelas (linhas 2893-3200)** → `src/ui/windows/manager.cjs` + `src/ui/windows/events.mjs` (ESM + ES2022)

### Fase 4 - UI & Database → Refinamento (ES2022 Completo)
- **BrowserViews** → `src/ui/browser-views/*.mjs` (ESM + ES2022 + JSDob)
- **Componentes UI** → `src/ui/components/*.mjs` (ESM + ES2022 + JSDob)
- **Operações BD detalhadas** → `src/core/database/queries.mjs` (ESM + ES2022 + JSDob)
- **Sistema de eventos** → `src/core/events/*.mjs` (ESM + ES2022 + JSDob)

### Fase 5 - Final Integration → Integração Final (Migração TypeScript)
- **main.js original** → `main.js` (~150 linhas, CJS orquestração)
- **Coordenação entre módulos** → `main.js` (adaptação híbrida)
- **Migração completa** → Converter tudo para `.mjs` + JSDob → TypeScript
- **Package.json** → `"type": "module"` (fase final)

## Fases do Projeto (Estratégia Híbrida)

### 🏗️ FASE 1 - Foundation (2 semanas)
**Objetivo:** Configurar estrutura base e ferramentas com ES2022  
**Status:** ⏳ Resetado para validação  
**Progresso:** 0/45 itens concluídos (0%)  
**Estratégia:** Manter CJS existente, preparar para migração híbrida com ES2022  
**Validação Obrigatória:** `npm run validate:es2022 && npm run validate:extensions`

**Detalhes completos:** `project/phases/phase-01-foundation.md`

---

### ⚙️ FASE 2 - Backend Services (2 semanas)
**Objetivo:** Extrair e modularizar serviços de backend com ES2022  
**Status:** ⏳ Resetado para validação  
**Progresso:** 0/26 itens concluídos (0%)  
**Estratégia:** Módulos híbridos CJS/ESM com ES2022 features obrigatórias  
**Validação Obrigatória:** `npm run validate:es2022 && npm run validate:jsdoc`

**Detalhes completos:** `project/phases/phase-02-backend.md`

---

### 🔌 FASE 3 - External Integrations (2 semanas)
**Objetivo:** Modularizar integrações com sistemas externos em ES2022  
**Status:** ⏳ Não iniciada  
**Progresso:** 0/20 itens concluídos (0%)  
**Estratégia:** Novos módulos em ESM ES2022, adapters para CJS  
**Validação Obrigatória:** `npm run validate:es2022 && npm run validate:hybrid`

**Detalhes completos:** `project/phases/phase-03-integrations.md`

---

### 🖥️ FASE 4 - UI & Database Refinement (2 semanas)
**Objetivo:** Refinar módulos de UI e banco de dados com ES2022 completo  
**Status:** ⏳ Não iniciada  
**Progresso:** 0/16 itens concluídos (0%)  
**Estratégia:** Novos módulos em ESM ES2022 puro, migração de CJS existente  
**Validação Obrigatória:** `npm run validate:es2022 && npm run validate:jsdoc`

**Detalhes completos:** `project/phases/phase-04-ui-database.md`

---

### 🔄 FASE 5 - Final Integration (4 semanas)
**Objetivo:** Integração final, otimização e preparação TypeScript  
**Status:** ⏳ Não iniciada  
**Progresso:** 0/20 itens concluídos (0%)  
**Estratégia:** Migração completa para ESM ES2022, package.json `"type": "module"`  
**Validação Obrigatória:** `npm run validate:all && npm run build && npm run test:coverage`

**Detalhes completos:** `project/phases/phase-05-integration.md`

---

## 🔄 Estratégia de Migração Híbrida

### Fases da Migração

#### **Fase Atual: Transição Híbrida**
- ✅ Documentação de estratégia híbrida criada
- ✅ Padrões JSDoc definidos
- ✅ Templates atualizados
- ✅ Compatibilidade ES2022 estabelecida
- 🔄 Implementação gradual em andamento

#### **Próximos Passos**
1. **Fase 3**: Novos módulos em `.mjs` (ESM puro)
2. **Fase 4**: Migração de módulos existentes para ESM
3. **Fase 5**: Conversão completa e package.json update

### Regras de Migração

#### ✅ SEMPRE FAZER
- Usar extensões explícitas em imports/exports
- JSDoc completo em todos os exports públicos
- Testes em `.test.mjs` com ESM puro
- Validar compatibilidade após mudanças

#### ❌ NUNCA FAZER
- Misturar CJS/ESM no mesmo arquivo
- Imports sem extensão (ambiguidade)
- Converter legado sem testes
- Remover `.js` legado prematuramente

### Validação Contínua

```bash
# Validação de compatibilidade híbrida
npm run validate:hybrid

# Testes em modo híbrido
npm run test:hybrid

# Verificação ES2022
npm run check:es2022
```

---

## 📊 Progresso Geral do Projeto

### Resumo
- **Total de Fases:** 5
- **Total de Itens:** 127
- **Itens Concluídos:** 0 (resetado para validação)
- **Progresso:** 0/127 (0%) - **RESETADO PARA VALIDAÇÃO ES2022**

### Status das Fases
| Fase | Status | Progresso | Previsão | Estratégia ES2022 | Validação Obrigatória | Áreas do main.js |
|------|--------|-----------|----------|------------------|-------------------|------------------|
| 1 - Foundation | 🔄 Em Validação ES2022 | 0/45 (0%) | Semanas 1-2 | CJS + ESM ES2022 parcial | `validate:es2022` + `validate:extensions` | Logging (22-80), Constantes |
| 2 - Backend | 🔄 Em Validação ES2022 | 0/26 (0%) | Semanas 3-4 | CJS + ESM ES2022 progressivo | `validate:es2022` + `validate:jsdoc` | Processos (85-618), Git (620-1230), GitHub (1232-1756), Node (1757-2892) |
| 3 - Integrations | 🔄 Em Validação ES2022 | 0/20 (0%) | Semanas 5-6 | ESM ES2022 + adapters CJS | `validate:es2022` + `validate:hybrid` | BD (3201-3700), IPC (3701-4845), Janelas (2893-3200) |
| 4 - UI/Database | 🔄 Em Validação ES2022 | 0/16 (0%) | Semanas 7-8 | ESM ES2022 completo | `validate:es2022` + `validate:jsdoc` | Refinamento UI/BD |
| 5 - Integration | 🔄 Em Validação ES2022 | 0/20 (0%) | Semanas 9-12 | ESM ES2022 + TypeScript prep | `validate:all` + `build` + `coverage` | main.js refatorado |

### Marcos do Projeto com Validação ES2022
- [ ] **Kickoff:** Início da Fase 1
- [ ] **Foundation Completa:** Término da Fase 1 (com validação ES2022)
- [ ] **Backend Completo:** Término da Fase 2 (com validação ES2022)
- [ ] **Testes Estabilizados:** Correção completa do ecossistema de testes (150/150 passando)
- [ ] **ES2022 Foundation Validada:** Fase 1 com validação ES2022 completa
- [ ] **ES2022 Backend Validado:** Fase 2 com validação ES2022 completa
- [ ] **Integrations Completas:** Término da Fase 3 com ES2022
- [ ] **UI/Database Completo:** Término da Fase 4 com ES2022
- [ ] **Projeto Concluído:** Término da Fase 5 + preparação TypeScript

### Sistema de Agregação de Progresso com Validação ES2022
O progresso é calculado automaticamente a partir dos checklists detalhados em cada fase:
- **Fase 1:** 0/45 itens (0%) - aguardando início com validação ES2022
- **Fase 2:** 0/26 itens (0%) - aguardando início com validação ES2022
- **Fase 3-5:** 0/56 itens (0%) - aguardando início
- **Média Geral:** 0/127 itens (0%) - projeto resetado para conformidade ES2022

### Checkpoints de Validação Obrigatórios
Cada fase deve passar por validação automática antes de avançar:
```bash
# Fase 1: Foundation
npm run validate:extensions && npm run validate:es2022

# Fase 2: Backend Services  
npm run validate:es2022 && npm run validate:jsdoc

# Fase 3: External Integrations
npm run validate:es2022 && npm run validate:hybrid

# Fase 4: UI & Database
npm run validate:es2022 && npm run validate:jsdoc

# Fase 5: Final Integration
npm run validate:all && npm run build && npm run test:coverage
```

**Última atualização:** 2025-11-04  
**Próxima revisão:** Após conclusão da Fase 3  
**Estratégia atual:** Transição Híbrida CJS/ESM

---

## 🚨 Critérios de Sucesso

### Funcionais
- ✅ Aplicação inicia sem erros
- ✅ Todas as funcionalidades existentes funcionam
- ✅ Logs de saída permanecem idênticos
- ✅ Performance mantida ou melhorada
- ✅ Zero breaking changes

### Técnicos
- ✅ Cobertura de código ≥ 80%
- ✅ Zero warnings no lint
- ✅ Build executa sem erros
- ✅ Documentação completa e atualizada

### Estratégia ES2022 Híbrida
- ✅ Compatibilidade CJS/ESM mantida
- ✅ Extensões explícitas em todos os imports
- ✅ JSDob completo em exports públicos (preparação TS)
- ✅ Testes em ESM ES2022 puro (`.test.mjs`)
- ✅ Validação contínua de compatibilidade com scripts automáticos
- ✅ ES2022 features obrigatórias implementadas corretamente
- ✅ Scripts de validação implementados e funcionando

### Migração TypeScript (Preparação)
- ✅ JSDoc compatível com conversão automática
- ✅ Tipagem forte em todo código novo
- ✅ Documentação de migração clara
- ✅ Ferramentas de validação prontas

### Qualidade
- ✅ Código limpo e legível
- ✅ Arquitetura modular e extensível
- ✅ Tratamento robusto de erros
- ✅ Segurança implementada

---

## 📋 Comandos de Validação

### Verificar Progresso
```bash
# Progresso geral
echo "Progresso: $(grep -c '\[x\]' project/phases/*.md)/127 itens"

# Progresso por fase
echo "Fase 1: $(grep -c '\[x\]' project/phases/phase-01-foundation.md)/45 itens"
echo "Fase 2: $(grep -c '\[x\]' project/phases/phase-02-backend.md)/26 itens"
echo "Fase 3: $(grep -c '\[x\]' project/phases/phase-03-integrations.md)/20 itens"
```

### Validação de Funcionalidade
```bash
# Teste completo
npm test && npm run build && npm run verify-build

# Teste de startup
timeout 10s npm start > /dev/null 2>&1 && echo "✅ Startup OK"

# Comparação de logs
diff logs/before.log logs/after.log
```

### Validação ES2022 Híbrida CJS/ESM
```bash
# Validação completa da estratégia híbrida
npm run validate:hybrid

# Verificar uso de features ES2022
npm run validate:es2022

# Verificar extensões corretas
npm run validate:extensions

# Verificar JSDob completo
npm run validate:jsdoc

# Validação completa (todos os scripts)
npm run validate:all

# Verificar estrutura de arquivos
find src/ -name "*.js" -o -name "*.cjs" -o -name "*.mjs" | sort

# Validar imports com extensões explícitas
grep -r "from '\\./" src/ --include="*.js" --include="*.cjs" --include="*.mjs"

# Verificar testes em ESM ES2022
find tests/ -name "*.test.mjs" | wc -l
```

---

## 📝 Notas Importantes

### Princípios Fundamentais
1. **Preservação Total:** Nenhuma funcionalidade existente será alterada, apenas migrada para módulos
2. **Adição Apenas:** Novo código apenas adiciona capacidades
3. **Compatibilidade Reversa:** APIs existentes mantêm comportamento idêntico
4. **Logs Consistentes:** Saídas de terminal permanecem inalteradas
5. **Estratégia Híbrida:** Migração gradual CJS→ESM sem breaking changes

### Metodologia TDD
- Testes escritos ANTES da implementação
- Código mínimo para passar nos testes
- Refatoração contínua mantendo testes verdes
- Testes sempre em `.test.mjs` (ESM puro)

### Regras ES2022 Híbridas OBRIGATÓRIAS
- **SEMPRE** usar extensões explícitas em imports/exports
- **NUNCA** misturar CJS/ESM no mesmo arquivo
- **JSDob** completo em todos os exports públicos (preparação TS)
- **ES2022** features obrigatórias em arquivos `.mjs`
- **TESTES** sempre em `.test.mjs` com ES2022 features
- **VALIDAR** compatibilidade após cada mudança com scripts automáticos
- **CHECKPOINTS** obrigatórios antes de avançar fases

### Validação Obrigatória com ES2022
- Executar checklist completo após cada fase
- Validar não-interferência com funcionalidade existente
- Atualizar progresso neste documento
- Executar scripts de validação ES2022 após mudanças de módulos
- **Checkpoint obrigatório:** `npm run validate:es2022` antes de avançar
- **Checkpoint obrigatório:** `npm run validate:extensions` antes de commit
- **Checkpoint obrigatório:** `npm run validate:jsdoc` antes de finalizar fase

---

## 🔗 Referências Cruzadas

### Documentos Relacionados
- **`project/phases/`** - Documentação detalhada por fase:
  - `phase-01-foundation.md` - Configuração da fundação com ES2022
  - `phase-02-backend.md` - Serviços backend com ES2022
  - `phase-03-integrations.md` - Integrações externas com ES2022
  - `phase-04-ui-database.md` - UI e banco de dados com ES2022
  - `phase-05-integration.md` - Integração final + preparação TS
- **Estratégia ES2022 Híbrida:**
  - `docs/shared/es2022-hybrid-standards.md` - **NOVO E OBRIGATÓRIO** ✅
  - `docs/shared/methodology.md` - Metodologia TDD com ES2022
  - `docs/shared/commands.md` - Comandos essenciais + scripts de validação
- **Templates e Padrões:**
  - `docs/shared/templates/module-template.js` - Template híbrido ES2022 atualizado ✅
  - `docs/shared/templates/test-template.js` - Template ESM ES2022 puro atualizado ✅
- **Documentação Principal:**
  - `project/PROMPT.md` - Template de implementação com ES2022
  - `project/README.md` - Visão geral do projeto
- **Documentação Histórica (arquivada):**
  - `docs/archive/DESIGN_PATTERNS_ANALYSIS.md` - Análise de padrões de design
  - `docs/archive/COMPARISON.md` - Comparação de abordagens

### Mapeamento de Arquivos (Estratégia Híbrida)
| Arquivo Original | Novo(s) Arquivo(s) | Estratégia | Linhas | Status |
|------------------|-------------------|------------|--------|---------|
| main.js:22-80 | src/core/app-logger.cjs | Manter CJS | Logging | ✅ Concluído |
| main.js:85-618 | src/services/process/manager.cjs + watcher.mjs | Híbrido | Processos | ✅ Concluído |
| main.js:620-1230 | src/services/git/operations.cjs + utils.mjs | Híbrido | Git | ✅ Concluído |
| main.js:1232-1756 | src/services/github/auth.cjs + api.mjs | Híbrido | GitHub | ✅ Concluído |
| main.js:1757-2892 | src/services/node/manager.cjs + installer.mjs | Híbrido | Node.js | ✅ Concluído |
| main.js:2893-3200 | src/ui/windows/manager.cjs + events.mjs | Híbrido | Janelas | ⏳ Fase 3 |
| main.js:3201-3700 | src/core/database/connection.cjs + operations.mjs | Híbrido | BD | ⏳ Fase 3 |
| main.js:3701-4845 | src/core/ipc/main.cjs + renderer.mjs | Híbrido | IPC | ⏳ Fase 3 |

### Navegação Rápida
- **Visão Geral:** Este documento (PLAN_GENERAL.md)
- **Estratégia ES2022 Híbrida:** `docs/shared/es2022-hybrid-standards.md` ✅ **NOVO**
- **Metodologia TDD com ES2022:** `docs/shared/methodology.md`
- **Comandos com Validação:** `docs/shared/commands.md`
- **Templates ES2022:** `docs/shared/templates/`
- **Detalhes da Fase Atual:** `project/phases/phase-01-foundation.md` (resetado)
- **Próxima Fase:** `project/phases/phase-02-backend.md` (resetado)
- **Documentação Técnica:** `docs/shared/`

---

## 📈 Métricas de Sucesso

### Métricas Técnicas
- **Redução de complexidade**: main.js de 4845 → ~150 linhas (97% redução)
- **Modularização**: 1 arquivo → 60+ módulos especializados
- **Testabilidade**: Cobertura ≥ 80% em todos os módulos
- **Performance**: <5% overhead em operações críticas

### Métricas de Qualidade
- **Manutenibilidade**: Módulos de 50-150 linhas
- **Reusabilidade**: Módulos independentes e desacoplados
- **Extensibilidade**: Novas features com impacto mínimo
- **Debugabilidade**: Problemas isolados em módulos específicos
- **Compatibilidade**: 100% compatível CJS/ESM durante migração
- **Type Safety**: JSDoc completo para migração TS futura

### Métricas de Migração ES2022 Híbrida
- **Compatibilidade**: 0 breaking changes durante transição
- **Extensões Claras**: 100% dos imports com extensões explícitas
- **JSDob Coverage**: 100% dos exports públicos documentados (preparação TS)
- **Test Coverage**: ≥80% em todos os módulos híbridos
- **ES2022 Adoption**: Features modernas implementadas corretamente em `.mjs`
- **Validação Automática**: 100% dos módulos passam em `npm run validate:all`
- **Testes ES2022**: 100% dos testes em `.test.mjs` com ES2022 features

---

**Última atualização:** 2025-11-04  
**Próxima revisão:** Após validação ES2022 da Fase 1  
**Responsável:** Equipe de Desenvolvimento  
**Status:** 📋 Documento mestre de referência - **RESETADO PARA VALIDAÇÃO ES2022**  
**Estratégia Atual:** 🔄 Migração Híbrida CJS/ESM com ES2022 + Validação Automática  
**Validação Obrigatória:** `npm run validate:es2022 && npm run validate:extensions` antes de prosseguir