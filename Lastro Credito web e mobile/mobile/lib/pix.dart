import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'api.dart';
import 'auth.dart';
import 'theme.dart';
import 'store.dart';
import 'loans.dart';

/// Aba "Pagar": parcelas em aberto de todos os contratos ativos.
class PayTab extends StatefulWidget {
  const PayTab({super.key});
  @override State<PayTab> createState() => _PayTabState();
}

class _PayTabState extends State<PayTab> {
  List<Map<String, dynamic>>? rows; String? err; int seenLoans = -1;

  Future<void> load() async {
    try {
      final out = <Map<String, dynamic>>[];
      for (final l in store.active) {
        final r = await Api.get('/api/loans/${l['id']}');
        for (final i in (r['installments'] as List)) { final m = (i as Map).cast<String, dynamic>(); if (m['status'] != 'paga' && m['status'] != 'renegociada') out.add({...m, 'loan_id': l['id']}); }
      }
      out.sort((a, b) => '${a['due_date']}'.compareTo('${b['due_date']}'));
      if (mounted) setState(() { rows = out; err = null; });
    } on ApiError catch (e) { if (mounted) setState(() => err = e.message); }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(listenable: store, builder: (context, _) {
        final sig = store.active.length * 1000 + store.payments.length;
        if (!store.loading && seenLoans != sig) { seenLoans = sig; WidgetsBinding.instance.addPostFrameCallback((_) => load()); }
        final r = rows ?? [], late = r.where((i) => n(i['days_late']) > 0).toList(), next = r.where((i) => n(i['days_late']) == 0).toList();
        return RefreshIndicator(color: C.spruce, onRefresh: () async { await store.load(silent: true); await load(); }, child: ListView(padding: const EdgeInsets.only(bottom: 28), children: [
          Padding(padding: const EdgeInsets.fromLTRB(20, 18, 20, 4), child: Text('Pagar com Pix', style: T(26, w: FontWeight.w800, ls: -.5))),
          Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: Text('Escolha a parcela. O QR Code vale por 30 minutos e a baixa é automática.', style: T(13.5, color: C.mut, h: 1.4))),
          if (err != null) ErrorState(err!, load)
          else if (rows == null) ...[for (var i = 0; i < 3; i++) const Padding(padding: EdgeInsets.fromLTRB(20, 14, 20, 0), child: Skel(h: 76, r: 18))]
          else if (r.isEmpty) Pad(Padding(padding: const EdgeInsets.only(top: 16), child: Card2(child: const EmptyState(Ic.check, 'Tudo em dia', 'Você não tem parcelas em aberto agora.'))))
          else ...[
            if (late.isNotEmpty) ...[const SectionTitle('Em atraso'), for (final i in late) _tile(context, i)],
            if (next.isNotEmpty) ...[const SectionTitle('A vencer'), for (final i in next.take(8)) _tile(context, i)],
          ],
        ]));
      });

  Widget _tile(BuildContext context, Map<String, dynamic> i) {
    final late = n(i['days_late']) > 0;
    return Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 10), child: Card2(
      onTap: () async { await Navigator.push(context, slide(PixPage(loanId: n(i['loan_id']).toInt(), installmentId: n(i['id']).toInt()))); await store.load(silent: true); },
      child: Row(children: [
        Container(width: 44, height: 44, decoration: BoxDecoration(color: late ? C.badSoft : C.mintSoft, borderRadius: BorderRadius.circular(14)), alignment: Alignment.center, child: LIcon(Ic.pix, color: late ? C.bad : C.spruce)),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Parcela ${i['n']} • Contrato ${i['loan_id']}', style: T(14.5, w: FontWeight.w800)),
          Text(late ? '${i['days_late']} dias em atraso • venceu ${dm(i['due_date'])}' : 'Vence em ${dmy(i['due_date'])}', style: T(12.5, w: FontWeight.w600, color: late ? C.bad : C.mut)),
        ])),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [Text(brl(late ? i['amount_due'] : i['amount']), style: T(15, w: FontWeight.w800, num: true)), if (late) Text('com encargos', style: T(11, w: FontWeight.w600, color: C.bad))]),
      ]),
    ));
  }
}

/// Cobrança Pix: QR Code, "copia e cola", acompanhamento e baixa automática (sandbox).
class PixPage extends StatefulWidget {
  final int loanId; final int? installmentId; final String kind;
  const PixPage({super.key, required this.loanId, this.installmentId, this.kind = 'parcela'});
  @override State<PixPage> createState() => _PixPageState();
}

class _PixPageState extends State<PixPage> {
  Map<String, dynamic>? ch; String? err; Timer? poll; bool paying = false; bool copied = false;
  @override void initState() { super.initState(); create(); }
  @override void dispose() { poll?.cancel(); super.dispose(); }

