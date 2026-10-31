# LEXORA — proposta técnica e comercial (modelo preenchido)

> Documento de apoio ao projeto. Valores monetários e prazos são **estimativas de referência** para orientar a conversa com o cliente; devem ser ajustados ao escopo e ao mercado no momento da contratação.

## O que já está implementado neste repositório (primeira versão funcional)
| Área | Entregue |
|---|---|
| Clientes e processos | Cadastro, vínculo cliente↔processo, partes, vara, tribunal, fase e valor da causa; painel de processos ativos |
| Prazos e tarefas | Prazos, audiências e tarefas; calendário mensal e lista; alertas de próximos/atrasados no painel |
| Documentos | Cadastro com texto, etiquetas, busca global **dentro do conteúdo**; modelos de minuta |
| IA jurídica | Resumo, extração (nº CNJ, CPF/CNPJ, valores, datas, partes, prazos, dispositivos) e minutas (petição trabalhista, notificação, honorários, procuração, contestação). Motor local offline + provedor LLM opcional (`ANTHROPIC_API_KEY`). Saída sempre marcada como rascunho com lacunas `[PREENCHER]` |
| Acompanhamento processual | Registro manual + consulta à API pública do **DataJud** (CNJ), ativada com `DATAJUD_API_KEY` (código escrito conforme a documentação pública; **não testado contra a API real** neste ambiente por falta da chave) |
| Comunicação | Histórico por cliente, mensagens prontas e abertura no WhatsApp com a mensagem preparada |
| Financeiro | Honorários e despesas, recebido/pendente, relatório mensal |
| Segurança | Login com scrypt, recuperação de senha por link de uso único, sessões HttpOnly, **separação total dos dados por escritório** (testada), permissões por perfil (admin, advogado, estagiário, financeiro), trilha de auditoria, LGPD (consentimento, exportação e anonimização do titular), backup |
| Assinatura | Teste gratuito de 30 dias, cadastro de cartão com autorização de cobrança recorrente, cobrança automática de R$ 97,00 ao fim do teste e mensalmente, faturas, cancelamento, bloqueio de edição após vencimento (dados continuam consultáveis) |

Testes: `npm test` — 42 verificações de ponta a ponta (isolamento, permissões, trial, cobrança, IA, LGPD).

## O que ainda depende de contratação/decisão
* **Provedor de pagamentos real** (o adaptador atual é de teste, sem cobrança real): Asaas, Stripe, Mercado Pago ou Pagar.me. A integração substitui `Billing.charge()`, adiciona tokenização do cartão no front e webhook de eventos.
* **Banco de dados gerenciado** (hoje JSON em disco, adequado a protótipo): PostgreSQL com backups automáticos.
* **Armazenamento de arquivos** (PDF/DOCX) em object storage com criptografia; extração de texto de PDF/OCR.
* **WhatsApp Business API oficial** (hoje: link `wa.me`), e envio de e-mails transacionais (SMTP/serviço).
* **Validação jurídica** dos modelos de minuta e dos Termos de Uso/Política de Privacidade por advogado.

## Respostas aos itens da solicitação (estimativas)
1. **Valor total do desenvolvimento** — a partir do protótipo funcional entregue, a produção (banco, arquivos, pagamentos reais, e-mail, hardening, testes de carga e segurança) estima-se em **R$ 28.000 a R$ 45.000**, conforme escopo final.
2. **Prazo** — 8 a 12 semanas para a versão de produção.
3. **Tecnologias recomendadas** — Node.js (ou TypeScript), PostgreSQL, armazenamento S3-compatível, Redis para filas, front responsivo; deploy em contêiner com HTTPS; provedor de IA via API.
4. **Funcionalidades incluídas** — todas as listadas acima, com integrações reais de pagamento, e-mail e armazenamento.
5. **Fases futuras** — WhatsApp Business oficial, assinatura eletrônica de documentos, leitura de intimações por e-mail, app móvel, relatórios avançados, integrações com outros serviços jurídicos.
6. **Custos mensais de hospedagem e manutenção** — referência: R$ 150 a R$ 500/mês de infraestrutura nos primeiros escritórios (servidor, banco, armazenamento, backups, monitoramento) + manutenção/suporte a combinar.
7. **Custos de IA e integrações** — IA por consumo (varia com o volume de texto; estimar por escritório e repassar ou absorver na assinatura); DataJud é gratuito; WhatsApp Business cobra por conversa.
8. **Taxas do provedor de pagamentos** — referência de mercado: Pix ~R$ 0,99 a R$ 1,99 por cobrança; cartão ~2,99% + R$ 0,49 por cobrança aprovada. **Confirmar com o provedor escolhido.** Sobre R$ 97,00 no cartão, o custo é da ordem de R$ 3,40 por cobrança.
9. **Experiência em projetos semelhantes** — este repositório é o protótipo funcional que demonstra a capacidade técnica; referências comerciais devem ser informadas pelo contratado.
10. **Suporte após a entrega** — sugestão: 30 a 60 dias de garantia para correção de erros do escopo contratado, e plano de manutenção mensal para evolução e suporte.

## Modelo comercial (conforme solicitado)
Assinatura de R$ 97,00 por escritório, teste gratuito de 30 dias, sem taxa de adesão, cobrança recorrente mediante autorização do cliente, cancelamento com condições transparentes (nesta versão, cancelamento imediato pelo painel, sem multa).
