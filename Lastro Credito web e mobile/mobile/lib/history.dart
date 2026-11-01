import 'package:flutter/material.dart';
import 'auth.dart';
import 'theme.dart';
import 'store.dart';
import 'loans.dart';

class HistoryTab extends StatelessWidget {
  const HistoryTab({super.key});
  @override
  Widget build(BuildContext context) => ListenableBuilder(listenable: store, builder: (context, _) {
        final p = store.payments, total = p.fold<num>(0, (a, x) => a + n(x['amount'])), enc = p.fold<num>(0, (a, x) => a + n(x['fine']) + n(x['interest_late']));
        final groups = <String, List<Map<String, dynamic>>>{};
        for (final x in p) { final d = pd(x['paid_at'])!; groups.putIfAbsent('${_mes[d.month - 1]} ${d.year}', () => []).add(x); }
        return RefreshIndicator(color: C.spruce, onRefresh: () => store.load(silent: true), child: ListView(padding: const EdgeInsets.only(bottom: 28), children: [
          Padding(padding: const EdgeInsets.fromLTRB(20, 18, 20, 14), child: Text('Extrato', style: T(26, w: FontWeight.w800, ls: -.5))),
          if (store.loading && p.isEmpty) ...[const Padding(padding: EdgeInsets.symmetric(horizontal: 20), child: Skel(h: 90, r: 18)), for (var i = 0; i < 4; i++) const Padding(padding: EdgeInsets.fromLTRB(20, 14, 20, 0), child: Skel(h: 52, r: 12))]
          else if (p.isEmpty) Pad(Card2(child: const EmptyState(Ic.receipt, 'Nenhum pagamento ainda', 'Seus pagamentos e recibos aparecem aqui assim que você pagar uma parcela.')))
          else ...[
            Pad(Row(children: [
              Expanded(child: Card2(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Total pago', style: T(12, w: FontWeight.w600, color: C.mut)), const SizedBox(height: 4), Text(brl(total), style: T(19, w: FontWeight.w800, num: true))]))),
              const SizedBox(width: 12),
              Expanded(child: Card2(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Multas e juros', style: T(12, w: FontWeight.w600, color: C.mut)), const SizedBox(height: 4), Text(brl(enc), style: T(19, w: FontWeight.w800, num: true, color: enc > 0 ? C.amber : C.ink))]))),
            ])),
            for (final e in groups.entries) ...[
              Padding(padding: const EdgeInsets.fromLTRB(20, 22, 20, 8), child: Text(e.key.toUpperCase(), style: T(11, w: FontWeight.w800, color: C.mut, ls: 1.2))),
              Pad(Card2(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(children: [for (var i = 0; i < e.value.length; i++) PaymentRow(e.value[i], last: i == e.value.length - 1, onTap: () => Navigator.push(context, slide(ReceiptPage(e.value[i]))))]))),
            ],
          ],
        ]));
      });
  static const _mes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
}

class ReceiptPage extends StatelessWidget {
  final Map<String, dynamic> p;
  const ReceiptPage(this.p, {super.key});
  @override
  Widget build(BuildContext context) {
    final fine = n(p['fine']), li = n(p['interest_late']), base = n(p['amount']) - fine - li;
    return Scaffold(
      appBar: appBarFor(context, 'Comprovante'),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 30), children: [
        Container(
          padding: const EdgeInsets.fromLTRB(22, 26, 22, 22),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6), border: Border.all(color: C.line), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: .05), blurRadius: 18, offset: const Offset(0, 8))]),
          child: Column(children: [
            Container(width: 56, height: 56, decoration: const BoxDecoration(color: C.mintSoft, shape: BoxShape.circle), alignment: Alignment.center, child: const LIcon(Ic.check, size: 28, color: Color(0xFF14664A), stroke: 2.6)),
            const SizedBox(height: 14),
            Text('Pagamento confirmado', style: T(16, w: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(brl(p['amount']), style: T(34, w: FontWeight.w800, ls: -1, num: true)),
            const SizedBox(height: 18),
            _dash(),
            _r('Referente a', p['installment_n'] != null ? 'Parcela ${p['installment_n']} • Contrato ${p['loan_id']}' : '${p['kind']}'),
            _r('Valor da parcela', brl(base)), if (fine > 0) _r('Multa (2%)', brl(fine)), if (li > 0) _r('Juros de mora', brl(li)),
            _r('Pago em', _full(p['paid_at'])), _r('Forma', 'Pix'),
            _dash(),
            Text('CÓDIGO DO RECIBO', style: T(10, w: FontWeight.w700, color: C.mut, ls: 1)), const SizedBox(height: 4),
            Text('${p['receipt_code']}', style: T(15, w: FontWeight.w800, ls: .6)),
            if (p['sandbox'] == true) Padding(padding: const EdgeInsets.only(top: 14), child: Pill.warn('PAGAMENTO SIMULADO • SANDBOX')),
          ]),
        ),
        const SizedBox(height: 16),
        Text('O comprovante em PDF, com impressão digital do documento, é emitido pelo servidor e fica disponível para a equipe e para auditoria.', textAlign: TextAlign.center, style: T(12, color: C.mut, h: 1.45)),
      ]),
    );
  }
  String _full(dynamic s) { final d = pd(s); return d == null ? '—' : '${dmy(s)} às ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}'; }
  Widget _dash() => Padding(padding: const EdgeInsets.symmetric(vertical: 14), child: LayoutBuilder(builder: (_, c) => Row(children: [for (var i = 0; i < (c.maxWidth / 8).floor(); i++) Expanded(child: Container(height: 1, margin: const EdgeInsets.symmetric(horizontal: 2), color: C.line))])));
  Widget _r(String k, String v) => Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(k, style: T(13.5, color: C.mut, w: FontWeight.w600)), const SizedBox(width: 16), Expanded(child: Text(v, textAlign: TextAlign.right, style: T(13.5, w: FontWeight.w700, num: true)))]));
}