  Future<void> create() async {
    setState(() { ch = null; err = null; });
    try {
      final r = await Api.post('/api/loans/${widget.loanId}/pix', {'kind': widget.kind, if (widget.installmentId != null) 'installment_id': widget.installmentId});
      if (!mounted) return; setState(() => ch = r);
      poll = Timer.periodic(const Duration(seconds: 3), (_) => check());
    } on ApiError catch (e) { if (mounted) setState(() => err = e.message); }
  }

  Future<void> check() async {
    if (ch == null) return;
    try { final r = await Api.get('/api/pix/${ch!['txid']}'); if (!mounted) return; if (r['status'] != ch!['status']) { setState(() => ch = {...ch!, ...r}); if (r['status'] == 'paga') { poll?.cancel(); store.load(silent: true); } } } catch (_) {}
  }

  Future<void> simulate() async {
    setState(() => paying = true);
    try { await Api.post('/api/sandbox/pix/${ch!['txid']}/pay'); await check(); } on ApiError catch (e) { if (mounted) toast(context, e.message, error: true); }
    if (mounted) setState(() => paying = false);
  }

  @override
  Widget build(BuildContext context) {
    final paid = ch?['status'] == 'paga';
    return Scaffold(
      appBar: appBarFor(context, 'Pagamento via Pix'),
      body: err != null ? ErrorState(err!, create) : ch == null ? const Padding(padding: EdgeInsets.all(20), child: Column(children: [Skel(h: 100, r: 20), SizedBox(height: 14), Skel(h: 320, r: 20)])) : paid ? _done() : ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 30), children: [
        Card2(padding: const EdgeInsets.all(22), child: Column(children: [
          Text('VALOR A PAGAR', style: T(10.5, w: FontWeight.w700, color: C.mut, ls: 1.4)),
          const SizedBox(height: 4),
          Text(brl(ch!['amount']), style: T(36, w: FontWeight.w800, ls: -1, num: true)),
          if (n(ch!['fine']) + n(ch!['interest_late']) > 0) Padding(padding: const EdgeInsets.only(top: 4), child: Text('inclui ${brl(n(ch!['fine']) + n(ch!['interest_late']))} de multa e juros de mora', style: T(12.5, color: C.bad, w: FontWeight.w600))),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: C.line)),
            child: QrImageView(data: '${ch!['brcode']}', size: 218, padding: EdgeInsets.zero, eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: C.spruce), dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: C.spruce)),
          ),
          const SizedBox(height: 14),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: C.amber.withValues(alpha: .8))), const SizedBox(width: 8), Text('Aguardando pagamento • expira às ${_hm(ch!['expires_at'])}', style: T(12.5, w: FontWeight.w600, color: C.mut))]),
        ])),
        const SizedBox(height: 12),
        Btn(copied ? 'Código copiado' : 'Copiar Pix copia e cola', ghost: true, icon: copied ? Ic.check : Ic.doc, onTap: () async { await Clipboard.setData(ClipboardData(text: '${ch!['brcode']}')); setState(() => copied = true); Future.delayed(const Duration(seconds: 2), () { if (mounted) setState(() => copied = false); }); }),
        const SizedBox(height: 18),
        Card2(color: C.amberSoft, border: false, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Pill.warn('SANDBOX'), const SizedBox(width: 8), Text('Ambiente de demonstração', style: T(13.5, w: FontWeight.w800))]),
          const SizedBox(height: 8),
          Text('Este QR Code não move dinheiro real. Para a demonstração, o botão abaixo representa o banco confirmando o pagamento ao provedor, que avisa a Lastro por webhook assinado.', style: T(12.5, color: C.ink2, h: 1.45)),
          const SizedBox(height: 12),
          Btn('Simular confirmação do banco', onTap: simulate, busy: paying, mint: true),
        ])),
      ]),
    );
  }

  String _hm(dynamic s) { final d = pd(s); return d == null ? '--:--' : '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}'; }

  Widget _done() => Padding(padding: const EdgeInsets.all(28), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        TweenAnimationBuilder<double>(tween: Tween(begin: 0, end: 1), duration: const Duration(milliseconds: 650), curve: Curves.elasticOut, builder: (_, v, __) => Transform.scale(scale: v, child: Container(width: 88, height: 88, decoration: const BoxDecoration(color: C.mintSoft, shape: BoxShape.circle), alignment: Alignment.center, child: const LIcon(Ic.check, size: 42, color: Color(0xFF14664A), stroke: 3)))),
        const SizedBox(height: 24),
        Text('Pagamento confirmado', style: T(25, w: FontWeight.w800, ls: -.5)), const SizedBox(height: 6),
        Text(brl(ch!['amount']), style: T(32, w: FontWeight.w800, color: const Color(0xFF14664A), num: true)), const SizedBox(height: 10),
        Text('Baixa automática por conciliação (sandbox).\nID da transação: ${ch!['end_to_end'] ?? ch!['txid']}', textAlign: TextAlign.center, style: T(12.5, color: C.mut, h: 1.5)),
        const SizedBox(height: 28),
        Btn('Concluir', onTap: () => Navigator.pop(context)),
      ]));
}
