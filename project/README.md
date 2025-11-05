# Documental App - Projeto de Modularização ES2022

## Visão Geral

Este projeto transforma o Documental App monolítico (`main.js` ~4845 linhas) em uma arquitetura modular, testável e escalável usando **ES2022 Hybrid Migration Strategy** com Test-Driven Development (TDD) e Vitest.

## Início Rápido

```bash
# Navegar para o diretório do projeto
cd /workspaces/astro-sveltia-app/project

# Verificar status atual das fases
cat PLAN_GENERAL.md

# Ler padrões ES2022 obrigatórios
cat docs/shared/es2022-hybrid-standards.md

# Começar com a Fase 1
cat phases/phase-01-foundation.md
```

## Estrutura do Projeto

```
project/
├── README.md                    # Este arquivo - visão geral
├── PLAN_GENERAL.md             # Plano mestre com todas as fases
├── PROMPT.md                    # Template TDD para implementação
├── scripts/                     # Scripts de validação ES2022
│   ├── validate-es2022.mjs     # Features ES2022
│   ├── validate-extensions.mjs # Extensões de arquivo
│   ├── validate-jsdoc.mjs      # JSDob completo
│   └── validate-hybrid.mjs     # Compatibilidade CJS/ESM
├── docs/                       # Documentação compartilhada
│   └── shared/                 # Conteúdo compartilhado
│       ├── es2022-hybrid-standards.md # ⭐ Padrões ES2022 obrigatórios
│       ├── methodology.md     # Metodologia TDD e princípios
│       ├── commands.md        # Comandos essenciais
│       └── templates/         # Templates de código
└── phases/                     # Implementações detalhadas por fase
    ├── phase-01-foundation.md   # Configuração base (2 semanas)
    ├── phase-02-backend.md      # Serviços backend (2 semanas)
    ├── phase-03-integrations.md # Integrações externas (2 semanas)
    ├── phase-04-ui-database.md  # UI/BD refinamento (2 semanas)
    └── phase-05-integration.md  # Integração final (4 semanas)

# Documentos arquivados (histórico)
docs/archive/                   # Documentos antigos e obsoletos
```

## Estratégia de Modularização ES2022

### Abordagem de Arquitetura Híbrida
- **Estratégia Híbrida CJS/ESM**: Legado mantido, novo código com ES2022
- **Modularização Progressiva**: Módulos maiores (200-300 linhas) → ultra-granular (50-150 linhas)
- **Arquitetura em Camadas**: Separação clara de responsabilidades
- **Orientada a Serviços**: Lógica de negócio encapsulada em serviços
- **Orientada a Eventos**: Acoplamento fraco via sistemas de eventos

### Princípios Fundamentais ES2022
1. **Zero Breaking Changes**: Toda funcionalidade existente preservada
2. **ES2022 Obrigatório**: Features modernas em novo código (.mjs)
3. **JSDob Completo**: Tipagem forte para preparação TypeScript
4. **Compatibilidade Híbrida**: CJS/ESM convivendo sem conflitos
5. **Validação Automatizada**: Scripts de verificação obrigatórios
6. **Metodologia TDD**: Ciclos Red-Green-Refactor com >80% cobertura



## Fluxo de Desenvolvimento ES2022

### Para Cada Fase
1. **Verificar Status**: `PLAN_GENERAL.md` - tabela de status das fases
2. **Ler Guia da Fase**: `phases/phase-XX-name.md`
3. **Estudar Padrões ES2022**: `docs/shared/es2022-hybrid-standards.md` ⭐
4. **Seguir Template TDD**: Usar `PROMPT.md`
5. **Validar ES2022**: Executar `npm run validate:all`
6. **Implementar**: Seguir checklist com validação contínua
7. **Acompanhar Progresso**: Atualizar checklists nos arquivos de fase

### Estratégia de Testes ES2022
```bash
# Instalar Vitest (se não instalado)
npm install --save-dev vitest @vitest/ui jsdom

# Executar testes
npm test

# Modo watch
npm run test:watch

# Relatório de cobertura
npm run test:coverage

# Validação ES2022 obrigatória
npm run validate:all
```

## Padrões de Arquitetura ES2022

### Organização de Módulos Híbrida
```
src/
├── core/           # Utilitários core e classes base
│   ├── app-logger.cjs      # CJS para compatibilidade
│   └── database/           # Sistema de banco
│       ├── connection.cjs  # CJS compatibilidade
│       └── operations.mjs  # ESM com ES2022
├── services/       # Serviços de lógica de negócio
│   ├── git/               # Operações Git
│   ├── github/            # Integração GitHub
│   ├── nodejs/            # Gerenciamento Node.js
│   └── process/           # Gerenciamento processos
├── integrations/   # Integrações com serviços externos
├── ui/            # Componentes de interface
├── database/      # Camada de acesso a dados
├── events/        # Sistema de eventos
└── config/        # Gestão de configuração
    ├── app-config.cjs      # CJS para main.js
    └── constants.mjs       # ESM com ES2022
```

### Extensões de Arquivo Obrigatórias
- **Legado CJS**: `.js` (mantido)
- **Novo CJS**: `.cjs` (compatibilidade main.js)
- **ESM Puro**: `.mjs` (novo código com ES2022)
- **Testes**: `.test.mjs` (100% ESM com ES2022)

