import 'package:flutter/material.dart';
import 'api.dart';
import 'auth.dart';
import 'theme.dart';
import 'store.dart';
import 'pix.dart';
import 'simulate.dart';

const statusLabel = {
  'pendente': ['Em análise', 'info'], 'em_analise': ['Em análise', 'info'], 'aprovado': ['Aprovado', 'ok'], 'assinatura': ['Assinar contrato', 'warn'],
  'ativo': ['Ativo', 'ok'], 'quitado': ['Quitado', 'plain'], 'recusado': ['Recusado', 'bad'], 'cancelado': ['Cancelado', 'bad'], 'renegociado': ['Renegociado', 'plain'],
};
Widget statusPill(String s) {
  final v = statusLabel[s] ?? [s, 'plain'];
  return switch (v[1]) { 'ok' => Pill.ok(v[0]), 'warn' => Pill.warn(v[0]), 'bad' => Pill.bad(v[0]), 'info' => Pill.info(v[0]), _ => Pill(v[0]) };
}

class LoanCard extends StatelessWidget {
  final Map<String, dynamic> l;
  const LoanCard(this.l, {super.key});
  @override
  Widget build(BuildContext context) {
    final term = n(l['term']).toInt(), paid = n(l['paid_count']).toInt(), nx = l['next'] as Map?;
    final late = nx != null && '${nx['status']}' == 'atrasada';
    return Card2(
      onTap: () => Navigator.push(context, slide(LoanDetailPage(id: n(l['id']).toInt()))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${l['purpose'] ?? 'Empréstimo'}'.isEmpty ? 'Empréstimo' : '${l['purpose'] ?? 'Empréstimo'}', style: T(15.5, w: FontWeight.w800), maxLines: 1, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 2),
            Text('${brl0(l['principal'])} • $term× ${periodNames[l['periodicity']] ?? ''}', style: T(12.5, color: C.mut)),
          ])),
          if (late) Pill.bad('Em atraso') else statusPill('${l['status']}'),
        ]),
        const SizedBox(height: 14),
        ClipRRect(borderRadius: BorderRadius.circular(5), child: LinearProgressIndicator(value: term == 0 ? 0 : paid / term, minHeight: 6, backgroundColor: C.line2, color: late ? C.bad : C.mint)),
        const SizedBox(height: 10),
        Row(children: [
          Text('$paid de $term parcelas pagas', style: T(12.5, w: FontWeight.w600, color: C.mut)),
          const Spacer(),
          if (nx != null) Text('${brl(nx['amount'])} • ${dm(nx['due_date'])}', style: T(12.5, w: FontWeight.w800, color: late ? C.bad : C.ink)),
        ]),
      ]),
    );
  }
}

class PaymentRow extends StatelessWidget {
  final Map<String, dynamic> p; final bool last; final VoidCallback? onTap;
  const PaymentRow(this.p, {super.key, this.last = false, this.onTap});
  @override
  Widget build(BuildContext context) {
    final extra = n(p['fine']) + n(p['interest_late']);
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 13),
        decoration: BoxDecoration(border: last ? null : const Border(bottom: BorderSide(color: C.line2))),
        child: Row(children: [
          Container(width: 38, height: 38, decoration: BoxDecoration(color: C.mintSoft, borderRadius: BorderRadius.circular(12)), alignment: Alignment.center, child: const LIcon(Ic.check, size: 19, color: Color(0xFF14664A), stroke: 2.2)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(p['installment_n'] != null ? 'Parcela ${p['installment_n']} • Contrato ${p['loan_id']}' : '${p['kind']}'.replaceFirstMapped(RegExp('^.'), (m) => m[0]!.toUpperCase()), style: T(14.5, w: FontWeight.w700)),
            Text('${dmy(p['paid_at'])}${extra > 0 ? ' • inclui ${brl(extra)} de encargos' : ''}', style: T(12.5, color: C.mut)),
          ])),
          Text(brl(p['amount']), style: T(14.5, w: FontWeight.w800, num: true)),
        ]),
      ),
    );
  }
}

