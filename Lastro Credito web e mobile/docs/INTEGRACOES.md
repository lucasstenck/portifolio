# Integrações que exigem credenciais, provedor ou homologação

| Serviço | Estado aqui | O que falta para produção |
|---|---|---|
| **Pix / PSP** | Sandbox: BR Code próprio, webhook HMAC | Contratar PSP/instituição autorizada pelo BCB, chaves e certificado mTLS, cobrança imediata/com vencimento, homologar webhook e conciliação diária |
| **Assinatura eletrônica** | Sandbox: hash + IP + agente + horário | Provedor (Clicksign, D4Sign, ZapSign…) com credenciais, validade jurídica e carimbo de tempo |
| **SMS** | Caixa de saída simulada | Provedor (Zenvia, Twilio…) com remetente aprovado |
| **WhatsApp** | Caixa de saída simulada | WhatsApp Business API, templates aprovados pela Meta, opt-in registrado |
| **E-mail transacional** | Simulado | SMTP/serviço (SES, SendGrid) com SPF/DKIM |
| **KYC / OCR / biometria facial** | Leitura simulada + revisão humana | Provedor (unico, idwall, Serpro…), contrato, base legal LGPD, prova de vida |
| **Bureaus de crédito** | Não conectado | Convênio Serasa/SPC/Boa Vista, consulta com consentimento específico |
| **PostgreSQL** | Embarcado (demonstração) | Instância gerenciada, backups automáticos com teste de restauração, réplica, TLS |
| **Chaves e segredos** | Padrões de demonstração | KMS/Secrets Manager, rotação de `JWT_SECRET` e `DATA_ENCRYPTION_KEY` |
| **Armazenamento de documentos** | Disco local cifrado | Object storage com criptografia e política de retenção |
| **Push (FCM/APNs)** | Não implementado | Contas Firebase/Apple, consentimento de notificação |
| **Lojas** | — | Contas Google Play/Apple Developer, assinatura de release, política de privacidade publicada |

Obrigações regulatórias a confirmar com assessoria jurídica antes de operar: autorização para conceder crédito, divulgação de CET e taxas (CDC/Res. BCB), regras de cobrança, LGPD (encarregado, RIPD), registro de operações e prevenção à lavagem de dinheiro.
