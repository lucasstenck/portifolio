# Funcionalidades

## Autenticação e sessões
Login e senha, 2FA por aplicativo autenticador (TOTP), recuperação de senha por código (resposta idêntica exista ou não a conta), cadastro de cliente com CPF validado e consentimentos, confirmação de celular por OTP, bloqueio após 5 falhas, sessões revogáveis ("Aparelhos conectados" no app), refresh token rotativo. Perfis: **admin**, **analista (staff)** e **cliente**, com permissões por rota; analista aprova até R$ 15.000.

## KYC (verificação de identidade)
Dados pessoais e endereço, upload de documento (frente/verso/CNH), selfie, comprovantes de residência e renda (cifrados em repouso, com SHA-256). Leitura documental **simulada** que marca divergências; análise e decisão **humanas** no painel. Alterar renda/endereço de cliente verificado reabre a verificação. Envio exige celular confirmado.

## Empréstimos
Simulação em tempo real (valor, prazo, periodicidade diária/semanal/mensal), taxa por produto, IOF, CET (mensal e anual), tabela de parcelas, solicitação com finalidade e consentimento, análise e decisão no painel (aprovar/recusar/iniciar análise com justificativa), cronograma com amortização e saldo, saldo devedor e valor de quitação do dia, quitação com abatimento de juros.

## Contratos e recibos
Contrato em PDF (pdfkit) com hash SHA-256, leitura integral no app, **assinatura eletrônica sandbox** (data, IP, agente, hash) e recibos em PDF com código. O app exibe contrato e comprovante em tela; os PDFs são emitidos pela API (`/api/loans/:id/contract.pdf`, `/api/payments/:id/receipt.pdf`) e abertos pelo painel.

## Pix (sandbox)
QR Code e "copia e cola" (BR Code EMV + CRC16), validade de 30 min, acompanhamento por polling, multa e mora calculadas no ato, **baixa automática por webhook assinado** e idempotente, histórico e recibos. Valor divergente gera alerta. Em demonstração, o botão "Simular confirmação do banco" representa o banco; ele não existe em produção.

## Cobrança e renegociação
Régua por estágio (lembrete → contato → negociação → acordo → jurídico), registro de contatos por canal, **bloqueio de SMS/WhatsApp sem consentimento** e fora de 8h–20h, propostas de acordo com desconto máximo de 30% e simulação de parcela, aceite do cliente no app que gera novo contrato e encerra o anterior como renegociado, histórico de acordos.

## Painel administrativo
Visão geral com KPIs (emprestado, recebido, a receber, inadimplência, carteira, pendências), gráfico de fluxo de caixa interativo com filtros de período, atraso por faixa, mix por periodicidade, operações recentes; clientes com busca/filtros, ficha completa (documentos, empréstimos, pagamentos, contatos, alertas, CPF revelado só por admin e auditado); fila de empréstimos; cobranças; antifraude; relatórios CSV (empréstimos, pagamentos, inadimplência, clientes) com CPF mascarado; equipe e matriz de permissões; auditoria; integrações. Responsivo (testado em 390 px e 1440 px).

## Antifraude
Regras: telefone compartilhado/não verificado, CPF duplicado, divergência documental, documento reutilizado, documento suspeito, CEP × UF, comprometimento de renda, histórico de inadimplência, solicitações em sequência, identidade não aprovada, Pix divergente. Gera score interno de apoio. **Nada é recusado automaticamente**; alertas altos bloqueiam a aprovação até revisão com justificativa.

## App do cliente
Splash, login com 2FA, cadastro, dashboard (saldo, próxima parcela, atraso, ofertas), simulador, solicitação, contratos, detalhe com amortização, calendário mensal, Pix, extrato e comprovantes, contrato digital, perfil e KYC, notificações, suporte, privacidade (consentimentos, sessões, exportação). Estados de carregamento (skeleton), vazio e erro em todas as telas; ícones e marca próprios; microinterações (pressão de botão, transições, check animado).

## Privacidade (LGPD)
Consentimentos versionados e revogáveis, exportação dos dados, anonimização por admin, mascaramento de CPF, trilha de auditoria. **Não há rastreamento oculto**: o app não acessa contatos, mensagens, localização nem tela; câmera e galeria só abrem quando o usuário toca em enviar.
