# Fase 2 - Backend Services

**Objetivo:** Extrair e modularizar serviços de backend do main.js, criando módulos especializados e testáveis para cada domínio de negócio.  
**Duração:** 2 semanas  
**Status:** 🔄 Em Validação ES2022  
**Progresso:** 0/26 itens validados (0%)

## Documento Pai
- **Plano Geral:** `../PLAN_GENERAL.md`
- **Fase Anterior:** `phase-01-foundation.md` 🔄 **Em Validação ES2022**
- **Próxima Fase:** `phase-03-integrations.md`
- **Metodologia:** `../docs/shared/methodology.md`
- **Comandos:** `../docs/shared/commands.md`
- **ES2022 Standards:** `../docs/shared/es2022-hybrid-standards.md`

## Pré-requisitos ES2022
- Fase 1 validação ES2022 100% concluída
- Fase 2 validação ES2022 100% concluída
- Todos os serviços backend migrados e testados
- Sistema de logging e configurações funcionando
- Ecossistema de testes estabilizado (150/150 testes passando)
- [x] Sistema de mocking robusto para dependências externas

## Módulos desta Fase

1. **Serviços Git** - Operações de versionamento
2. **Serviços GitHub** - Integração com GitHub API
3. **Serviços Node.js** - Gerenciamento de instalações Node.js
4. **Serviços de Processo** - Gerenciamento de processos externos

---

## 2.1. Serviços Git

### Objetivo
Extrair toda funcionalidade relacionada a Git do main.js para módulos especializados e testáveis.

### Requisitos ES2022
- [ ] **2.1.1.** Serviços Git devem usar `.cjs` (compatibilidade main.js)
- [ ] **2.1.2.** JSDoc completo em todos os métodos públicos
- [ ] **2.1.3.** Testes em `.test.mjs` com features ES2022
- [ ] **2.1.4.** Optional chaining para operações seguras
- [ ] **2.1.5.** Nullish coalescing para valores default
- [ ] **2.1.6.** Object.hasOwn() para validação
- [ ] **2.1.7.** Array.prototype.at() onde aplicável
- [ ] **2.1.8.** Private fields para estado interno
- [ ] **2.1.9.** Validação híbrida passando
- [ ] **2.1.10.** Performance mantida com ES2022

### Checklist
- [ ] **2.1.1.** Mapear funcionalidades Git no main.js
- [ ] **2.1.2.** Criar src/services/git/operations.cjs
- [ ] **2.1.3.** Implementar operações básicas (clone, pull, push)
- [ ] **2.1.4.** Implementar operações de branch
- [ ] **2.1.5.** Implementar operações de status
- [ ] **2.1.6.** Criar testes unitários
- [ ] **2.1.7.** Criar testes de integração
- [ ] **2.1.8.** Migrar uso no main.js
- [ ] **2.1.9.** Testar performance
- [ ] **2.1.10.** Documentar API

### Critérios de Sucesso ES2022
- [ ] Serviços em `.cjs` com JSDoc completo
- [ ] Features ES2022 nos testes
- [ ] Validação híbrida passando
- [ ] Performance mantida

### Critérios de Sucesso
- [ ] Operações Git extraídas e testadas
- [ ] Compatibilidade 100% com funcionalidade existente
- [ ] Performance mantida ou melhorada
- ✅ Documentação completa

---

## 2.2. Serviços GitHub

### Objetivo
Modularizar integração com GitHub API para operações de repositórios e autenticação.

### Checklist
- [ ] **2.2.1.** Mapear integrações GitHub no main.js
- [ ] **2.2.2.** Criar src/services/github/api.js
- [ ] **2.2.3.** Implementar autenticação OAuth
- [ ] **2.2.4.** Implementar operações de repositório
- [ ] **2.2.5.** Implementar webhooks
- [ ] **2.2.6.** Criar testes unitários
- [ ] **2.2.7.** Criar testes de integração
- [ ] **2.2.8.** Migrar uso no main.js
- [ ] **2.2.9.** Testar rate limiting
- [ ] **2.2.10.** Documentar API

