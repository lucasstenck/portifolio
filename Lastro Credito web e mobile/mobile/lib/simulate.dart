import 'dart:async';
import 'package:flutter/material.dart';
import 'api.dart';
import 'auth.dart';
import 'theme.dart';
import 'store.dart';
import 'loans.dart';

class SimulatePage extends StatefulWidget {
  const SimulatePage({super.key});
  @override State<SimulatePage> createState() => _SimulateState();
}

class _SimulateState extends State<SimulatePage> {
  double amount = 5000; int term = 12; String per = 'mensal';
  Map<String, dynamic>? sim; String? err; bool loading = true; Timer? deb; bool showRows = false;

  @override void initState() { super.initState(); run(); }
  @override void dispose() { deb?.cancel(); super.dispose(); }

  void queue() { deb?.cancel(); setState(() => loading = true); deb = Timer(const Duration(milliseconds: 260), run); }
  Future<void> run() async {
    try { final r = await Api.post('/api/simulate', {'amount': amount, 'term': term, 'periodicity': per}); if (mounted) setState(() { sim = r; err = null; loading = false; }); }
    on ApiError catch (e) { if (mounted) setState(() { err = e.message; loading = false; }); }
  }

  (int, int, String) get range => switch (per) { 'diaria' => (10, 90, 'dias'), 'semanal' => (4, 52, 'semanas'), _ => (3, 36, 'meses') };
  void setPer(String p) { setState(() { per = p; term = switch (p) { 'diaria' => 30, 'semanal' => 12, _ => 12 }; }); queue(); }