class LoansTab extends StatelessWidget {
  const LoansTab({super.key});
  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: store,
        builder: (context, _) {
          final cur = store.loans.where((l) => ['ativo', 'pendente', 'em_analise', 'aprovado', 'assinatura'].contains(l['status'])).toList(), old = store.loans.where((l) => !cur.contains(l)).toList();
          return RefreshIndicator(color: C.spruce, onRefresh: () => store.load(silent: true), child: ListView(padding: const EdgeInsets.only(bottom: 28), children: [
            Padding(padding: const EdgeInsets.fromLTRB(20, 18, 20, 4), child: Row(children: [Expanded(child: Text('Contratos', style: T(26, w: FontWeight.w800, ls: -.5))), SizedBox(width: 130, child: Btn('Novo', icon: Ic.plus, onTap: () => Navigator.push(context, slide(const SimulatePage()))))])),
            if (store.loading && store.loans.isEmpty) ...[for (var i = 0; i < 3; i++) const Padding(padding: EdgeInsets.fromLTRB(20, 12, 20, 0), child: Skel(h: 120, r: 18))]
            else if (store.loans.isEmpty) Pad(Card2(child: EmptyState(Ic.loans, 'Você ainda não tem contratos', 'Quando você contratar, as condições e parcelas aparecem aqui.')))
            else ...[
              if (cur.isNotEmpty) const SectionTitle('Em andamento'),
              for (final l in cur) Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 10), child: LoanCard(l)),
              if (old.isNotEmpty) const SectionTitle('Encerrados'),
              for (final l in old) Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 10), child: LoanCard(l)),
            ],
          ]));
        },
      );
}

class LoanDetailPage extends StatefulWidget {
  final int id;
  const LoanDetailPage({super.key, required this.id});
  @override State<LoanDetailPage> createState() => _LoanDetailState();
}

class _LoanDetailState extends State<LoanDetailPage> {
  Map<String, dynamic>? d; String? err; bool amort = false;
  @override void initState() { super.initState(); load(); }
  Future<void> load() async {
    try { final r = await Api.get('/api/loans/${widget.id}'); if (mounted) setState(() { d = r; err = null; }); } on ApiError catch (e) { if (mounted) setState(() => err = e.message); }
  }
  List<Map<String, dynamic>> get inst => (d!['installments'] as List).map((e) => (e as Map).cast<String, dynamic>()).toList();

