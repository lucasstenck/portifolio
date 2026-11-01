import 'package:flutter/material.dart';
import 'api.dart';
import 'theme.dart';

Route<T> slide<T>(Widget w) => PageRouteBuilder<T>(
      pageBuilder: (_, a, __) => w, transitionDuration: const Duration(milliseconds: 300), reverseTransitionDuration: const Duration(milliseconds: 220),
      transitionsBuilder: (_, a, __, child) => SlideTransition(position: Tween(begin: const Offset(.06, 0), end: Offset.zero).animate(CurvedAnimation(parent: a, curve: Curves.easeOutCubic)), child: FadeTransition(opacity: a, child: child)),
    );

/// Tela de entrada: login com 2FA opcional, atalhos para cadastro e recuperação.
class Welcome extends StatefulWidget {
  final VoidCallback onDone;
  const Welcome({super.key, required this.onDone});
  @override State<Welcome> createState() => _WelcomeState();
}

class _WelcomeState extends State<Welcome> {
  final email = TextEditingController(), pw = TextEditingController(), code = TextEditingController();
  String? mfaToken, err; bool busy = false, show = false;

  Future<void> go() async {
    setState(() { busy = true; err = null; });
    try {
      if (mfaToken != null) {
        await Api.mfa(mfaToken!, code.text.trim());
      } else {
        final t = await Api.login(email.text.trim(), pw.text);
        if (t != null) { mfaToken = t; if (mounted) setState(() => busy = false); return; }
      }
      if (Api.user?['role'] != 'client') { await Api.clear(); mfaToken = null; throw ApiError('Esta conta é da equipe. Use o painel administrativo na web.'); }
      widget.onDone(); return;
    } on ApiError catch (e) { err = e.message; }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final step2 = mfaToken != null;
    return Scaffold(
      backgroundColor: C.spruce,
      body: SafeArea(
        child: LayoutBuilder(builder: (context, box) => SingleChildScrollView(
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: box.maxHeight),
            child: IntrinsicHeight(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(padding: const EdgeInsets.fromLTRB(24, 26, 24, 0), child: Row(children: [const Logo(size: 34, light: true), const SizedBox(width: 10), Text('lastro', style: T(22, w: FontWeight.w800, color: Colors.white, ls: -.5))])),
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 38, 24, 28),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Seu crédito,\nsem letra miúda.', style: T(32, w: FontWeight.w800, color: Colors.white, h: 1.12, ls: -.8)),
                  const SizedBox(height: 12),
                  Text('Simule, contrate e acompanhe cada parcela com total transparência.', style: T(15, color: const Color(0xFF9CC0B5), h: 1.45)),
                ]),
              ),
              const Spacer(),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(24, 26, 24, 22),
                decoration: const BoxDecoration(color: C.sand, borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
                child: AnimatedSize(
                  duration: const Duration(milliseconds: 250), curve: Curves.easeOut,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(step2 ? 'Verificação em duas etapas' : 'Entrar', style: T(21, w: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text(step2 ? 'Informe o código de 6 dígitos do seu aplicativo autenticador.' : 'Acesse sua conta com e-mail e senha.', style: T(13.5, color: C.mut)),
                    const SizedBox(height: 20),
                    if (!step2) ...[
                      Field('E-mail', email, type: TextInputType.emailAddress, hint: 'voce@exemplo.com.br'),
                      Stack(alignment: Alignment.topRight, children: [
                        Field('Senha', pw, obscure: !show),
                        Positioned(right: 0, top: -2, child: GestureDetector(onTap: () => setState(() => show = !show), child: Text(show ? 'Ocultar' : 'Mostrar', style: T(12.5, w: FontWeight.w700, color: C.mut)))),
                      ]),
                    ] else Field('Código de verificação', code, type: TextInputType.number, maxLength: 6, hint: '000000'),
                    if (err != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Container(width: double.infinity, padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: C.badSoft, borderRadius: BorderRadius.circular(10)), child: Text(err!, style: T(13, w: FontWeight.w600, color: C.bad)))),
                    Btn(step2 ? 'Verificar e entrar' : 'Entrar', onTap: go, busy: busy),
                    const SizedBox(height: 14),
                    if (!step2) Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                      _link('Esqueci a senha', () => Navigator.push(context, slide(const ForgotPage()))),
                      _link('Criar conta', () => Navigator.push(context, slide(RegisterPage(onDone: () { Navigator.of(context).popUntil((r) => r.isFirst); widget.onDone(); })))),
                    ]) else Center(child: _link('Voltar', () => setState(() { mfaToken = null; err = null; code.clear(); }))),
                    const SizedBox(height: 14),
                    Center(child: Text('Ambiente de demonstração • dados fictícios', style: T(11.5, color: C.faint))),
                  ]),
                ),
              ),
            ])),
          ),
        )),
      ),
    );
  }
  Widget _link(String t, VoidCallback f) => GestureDetector(onTap: f, child: Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Text(t, style: T(14, w: FontWeight.w700, color: C.spruce))));
}