  @override
  Widget build(BuildContext context) {
    final (lo, hi, unit) = range;
    return Scaffold(
      appBar: appBarFor(context, 'Simular empréstimo'),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 30), children: [
        Card2(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('De quanto você precisa?', style: T(13, w: FontWeight.w700, color: C.mut)),
          const SizedBox(height: 4),
          Text(brl0(amount), style: T(40, w: FontWeight.w800, ls: -1.2, num: true)),
          _slider(amount, 500, 50000, (v) { setState(() => amount = (v / 100).round() * 100.0); queue(); }),
          Row(children: [Text('R\$ 500', style: T(11.5, color: C.faint)), const Spacer(), Text('R\$ 50.000', style: T(11.5, color: C.faint))]),
          const SizedBox(height: 22),
          Text('Em quanto tempo?', style: T(13, w: FontWeight.w700, color: C.mut)),
          const SizedBox(height: 4),
          Text('$term $unit', style: T(26, w: FontWeight.w800, ls: -.5)),
          _slider(term.toDouble().clamp(lo.toDouble(), hi.toDouble()), lo.toDouble(), hi.toDouble(), (v) { setState(() => term = v.round()); queue(); }),
          const SizedBox(height: 14),
          Text('Periodicidade das parcelas', style: T(13, w: FontWeight.w700, color: C.mut)),
          const SizedBox(height: 8),
          Container(padding: const EdgeInsets.all(3), decoration: BoxDecoration(color: C.line2, borderRadius: BorderRadius.circular(12)), child: Row(children: [for (final p in ['mensal', 'semanal', 'diaria']) Expanded(child: GestureDetector(
            onTap: () => setPer(p),
            child: AnimatedContainer(duration: const Duration(milliseconds: 180), height: 38, alignment: Alignment.center, decoration: BoxDecoration(color: per == p ? C.paper : Colors.transparent, borderRadius: BorderRadius.circular(10), boxShadow: per == p ? [BoxShadow(color: Colors.black.withValues(alpha: .08), blurRadius: 4, offset: const Offset(0, 1))] : null), child: Text('${periodNames[p]![0].toUpperCase()}${periodNames[p]!.substring(1)}', style: T(13.5, w: FontWeight.w700, color: per == p ? C.ink : C.mut))),
          ))])),
        ])),
        const SizedBox(height: 14),
        AnimatedSwitcher(duration: const Duration(milliseconds: 220), child: err != null
            ? Card2(key: const ValueKey('e'), color: C.badSoft, border: false, child: Text(err!, style: T(13.5, w: FontWeight.w600, color: C.bad, h: 1.4)))
            : sim == null ? const Skel(key: ValueKey('s'), h: 200, r: 20) : _result(context)),
      ]),
    );
  }

  Widget _slider(double v, double lo, double hi, ValueChanged<double> f) => SliderTheme(
        data: SliderThemeData(trackHeight: 5, activeTrackColor: C.spruce, inactiveTrackColor: C.line2, thumbColor: C.spruce, overlayColor: C.spruce.withValues(alpha: .12), thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 11, elevation: 2), trackShape: const RoundedRectSliderTrackShape()),
        child: Slider(value: v, min: lo, max: hi, onChanged: f),
      );

  Widget _result(BuildContext context) {
    final s = sim!, rows = (s['rows'] as List).map((e) => (e as Map).cast<String, dynamic>()).toList();
    return Opacity(key: const ValueKey('r'), opacity: loading ? .5 : 1, child: Column(children: [
      Card2(color: C.spruce, border: false, padding: const EdgeInsets.all(22), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('VOCÊ PAGA', style: T(10.5, w: FontWeight.w700, color: const Color(0xFF7FB6A4), ls: 1.4)),
        const SizedBox(height: 4),
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [Text('${s['term']}×', style: T(18, w: FontWeight.w700, color: const Color(0xFF9CC0B5))), const SizedBox(width: 8), Text(brl(s['installment']), style: T(34, w: FontWeight.w800, color: Colors.white, ls: -1, num: true))]),
        Text('${periodNames[s['periodicity']]}s • 1ª parcela em ${dm(s['firstDue'])}', style: T(12.5, color: const Color(0xFF9CC0B5))),
        const SizedBox(height: 18),
        Container(height: 1, color: Colors.white12), const SizedBox(height: 14),
        _line('Total a pagar', brl(s['total']), strong: true), _line('Juros do período', brl(s['interestTotal'])), _line('IOF', brl(s['iof'])),
        _line('Taxa de juros', '${n(s['monthlyRate']).toStringAsFixed(2).replaceAll('.', ',')}% ao mês'), _line('CET', '${n(s['cet']).toStringAsFixed(2).replaceAll('.', ',')}% a.m. • ${n(s['cetYear']).toStringAsFixed(1).replaceAll('.', ',')}% a.a.'),
      ])),
      const SizedBox(height: 10),
      Card2(onTap: () => setState(() => showRows = !showRows), padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14), child: Column(children: [
        Row(children: [Expanded(child: Text('Ver tabela de parcelas', style: T(14.5, w: FontWeight.w700))), AnimatedRotation(turns: showRows ? .25 : 0, duration: const Duration(milliseconds: 200), child: const LIcon(Ic.arrowR, size: 18, color: C.mut))]),
        if (showRows) Padding(padding: const EdgeInsets.only(top: 10), child: Column(children: [
          Row(children: [for (final h in ['Nº', 'Vencimento', 'Parcela', 'Saldo']) Expanded(flex: h == 'Nº' ? 1 : 2, child: Text(h, style: T(11, w: FontWeight.w700, color: C.mut)))]),
          const SizedBox(height: 6),
          for (final r in rows.take(24)) Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [Expanded(flex: 1, child: Text('${r['n']}', style: T(12.5, color: C.mut))), Expanded(flex: 2, child: Text(dm(r['due_date']), style: T(12.5))), Expanded(flex: 2, child: Text(brl(r['amount']), style: T(12.5, w: FontWeight.w700, num: true))), Expanded(flex: 2, child: Text(brl0(r['balance_after']), style: T(12.5, color: C.mut, num: true)))])),
        ])),
      ])),
      const SizedBox(height: 16),
      Btn('Solicitar este empréstimo', onTap: loading ? null : () => Navigator.push(context, slide(RequestPage(sim: s)))),
      const SizedBox(height: 12),
      Text('Simulação sem compromisso. A aprovação depende de análise de crédito e de documentos.', textAlign: TextAlign.center, style: T(11.5, color: C.mut, h: 1.4)),
    ]));
  }

  Widget _line(String k, String v, {bool strong = false}) => Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [Text(k, style: T(13.5, color: const Color(0xFF9CC0B5))), const Spacer(), Text(v, style: T(strong ? 15.5 : 13.5, w: strong ? FontWeight.w800 : FontWeight.w700, color: Colors.white, num: true))]));
}

class RequestPage extends StatefulWidget {
  final Map<String, dynamic> sim;
  const RequestPage({super.key, required this.sim});
  @override State<RequestPage> createState() => _RequestState();
}

class _RequestState extends State<RequestPage> {
  final purpose = TextEditingController(); bool agree = false, busy = false, done = false; String? err;
  static const chips = ['Reforma', 'Capital de giro', 'Quitar dívidas', 'Estudos', 'Saúde', 'Viagem'];