  @override
  Widget build(BuildContext context) {
    final loan = (d?['loan'] as Map?)?.cast<String, dynamic>();
    return Scaffold(
      appBar: _bar(context, loan == null ? 'Contrato' : 'Contrato nº ${loan['id']}'),
      body: err != null ? ErrorState(err!, load) : d == null ? const _DetailSkeleton() : RefreshIndicator(color: C.spruce, onRefresh: load, child: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 30), children: _body(context, loan!))),
    );
  }

  List<Widget> _body(BuildContext context, Map<String, dynamic> l) {
    final st = '${l['status']}', pay = (d!['payoff'] as Map?)?.cast<String, dynamic>(), rows = inst, contract = d!['contract'] as Map?;
    final payments = (d!['payments'] as List).map((e) => (e as Map).cast<String, dynamic>()).toList();
    return [
      Card2(color: C.spruce, border: false, padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Text('VALOR CONTRATADO', style: T(10.5, w: FontWeight.w700, color: const Color(0xFF7FB6A4), ls: 1.3)), const Spacer(), statusPill(st)]),
        const SizedBox(height: 4),
        Text(brl(l['principal']), style: T(32, w: FontWeight.w800, color: Colors.white, ls: -.8, num: true)),
        const SizedBox(height: 16),
        Row(children: [
          _kv('Parcela', '${l['term']}× ${brl(l['installment_value'])}'), _kv('Juros', '${n(l['monthly_rate']).toStringAsFixed(2).replaceAll('.', ',')}% a.m.'), _kv('CET', '${n(l['cet_monthly']).toStringAsFixed(2).replaceAll('.', ',')}% a.m.'),
        ]),
      ])),
      if (st == 'assinatura') Padding(padding: const EdgeInsets.only(top: 14), child: Card2(color: C.amberSoft, border: false, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Falta só assinar', style: T(16, w: FontWeight.w800)), const SizedBox(height: 4),
        Text('Sua solicitação foi aprovada. Leia o contrato e assine para liberar o valor.', style: T(13.5, color: C.ink2, h: 1.4)), const SizedBox(height: 14),
        Btn('Revisar e assinar', onTap: () async { await Navigator.push(context, slide(ContractPage(loanId: widget.id))); await load(); store.load(silent: true); }),
      ]))),
      if (['pendente', 'em_analise'].contains(st)) Padding(padding: const EdgeInsets.only(top: 14), child: Card2(child: Row(children: [const LIcon(Ic.history, color: C.info), const SizedBox(width: 12), Expanded(child: Text('Estamos analisando sua solicitação e seus documentos. Você será avisado por notificação.', style: T(13.5, color: C.ink2, h: 1.4)))]))),
      if (st == 'recusado') Padding(padding: const EdgeInsets.only(top: 14), child: Card2(color: C.badSoft, border: false, child: Text('${l['decision_note'] ?? 'Solicitação não aprovada neste momento.'}', style: T(13.5, color: C.bad, h: 1.4, w: FontWeight.w600)))),
      if (pay != null && st == 'ativo') ...[
        const SizedBox(height: 14),
        Card2(child: Column(children: [
          Row(children: [_stat('Saldo devedor', brl(pay['outstanding'])), _stat('Quitar hoje', brl(pay['payoffToday']), accent: true)]),
          if (n(pay['overdue']) > 0) Padding(padding: const EdgeInsets.only(top: 12), child: Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: C.badSoft, borderRadius: BorderRadius.circular(10)), child: Row(children: [Expanded(child: Text('${brl(pay['overdue'])} em atraso. Multa de 2% e juros de mora de 1% a.m. incidem sobre o valor vencido.', style: T(12.5, w: FontWeight.w600, color: C.bad, h: 1.35)))]))),
          const SizedBox(height: 14),
          Btn('Pagar parcela com Pix', icon: Ic.pix, onTap: () async { await Navigator.push(context, slide(PixPage(loanId: widget.id))); await load(); }),
        ])),
      ],
      if (contract != null) ...[
        const SizedBox(height: 14),
        Card2(onTap: () => Navigator.push(context, slide(ContractPage(loanId: widget.id))), child: Row(children: [
          Container(width: 40, height: 40, decoration: BoxDecoration(color: C.line2, borderRadius: BorderRadius.circular(12)), alignment: Alignment.center, child: const LIcon(Ic.doc, color: C.spruce)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Contrato ${contract['code']}', style: T(14.5, w: FontWeight.w800)), Text(contract['signed_at'] != null ? 'Assinado em ${dmy(contract['signed_at'])}' : 'Aguardando assinatura', style: T(12.5, color: C.mut))])),
          const LIcon(Ic.arrowR, size: 18, color: C.mut),
        ])),
      ],
      if (rows.isNotEmpty) ...[
        SectionTitle('Parcelas', trailing: GestureDetector(onTap: () => setState(() => amort = !amort), child: Text(amort ? 'Ocultar amortização' : 'Ver amortização', style: T(13, w: FontWeight.w700, color: C.mut)))),
        Card2(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4), child: Column(children: [for (var i = 0; i < rows.length; i++) _instRow(context, rows[i], i == rows.length - 1)])),
      ],
      if (payments.isNotEmpty) ...[const SectionTitle('Pagamentos'), Card2(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(children: [for (var i = 0; i < payments.length; i++) PaymentRow(payments[i], last: i == payments.length - 1)]))],
    ];
  }

  Widget _instRow(BuildContext context, Map<String, dynamic> i, bool last) {
    final paid = '${i['status']}' == 'paga', late = n(i['days_late']) > 0 && !paid;
    return InkWell(
      onTap: paid || '${d!['loan']['status']}' != 'ativo' ? null : () async { await Navigator.push(context, slide(PixPage(loanId: widget.id, installmentId: n(i['id']).toInt()))); await load(); },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(border: last ? null : const Border(bottom: BorderSide(color: C.line2))),
        child: Column(children: [
          Row(children: [
            Container(width: 30, height: 30, decoration: BoxDecoration(color: paid ? C.mintSoft : late ? C.badSoft : C.line2, shape: BoxShape.circle), alignment: Alignment.center, child: paid ? const LIcon(Ic.check, size: 16, color: Color(0xFF14664A), stroke: 2.4) : Text('${i['n']}', style: T(12.5, w: FontWeight.w800, color: late ? C.bad : C.ink2))),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(dmy(i['due_date']), style: T(14, w: FontWeight.w700)), Text(paid ? 'paga' : late ? '${i['days_late']} dias em atraso' : 'a vencer', style: T(12, w: FontWeight.w600, color: paid ? const Color(0xFF14664A) : late ? C.bad : C.mut))])),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [Text(brl(late ? i['amount_due'] : i['amount']), style: T(14.5, w: FontWeight.w800, num: true)), if (late) Text('com encargos', style: T(11, color: C.bad, w: FontWeight.w600))]),
          ]),
          if (amort) Padding(padding: const EdgeInsets.only(top: 8, left: 42), child: Row(children: [
            Text('Principal ${brl(i['principal'])}', style: T(11.5, color: C.mut)), const SizedBox(width: 12), Text('Juros ${brl(i['interest'])}', style: T(11.5, color: C.mut)), const Spacer(), Text('Saldo ${brl(i['balance_after'])}', style: T(11.5, color: C.mut)),
          ])),
        ]),
      ),
    );
  }

  Widget _kv(String k, String v) => Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(k, style: T(11.5, color: const Color(0xFF7FB6A4), w: FontWeight.w600)), const SizedBox(height: 2), Text(v, style: T(13.5, w: FontWeight.w800, color: Colors.white, num: true))]));
  Widget _stat(String k, String v, {bool accent = false}) => Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(k, style: T(12, color: C.mut, w: FontWeight.w600)), const SizedBox(height: 2), Text(v, style: T(20, w: FontWeight.w800, color: accent ? const Color(0xFF14664A) : C.ink, num: true))]));
}

