# Lastro — gestão de empréstimos (Oryveen)

Plataforma de crédito pessoal com **app do cliente (Flutter)**, **painel administrativo web** independente e **API REST** com PostgreSQL. Todo o ambiente usa dados fictícios e integrações em *sandbox*: **nenhum pagamento, SMS, WhatsApp ou assinatura é real**.

```
backend/     API Node (ESM, sem framework) + PostgreSQL + seed + testes
admin-web/   painel admin (SPA em JS puro, gráficos SVG próprios), servido em /admin
mobile/      app Flutter (Android, iOS, web), build web servido em /app
portfolio/screenshots/   15 capturas reais
docs/        funcionalidades, relatório de testes, integrações
```

## Como rodar

Requisitos: Node 22+, Flutter 3.4x (apenas para recompilar o app).

```bash
cd backend && npm install
npm run reset      # cria o banco, aplica o schema e carrega os dados de demonstração
npm start          # http://localhost:3300  →  /admin (painel)  •  /app (app web)
npm test           # 30 testes (finance + API integrada)
```

Sem `DATABASE_URL`, a API sobe um **PostgreSQL 18 embarcado** (porta 54329, pasta `backend/data/pg`). Para usar seu servidor: `DATABASE_URL=postgres://user:pass@host/db npm start`.
Variáveis de produção: `JWT_SECRET`, `DATA_ENCRYPTION_KEY` (AES-256-GCM), `PIX_WEBHOOK_SECRET`, `ALLOWED_ORIGINS`, `NODE_ENV=production` (desativa o endpoint de simulação de Pix). Os valores padrão existem só para a demonstração e devem ser trocados.

### App Flutter
```bash
cd mobile
flutter pub get
flutter run -d chrome --dart-define=API_URL=http://localhost:3300
flutter build web --release --base-href /app/          # servido pela API em /app
flutter build apk --release --dart-define=API_URL=http://10.0.2.2:3300   # emulador Android
```
**iOS:** o projeto `mobile/ios` está gerado, mas só compila em macOS com Xcode (`flutter build ios`). Antes de publicar, acrescente ao `Info.plist` as chaves `NSCameraUsageDescription` e `NSPhotoLibraryUsageDescription` (câmera para a selfie, galeria para documentos).

## Contas de demonstração
Senha de todas: `Lastro@2026demo`

| Perfil | E-mail | Observação |
|---|---|---|
| Admin | camila.ribeiro@lastro.dev | 2FA: segredo TOTP `JBSWY3DPEHPK3PXP` |
| Analista | rafael.teixeira@lastro.dev | alçada de aprovação até R$ 15.000 |
| Cliente | marina.albuquerque@exemplo.com.br | contrato ativo, histórico quitado |
| Cliente (atraso) | marcos.lima9@exemplo.com.br | parcela vencida, multa e mora |
| Cliente (semanal) | camila.teixeira2@exemplo.com.br | contrato semanal |

A base traz 38 clientes, 27 contratos ativos, pagamentos, parcelas em atraso, solicitações pendentes, contratos assinados, alertas antifraude e propostas de renegociação.

## Arquitetura resumida
- **Segurança:** senhas com scrypt; JWT de 15 min + refresh rotativo preso a sessão revogável; 2FA TOTP (RFC 6238); bloqueio por tentativas e rate limit; CPF, segredos 2FA e documentos cifrados em repouso (AES-256-GCM); CPF único via índice cego HMAC; auditoria de ações sensíveis; consentimentos LGPD registrados; exportação e anonimização de dados.
- **Financeiro:** Tabela Price com taxa proporcional por período (diária/semanal/mensal), IOF, CET por TIR, multa 2% + mora 1% a.m. pro rata, quitação com abatimento de juros (CDC art. 52 §2º), renegociação.
- **Pix (sandbox):** BR Code EMV com CRC16, webhook assinado HMAC, baixa idempotente, divergência de valor gera alerta antifraude.
- **Antifraude:** regras determinísticas com revisão humana; nenhum alerta recusa sozinho, alertas de alta gravidade bloqueiam a aprovação até revisão.

Detalhes em [docs/FUNCIONALIDADES.md](docs/FUNCIONALIDADES.md), [docs/RELATORIO-DE-TESTES.md](docs/RELATORIO-DE-TESTES.md) e [docs/INTEGRACOES.md](docs/INTEGRACOES.md).