  Future<void> send() async {
    setState(() { busy = true; err = null; });
    final s = widget.sim;
    try { await Api.post('/api/loans', {'amount': s['principal'], 'term': s['term'], 'periodicity': s['periodicity'], 'purpose': purpose.text.trim()}); await store.load(silent: true); if (mounted) setState(() => done = true); }
    on ApiError catch (e) { err = e.message; }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.sim;
    if (done) return _success(context);
    final kyc = store.kyc;
    return Scaffold(
      appBar: appBarFor(context, 'Nova solicitação'),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 30), children: [
        Card2(child: Column(children: [
          _r('Valor', brl(s['principal']), big: true), _r('Parcelas', '${s['term']}× ${brl(s['installment'])}'), _r('Periodicidade', '${periodNames[s['periodicity']]}'), _r('Total a pagar', brl(s['total'])), _r('CET', '${n(s['cet']).toStringAsFixed(2).replaceAll('.', ',')}% a.m.'),
        ])),
        const SizedBox(height: 18),
        Field('Para que você vai usar o dinheiro?', purpose, hint: 'Ex.: reforma da cozinha'),
        Wrap(spacing: 8, runSpacing: 8, children: [for (final c in chips) GestureDetector(onTap: () => setState(() => purpose.text = c), child: Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8), decoration: BoxDecoration(color: purpose.text == c ? C.spruce : C.paper, borderRadius: BorderRadius.circular(20), border: Border.all(color: purpose.text == c ? C.spruce : C.line)), child: Text(c, style: T(13, w: FontWeight.w700, color: purpose.text == c ? Colors.white : C.ink2))))]),
        const SizedBox(height: 18),
        if (kyc != 'aprovado' && kyc != 'em_analise') Card2(color: C.amberSoft, border: false, child: Text('Antes de enviar, complete a verificação de identidade em Perfil. Sem ela não conseguimos analisar o pedido.', style: T(13, color: const Color(0xFF8A5214), w: FontWeight.w600, h: 1.4))),
        const SizedBox(height: 14),
        GestureDetector(onTap: () => setState(() => agree = !agree), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          AnimatedContainer(duration: const Duration(milliseconds: 150), width: 22, height: 22, decoration: BoxDecoration(color: agree ? C.spruce : C.paper, borderRadius: BorderRadius.circular(6), border: Border.all(color: agree ? C.spruce : C.line, width: 1.5)), child: agree ? const LIcon(Ic.check, size: 16, color: Colors.white, stroke: 2.4) : null),
          const SizedBox(width: 12), Expanded(child: Text('Autorizo a Lastro a analisar meus dados e documentos para fins de crédito, conforme a Política de Privacidade.', style: T(13.5, color: C.ink2, h: 1.4))),
        ])),
        if (err != null) Padding(padding: const EdgeInsets.only(top: 14), child: Text(err!, style: T(13.5, w: FontWeight.w600, color: C.bad, h: 1.4))),
        const SizedBox(height: 18),
        Btn('Enviar solicitação', onTap: agree ? send : null, busy: busy),
      ]),
    );
  }

  Widget _success(BuildContext context) => Scaffold(
        body: SafeArea(child: Padding(padding: const EdgeInsets.all(28), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          TweenAnimationBuilder<double>(tween: Tween(begin: 0, end: 1), duration: const Duration(milliseconds: 600), curve: Curves.elasticOut, builder: (_, v, __) => Transform.scale(scale: v, child: Container(width: 84, height: 84, decoration: const BoxDecoration(color: C.mintSoft, shape: BoxShape.circle), alignment: Alignment.center, child: const LIcon(Ic.check, size: 40, color: Color(0xFF14664A), stroke: 3)))),
          const SizedBox(height: 26),
          Text('Solicitação enviada', style: T(26, w: FontWeight.w800, ls: -.5)), const SizedBox(height: 8),
          Text('Nossa equipe vai analisar seu pedido de ${brl(widget.sim['principal'])}. Você recebe uma notificação assim que houver decisão.', textAlign: TextAlign.center, style: T(14.5, color: C.mut, h: 1.45)),
          const SizedBox(height: 30),
          Btn('Voltar ao início', onTap: () => Navigator.of(context).popUntil((r) => r.isFirst)),
        ]))),
      );

  Widget _r(String k, String v, {bool big = false}) => Padding(padding: const EdgeInsets.symmetric(vertical: 7), child: Row(children: [Text(k, style: T(14, color: C.mut, w: FontWeight.w600)), const Spacer(), Text(v, style: T(big ? 20 : 14.5, w: FontWeight.w800, num: true))]));
}
