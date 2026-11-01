import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'api.dart';
import 'auth.dart';
import 'theme.dart';
import 'store.dart';
import 'loans.dart';

Widget _kycPill(String s) => switch (s) { 'aprovado' => Pill.ok('Verificada'), 'em_analise' => Pill.info('Em análise'), 'recusado' => Pill.bad('Não aprovada'), _ => Pill.warn('Pendente') };

class ProfileTab extends StatelessWidget {
  final Future<void> Function() onLogout;
  const ProfileTab({super.key, required this.onLogout});

  @override
  Widget build(BuildContext context) => ListenableBuilder(listenable: store, builder: (context, _) {
        final c = store.customer, me = store.me;
        Widget item(Ic ic, String t, String sub, VoidCallback f, {Widget? trailing}) => InkWell(onTap: f, child: Padding(padding: const EdgeInsets.symmetric(vertical: 14), child: Row(children: [
              Container(width: 38, height: 38, decoration: BoxDecoration(color: C.line2, borderRadius: BorderRadius.circular(11)), alignment: Alignment.center, child: LIcon(ic, size: 20, color: C.spruce)),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(t, style: T(15, w: FontWeight.w700)), Text(sub, style: T(12.5, color: C.mut))])),
              trailing ?? const LIcon(Ic.arrowR, size: 17, color: C.faint),
            ])));
        return ListView(padding: const EdgeInsets.only(bottom: 28), children: [
          Padding(padding: const EdgeInsets.fromLTRB(20, 18, 20, 16), child: Text('Perfil', style: T(26, w: FontWeight.w800, ls: -.5))),
          Pad(Card2(child: Row(children: [
            Container(width: 56, height: 56, decoration: BoxDecoration(color: C.spruce, borderRadius: BorderRadius.circular(18)), alignment: Alignment.center, child: Text(store.firstName.isEmpty ? '' : store.firstName[0], style: T(24, w: FontWeight.w800, color: C.mint))),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${me['name'] ?? ''}', style: T(17, w: FontWeight.w800), maxLines: 1, overflow: TextOverflow.ellipsis), Text('CPF ${c['cpf_masked'] ?? '***'}', style: T(12.5, color: C.mut)), const SizedBox(height: 6), Row(children: [_kycPill(store.kyc), const SizedBox(width: 6), if (me['phone_verified'] == true) Pill.ok('Telefone confirmado') else Pill.warn('Telefone pendente')])])),
          ]))),
          Pad(Padding(padding: const EdgeInsets.only(top: 14), child: Card2(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(children: [
            item(Ic.shield, 'Verificação de identidade', store.kyc == 'aprovado' ? 'Concluída' : store.kyc == 'em_analise' ? 'Em análise pela equipe' : 'Envie seus documentos', () => Navigator.push(context, slide(const KycPage()))),
            const Divider(height: 1, color: C.line2),
            item(Ic.user, 'Dados pessoais e endereço', 'Alterações exigem nova verificação', () => Navigator.push(context, slide(const KycPage(onlyData: true)))),
            const Divider(height: 1, color: C.line2),
            item(Ic.bell, 'Notificações', store.unread > 0 ? '${store.unread} não lida(s)' : 'Tudo em dia', () => Navigator.push(context, slide(const NotificationsPage()))),
          ])))),
          Pad(Padding(padding: const EdgeInsets.only(top: 14), child: Card2(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(children: [
            item(Ic.lock, 'Privacidade e segurança', 'Consentimentos, sessões e seus dados', () => Navigator.push(context, slide(const PrivacyPage()))),
            const Divider(height: 1, color: C.line2),
            item(Ic.support, 'Ajuda e suporte', 'Fale com a gente', () => Navigator.push(context, slide(const SupportPage()))),
          ])))),
          Pad(Padding(padding: const EdgeInsets.only(top: 18), child: Btn('Sair da conta', ghost: true, onTap: onLogout))),
          Padding(padding: const EdgeInsets.only(top: 18), child: Center(child: Text('Lastro 1.0 • Oryveen • ambiente de demonstração', style: T(11.5, color: C.faint)))),
        ]);
      });
}

const _docs = [
  ['rg_frente', 'Documento com foto (frente)', 'RG ou CNH aberta, sem reflexo'],
  ['rg_verso', 'Documento com foto (verso)', 'Opcional para CNH'],
  ['selfie', 'Selfie segurando o documento', 'Rosto e documento legíveis'],
  ['comprovante_residencia', 'Comprovante de residência', 'Conta dos últimos 90 dias'],
  ['comprovante_renda', 'Comprovante de renda', 'Opcional — melhora sua análise'],
];