class _DetailSkeleton extends StatelessWidget {
  const _DetailSkeleton();
  @override Widget build(BuildContext context) => const Padding(padding: EdgeInsets.all(20), child: Column(children: [Skel(h: 150, r: 20), SizedBox(height: 14), Skel(h: 120, r: 18), SizedBox(height: 14), Skel(h: 220, r: 18)]));
}

PreferredSizeWidget _bar(BuildContext context, String title) => AppBar(
      backgroundColor: C.sand, elevation: 0, scrolledUnderElevation: 0, centerTitle: false, titleSpacing: 0,
      leading: IconButton(tooltip: 'Voltar', onPressed: () => Navigator.pop(context), icon: const LIcon(Ic.back)),
      title: Text(title, style: T(17, w: FontWeight.w800)),
    );
PreferredSizeWidget appBarFor(BuildContext c, String t) => _bar(c, t);

/// Calendário mensal de vencimentos, reunindo as parcelas de todos os contratos ativos.
class CalendarPage extends StatefulWidget {
  const CalendarPage({super.key});
  @override State<CalendarPage> createState() => _CalendarState();
}

class _CalendarState extends State<CalendarPage> {
  List<Map<String, dynamic>>? items; String? err; DateTime month = DateTime(DateTime.now().year, DateTime.now().month); int? sel;
  @override void initState() { super.initState(); load(); }
  Future<void> load() async {
    try {
      final out = <Map<String, dynamic>>[];
      for (final l in store.active) { final r = await Api.get('/api/loans/${l['id']}'); for (final i in (r['installments'] as List)) { out.add({...(i as Map).cast<String, dynamic>(), 'loan_id': l['id']}); } }
      if (mounted) setState(() { items = out; err = null; });
    } on ApiError catch (e) { if (mounted) setState(() => err = e.message); }
  }
  Color _c(Map i) => '${i['status']}' == 'paga' ? C.mint : n(i['days_late']) > 0 ? C.bad : C.amber;

