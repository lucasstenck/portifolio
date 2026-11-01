-- Lastro — esquema PostgreSQL (migração única, idempotente)
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  role          TEXT NOT NULL CHECK (role IN ('admin','staff','client')),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  phone_verified_at TIMESTAMPTZ,
  password_hash TEXT NOT NULL,
  totp_secret   TEXT,                       -- criptografado (AES-256-GCM)
  totp_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  disabled      BOOLEAN NOT NULL DEFAULT FALSE,
  failed_logins INT NOT NULL DEFAULT 0,
  locked_until  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device      TEXT, ip TEXT,
  refresh_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS otp_codes (
  id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL, channel TEXT NOT NULL, destination TEXT NOT NULL,
  code_hash TEXT NOT NULL, attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY, user_id INT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  cpf_enc TEXT NOT NULL, cpf_idx TEXT NOT NULL UNIQUE, cpf_last3 TEXT NOT NULL,   -- CPF criptografado + índice cego (HMAC)
  birth_date DATE, mother_name TEXT, monthly_income NUMERIC(12,2),
  occupation TEXT,
  zip TEXT, street TEXT, number TEXT, district TEXT, city TEXT, state TEXT,
  kyc_status TEXT NOT NULL DEFAULT 'incompleto' CHECK (kyc_status IN ('incompleto','em_analise','aprovado','recusado')),
  kyc_reviewed_by INT REFERENCES users(id), kyc_reviewed_at TIMESTAMPTZ, kyc_note TEXT,
  risk_score INT, anonymized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY, customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('rg_frente','rg_verso','cnh','selfie','comprovante_residencia','comprovante_renda')),
  file_name TEXT, mime TEXT, size_bytes INT, sha256 TEXT, storage_path TEXT,   -- arquivo criptografado em disco
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado','suspeito')),
  review_note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS consents (
  id SERIAL PRIMARY KEY, customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL, granted BOOLEAN NOT NULL, version TEXT NOT NULL, ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS loan_products (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, min_amount NUMERIC(12,2) NOT NULL, max_amount NUMERIC(12,2) NOT NULL,
  min_term INT NOT NULL, max_term INT NOT NULL, monthly_rate NUMERIC(6,4) NOT NULL,   -- % ao mês
  periodicities TEXT[] NOT NULL DEFAULT '{mensal}', active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS loans (
  id SERIAL PRIMARY KEY, customer_id INT NOT NULL REFERENCES customers(id), product_id INT REFERENCES loan_products(id),
  principal NUMERIC(12,2) NOT NULL, term INT NOT NULL, periodicity TEXT NOT NULL CHECK (periodicity IN ('diaria','semanal','mensal')),
  monthly_rate NUMERIC(6,4) NOT NULL, period_rate NUMERIC(10,8) NOT NULL, iof NUMERIC(12,2) NOT NULL DEFAULT 0,
  installment_value NUMERIC(12,2) NOT NULL, total_amount NUMERIC(12,2) NOT NULL, cet_monthly NUMERIC(8,4),
  purpose TEXT, status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_analise','aprovado','recusado','assinatura','ativo','quitado','cancelado','renegociado')),
  analyst_id INT REFERENCES users(id), decision_note TEXT, decided_at TIMESTAMPTZ,
  first_due DATE, disbursed_at TIMESTAMPTZ, closed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS installments (
  id SERIAL PRIMARY KEY, loan_id INT NOT NULL REFERENCES loans(id) ON DELETE CASCADE, n INT NOT NULL,
  due_date DATE NOT NULL, principal NUMERIC(12,2) NOT NULL, interest NUMERIC(12,2) NOT NULL, amount NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL, paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0, paid_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','paga','atrasada','renegociada')),
  UNIQUE(loan_id, n)
);
CREATE TABLE IF NOT EXISTS pix_charges (
  id SERIAL PRIMARY KEY, txid TEXT NOT NULL UNIQUE, loan_id INT NOT NULL REFERENCES loans(id), installment_id INT REFERENCES installments(id),
  customer_id INT NOT NULL REFERENCES customers(id), amount NUMERIC(12,2) NOT NULL, fine NUMERIC(12,2) NOT NULL DEFAULT 0, interest_late NUMERIC(12,2) NOT NULL DEFAULT 0,
  brcode TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','paga','expirada','cancelada')),
  provider TEXT NOT NULL DEFAULT 'sandbox', provider_ref TEXT, expires_at TIMESTAMPTZ NOT NULL, paid_at TIMESTAMPTZ, end_to_end TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY, loan_id INT NOT NULL REFERENCES loans(id), installment_id INT REFERENCES installments(id), customer_id INT NOT NULL REFERENCES customers(id),
  charge_id INT REFERENCES pix_charges(id), kind TEXT NOT NULL DEFAULT 'parcela' CHECK (kind IN ('parcela','amortizacao','quitacao','acordo')),
  amount NUMERIC(12,2) NOT NULL, fine NUMERIC(12,2) NOT NULL DEFAULT 0, interest_late NUMERIC(12,2) NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'pix', sandbox BOOLEAN NOT NULL DEFAULT TRUE, receipt_code TEXT UNIQUE, paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS contracts (
  id SERIAL PRIMARY KEY, loan_id INT NOT NULL UNIQUE REFERENCES loans(id), code TEXT NOT NULL UNIQUE, doc_sha256 TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(), sign_provider TEXT DEFAULT 'sandbox', sign_ref TEXT,
  signed_at TIMESTAMPTZ, signer_ip TEXT, signer_user_agent TEXT, signature_hash TEXT
);
CREATE TABLE IF NOT EXISTS collection_cases (
  id SERIAL PRIMARY KEY, loan_id INT NOT NULL REFERENCES loans(id), customer_id INT NOT NULL REFERENCES customers(id),
  stage TEXT NOT NULL DEFAULT 'lembrete' CHECK (stage IN ('lembrete','contato','negociacao','acordo','juridico','encerrado')),
  assigned_to INT REFERENCES users(id), days_overdue INT NOT NULL DEFAULT 0, amount_overdue NUMERIC(12,2) NOT NULL DEFAULT 0,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(), closed_at TIMESTAMPTZ, UNIQUE(loan_id, closed_at)
);
CREATE TABLE IF NOT EXISTS contact_logs (
  id SERIAL PRIMARY KEY, case_id INT REFERENCES collection_cases(id) ON DELETE CASCADE, customer_id INT NOT NULL REFERENCES customers(id),
  channel TEXT NOT NULL CHECK (channel IN ('sms','whatsapp','ligacao','email','app')), direction TEXT NOT NULL DEFAULT 'saida',
  outcome TEXT, message TEXT, consent_checked BOOLEAN NOT NULL DEFAULT FALSE, by_user INT REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS renegotiations (
  id SERIAL PRIMARY KEY, loan_id INT NOT NULL REFERENCES loans(id), customer_id INT NOT NULL REFERENCES customers(id),
  original_balance NUMERIC(12,2) NOT NULL, discount NUMERIC(12,2) NOT NULL DEFAULT 0, new_total NUMERIC(12,2) NOT NULL,
  down_payment NUMERIC(12,2) NOT NULL DEFAULT 0, terms INT NOT NULL, installment_value NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposta' CHECK (status IN ('proposta','aceita','recusada','cumprida','quebrada')), created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), decided_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS fraud_alerts (
  id SERIAL PRIMARY KEY, customer_id INT REFERENCES customers(id), loan_id INT REFERENCES loans(id),
  rule TEXT NOT NULL, severity TEXT NOT NULL CHECK (severity IN ('baixa','media','alta')), detail TEXT NOT NULL, evidence JSONB,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_analise','confirmado','descartado')),
  reviewer_id INT REFERENCES users(id), reviewer_note TEXT, reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
  read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS outbox (   -- SMS/WhatsApp/e-mail simulados (provedor sandbox)
  id SERIAL PRIMARY KEY, channel TEXT NOT NULL, destination TEXT NOT NULL, body TEXT NOT NULL, purpose TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS support_tickets (
  id SERIAL PRIMARY KEY, customer_id INT NOT NULL REFERENCES customers(id), subject TEXT NOT NULL, message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_andamento','resolvido')), answer TEXT, answered_by INT REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY, user_id INT, user_name TEXT, role TEXT, action TEXT NOT NULL, entity TEXT, entity_id TEXT, detail JSONB, ip TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inst_due ON installments(due_date, status);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_status ON fraud_alerts(status, severity);
