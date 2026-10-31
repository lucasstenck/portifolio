# Âncora Contabilidade — landing page com captura de leads

Landing page de alta conversão para um escritório de contabilidade, com **backend real de captura de leads** e **painel administrativo**.

## O que tem
- Hero com formulário de proposta (validação no navegador **e** no servidor, máscara de telefone, consentimento LGPD, proteção contra duplicidade e limite de envios por IP).
- Seções: serviços, **simulador de regime tributário** (MEI / Simples Nacional / Lucro Presumido com os limites legais), planos com alternância mensal/anual, como funciona, painel do cliente, FAQ, CTA final, política de privacidade e botão de WhatsApp.
- `/admin`: painel protegido por token — KPIs, funil, busca, filtro por status, alteração de status, notas por lead, link direto para WhatsApp e exportação CSV.
- Armazenamento em `data/leads.json` (gravação atômica). Sem dependências npm.

## Rodar
```bash
cd contabilidade
node server.js        # http://localhost:3201   (PORT=xxxx para trocar)
```
O token do painel é gerado no primeiro start em `data/admin-token.txt` (ou defina `ADMIN_TOKEN`). Acesse `http://localhost:3201/admin`.

## Personalizar
Nome, telefone/WhatsApp, e-mail, preços e textos estão em `public/index.html` (procure por `Âncora`, `5511999990000` e `ancoracontabil.com.br`).

## Capturas
`screenshots/` — 15 imagens geradas automaticamente (`_tools/capture-contab.mjs`) com o servidor real rodando; os leads do painel nas fotos foram criados pela própria API em um ambiente temporário e **não** estão em `data/`.