  @override
  Widget build(BuildContext context) {
    final inMonth = (items ?? []).where((i) { final d = pd(i['due_date'])!; return d.year == month.year && d.month == month.month; }).toList();
    final first = DateTime(month.year, month.month), lead = (first.weekday % 7), days = DateTime(month.year, month.month + 1, 0).day, today = DateTime.now();
    final shown = sel == null ? inMonth : inMonth.where((i) => pd(i['due_date'])!.day == sel).toList();
    final monthName = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][month.month - 1];
    return Scaffold(
      appBar: _bar(context, 'Calendário de parcelas'),
      body: err != null ? ErrorState(err!, load) : items == null ? const Padding(padding: EdgeInsets.all(20), child: Skel(h: 360, r: 20)) : ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 30), children: [
        Card2(child: Column(children: [
          Row(children: [
            IconButton(tooltip: 'Mês anterior', onPressed: () => setState(() { month = DateTime(month.year, month.month - 1); sel = null; }), icon: const RotatedBox(quarterTurns: 0, child: LIcon(Ic.back, size: 20))),
            Expanded(child: Text('${monthName[0].toUpperCase()}${monthName.substring(1)} ${month.year}', textAlign: TextAlign.center, style: T(16.5, w: FontWeight.w800))),
            IconButton(tooltip: 'Próximo mês', onPressed: () => setState(() { month = DateTime(month.year, month.month + 1); sel = null; }), icon: const RotatedBox(quarterTurns: 2, child: LIcon(Ic.back, size: 20))),
          ]),
          const SizedBox(height: 6),
          Row(children: [for (final w in ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']) Expanded(child: Center(child: Text(w, style: T(11.5, w: FontWeight.w700, color: C.faint))))]),
          const SizedBox(height: 6),
          GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 7, childAspectRatio: 1, children: [
            for (var k = 0; k < lead; k++) const SizedBox(),
            for (var day = 1; day <= days; day++) _cell(day, inMonth.where((i) => pd(i['due_date'])!.day == day).toList(), today.year == month.year && today.month == month.month && today.day == day),
          ]),
          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [_dot(C.mint, 'paga'), const SizedBox(width: 14), _dot(C.amber, 'a vencer'), const SizedBox(width: 14), _dot(C.bad, 'em atraso')]),
        ])),
        SectionTitle(sel == null ? 'Vencimentos do mês' : 'Vencimentos do dia $sel'),
        if (shown.isEmpty) Card2(child: const EmptyState(Ic.calendar, 'Nada vence aqui', 'Nenhuma parcela neste período.'))
        else Card2(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(children: [for (var i = 0; i < shown.length; i++) _row(shown[i], i == shown.length - 1)])),
      ]),
    );
  }

  Widget _row(Map<String, dynamic> i, bool last) => Container(
        padding: const EdgeInsets.symmetric(vertical: 13), decoration: BoxDecoration(border: last ? null : const Border(bottom: BorderSide(color: C.line2))),
        child: Row(children: [
          Container(width: 10, height: 10, decoration: BoxDecoration(color: _c(i), shape: BoxShape.circle)), const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Parcela ${i['n']} • Contrato ${i['loan_id']}', style: T(14, w: FontWeight.w700)), Text(dmy(i['due_date']), style: T(12.5, color: C.mut))])),
          Text(brl(i['amount']), style: T(14.5, w: FontWeight.w800, num: true)),
        ]),
      );
  Widget _dot(Color c, String t) => Row(children: [Container(width: 8, height: 8, decoration: BoxDecoration(color: c, shape: BoxShape.circle)), const SizedBox(width: 6), Text(t, style: T(12, color: C.mut, w: FontWeight.w600))]);
  Widget _cell(int day, List<Map<String, dynamic>> its, bool today) {
    final on = sel == day;
    return GestureDetector(
      onTap: () => setState(() => sel = on ? null : day),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160), margin: const EdgeInsets.all(2),
        decoration: BoxDecoration(color: on ? C.spruce : today ? C.mintSoft : Colors.transparent, borderRadius: BorderRadius.circular(12)),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Text('$day', style: T(14, w: its.isNotEmpty || today ? FontWeight.w800 : FontWeight.w600, color: on ? Colors.white : its.isEmpty ? C.ink2 : C.ink)),
          const SizedBox(height: 3),
          SizedBox(height: 6, child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [for (final i in its.take(3)) Container(width: 5, height: 5, margin: const EdgeInsets.symmetric(horizontal: 1), decoration: BoxDecoration(color: on ? Colors.white : _c(i), shape: BoxShape.circle))])),
        ]),
      ),
    );
  }
}

/// Contrato digital: leitura integral, evidências e assinatura eletrônica (sandbox).
class ContractPage extends StatefulWidget {
  final int loanId;
  const ContractPage({super.key, required this.loanId});
  @override State<ContractPage> createState() => _ContractState();
}

class _ContractState extends State<ContractPage> {
  Map<String, dynamic>? d; String? err; bool ok = false, busy = false;
  @override void initState() { super.initState(); load(); }
  Future<void> load() async { try { final r = await Api.get('/api/loans/${widget.loanId}'); if (mounted) setState(() => d = r); } on ApiError catch (e) { if (mounted) setState(() => err = e.message); } }

