# Comandos Essenciais do Projeto

## Comandos de Desenvolvimento

### Testes
```bash
# Executar todos os testes
npm test

# Executar testes em modo watch
npm run test:watch

# Gerar relatório de cobertura
npm run test:coverage

# Abrir interface UI do Vitest
npm run test:ui

# Executar teste específico
npm test -- path/to/specific.test.js

# Executar testes de uma pasta específica
npm test tests/unit/
```

### Build e Verificação
```bash
# Build do projeto
npm run build

# Build para distribuição
npm run dist

# Verificar build
npm run verify-build

# Limpar artefatos de build
npm run clean

# Build para plataformas específicas
npm run build:linux
npm run build:win
npm run build:mac
```

### Inicialização
```bash
# Iniciar aplicação Electron
npm start

# Iniciar em modo desenvolvimento
npm run dev
```

## Comandos de Projeto

### Gestão de Progresso
```bash
# Verificar progresso atual
grep -c '\[x\]' project/PLAN_GENERAL.md

# Verificar itens pendentes
grep -c '\[ \]' project/PLAN_GENERAL.md

# Gerar relatório de progresso
grep -E "^\s*[-*]\s*\[x\]" project/PLAN_GENERAL.md | wc -l
```

### Validação ES2022 (OBRIGATÓRIO)
```bash
# Validação completa da estratégia ES2022
npm run validate:all

# Verificar uso de features ES2022
npm run validate:es2022

# Verificar extensões corretas (.mjs, .cjs, .test.mjs)
npm run validate:extensions

# Verificar JSDob completo em exports públicos
npm run validate:jsdoc

# Verificar compatibilidade híbrida CJS/ESM
npm run validate:hybrid

# NOTA: Todos os scripts de validação ES2022 estão em project/scripts/
# Scripts gerais do projeto permanecem em raiz/scripts/

# Verificar estrutura de arquivos ES2022
find src/ -name "*.mjs" -exec grep -l "await\|?.\|??\|Object\.hasOwn" {} \;
find tests/ -name "*.test.mjs" | wc -l
```

### Validação de Implementação com ES2022
```bash
# Validação completa ES2022 (OBRIGATÓRIO antes de prosseguir)
npm run validate:all && npm test && npm run build && npm run verify-build

# Verificar lint (se configurado)
npm run lint

# Verificar typecheck (se configurado)
npm run typecheck

# Validação específica por fase
npm run validate:phase-1    # Foundation
npm run validate:phase-2    # Backend
npm run validate:phase-3    # Integrations
npm run validate:phase-4    # UI/Database
npm run validate:phase-5    # Final Integration
```

### Gestão de Fases com ES2022
```bash
# Iniciar nova fase (com validação ES2022)
cp project/PROMPT.md phase-template.md

# Comparar fases
diff project/phases/phase-01-foundation.md project/phases/phase-02-backend.md

# Verificar dependências entre fases
grep -r "Fase [0-9]" project/phases/

# Validar fase específica com ES2022
npm run validate:phase-1    # Foundation
npm run validate:phase-2    # Backend
npm run validate:phase-3    # Integrations
npm run validate:phase-4    # UI/Database
npm run validate:phase-5    # Final Integration

# Resetar progresso da fase (se necessário)
npm run reset:phase-1
npm run reset:phase-2
```

## Comandos de Análise

### Análise de Código
```bash
# Contar linhas de código
find src/ -name "*.js" -exec wc -l {} + | tail -1

# Analisar complexidade (se instalado)
npm run complexity

# Encontrar duplicações (se instalado)
npm run duplicate-finder
```

### Análise de Documentação
```bash
# Contar linhas de documentação
find project/ -name "*.md" -exec wc -l {} + | tail -1

# Verificar links quebrados
npm run docs:check-links

# Gerar estatísticas do projeto
npm run docs:stats
```

## Comandos de Configuração

### Ambiente
```bash
# Instalar dependências
npm install

# Instalar dependências de desenvolvimento
npm install --save-dev vitest @vitest/ui jsdom

# Atualizar dependências
npm update

# Verificar dependências desatualizadas
npm outdated
```

### Configuração de Testes
```bash
# Configurar Vitest (se não existir)
npm install --save-dev vitest @vitest/ui jsdom

# Criar estrutura de testes
mkdir -p tests/{unit,integration,e2e}
mkdir -p tests/setup

# Configurar arquivo de setup
touch tests/setup.js
```

## Comandos de Depuração

### Logs e Debug
```bash
# Verificar logs da aplicação
tail -f logs/app.log

# Executar com debug
DEBUG=* npm start

# Verbose mode
npm start -- --verbose
```

### Testes Debug
```bash
# Debug de testes
npm test -- --debug

# Testes com inspetor
node --inspect-brk node_modules/.bin/vest --run
```

## Comandos de Git

### Fluxo de Trabalho
```bash
# Verificar status
git status

# Adicionar arquivos modificados
git add .

# Commit com mensagem padrão
git commit -m "feat: implement new module"

# Push para remoto
git push

# Criar branch para nova fase
git checkout -b phase-02-backend
```

### Histórico e Análise
```bash
# Verificar commits recentes
git log --oneline -10

# Verificar mudanças em arquivos específicos
git log --follow -- src/

# Comparar com branch principal
git diff main...HEAD
```

## Comandos de Sistema

### Processos
```bash
# Matar processos Electron
pkill -f electron

# Verificar portas em uso
lsof -i :3000

# Limpar cache
npm cache clean --force
```

### Arquivos e Diretórios
```bash
# Criar estrutura de módulos
mkdir -p src/{services,controllers,models,utils}

# Remover arquivos temporários
find . -name "*.tmp" -delete

# Verificar permissões
ls -la src/
```

## Scripts Personalizados de Validação ES2022

### Scripts de Automação da Migração
```bash
# Scripts de validação ES2022 (NOVOS - em project/scripts/)
./project/scripts/validate-es2022.mjs      # Valida features ES2022
./project/scripts/validate-extensions.mjs  # Valida extensões de arquivos
./project/scripts/validate-jsdoc.mjs       # Valida JSDob completo
./project/scripts/validate-hybrid.mjs      # Valida compatibilidade híbrida

# Scripts gerais do projeto (em raiz/scripts/)
./scripts/post-build.js          # Pós-build do projeto
./scripts/verify-build.js        # Verificação de build
```

## Comandos de Ajuda

### Documentação
```bash
# Ajuda do npm
npm --help

# Ajuda de scripts específicos
npm run test -- --help

# Verificar package.json scripts
npm run
```

### Referências Rápidas
```bash
# Verificar variáveis de ambiente
env | grep NODE_

# Verificar configuração do Electron
electron --version

# Verificar versão do Node
node --version
```