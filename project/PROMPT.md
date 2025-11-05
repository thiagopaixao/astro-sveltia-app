Implementar próxima fase do plano de modularização seguindo ES2022 Hybrid Standards:
PASSO 1 - DIAGNÓSTICO AUTOMÁTICO:
- Ler project/phases/ para identificar fase atual (status ≠ "Concluída")
- Verificar progresso e checklist pendente
- Identificar pré-requisitos ES2022 não validados
- Consultar project/PLAN_GENERAL.md para estratégia geral
- Verificar project/README.md para contexto do projeto
PASSO 2 - VALIDAÇÃO ES2022:
- Executar npm run validate:all (scripts em project/scripts/)
- Analisar falhas e priorizar correções
- Garantir compliance antes de prosseguir
PASSO 3 - IMPLEMENTAÇÃO:
- Seguir checklist da fase identificada
- Usar templates de project/docs/shared/templates/
- Aplicar es2022-hybrid-standards.md rigorosamente
ARQUIVOS ESSENCIAIS:
📋 project/phases/ - Detectar fase atual automaticamente
📖 project/PLAN_GENERAL.md - Estratégia geral e visão macro
📖 project/README.md - Contexto e overview do projeto
📖 project/docs/shared/es2022-hybrid-standards.md - Padrões obrigatórios
🔧 project/docs/shared/methodology.md - TDD com Vitest
⚡ project/docs/shared/commands.md - Scripts de validação
OBJETIVO: Continuar exatamente de onde parou com 0 breaking changes.