  Future<void> sign() async {
    setState(() => busy = true);
    try { await Api.post('/api/loans/${widget.loanId}/sign', {'accept': true}); await load(); await store.load(silent: true); if (mounted) toast(context, 'Contrato assinado. Seu valor será liberado em instantes.'); } on ApiError catch (e) { if (mounted) toast(context, e.message, error: true); }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final l = (d?['loan'] as Map?)?.cast<String, dynamic>(), c = (d?['contract'] as Map?)?.cast<String, dynamic>();
    final signed = c?['signed_at'] != null;
    return Scaffold(
      appBar: _bar(context, 'Contrato digital'),
      body: err != null ? ErrorState(err!, load) : l == null ? const Padding(padding: EdgeInsets.all(20), child: Skel(h: 400, r: 20)) : ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 30), children: [
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6), border: Border.all(color: C.line), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: .05), blurRadius: 18, offset: const Offset(0, 8))]),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [const Logo(size: 26), const SizedBox(width: 8), Text('lastro', style: T(16, w: FontWeight.w800)), const Spacer(), Text(c?['code'] ?? '', style: T(11, w: FontWeight.w700, color: C.mut))]),
            const Divider(height: 26, color: C.line),
            Text('CÉDULA DE CRÉDITO PESSOAL', style: T(15, w: FontWeight.w800, ls: .4)),
            const SizedBox(height: 4),
            Text('Contrato nº ${l['id']} • emitido em ${dmy(c?['generated_at'])}', style: T(12, color: C.mut)),
            const SizedBox(height: 16),
            _clause('Partes', 'CREDORA: Lastro Serviços Financeiros (demonstração). DEVEDOR(A): ${l['full_name']}, CPF final ${l['cpf_last3'] ?? '***'}.'),
            _clause('Valor e liberação', 'Valor principal de ${brl(l['principal'])}, mais IOF de ${brl(l['iof'])}, creditado após a assinatura.'),
            _clause('Pagamento', '${l['term']} parcelas ${periodNames[l['periodicity']]}s de ${brl(l['installment_value'])}, totalizando ${brl(l['total_amount'])}. Primeira parcela em ${dmy(l['first_due'])}.'),
            _clause('Encargos', 'Juros de ${n(l['monthly_rate']).toStringAsFixed(2).replaceAll('.', ',')}% ao mês e Custo Efetivo Total de ${n(l['cet_monthly']).toStringAsFixed(2).replaceAll('.', ',')}% ao mês. Em atraso: multa de 2% e juros de mora de 1% ao mês, proporcionais aos dias.'),
            _clause('Quitação antecipada', 'Você pode antecipar parcelas ou quitar o saldo a qualquer momento, com redução proporcional dos juros, conforme o art. 52, §2º do CDC.'),
            _clause('Dados pessoais', 'Seus dados são tratados conforme a LGPD para análise de crédito, cobrança e cumprimento deste contrato. Você pode solicitar acesso e correção pelo aplicativo.'),
            if (c?['doc_sha256'] != null) ...[const Divider(height: 26, color: C.line), Text('IMPRESSÃO DIGITAL DO DOCUMENTO (SHA-256)', style: T(10, w: FontWeight.w700, color: C.mut, ls: .8)), const SizedBox(height: 4), Text('${c!['doc_sha256']}', style: T(10.5, color: C.ink2, h: 1.4))],
          ]),
        ),
        const SizedBox(height: 16),
        if (signed) Card2(color: C.mintSoft, border: false, child: Row(children: [const LIcon(Ic.shield, color: Color(0xFF14664A)), const SizedBox(width: 12), Expanded(child: Text('Assinado eletronicamente em ${dmy(c!['signed_at'])}. Registramos data, IP, dispositivo e a impressão digital do documento (sandbox).', style: T(13, color: const Color(0xFF14664A), w: FontWeight.w600, h: 1.4)))]))
        else if ('${l['status']}' == 'assinatura') Column(children: [
          GestureDetector(onTap: () => setState(() => ok = !ok), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            AnimatedContainer(duration: const Duration(milliseconds: 150), width: 22, height: 22, decoration: BoxDecoration(color: ok ? C.spruce : C.paper, borderRadius: BorderRadius.circular(6), border: Border.all(color: ok ? C.spruce : C.line, width: 1.5)), child: ok ? const LIcon(Ic.check, size: 16, color: Colors.white, stroke: 2.4) : null),
            const SizedBox(width: 12), Expanded(child: Text('Li o contrato, entendi as parcelas, o CET e os encargos de atraso, e concordo em assinar eletronicamente.', style: T(13.5, color: C.ink2, h: 1.4))),
          ])),
          const SizedBox(height: 16),
          Btn('Assinar eletronicamente', onTap: ok ? sign : null, busy: busy),
          const SizedBox(height: 10), Text('Assinatura em ambiente de demonstração (sandbox). Em produção, usa um provedor de assinatura eletrônica homologado.', textAlign: TextAlign.center, style: T(11.5, color: C.mut, h: 1.4)),
        ]),
      ]),
    );
  }

  Widget _clause(String t, String b) => Padding(padding: const EdgeInsets.only(bottom: 14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(t.toUpperCase(), style: T(10.5, w: FontWeight.w800, color: C.spruce, ls: .8)), const SizedBox(height: 3), Text(b, style: T(13, color: C.ink2, h: 1.5))]));
}
