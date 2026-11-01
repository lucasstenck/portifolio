# Relatório de testes e limitações

Data da execução: 01/11/2026 • Windows 10, Node 22.17, PostgreSQL 18.6 (embarcado), Flutter 3.47.9, Chrome headless.

## Resultados
| Suíte | Comando | Resultado |
|---|---|---|
| Finanças (Price, CET, IOF, mora, quitação, amortização, renegociação) | `npm test` | **15/15** |
| API integrada com PostgreSQL real (cadastro, login/2FA, bloqueio, simulação, solicitação, aprovação, assinatura, Pix + webhook, idempotência, divergência de valor, antifraude, permissões, LGPD, relatórios) | `npm test` | **15/15** |
| App Flutter (formatação de moeda, números NUMERIC, datas) | `flutter test` | **3/3** |
| Análise estática do app | `flutter analyze` | sem erros (avisos de estilo apenas) |
| Painel admin: login com 2FA e navegação por 11 rotas em 1440 px e 390 px | script Puppeteer (`_tools/smoke-admin.mjs`) | sem erros de JS |
| App web: fluxo login → início → simulação → solicitação → contrato → extrato → perfil/KYC → calendário → Pix | script Puppeteer (`_tools/cap-app.mjs`) | concluído, 15 capturas geradas |

## Bugs encontrados e corrigidos durante os testes
CPFs duplicados na carga de dados; coluna ambígua no score; datas `DATE` chegando como objeto (quebrava atraso e renegociação); bloqueio de login nunca disparava; alerta de Pix divergente era perdido ao reverter a transação; inadimplência exibida como 0%; botões do alerta cortados em telas médias; tabelas sem rolagem horizontal em 390 px.

## Limitações conhecidas (declaradas, não escondidas)
- **iOS não foi compilado**: exige macOS/Xcode. O projeto existe, mas não foi executado em iPhone/simulador.
- **As capturas do app são do build web do Flutter** em viewport de celular (390×844, escala 3×), não de emulador Android. O APK release compilou com sucesso (50,7 MB, `mobile/build/app/outputs/flutter-apk/app-release.apk`), mas não foi instalado nem executado em emulador ou aparelho.
- **PDF no app:** contratos e comprovantes são exibidos em tela; o PDF é gerado pela API e aberto no painel, mas o app ainda não faz download do arquivo.
- **Nenhuma integração é real:** Pix, assinatura, SMS/WhatsApp e leitura de documentos são sandbox (ver `INTEGRACOES.md`).
- Armazenamento de documentos em disco local cifrado; em produção usar objeto/KMS.
- Sem testes automatizados de interface do Flutter além dos de utilidades; sem teste de carga.
- Não foi usado Figma nem as skills "Impeccable" (indisponíveis nesta sessão); o design usa sistema próprio (paleta spruce/menta, Manrope, ícones desenhados em código).
- Auditoria de segurança formal, pentest e parecer jurídico **não** foram feitos. Operar crédito exige atender às regras do Banco Central (ex.: SCD/instituição autorizada), CDC e LGPD.
