# Fase 1 - Foundation

**Objetivo:** Configurar estrutura base e ferramentas para suportar todo o processo de modularização.  
**Duração:** 2 semanas  
**Status:** 🔄 Em Validação ES2022
**Progresso:** 0/45 itens validados (0%)

## Documento Pai
- **Plano Geral:** `../PLAN_GENERAL.md`
- **Próxima Fase:** `phase-02-backend.md`
- **Metodologia:** `../docs/shared/methodology.md`
- **Comandos:** `../docs/shared/commands.md`
- **ES2022 Standards:** `../docs/shared/es2022-hybrid-standards.md`

## Módulos desta Fase

1. **Configuração do Ambiente** - Setup do Vitest e estrutura de testes
2. **Sistema de Logging** - Módulo centralizado de logging
3. **Configuração e Constantes** - Gerenciamento de configurações
4. **Utilitários Base** - Funções utilitárias fundamentais

---

## 1.1. Configuração do Ambiente

### Objetivo
Configurar ambiente de desenvolvimento e testes com Vitest.

### Requisitos ES2022
- [ ] **1.1.1.** Arquivos de teste devem usar `.test.mjs`
- [ ] **1.1.2.** Setup deve usar features ES2022 (top-level await, ??)
- [ ] **1.1.3.** Configurar Vitest com ES modules
- [ ] **1.1.4.** JSDoc completo em todos os exports
- [ ] **1.1.5.** Extensões explícitas em imports
- [ ] **1.1.6.** Validação ES2022 passando
- [ ] **1.1.7.** Validação de extensões passando
- [ ] **1.1.8.** Validação JSDoc passando
- [ ] **1.1.9.** Validação híbrida passando
- [ ] **1.1.10.** Coverage mantido com ES2022

### Checklist
- [ ] **1.1.1.** Instalar dependências Vitest
- [ ] **1.1.2.** Configurar vite.config.js
- [ ] **1.1.3.** Criar estrutura de testes
- [ ] **1.1.4.** Configurar tests/setup.mjs
- [ ] **1.1.5.** Adicionar scripts ao package.json
- [ ] **1.1.6.** Validar configuração
- [ ] **1.1.7.** Criar testes de validação
- [ ] **1.1.8.** Configurar coverage report
- [ ] **1.1.9.** Validar estrutura de diretórios
- [ ] **1.1.10.** Testar interface Vitest UI

### Critérios de Sucesso ES2022
- [ ] Todos os testes usam `.test.mjs`
- [ ] Features ES2022 implementadas
- [ ] JSDoc completo em exports públicos
- [ ] Validações ES2022 passando
- [ ] Compatibilidade híbrida mantida

### Critérios de Sucesso
- [ ] Vitest instalado e configurado
- [ ] Ambiente jsdom funcionando
- [ ] Estrutura de testes criada
- [ ] Scripts configurados
- [ ] Coverage funcionando
- [ ] Interface UI acessível

---

## 1.2. Sistema de Logging

### Objetivo
Criar sistema de logging centralizado que substitua console.log do main.js mantendo mesma saída.