class KycPage extends StatefulWidget {
  final bool onlyData;
  const KycPage({super.key, this.onlyData = false});
  @override State<KycPage> createState() => _KycState();
}

class _KycState extends State<KycPage> {
  final f = {for (final k in ['birth_date', 'mother_name', 'monthly_income', 'occupation', 'zip', 'street', 'number', 'district', 'city', 'state']) k: TextEditingController()};
  Map<String, dynamic> errs = {}; bool saving = false, submitting = false; String? up;
  List<Map<String, dynamic>> docs = [];

  @override
  void initState() {
    super.initState();
    final c = store.customer; docs = store.documents;
    for (final e in f.entries) { final v = c[e.key]; if (v != null) e.value.text = e.key == 'birth_date' ? '${v}'.substring(0, 10) : e.key == 'monthly_income' ? n(v).toStringAsFixed(0) : '$v'; }
  }

  Future<bool> saveData() async {
    setState(() { saving = true; errs = {}; });
    try {
      final r = await Api.patch('/api/me/profile', {for (final e in f.entries) e.key: e.key == 'monthly_income' ? num.tryParse(e.value.text) : e.value.text.trim()});
      await store.load(silent: true);
      if (mounted && r['reverification'] == true) toast(context, 'Dados atualizados. Faremos uma nova verificação.');
      return true;
    } on ApiError catch (e) { errs = e.fields; if (mounted) toast(context, e.fields.isEmpty ? e.message : 'Verifique os campos destacados.', error: true); return false; }
    finally { if (mounted) setState(() => saving = false); }
  }

  Future<void> pick(String kind) async {
    try {
      final x = await ImagePicker().pickImage(source: kind == 'selfie' ? ImageSource.camera : ImageSource.gallery, maxWidth: 1800, imageQuality: 82);
      if (x == null) return; setState(() => up = kind);
      final bytes = await x.readAsBytes();
      await Api.post('/api/me/documents', {'kind': kind, 'data_base64': base64Encode(bytes), 'mime': x.mimeType ?? 'image/jpeg', 'file_name': x.name});
      await store.load(silent: true); if (mounted) setState(() { docs = store.documents; }); if (mounted) toast(context, 'Documento enviado.');
    } on ApiError catch (e) { if (mounted) toast(context, e.message, error: true); }
    catch (_) { if (mounted) toast(context, 'Não foi possível abrir a câmera ou a galeria.', error: true); }
    if (mounted) setState(() => up = null);
  }

  Future<void> submit() async {
    setState(() => submitting = true);
    try { if (!await saveData()) return; await Api.post('/api/me/kyc/submit'); await store.load(silent: true); if (mounted) { toast(context, 'Enviado para análise.'); Navigator.pop(context); } }
    on ApiError catch (e) { if (mounted) toast(context, e.message, error: true); }
    finally { if (mounted) setState(() => submitting = false); }
  }