class _Scaffold extends StatelessWidget {
  final String title; final String? sub; final Widget child;
  const _Scaffold(this.title, this.sub, this.child);
  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(child: ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 30), children: [
          Align(alignment: Alignment.centerLeft, child: IconButton(padding: EdgeInsets.zero, onPressed: () => Navigator.pop(context), icon: const LIcon(Ic.back))),
          Text(title, style: T(26, w: FontWeight.w800, ls: -.5)),
          if (sub != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(sub!, style: T(14, color: C.mut, h: 1.4))),
          const SizedBox(height: 22), child,
        ])),
      );
}

class RegisterPage extends StatefulWidget {
  final VoidCallback onDone;
  const RegisterPage({super.key, required this.onDone});
  @override State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final name = TextEditingController(), cpf = TextEditingController(), email = TextEditingController(), phone = TextEditingController(), pw = TextEditingController();
  bool terms = false, mkt = false, busy = false; Map<String, dynamic> errs = {}; String? general;

  Future<void> submit() async {
    setState(() { busy = true; errs = {}; general = null; });
    try {
      await Api.register({'name': name.text, 'cpf': cpf.text, 'email': email.text, 'phone': phone.text, 'password': pw.text, 'consent_terms': terms, 'consent_marketing': mkt});
      if (!mounted) return;
      Navigator.pushReplacement(context, slide(PhoneConfirmPage(onDone: widget.onDone)));
    } on ApiError catch (e) { errs = e.fields; general = e.fields.isEmpty ? e.message : null; }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) => _Scaffold('Criar conta', 'Leva menos de dois minutos. A verificação de identidade vem depois.', Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Field('Nome completo', name, error: errs['name']),
        Field('CPF', cpf, type: TextInputType.number, maxLength: 14, hint: '000.000.000-00', error: errs['cpf']),
        Field('E-mail', email, type: TextInputType.emailAddress, error: errs['email']),
        Field('Celular com DDD', phone, type: TextInputType.phone, hint: '11 99999-9999', error: errs['phone']),
        Field('Senha', pw, obscure: true, hint: 'Mín. 10 caracteres, com letras e números', error: errs['password']),
        _check(terms, 'Li e aceito os Termos de Uso e a Política de Privacidade (LGPD).', (v) => setState(() => terms = v), error: errs['consent_terms']),
        _check(mkt, 'Aceito receber lembretes e ofertas por SMS e WhatsApp. Posso revogar quando quiser.', (v) => setState(() => mkt = v)),
        if (general != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(general!, style: T(13, w: FontWeight.w600, color: C.bad))),
        const SizedBox(height: 16),
        Btn('Criar conta', onTap: submit, busy: busy),
      ]));

  Widget _check(bool v, String t, ValueChanged<bool> f, {String? error}) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: GestureDetector(
          onTap: () => f(!v),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            AnimatedContainer(duration: const Duration(milliseconds: 150), width: 22, height: 22, margin: const EdgeInsets.only(top: 1), decoration: BoxDecoration(color: v ? C.spruce : C.paper, borderRadius: BorderRadius.circular(6), border: Border.all(color: error != null ? C.bad : v ? C.spruce : C.line, width: 1.5)), child: v ? const LIcon(Ic.check, size: 16, color: Colors.white, stroke: 2.4) : null),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(t, style: T(13.5, color: C.ink2, h: 1.4)), if (error != null) Text(error, style: T(12.5, w: FontWeight.w600, color: C.bad))])),
          ]),
        ),
      );
}