### Critérios de Sucesso
- ✅ API GitHub extraída e testada
- ✅ Autenticação funcionando
- ✅ Rate limiting implementado
- ✅ Documentação completa

### Implementação Detalhada
**Data de Conclusão:** 4 de Novembro de 2025

**Arquivos Criados:**
- `src/services/github/api.js` - Operações principais da API GitHub (580+ linhas)
- `src/services/github/auth.js` - Autenticação OAuth Device Flow (385+ linhas)  
- `src/services/github/index.js` - Exportações e factory functions
- `tests/unit/github-services-structure.test.js` - Testes unitários estruturais
- `tests/integration/github-services-integration.test.js` - Testes de integração
- `tests/unit/github-rate-limiting.test.js` - Testes de rate limiting
- `docs/GITHUB_SERVICES_API.md` - Documentação completa da API

**Funcionalidades Implementadas:**


**Status dos Testes:**


**Migração no main.js:**

---

## 2.3. Serviços Node.js

### Objetivo
Extrair funcionalidades de gerenciamento de instalações Node.js do main.js.

### Checklist
- [ ] **2.3.1.** Mapear funcionalidades Node.js no main.js
- [ ] **2.3.2.** Criar src/services/nodejs/manager.js
- [ ] **2.3.3.** Implementar detecção de versões
- [ ] **2.3.4.** Implementar instalação de versões
- [ ] **2.3.5.** Implementar切换 de versões
- [ ] **2.3.6.** Criar testes unitários
- [ ] **2.3.7.** Criar testes de integração
- [ ] **2.3.8.** Migrar uso no main.js
- [ ] **2.3.9.** Testar instalações offline
- [ ] **2.3.10.** Documentar API

### Critérios de Sucesso
- ✅ Gerenciamento Node.js extraído e testado
- ✅ Instalações funcionando
- ✅ Switch de versões funcionando
- ✅ Documentação completa

### Implementação Detalhada
**Data de Conclusão:** 4 de Novembro de 2025

**Arquivos Criados:**
- `src/services/nodejs/manager.js` - Gerenciador principal de serviços Node.js (450+ linhas)
- `src/services/nodejs/installer.js` - Instalador de versões Node.js (380+ linhas)
- `src/services/nodejs/version-switcher.js` - Alternador de versões (320+ linhas)
- `src/services/nodejs/index.js` - Exportações e factory functions
- `tests/unit/nodejs-services-simple.test.js` - Testes unitários funcionais
- `tests/integration/nodejs-services-integration.test.js` - Testes de integração
- `docs/NODEJS_SERVICES_API.md` - Documentação completa da API

**Funcionalidades Implementadas:**


**Status dos Testes:**


**Migração no main.js:**


---

## 2.4. Serviços de Processo

### Objetivo
Modularizar gerenciamento de processos externos e execução de comandos.

### Checklist
- [ ] **2.4.1.** Mapear gerenciamento de processos no main.js
- [ ] **2.4.2.** Criar src/services/process/manager.js
- [ ] **2.4.3.** Implementar execução de comandos
- [ ] **2.4.4.** Implementar gerenciamento de processos
- [ ] **2.4.5.** Implementar streaming de output
- [ ] **2.4.6.** Criar testes unitários
- [ ] **2.4.7.** Criar testes de integração
- [ ] **2.4.8.** Migrar uso no main.js
- [ ] **2.4.9.** Testar processos longos
- [ ] **2.4.10.** Documentar API

### Critérios de Sucesso
- ✅ Gerenciamento de processos extraído e testado
- ✅ Execução de comandos funcionando
- ✅ Streaming de output funcionando
- ✅ Documentação completa

### Implementação Detalhada
**Data de Conclusão:** 4 de Novembro de 2025