### Requisitos ES2022
- [ ] **1.2.1.** Logger deve usar `.cjs` (compatibilidade main.js)
- [ ] **1.2.2.** JSDoc completo em todos os métodos públicos
- [ ] **1.2.3.** Testes devem usar `.test.mjs` com ES2022
- [ ] **1.2.4.** Usar optional chaining (?.) onde aplicável
- [ ] **1.2.5.** Usar nullish coalescing (??) para defaults
- [ ] **1.2.6.** Private fields (#) para estado interno
- [ ] **1.2.7.** Object.hasOwn() em vez de hasOwnProperty
- [ ] **1.2.8.** Array.prototype.at() para acesso seguro
- [ ] **1.2.9.** Validação híbrida passando
- [ ] **1.2.10.** Performance mantida com ES2022

### Checklist
- [ ] **1.2.1.** Analisar logs existentes no main.js
- [ ] **1.2.2.** Documentar padrões de logs
- [ ] **1.2.3.** Criar src/core/app-logger.cjs
- [ ] **1.2.4.** Implementar métodos de log
- [ ] **1.2.5.** Configurar arquivo de log
- [ ] **1.2.6.** Implementar forwarding para renderer
- [ ] **1.2.7.** Criar testes unitários
- [ ] **1.2.8.** Validar saída idêntica
- [ ] **1.2.9.** Migrar primeiros logs do main.js
- [ ] **1.2.10.** Testar performance

### Critérios de Sucesso ES2022
- [ ] Logger em `.cjs` com JSDoc completo
- [ ] Features ES2022 nos testes `.test.mjs`
- [ ] Validação híbrida passando
- [ ] Performance mantida

### Critérios de Sucesso
- [ ] Logger criado e testado
- [ ] Saída idêntica aos logs originais
- [ ] Arquivo de log configurado
- [ ] Forwarding funcionando
- [ ] Performance validada
- [ ] Migração completa

---

## 1.3. Configuração e Constantes

### Objetivo
Extrair configurações e constantes do main.js para módulos centralizados.

### Requisitos ES2022
- [ ] **1.3.1.** Config deve usar `.cjs` (compatibilidade main.js)
- [ ] **1.3.2.** Constants pode usar `.mjs` (sem dependências)
- [ ] **1.3.3.** JSDoc completo em todos os exports
- [ ] **1.3.4.** Top-level await em constants.mjs se necessário
- [ ] **1.3.5.** Optional chaining para configurações aninhadas
- [ ] **1.3.6.** Nullish coalescing para valores default
- [ ] **1.3.7.** Testes em `.test.mjs` com ES2022
- [ ] **1.3.8.** Validação híbrida passando
- [ ] **1.3.9.** Extensões explícitas em imports
- [ ] **1.3.10.** Object.hasOwn() para validação

### Checklist
- [ ] **1.3.1.** Mapear configurações no main.js
- [ ] **1.3.2.** Identificar constantes globais
- [ ] **1.3.3.** Criar src/config/app-config.cjs
- [ ] **1.3.4.** Criar src/config/constants.mjs
- [ ] **1.3.5.** Implementar sistema de configuração
- [ ] **1.3.6.** Migrar constantes
- [ ] **1.3.7.** Criar testes
- [ ] **1.3.8.** Validar funcionamento
- [ ] **1.3.9.** Migrar uso no main.js
- [ ] **1.3.10.** Testar configuração externa

### Critérios de Sucesso ES2022
- [ ] Sistema em `.cjs`/`.mjs` conforme padrão
- [ ] JSDoc completo em exports
- [ ] Features ES2022 implementadas
- [ ] Validação híbrida passando

### Critérios de Sucesso
- [ ] Sistema de configuração criado
- [ ] Constantes migradas
- [ ] Testes funcionando
- [ ] Uso no main.js migrado
- [ ] Configuração externa funcionando

---

## 1.4. Utilitários Base

### Objetivo
Criar funções utilitárias fundamentais usadas pelo main.js.

### Requisitos ES2022
- [ ] **1.4.1.** Utils devem usar `.cjs` (compatibilidade main.js)
- [ ] **1.4.2.** JSDoc completo em todas as funções públicas
- [ ] **1.4.3.** Testes em `.test.mjs` com ES2022
- [ ] **1.4.4.** Optional chaining para operações seguras
- [ ] **1.4.5.** Nullish coalescing para defaults
- [ ] **1.4.6.** Array.prototype.at() para acesso seguro
- [ ] **1.4.7.** Object.hasOwn() para validação de objetos
- [ ] **1.4.8.** Private fields onde aplicável
- [ ] **1.4.9.** Validação híbrida passando
- [ ] **1.4.10.** Performance mantida com ES2022

### Checklist
- [ ] **1.4.1.** Mapear funções utilitárias no main.js
- [ ] **1.4.2.** Identificar padrões repetidos
- [ ] **1.4.3.** Criar src/utils/file-utils.cjs
- [ ] **1.4.4.** Criar src/utils/path-utils.cjs
- [ ] **1.4.5.** Implementar funções base
- [ ] **1.4.6.** Criar testes
- [ ] **1.4.7.** Validar funcionamento
- [ ] **1.4.8.** Migrar uso no main.js
- [ ] **1.4.9.** Testar performance
- [ ] **1.4.10.** Documentar funções

### Critérios de Sucesso ES2022
- [ ] Utils em `.cjs` com JSDoc completo
- [ ] Features ES2022 nos testes
- [ ] Validação híbrida passando
- [ ] Performance mantida

### Critérios de Sucesso
- [ ] Utilitários criados e testados
- [ ] Funcionamento validado
- [ ] Uso no main.js migrado
- [ ] Performance testada
- [ ] Documentação completa

---

## Pré-requisitos ES2022 para Fase 2

- [ ] Validação de extensões: 100% passando
- [ ] Validação ES2022: 100% passando  
- [ ] Validação JSDoc: 100% passando
- [ ] Validação híbrida: 100% passando
- [ ] Todos os testes em `.test.mjs`
- [ ] Features ES2022 implementadas
- [ ] JSDoc completo em exports públicos
- [ ] Compatibilidade híbrida mantida

## Pré-requisitos para Fase 2

- [ ] Sistema de logging 100% migrado
- [ ] Configurações e constantes migradas
- [ ] Utilitários base migrados
- [ ] Todos os testes passando (>80% cobertura)
- [ ] Sem regressão de funcionalidade

## Templates e Referências

- **Template de Testes:** `../docs/shared/templates/test-template.js`
- **Template de Módulo:** `../docs/shared/templates/module-template.js`
- **Metodologia TDD:** `../docs/shared/methodology.md`
- **Comandos:** `../docs/shared/commands.md`

---

**Status:** 🔄 Em Validação ES2022 - 0/45 itens validados (0%)  
**Próximo passo:** Completar validação ES2022 → Fase 2 - Backend Services