  @override
  Widget build(BuildContext context) {
    final locked = store.kyc == 'em_analise', note = store.customer['kyc_note'];
    return Scaffold(
      appBar: appBarFor(context, widget.onlyData ? 'Dados pessoais' : 'Verificação de identidade'),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 30), children: [
        Card2(color: store.kyc == 'recusado' ? C.badSoft : C.mintSoft, border: false, child: Row(children: [
          LIcon(Ic.shield, color: store.kyc == 'recusado' ? C.bad : const Color(0xFF14664A)), const SizedBox(width: 12),
          Expanded(child: Text(store.kyc == 'aprovado' ? 'Sua identidade está verificada. Se alterar renda ou endereço, faremos uma nova checagem.' : store.kyc == 'em_analise' ? 'Estamos analisando seus documentos. Isso costuma levar até 1 dia útil.' : store.kyc == 'recusado' ? '${note ?? 'Não foi possível aprovar seus documentos.'} Reenvie abaixo.' : 'Usamos seus documentos apenas para confirmar quem você é e analisar crédito (LGPD). Você consente ao enviar.', style: T(13, w: FontWeight.w600, color: store.kyc == 'recusado' ? C.bad : const Color(0xFF14664A), h: 1.4))),
        ])),
        const SectionTitle('Seus dados'),
        Field('Data de nascimento', f['birth_date']!, hint: 'AAAA-MM-DD', error: errs['birth_date']),
        Field('Nome da mãe', f['mother_name']!), Field('Ocupação', f['occupation']!),
        Field('Renda mensal (R\$)', f['monthly_income']!, type: TextInputType.number, error: errs['monthly_income']),
        Field('CEP', f['zip']!, type: TextInputType.number, maxLength: 9, error: errs['zip']),
        Field('Rua', f['street']!),
        Row(children: [Expanded(flex: 2, child: Field('Número', f['number']!)), const SizedBox(width: 12), Expanded(flex: 3, child: Field('Bairro', f['district']!))]),
        Row(children: [Expanded(flex: 3, child: Field('Cidade', f['city']!)), const SizedBox(width: 12), Expanded(flex: 1, child: Field('UF', f['state']!, maxLength: 2))]),
        if (widget.onlyData) Btn('Salvar alterações', onTap: () async { if (await saveData() && mounted) Navigator.pop(context); }, busy: saving) else ...[
          const SectionTitle('Documentos'),
          for (final d in _docs) _docRow(d),
          const SizedBox(height: 20),
          Btn(locked ? 'Em análise' : 'Enviar para análise', onTap: locked ? null : submit, busy: submitting),
          const SizedBox(height: 12),
          Text('Não fazemos nenhum acesso oculto ao seu aparelho. A câmera e a galeria só abrem quando você toca em enviar.', textAlign: TextAlign.center, style: T(11.5, color: C.mut, h: 1.45)),
        ],
      ]),
    );
  }

  Widget _docRow(List<String> d) {
    final doc = docs.cast<Map<String, dynamic>?>().firstWhere((x) => x!['kind'] == d[0], orElse: () => null), busy = up == d[0];
    final st = doc?['status'];
    return Padding(padding: const EdgeInsets.only(bottom: 10), child: Card2(padding: const EdgeInsets.all(14), onTap: store.kyc == 'em_analise' || busy ? null : () => pick(d[0]), child: Row(children: [
      Container(width: 42, height: 42, decoration: BoxDecoration(color: doc != null ? C.mintSoft : C.line2, borderRadius: BorderRadius.circular(12)), alignment: Alignment.center, child: busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: C.spruce)) : LIcon(doc != null ? Ic.check : d[0] == 'selfie' ? Ic.camera : Ic.doc, color: doc != null ? const Color(0xFF14664A) : C.mut)),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(d[1], style: T(14, w: FontWeight.w700)), const SizedBox(height: 1), Text(doc != null ? '${doc['file_name'] ?? 'enviado'}' : d[2], style: T(12, color: C.mut), maxLines: 1, overflow: TextOverflow.ellipsis)])),
      if (doc != null) (st == 'aprovado' ? Pill.ok('Aprovado') : st == 'recusado' || st == 'suspeito' ? Pill.bad('Reenviar') : Pill.info('Enviado')) else Text('Enviar', style: T(13, w: FontWeight.w800, color: C.spruce)),
    ])));
  }
}

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});
  @override State<NotificationsPage> createState() => _NotifState();
}

class _NotifState extends State<NotificationsPage> {
  @override
  void initState() { super.initState(); Api.post('/api/notifications/read').then((_) => store.load(silent: true)).catchError((_) => <String, dynamic>{}); }
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: appBarFor(context, 'Notificações'),
        body: ListenableBuilder(listenable: store, builder: (context, _) {
          final l = store.notifications;
          if (l.isEmpty) return const EmptyState(Ic.bell, 'Nada por aqui', 'Avisos de vencimento, aprovações e pagamentos aparecem aqui.');
          return ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 30), children: [for (final x in l) Padding(padding: const EdgeInsets.only(bottom: 10), child: Card2(child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 9, height: 9, margin: const EdgeInsets.only(top: 6, right: 12), decoration: BoxDecoration(color: x['read_at'] == null ? C.mint : C.line, shape: BoxShape.circle)),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${x['title']}', style: T(14.5, w: FontWeight.w800)), const SizedBox(height: 2), Text('${x['body']}', style: T(13, color: C.ink2, h: 1.4)), const SizedBox(height: 6), Text(dmy(x['created_at']), style: T(11.5, color: C.faint))])),
          ])))]);
        }),
      );
}

