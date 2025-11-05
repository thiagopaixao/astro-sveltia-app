# Padrões ES2022 e Estratégia Híbrida CJS/ESM

## Visão Geral

Este documento define os padrões obrigatórios para a estratégia de migração híbrida do Documental App, garantindo uso de ES2022 em novo código com compatibilidade total com legado CJS.

## Estratégia Híbrida CJS/ESM com ES2022

### Princípios Fundamentais

1. **Preservação de Legado**: Código CJS existente mantido como `.js`
2. **Novo Código CJS**: Módulos que precisam compatibilidade usam `.cjs`
3. **ESM Puro**: Todo código novo preferencialmente em `.mjs` com ES2022
4. **Testes 100% ESM**: Todos os testes em `.test.mjs` com features ES2022
5. **JSDob Obrigatório**: Tipagem forte para futura migração TypeScript

### Regras OBRIGATÓRIAS de Extensões

| Tipo de Arquivo | Extensão | Padrão | ES2022 | JSDob | Quando Usar |
|-----------------|----------|--------|--------|-------|------------|
| Legado CJS | `.js` | Mantido | ❌ Não | Opcional | Código existente não migrado |
| Novo CJS | `.cjs` | Compatibilidade | ⚠️ Parcial | ✅ Obrigatório | Depende de módulos CJS |
| Novo ESM | `.mjs` | Preferido | ✅ Sim | ✅ Obrigatório | Todo código novo |
| Testes | `.test.mjs` | Obrigatório | ✅ Sim | ✅ Obrigatório | 100% dos testes |
| Config | `.config.mjs` | Preferido | ✅ Sim | ✅ Obrigatório | Arquivos de configuração |
| Tipos | `.types.mjs` | Preferido | ✅ Sim | ✅ Obrigatório | Definições de tipos |

### Features ES2022 Obrigatórias em Novo Código

#### 1. Top-level Await (apenas em `.mjs`)
```javascript
// ✅ CORRETO - Em arquivo .mjs
const config = await loadConfig();
const dbConnection = await createConnection();

export default { config, dbConnection };

// ❌ ERRADO - Em arquivo .cjs ou .js
const config = await loadConfig(); // SyntaxError
```

#### 2. Optional Chaining (`?.`)
```javascript
// ✅ CORRETO
const user = data?.user?.profile?.name;
const result = service?.getData?.();

// ❌ ERRADO (legado)
const user = data && data.user && data.user.profile && data.user.profile.name;
```

#### 3. Nullish Coalescing (`??`)
```javascript
// ✅ CORRETO
const timeout = options?.timeout ?? 5000;
const port = config?.port ?? 3000;

// ❌ ERRADO (legado)
const timeout = options && options.timeout || 5000;
```

#### 4. Private Class Fields (`#`)
```javascript
// ✅ CORRETO
class ServiceManager {
  #config;
  #logger;
  #cache = new Map();

  constructor(config, logger) {
    this.#config = config;
    this.#logger = logger;
  }

  #validateInput(input) {
    return input != null;
  }
}
```

#### 5. Object.hasOwn()
```javascript
// ✅ CORRETO
if (Object.hasOwn(obj, 'property')) {
  // Usar propriedade
}

// ❌ ERRADO (legado)
if (obj.hasOwnProperty('property')) {
  // Usar propriedade
}
```

#### 6. Array.prototype.at()
```javascript
// ✅ CORRETO
const lastItem = array.at(-1);
const secondItem = array.at(1);

// ❌ ERRADO (legado)
const lastItem = array[array.length - 1];
const secondItem = array[1];
```

## Padrões de Import/Export Híbridos

### Imports ESM (.mjs)
```javascript
// ✅ CORRETO - Sempre com extensões explícitas
import { createLogger } from '../core/app-logger.cjs';
import { Constants } from '../config/constants.mjs';
import type { ServiceConfig } from '../types/service.types.mjs';

// ✅ CORRETO - Default imports
import DatabaseManager from '../core/database/manager.mjs';

// ✅ CORRETO - Namespace imports
import * as GitUtils from '../services/git/utils.mjs';

// ❌ ERRADO - Sem extensão
import { createLogger } from '../core/app-logger';
```

### Exports CJS (.cjs)
```javascript
// ✅ CORRETO - Named exports
module.exports = {
  ServiceManager,
  createServiceManager,
  CONSTANTS
};

// ✅ CORRETO - Default export
module.exports = ServiceManager;

// ✅ CORRETO - Mixed exports
class ServiceManager {}
module.exports = ServiceManager;
module.exports.createManager = createServiceManager;
```

