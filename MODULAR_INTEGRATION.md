# Integração Modular Híbrida

## Visão Geral

O sistema agora suporta uma arquitetura modular híbrida que permite testar novos módulos em produção enquanto mantém a funcionalidade existente.

## Arquivos Principais

### `main-modular.js`
- **Arquivo principal híbrido** que integra novos módulos com código legado
- Substitui gradualmente o `main.js` original
- Mantém compatibilidade total com funcionalidades existentes

### Novos Módulos Integrados

#### 1. Sistema de Logging (`src/main/logging/logger.js`)
- ✅ Buffer de logs com gerenciamento de memória
- ✅ Broadcast para janelas Electron
- ✅ Níveis de log: info, error, warn, debug
- ✅ Override de console methods

#### 2. Process Tracker (`src/main/processes/documentalTracker.js`)
- ✅ Rastreamento de processos Documental
- ✅ Persistência em JSON
- ✅ Validação de processos ativos
- ✅ Limpeza de processos órfãos

#### 3. Platform Inspectors (`src/main/platform/`)
- ✅ Suporte multi-plataforma (Windows, Linux, macOS, BSD)
- ✅ Inspeção detalhada de processos
- ✅ Comandos específicos por plataforma
- ✅ Factory pattern para seleção automática

## Como Usar

### 1. Testar Integração Modular
```bash
# Testar componentes modulares isoladamente
node test-modular.js

# Executar aplicação com arquitetura modular
npm run start:modular
```

### 2. Comparar com Versão Original
```bash
# Versão original (monolítica)
npm run start

# Versão modular híbrida
npm run start:modular
```

### 3. Logs e Monitoramento

A versão modular inclui logs aprimorados:
- 📊 Informações de plataforma na inicialização
- 🔍 Validação de processos Documental
- 📋 Detalhes de processos ativos
- ✅ Status de integração de módulos

## Benefícios da Abordagem Híbrida

### ✅ Migração Gradual
- Sem downtime ou interrupção de serviço
- Teste em ambiente real com dados reais
- Rollback instantâneo para versão original

### ✅ Validação Real
- Módulos funcionam sob carga real
- Integração com APIs Electron
- Compatibilidade com sistema existente

### ✅ Monitoramento Aprimorado
- Logs estruturados com timestamps
- Detecção de problemas em tempo real
- Métricas de performance

## Próximos Passos

1. **Database Module** - Extrair operações SQLite
2. **Window Management** - Migrar criação de janelas
3. **IPC Handlers** - Modularizar comunicação
4. **Business Logic** - Extrair serviços de domínio

## Estrutura de Diretórios

```
src/main/
├── logging/
│   └── logger.js          # Sistema de logging modular
├── processes/
│   └── documentalTracker.js # Rastreamento de processos
└── platform/
    ├── index.js           # Factory para seleção de plataforma
    ├── windows.js         # Inspector Windows
    └── unix.js           # Inspector Unix/Linux
```

## Comandos Úteis

```bash
# Testar módulos individuais
npm test -- tests/unit/platform/

# Validar arquitetura híbrida
npm run validate:hybrid

# Build com módulos
npm run build:fixed
```

## Monitoramento

Os logs da versão modular incluem:
- 🚀 Inicialização da aplicação
- 🖥️ Informações da plataforma
- 📊 Status dos processos Documental
- 🔍 Validação de processos
- ✅ Status de integração

## Rollback

Se necessário, voltar para versão original:
```bash
# Usar main.js original
npm run start
```

A abordagem híbrida garante transição segura para arquitetura modular sem risco para produção.