class SupportPage extends StatefulWidget {
  const SupportPage({super.key});
  @override State<SupportPage> createState() => _SupportState();
}

class _SupportState extends State<SupportPage> {
  final subject = TextEditingController(), msg = TextEditingController(); List<Map<String, dynamic>>? tickets; bool busy = false;
  @override void initState() { super.initState(); load(); }
  Future<void> load() async { try { final r = await Api.get('/api/support'); if (mounted) setState(() => tickets = (r['tickets'] as List).map((e) => (e as Map).cast<String, dynamic>()).toList()); } catch (_) { if (mounted) setState(() => tickets = []); } }
  Future<void> send() async {
    setState(() => busy = true);
    try { await Api.post('/api/support', {'subject': subject.text, 'message': msg.text}); subject.clear(); msg.clear(); await load(); if (mounted) toast(context, 'Chamado aberto. Respondemos em até 1 dia útil.'); } on ApiError catch (e) { if (mounted) toast(context, e.message, error: true); }
    if (mounted) setState(() => busy = false);
  }
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: appBarFor(context, 'Ajuda e suporte'),
        body: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 30), children: [
          Field('Assunto', subject, hint: 'Ex.: dúvida sobre uma parcela'),
          Field('Mensagem', msg, lines: 4, hint: 'Conte o que aconteceu'),
          Btn('Enviar mensagem', onTap: send, busy: busy),
          const SectionTitle('Seus chamados'),
          if (tickets == null) const Skel(h: 70, r: 16) else if (tickets!.isEmpty) Card2(child: const EmptyState(Ic.support, 'Nenhum chamado', 'Quando você falar com a gente, o histórico fica aqui.'))
          else for (final t in tickets!) Padding(padding: const EdgeInsets.only(bottom: 10), child: Card2(child: Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${t['subject']}', style: T(14.5, w: FontWeight.w800)), Text(dmy(t['created_at']), style: T(12, color: C.mut))])), t['status'] == 'resolvido' ? Pill.ok('Resolvido') : t['status'] == 'em_andamento' ? Pill.info('Em andamento') : Pill.warn('Aberto')]))),
        ]),
      );
}

class OffersPage extends StatefulWidget {
  const OffersPage({super.key});
  @override State<OffersPage> createState() => _OffersState();
}

class _OffersState extends State<OffersPage> {
  bool busy = false;
  Future<void> act(Map<String, dynamic> o, bool accept) async {
    setState(() => busy = true);
    try { await Api.post('/api/renegotiations/${o['id']}/${accept ? 'accept' : 'decline'}'); await store.load(silent: true); if (mounted) { toast(context, accept ? 'Acordo aceito. Seu novo contrato já está ativo.' : 'Proposta recusada.'); if (store.offers.isEmpty) Navigator.pop(context); } }
    on ApiError catch (e) { if (mounted) toast(context, e.message, error: true); }
    if (mounted) setState(() => busy = false);
  }
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: appBarFor(context, 'Proposta de acordo'),
        body: ListenableBuilder(listenable: store, builder: (context, _) => ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 30), children: [
          if (store.offers.isEmpty) const EmptyState(Ic.doc, 'Sem propostas', 'Nenhuma renegociação disponível agora.'),
          for (final o in store.offers) Card2(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Regularize com desconto', style: T(18, w: FontWeight.w800)), const SizedBox(height: 4),
            Text('Sua equipe preparou uma condição para quitar o atraso e retomar o contrato.', style: T(13.5, color: C.mut, h: 1.4)), const SizedBox(height: 16),
            _r('Saldo original', brl(o['original_balance'])), _r('Desconto', brl(o['discount']), good: true), _r('Entrada', brl(o['down_payment'])), _r('Parcelas', '${o['terms']}× ${brl(o['installment_value'])}'),
            const SizedBox(height: 16),
            Btn('Aceitar acordo', onTap: () => act(o, true), busy: busy), const SizedBox(height: 10), Btn('Recusar', ghost: true, onTap: busy ? null : () => act(o, false)),
            const SizedBox(height: 10), Text('Ao aceitar, o contrato atual é encerrado como renegociado e um novo cronograma é gerado.', textAlign: TextAlign.center, style: T(11.5, color: C.mut, h: 1.4)),
          ])),
        ])),
      );
  Widget _r(String k, String v, {bool good = false}) => Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Row(children: [Text(k, style: T(14, color: C.mut, w: FontWeight.w600)), const Spacer(), Text(v, style: T(15, w: FontWeight.w800, num: true, color: good ? const Color(0xFF14664A) : C.ink))]));
}