class PhoneConfirmPage extends StatefulWidget {
  final VoidCallback onDone;
  const PhoneConfirmPage({super.key, required this.onDone});
  @override State<PhoneConfirmPage> createState() => _PhoneConfirmPageState();
}

class _PhoneConfirmPageState extends State<PhoneConfirmPage> {
  final code = TextEditingController(); bool busy = false; String? err;
  Future<void> verify() async {
    setState(() { busy = true; err = null; });
    try { await Api.post('/api/auth/phone/verify', {'code': code.text.trim()}); widget.onDone(); } on ApiError catch (e) { err = e.message; }
    if (mounted) setState(() => busy = false);
  }
  @override
  Widget build(BuildContext context) => _Scaffold('Confirme seu celular', 'Enviamos um código de 6 dígitos por SMS. Em demonstração, a mensagem aparece na caixa de saída simulada do painel — nada é enviado de verdade.', Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Field('Código recebido', code, type: TextInputType.number, maxLength: 6, hint: '000000', error: err),
        Btn('Confirmar', onTap: verify, busy: busy),
        const SizedBox(height: 10),
        Btn('Reenviar código', ghost: true, onTap: () async { try { await Api.post('/api/auth/phone/send'); if (context.mounted) toast(context, 'Novo código enviado.'); } on ApiError catch (e) { if (context.mounted) toast(context, e.message, error: true); } }),
        const SizedBox(height: 10),
        Center(child: TextButton(onPressed: widget.onDone, child: Text('Confirmar depois', style: T(14, w: FontWeight.w700, color: C.mut)))),
      ]));
}

class ForgotPage extends StatefulWidget {
  const ForgotPage({super.key});
  @override State<ForgotPage> createState() => _ForgotPageState();
}

class _ForgotPageState extends State<ForgotPage> {
  final email = TextEditingController(), code = TextEditingController(), pw = TextEditingController();
  bool sent = false, busy = false; String? err;
  Future<void> run() async {
    setState(() { busy = true; err = null; });
    try {
      if (!sent) { await Api.post('/api/auth/forgot', {'email': email.text.trim()}); sent = true; }
      else { await Api.post('/api/auth/reset', {'email': email.text.trim(), 'code': code.text.trim(), 'password': pw.text}); if (mounted) { toast(context, 'Senha alterada. Entre com a nova senha.'); Navigator.pop(context); } return; }
    } on ApiError catch (e) { err = e.fields['password'] ?? e.message; }
    if (mounted) setState(() => busy = false);
  }
  @override
  Widget build(BuildContext context) => _Scaffold('Recuperar senha', sent ? 'Se o e-mail estiver cadastrado, enviamos um código de 6 dígitos válido por 10 minutos.' : 'Informe o e-mail da conta para receber um código.', Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Field('E-mail', email, type: TextInputType.emailAddress),
        if (sent) ...[Field('Código', code, type: TextInputType.number, maxLength: 6), Field('Nova senha', pw, obscure: true, hint: 'Mín. 10 caracteres, com letras e números')],
        if (err != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(err!, style: T(13, w: FontWeight.w600, color: C.bad))),
        Btn(sent ? 'Redefinir senha' : 'Enviar código', onTap: run, busy: busy),
      ]));
}