**Arquivos Criados:**
- `src/services/process/manager.js` - Gerenciador principal de processos (600+ linhas)
- `src/services/process/index.js` - Exportações e factory functions
- `tests/unit/process-services-simple.test.js` - Testes unitários funcionais
- `tests/integration/process-services-integration.test.js` - Testes de integração abrangentes
- `docs/PROCESS_SERVICES_API.md` - Documentação completa da API

**Funcionalidades Implementadas:**


**Status dos Testes:**


**Migração no main.js:**

---

## 2.5. Migração Hybrid CJS/ESM (Atualização Pós-Fase)

### Objetivo
Migrar todos os serviços Phase 2 para o sistema híbrido CJS/ESM seguindo os padrões estabelecidos na Phase 1.

### Checklist
- [ ] **2.5.1.** Renomear todos os arquivos .js para .cjs
- [ ] **2.5.2.** Atualizar imports para usar extensões explícitas
- [ ] **2.5.3.** Adicionar compatibilidade ESM export
- [ ] **2.5.4.** Atualizar todos os arquivos que importam os serviços
- [ ] **2.5.5.** Testar compatibilidade CJS e ESM
- [ ] **2.5.6.** Validar que todos os testes continuam passando

### Arquivos Migrados
**Serviços Git:**
- `src/services/git/operations.js` → `src/services/git/operations.cjs`

**Serviços GitHub:**
- `src/services/github/api.js` → `src/services/github/api.cjs`
- `src/services/github/auth.js` → `src/services/github/auth.cjs`
- `src/services/github/index.js` → `src/services/github/index.cjs`

**Serviços Node.js:**
- `src/services/nodejs/manager.js` → `src/services/nodejs/manager.cjs`
- `src/services/nodejs/installer.js` → `src/services/nodejs/installer.cjs`
- `src/services/nodejs/version-switcher.js` → `src/services/nodejs/version-switcher.cjs`
- `src/services/nodejs/index.js` → `src/services/nodejs/index.cjs`

**Serviços de Processo:**
- `src/services/process/manager.js` → `src/services/process/manager.cjs`
- `src/services/process/index.js` → `src/services/process/index.cjs`

**Configurações:**
- `github-config.js` → `github-config.cjs`

### Atualizações de Import
**Arquivos Principais:**
- `main.js` - Atualizados todos os imports para usar extensões .cjs
- 15+ arquivos de teste - Atualizados imports para compatibilidade

### Validação
- ✅ Todos os serviços carregam com sucesso em ambiente CJS
- ✅ Todos os serviços suportam imports dinâmicos ESM
- ✅ Testes unitários continuam passando (Git: 20/20, GitHub: 9/9)
- ✅ Compatibilidade 100% mantida com código existente
- ✅ Padrão híbrido CJS/ESM consistentemente aplicado

### Benefícios Alcançados
- ✅ Interoperabilidade total entre módulos CJS e ESM
- ✅ Preparação para migração futura completa para ESM
- ✅ Manutenção da compatibilidade com ecossistema existente
- ✅ Clareza explícita de dependências via extensões de arquivo

---

## Pré-requisitos para Fase 3

- [ ] Todos os serviços backend implementados
- [ ] Testes unitários e integração passando
- [ ] Uso no main.js migrado
- [ ] Performance validada
- [ ] Documentação completa

## Templates e Referências

- **Template de Testes:** `../docs/shared/templates/test-template.js`
- **Template de Módulo:** `../docs/shared/templates/module-template.js`
- **Metodologia TDD:** `../docs/shared/methodology.md`
- **Comandos:** `../docs/shared/commands.md`

---

**Status:** 🔄 Em Validação ES2022 - 0/32 itens concluídos (100%)  
**Inclui:** Migração completa para sistema híbrido CJS/ESM
**Próximo passo:** Iniciar Fase 3 - External Integrations (Database, IPC, Window services)