class PrivacyPage extends StatefulWidget {
  const PrivacyPage({super.key});
  @override State<PrivacyPage> createState() => _PrivacyState();
}

class _PrivacyState extends State<PrivacyPage> {
  Map<String, bool>? consents; List<Map<String, dynamic>> sessions = []; String? exported;
  @override void initState() { super.initState(); load(); }
  Future<void> load() async {
    try {
      final c = await Api.get('/api/me/consents'), s = await Api.get('/api/auth/sessions');
      if (mounted) setState(() { consents = {for (final x in (c['consents'] as List)) '${x['purpose']}': x['granted'] == true}; sessions = (s['sessions'] as List).map((e) => (e as Map).cast<String, dynamic>()).toList(); });
    } catch (_) { if (mounted) setState(() => consents = {}); }
  }
  Future<void> toggle(String p, bool v) async { setState(() => consents![p] = v); try { await Api.post('/api/me/consents', {'purpose': p, 'granted': v}); } on ApiError catch (e) { if (mounted) { setState(() => consents![p] = !v); toast(context, e.message, error: true); } } }

  @override
  Widget build(BuildContext context) {
    Widget sw(String p, String t, String s, {bool locked = false}) => Padding(padding: const EdgeInsets.symmetric(vertical: 10), child: Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(t, style: T(14.5, w: FontWeight.w700)), const SizedBox(height: 2), Text(s, style: T(12.5, color: C.mut, h: 1.35))])),
          Switch(value: consents?[p] ?? false, onChanged: locked || consents == null ? null : (v) => toggle(p, v), activeThumbColor: Colors.white, activeTrackColor: C.spruce),
        ]));
    return Scaffold(
      appBar: appBarFor(context, 'Privacidade e segurança'),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 30), children: [
        Card2(child: Column(children: [
          sw('termos_privacidade', 'Termos e Política de Privacidade', 'Necessário para usar o aplicativo.', locked: true), const Divider(height: 1, color: C.line2),
          sw('analise_credito', 'Análise de crédito', 'Uso dos seus dados para avaliar pedidos.', locked: true), const Divider(height: 1, color: C.line2),
          sw('comunicacao_sms_whatsapp', 'SMS e WhatsApp', 'Lembretes e cobranças por mensagem. Pode ser revogado a qualquer momento.'),
        ])),
        const SectionTitle('Aparelhos conectados'),
        if (sessions.isEmpty) const Skel(h: 60, r: 16) else Card2(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(children: [for (var i = 0; i < sessions.length; i++) _session(sessions[i], i == sessions.length - 1)])),
        const SectionTitle('Seus dados (LGPD)'),
        Btn('Baixar cópia dos meus dados', ghost: true, icon: Ic.doc, onTap: () async { try { final r = await Api.get('/api/me/export'); if (mounted) setState(() => exported = '${(r.keys.length)} grupos de dados prontos'); } on ApiError catch (e) { if (mounted) toast(context, e.message, error: true); } }),
        if (exported != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text('Exportação gerada: $exported. A entrega completa em arquivo é feita por solicitação ao suporte.', style: T(12, color: C.mut, h: 1.4))),
        const SizedBox(height: 10),
        Text('A Lastro não instala rastreadores, não acessa contatos, mensagens ou localização do seu aparelho e não grava a tela.', style: T(12, color: C.mut, h: 1.45)),
      ]),
    );
  }

  Widget _session(Map<String, dynamic> s, bool last) => Container(
        padding: const EdgeInsets.symmetric(vertical: 12), decoration: BoxDecoration(border: last ? null : const Border(bottom: BorderSide(color: C.line2))),
        child: Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${s['device'] ?? 'Dispositivo'}'.split(')').first.replaceAll('Mozilla/5.0 (', ''), style: T(13.5, w: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis), Text('Último acesso ${dmy(s['last_seen_at'])}', style: T(12, color: C.mut))])),
          if (s['current'] == true) Pill.ok('Este aparelho') else GestureDetector(onTap: () async { await http_delete(s['id']); load(); }, child: Text('Encerrar', style: T(13, w: FontWeight.w800, color: C.bad))),
        ]),
      );
  Future<void> http_delete(dynamic id) async { try { await Api.del('/api/auth/sessions/$id'); } catch (_) {} }
}