### Padrões de Design Aplicados
- **Factory Pattern**: Criação de objetos e serviços
- **Observer Pattern**: Sistema de eventos e notificações
- **Strategy Pattern**: Algoritmos intercambiáveis
- **Repository Pattern**: Abstração de acesso a dados
- **Dependency Injection**: Injeção de dependências

## Metodologia TDD com ES2022

### Ciclo Red-Green-Refactor
1. **Red**: Escrever testes que falham em `.test.mjs` com ES2022
2. **Green**: Implementar código mínimo em `.mjs`/`.cjs` com ES2022 features
3. **Refactor**: Melhorar código mantendo testes verdes e JSDob completo

### Features ES2022 Obrigatórias
- **Top-level await** (apenas `.mjs`)
- **Optional chaining** (`?.`)
- **Nullish coalescing** (`??`)
- **Private class fields** (`#field`)
- **Object.hasOwn()**
- **Array.prototype.at()**

*Para detalhes completos, veja: `docs/shared/methodology.md` e `docs/shared/es2022-hybrid-standards.md`*

## Comandos Essenciais ES2022

### Validação Obrigatória
```bash
# Validação completa ES2022
npm run validate:all

# Validações individuais
npm run validate:es2022      # Features ES2022
npm run validate:extensions  # Extensões corretas
npm run validate:jsdoc       # JSDob completo
npm run validate:hybrid      # Compatibilidade CJS/ESM

# Validação por fase
npm run validate:phase-1     # Foundation
npm run validate:phase-2     # Backend
npm run validate:phase-3     # Integrations
npm run validate:phase-4     # UI/Database
npm run validate:phase-5     # Final Integration
```

### Gestão de Projeto
```bash
# Verificar progresso
grep -c '\[x\]' project/PLAN_GENERAL.md

# Build e verificação
npm run build && npm run verify-build

# Iniciar nova fase
cp project/PROMPT.md phase-template.md
```

*Para lista completa de comandos, veja: `docs/shared/commands.md`*

## Templates e Padrões ES2022

### Templates Disponíveis
- **Template de Testes**: `docs/shared/templates/test-template.js` (ESM ES2022)
- **Template de Módulo**: `docs/shared/templates/module-template.js` (Híbrido CJS/ESM)

### Padrões de Código ES2022
- **Extensões explícitas** em todos os imports/exports
- **Indentação de 2 espaços**
- **JSDob completo** em todos os exports públicos
- **Tratamento de erros** com `try/catch`
- **Features ES2022** obrigatórias em código `.mjs`
- **Compatibilidade híbrida** CJS/ESM sem mistura no mesmo arquivo

## Critérios de Sucesso

### Métricas de Qualidade
- **Cobertura de Testes**: >80%
- **Tamanho de Módulos**: 50-300 linhas
- **Complexidade Ciclomática**: <10 por função
- **Performance**: Sem regressão de performance

### Validação
- Todos os testes passando
- Build executando com sucesso
- Funcionalidade existente preservada
- Sem novas dependências desnecessárias

## Documentação de Referência ES2022

### Padrões e Metodologia
- `docs/shared/es2022-hybrid-standards.md` - ⭐ **PADRÕES ES2022 OBRIGATÓRIOS**
- `docs/shared/methodology.md` - Metodologia TDD com ES2022
- `docs/shared/commands.md` - Comandos essenciais e validação

### Implementação
- `PLAN_GENERAL.md` - Plano mestre com progresso
- `PROMPT.md` - Template para implementação
- `phases/` - Guias detalhados por fase

### Scripts de Validação
- `scripts/validate-es2022.mjs` - Features ES2022
- `scripts/validate-extensions.mjs` - Extensões de arquivo
- `scripts/validate-jsdoc.mjs` - JSDob completo
- `scripts/validate-hybrid.mjs` - Compatibilidade CJS/ESM

### Histórico (Arquivado)
- `docs/archive/` - Documentos antigos e obsoletos

## Suporte e Contribuição ES2022

### Para Dúvidas
1. **Consulte padrões ES2022**: `docs/shared/es2022-hybrid-standards.md` ⭐
2. **Verifique progresso**: `PLAN_GENERAL.md`
3. **Use templates**: `docs/shared/templates/`
4. **Execute validação**: `npm run validate:all`

### Relatório de Progresso
- Progresso atualizado em `PLAN_GENERAL.md`
- Status detalhado em cada arquivo de fase
- Validação ES2022 obrigatória antes de avançar
- Métricas em relatórios de teste e validação

---

**Status**: Em Validação ES2022  
**Última atualização**: 2025-11-05  
**Progresso**: 0/127 itens (0%) - **RESETADO PARA CONFORMIDADE ES2022**  
**Próxima Fase**: Completar validação ES2022 → Fase 1 - Foundation

## Conquistas Recentes ES2022

### ✅ Estratégia Híbrida CJS/ESM Implementada (5 de Novembro de 2025)
- **Padrões ES2022** definidos e documentados
- **Scripts de validação** automatizados implementados
- **Estrutura de arquivos** organizada e limpa
- **Documentação consolidada** e arquivos obsoletos arquivados
- **Compatibilidade híbrida** estabelecida sem breaking changes

### ✅ Sistema de Validação ES2022
- **4 scripts de validação** automatizados
- **Integração NPM** para execução facilitada
- **Validação por fase** específica
- **Compatibilidade CJS/ESM** verificada
- **JSDob completo** obrigatório para TypeScript preparation