### Exports ESM (.mjs)
```javascript
// ✅ CORRETO - Named exports
export { ServiceManager, createServiceManager };

// ✅ CORRETO - Default export
export default ServiceManager;

// ✅ CORRETO - Export de tipos
export type { ServiceConfig, ProcessResult };

// ✅ CORRETO - Re-exports
export { Logger } from '../core/logger.cjs';
export type { LoggerConfig } from '../types/logger.types.mjs';
```

## Padrões JSDob Obrigatórios

### Tipos Básicos
```javascript
/**
 * @typedef {Object} ServiceConfig
 * @property {string} apiUrl - URL base da API
 * @property {number} [timeout=5000] - Timeout em milissegundos
 * @property {string[]} [requiredFields=[]] - Campos obrigatórios
 * @property {boolean} [validateInputs=true] - Se deve validar inputs
 * @property {Record<string, string>} [headers={}] - Headers HTTP padrão
 * @property {Date|null} [lastSync] - Última sincronização
 */

/**
 * @typedef {'pending' | 'processing' | 'completed' | 'failed'} ProcessingStatus
 * Status do processamento
 */

/**
 * @typedef {Object} ProcessingResult
 * @property {boolean} success - Status do processamento
 * @property {unknown} data - Dados processados
 * @property {string[]} [errors=[]] - Lista de erros
 * @property {string[]} [warnings=[]] - Lista de avisos
 * @property {number} timestamp - Timestamp do processamento
 * @property {ProcessingStatus} status - Status atual
 */
```

### Classes e Métodos
```javascript
/**
 * Gerenciador de serviços com suporte a ES2022
 * 
 * @class ServiceManager
 * @description Implementa gerenciamento de serviços usando features modernas
 * 
 * @example
 * ```javascript
 * const manager = new ServiceManager({
 *   apiUrl: 'https://api.example.com',
 *   timeout: 3000
 * });
 * 
 * const result = await manager.process({ data: 'test' });
 * console.log(result.success); // true
 * ```
 */
class ServiceManager {
  /**
   * Configuração do serviço
   * @private @readonly {ServiceConfig}
   */
  #config;

  /**
   * Instância do logger
   * @private @readonly {ReturnType<import('../core/app-logger.cjs').createLogger>}
   */
  #logger;

  /**
   * Construtor do gerenciador de serviços
   * 
   * @param {ServiceConfig} options - Opções de configuração
   * @param {Object} [dependencies={}] - Dependências injetadas
   * @param {ReturnType<import('../core/app-logger.cjs').createLogger>} [dependencies.logger] - Logger customizado
   * @throws {TypeError} Se configuração for inválida
   */
  constructor(options, dependencies = {}) {
    // Implementação...
  }

  /**
   * Processa dados usando features ES2022
   * 
   * @async
   * @param {unknown} input - Dados de entrada
   * @param {Object} [options={}] - Opções de processamento
   * @param {boolean} [options.validate=true] - Se deve validar entrada
   * @param {boolean} [options.useCache=true] - Se deve usar cache
   * @returns {Promise<ProcessingResult>} Resultado do processamento
   * @throws {ValidationError} Se a entrada for inválida
   * @throws {ProcessingError} Se o processamento falhar
   * 
   * @example
   * ```javascript
   * const result = await manager.process(
   *   { data: 'test', id: 123 },
   *   { validate: true, useCache: true }
   * );
   * ```
   */
  async process(input, options = {}) {
    // Implementação com ES2022 features
    const { validate = true, useCache = true } = options;
    
    // Optional chaining
    const config = this.#config?.apiUrl;
    
    // Nullish coalescing
    const timeout = options?.timeout ?? 5000;
    
    // Implementação...
  }
}
```

### Funções
```javascript
/**
 * Cria uma instância do ServiceManager
 * 
 * @param {ServiceConfig} options - Opções de configuração
 * @param {Object} [dependencies={}] - Dependências injetadas
 * @returns {ServiceManager} Nova instância do gerenciador
 * 
 * @example
 * ```javascript
 * const manager = createServiceManager({
 *   apiUrl: 'https://api.example.com',
 *   timeout: 3000
 * });
 * ```
 */
export function createServiceManager(options, dependencies = {}) {
  return new ServiceManager(options, dependencies);
}

/**
 * Valida dados de entrada usando ES2022 features
 * 
 * @param {unknown} input - Dados a serem validados
 * @param {string[]} [requiredFields=[]] - Campos obrigatórios
 * @returns {boolean} True se válido, false caso contrário
 * @throws {TypeError} Se input for null/undefined
 */
export function validateInput(input, requiredFields = []) {
  // Nullish coalescing
  const data = input ?? {};
  
  // Optional chaining
  const hasRequired = requiredFields?.every(field => Object.hasOwn(data, field));
  
  return hasRequired;
}
```

