# Metodologia TDD e Princípios

## Metodologia TDD com Vitest + ESM ES2022

Todas as fases do projeto seguem a metodologia TDD com Vitest e ES2022:

### Ciclo Red-Green-Refactor

1. **Red**: Escrever testes que falham
   - Criar testes antes da implementação
   - Definir comportamento esperado
   - Garantir que testes falhem inicialmente

2. **Green**: Implementar código mínimo para passar
   - Implementar apenas o suficiente para os testes passarem
   - Focar na funcionalidade essencial
   - Evitar over-engineering

3. **Refactor**: Melhorar código mantendo testes verdes
   - Melhorar design e estrutura
   - Eliminar duplicação
   - Otimizar performance

### Padrões de Testes

#### Estrutura de Testes ESM ES2022
```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ModuleName', () => {
  /** @type {import('../../../src/types/module.js').ModuleInstance} */
  let moduleInstance;

  beforeEach(async () => {
    // ES2022: Top-level await no setup
    const { createModule } = await import('../../../src/services/module.mjs');
    moduleInstance = createModule();
  });

  afterEach(() => {
    // Cleanup após cada teste
    vi.clearAllMocks();
  });

  it('should use ES2022 features correctly', async () => {
    // Arrange: preparar dados
    const input = { data: 'test', id: 123 };
    
    // Act: executar ação com ES2022 features
    const result = await moduleInstance?.process?.(input);
    
    // Assert: verificar resultado com ES2022 features
    expect(result?.data?.value ?? 'default').toBe('test');
    expect(Object.hasOwn(result, 'success')).toBe(true);
  });
});
```

#### Tipos de Testes com ES2022
- **Unit Tests**: Testam unidades individuais de código em `.test.mjs` com ES2022
- **Integration Tests**: Testam interação entre módulos híbridos CJS/ESM
- **E2E Tests**: Testam fluxos completos do usuário com ES2022 features

#### Padrões ES2022 em Testes
- **Top-level await** em setup de testes
- **Optional chaining** (`?.`) em assertions
- **Nullish coalescing** (`??`) em valores default
- **Object.hasOwn()** em verificações de objeto
- **Private class fields** em classes de teste

### Cobertura de Código com ES2022

- **Target**: >80% de cobertura
- **Métricas**: Statements, Branches, Functions, Lines
- **Relatórios**: Text, JSON, HTML
- **ES2022 Features**: Todas as features ES2022 devem ser testadas
- **JSDob Coverage**: 100% dos exports públicos com JSDob testado

## Princípios Fundamentais do Projeto

### Preservação de Funcionalidade
- ✅ **Preservação Total**: Nenhuma funcionalidade existente será alterada
- ✅ **Adição Apenas**: Novo código apenas adiciona capacidades
- ✅ **Compatibilidade Reversa**: APIs existentes mantêm comportamento idêntico
- ✅ **Logs Consistentes**: Saídas de terminal permanecem inalteradas

### Qualidade de Código
- **Clean Code**: Código legível e maintenível
- **SOLID Principles**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- **DRY**: Don't Repeat Yourself
- **KISS**: Keep It Simple, Stupid

### Arquitetura
- **Modularização**: Divisão em módulos coesos e de baixo acoplamento
- **Layered Architecture**: Separação clara de responsabilidades
- **Service-Oriented**: Lógica de negócio encapsulada em serviços
- **Event-Driven**: Acoplamento fraco através de sistemas de eventos

### Performance com ES2022
- **Lazy Loading**: Carregamento sob demanda com top-level await
- **Caching**: Estratégias de cache eficientes com ES2022 features
- **Memory Management**: Gerenciamento cuidadoso de memória
- **Async/Await**: Operações assíncronas eficientes com ES2022

## Estratégia de Modularização com ES2022

### Abordagem Híbrida com ES2022
- **Fase inicial**: Módulos maiores (200-300 linhas) para implementação rápida
- **Evolução progressiva**: Divisão para módulos ultra granulares (50-150 linhas)
- **Foco**: Preservação total de funcionalidade existente
- **ES2022 Obrigatório**: Todo código novo em `.mjs` com features ES2022
- **JSDob Obrigatório**: Tipagem forte para preparação TypeScript

### Critérios de Divisão de Módulos
1. **Single Responsibility**: Cada módulo tem uma única responsabilidade
2. **Cohesion**: Elementos relacionados ficam juntos
3. **Coupling**: Mínimo acoplamento entre módulos
4. **Testability**: Módulos fáceis de testar isoladamente
5. **ES2022 Compliance**: Módulos `.mjs` usam features ES2022
6. **JSDob Completeness**: Todos os exports públicos documentados

### Padrões de Extensões ES2022
- **Legado CJS**: `.js` (mantido)
- **Novo CJS**: `.cjs` (compatibilidade)
- **Novo ESM**: `.mjs` (preferido com ES2022)
- **Testes**: `.test.mjs` (obrigatório com ES2022)
- **Tipos**: `.types.mjs` (definições de tipos)

## Gestão de Dependências

### Princípios
- **Dependency Injection**: Injeção de dependências
- **Inversion of Control**: Controle invertido
- **Interface Segregation**: Interfaces pequenas e focadas

### Padrões com ES2022
- **Factory Pattern**: Criação de objetos com ES2022 features
- **Observer Pattern**: Notificação de eventos com private fields
- **Strategy Pattern**: Algoritmos intercambiáveis com optional chaining

### Validação Automática ES2022
```bash
# Validação completa da estratégia ES2022
npm run validate:all

# Validações individuais obrigatórias
npm run validate:es2022      # Features ES2022
npm run validate:extensions  # Extensões corretas
npm run validate:jsdoc       # JSDob completo
npm run validate:hybrid      # Compatibilidade híbrida

# NOTA: Scripts de validação ES2022 estão em project/scripts/
# Scripts gerais do projeto permanecem em raiz/scripts/
```

### Checkpoints de Validação
Cada módulo/fase deve passar por checkpoints obrigatórios:
1. **Extensões corretas** (`.mjs`, `.cjs`, `.test.mjs`)
2. **Features ES2022 implementadas** (top-level await, optional chaining, etc.)
3. **JSDob completo** (preparação TypeScript)
4. **Testes ES2022** (100% em `.test.mjs`)
5. **Compatibilidade híbrida** (CJS/ESM sem conflitos)