## Padrões de Testes ESM ES2022

### Estrutura de Teste Padrão
```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * @typedef {Object} TestContext
 * @property {any} moduleInstance - Instância do módulo em teste
 * @property {Object} mocks - Mocks configurados
 * @property {Object} testData - Dados de teste
 */

describe('ServiceManager', () => {
  /** @type {TestContext} */
  let testContext;

  beforeEach(async () => {
    // ES2022: Top-level await no setup
    const { createServiceManager } = await import('../../../src/services/manager.mjs');
    
    testContext = {
      moduleInstance: createServiceManager({
        apiUrl: 'https://api.test.com',
        timeout: 5000
      }),
      mocks: {
        logger: vi.fn(),
        config: vi.fn()
      },
      testData: {
        validInput: { data: 'test', id: 123 },
        invalidInput: null
      }
    };
  });

  it('should use ES2022 features correctly', async () => {
    const input = testContext.testData.validInput;
    
    // ES2022: Optional chaining em testes
    const result = await testContext.moduleInstance?.process?.(input);
    
    // ES2022: Nullish coalescing em assertions
    expect(result?.data?.value ?? 'default').toBe('test');
    
    // ES2022: Object.hasOwn
    expect(Object.hasOwn(result, 'success')).toBe(true);
  });

  it('should handle nullish values correctly', () => {
    const input = testContext.testData.invalidInput;
    
    // ES2022: Nullish coalescing
    const result = input ?? { default: 'value' };
    expect(result).toEqual({ default: 'value' });
  });
});
```

## Validação Automática

### Scripts de Validação
**NOTA:** Todos os scripts de validação ES2022 estão localizados em `project/scripts/` e são executados via NPM scripts. Scripts gerais do projeto permanecem em `raiz/scripts/`.

#### `npm run validate:es2022`
Verifica uso de features ES2022 em arquivos `.mjs`:
- Top-level await
- Optional chaining
- Nullish coalescing
- Private class fields
- Object.hasOwn()
- Array.prototype.at()

#### `npm run validate:extensions`
Verifica extensões corretas:
- Testes devem ser `.test.mjs`
- Novo ESM deve ser `.mjs`
- Novo CJS deve ser `.cjs`
- Legado mantido como `.js`

#### `npm run validate:jsdoc`
Verifica JSDob completo:
- Todos os exports públicos têm JSDob
- Tipos definidos corretamente
- Exemplos incluídos
- Parâmetros documentados

#### `npm run validate:hybrid`
Validação completa da estratégia híbrida:
- Imports com extensões explícitas
- Compatibilidade CJS/ESM
- Padrões ES2022 aplicados
- JSDob completo

## Migração Gradual

### Fase 1: Foundation (ES2022 Parcial)
- Configuração em `.mjs` com ES2022
- Testes em `.test.mjs` com ES2022
- Legado mantido em `.js`

### Fase 2-3: Backend Services (ES2022 Progressivo)
- Novos serviços em `.mjs` com ES2022
- Adapters em `.cjs` para compatibilidade
- Testes 100% ESM ES2022

### Fase 4-5: UI & Integration (ES2022 Completo)
- Todo código novo em `.mjs` com ES2022
- Migração de CJS para ESM onde possível
- Preparação para TypeScript

## Checklist de Validação

### Para Cada Novo Módulo:
- [ ] Extensão correta (`.mjs` para ESM, `.cjs` para CJS)
- [ ] Features ES2022 aplicadas (se `.mjs`)
- [ ] JSDob completo em todos os exports
- [ ] Testes em `.test.mjs` com ES2022
- [ ] Imports com extensões explícitas
- [ ] Validação automática passa

### Para Cada Fase:
- [ ] Todos os novos módulos seguem padrões
- [ ] Testes 100% ESM ES2022
- [ ] Validação `npm run validate:all` passa
- [ ] Documentação atualizada
- [ ] Histórico de migração preservado

---

**Última atualização:** 2025-11-04  
**Estratégia atual:** Migração Híbrida CJS/ESM com ES2022  
**Status:** Padrões definidos e validação automática implementada