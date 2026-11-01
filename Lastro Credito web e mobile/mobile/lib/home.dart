import 'package:flutter/material.dart';
import 'auth.dart';
import 'theme.dart';
import 'store.dart';
import 'loans.dart';
import 'pix.dart';
import 'simulate.dart';
import 'profile.dart';

class HomeTab extends StatelessWidget {
  final void Function(int) go;
  const HomeTab({super.key, required this.go});

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: store,
        builder: (context, _) {
          if (store.loading && store.me.isEmpty) return const _HomeSkeleton();
          if (store.error != null && store.me.isEmpty) return ErrorState(store.error!, store.load);
          return RefreshIndicator(
            color: C.spruce, onRefresh: () => store.load(silent: true),
            child: ListView(padding: const EdgeInsets.only(bottom: 28), children: [
              _header(context), _hero(context),
              ..._alerts(context),
              _quick(context),
              ..._loansSection(context),
              ..._recent(context),
            ]),
          );
        },
      );

  Widget _header(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 12, 14),
        child: Row(children: [
          Container(width: 42, height: 42, decoration: BoxDecoration(color: C.spruce, borderRadius: BorderRadius.circular(13)), alignment: Alignment.center, child: Text(store.firstName.isEmpty ? '' : store.firstName[0], style: T(18, w: FontWeight.w800, color: C.mint))),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Olá, ${store.firstName}', style: T(19, w: FontWeight.w800, ls: -.3)), Text(_greet(), style: T(12.5, color: C.mut))])),
          IconButton(
            onPressed: () async { await Navigator.push(context, slide(const NotificationsPage())); store.load(silent: true); },
            icon: Stack(clipBehavior: Clip.none, children: [const LIcon(Ic.bell, size: 25), if (store.unread > 0) Positioned(right: -3, top: -3, child: Container(padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1), decoration: BoxDecoration(color: C.bad, borderRadius: BorderRadius.circular(10), border: Border.all(color: C.sand, width: 2)), child: Text('${store.unread}', style: T(10, w: FontWeight.w800, color: Colors.white))))]),
          ),
        ]),
      );
  String _greet() { final h = DateTime.now().hour; return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }

  Widget _hero(BuildContext context) {
    final out = n(store.summary['outstanding']), over = n(store.summary['overdue']), nx = store.nextDue;
    final late = nx != null && (pd(nx['due_date'])?.isBefore(DateTime.now().subtract(const Duration(days: 1))) ?? false);
    final total = store.active.fold<num>(0, (a, l) => a + n(l['total_amount'])), paid = store.active.fold<num>(0, (a, l) => a + n(l['paid_count']) * n(l['installment_value']));
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Container(
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(color: C.spruce, borderRadius: BorderRadius.circular(24), boxShadow: [BoxShadow(color: C.spruce.withValues(alpha: .25), blurRadius: 24, offset: const Offset(0, 12))]),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('SALDO DEVEDOR (PRINCIPAL)', style: T(11, w: FontWeight.w700, color: const Color(0xFF7FB6A4), ls: 1.4)),
          const SizedBox(height: 6),
          Text(brl(out), style: T(36, w: FontWeight.w800, color: Colors.white, ls: -1, num: true)),
          const SizedBox(height: 16),
          if (total > 0) ClipRRect(borderRadius: BorderRadius.circular(6), child: LinearProgressIndicator(value: (paid / total).clamp(0, 1).toDouble(), minHeight: 6, backgroundColor: Colors.white12, color: C.mint)),
          if (total > 0) Padding(padding: const EdgeInsets.only(top: 8), child: Text('${(paid / total * 100).round()}% do total já pago', style: T(12, color: const Color(0xFF9CC0B5)))),
          const SizedBox(height: 18),
          if (nx != null) Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: .07), borderRadius: BorderRadius.circular(16)),
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(late ? 'PARCELA EM ATRASO' : 'PRÓXIMA PARCELA', style: T(10.5, w: FontWeight.w700, color: late ? const Color(0xFFFFB4A6) : const Color(0xFF7FB6A4), ls: 1.2)),
                const SizedBox(height: 3),
                Text(brl(nx['amount']), style: T(20, w: FontWeight.w800, color: Colors.white, num: true)),
                Text('${late ? 'Venceu' : 'Vence'} ${dm(nx['due_date'])} · parcela ${nx['n']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: T(12.5, color: const Color(0xFF9CC0B5))),
              ])),
              SizedBox(width: 118, child: Btn('Pagar', mint: true, icon: Ic.pix, onTap: () => Navigator.push(context, slide(PixPage(loanId: n(nx['loan_id']).toInt(), installmentId: null))))),
            ]),
          ) else Text(store.pending != null ? 'Sua solicitação está em andamento.' : 'Você não tem parcelas em aberto.', style: T(14, color: const Color(0xFF9CC0B5))),
          if (over > 0) Padding(padding: const EdgeInsets.only(top: 12), child: Text('${brl(over)} em atraso, sem encargos', style: T(12.5, w: FontWeight.w700, color: const Color(0xFFFFB4A6)))),
        ]),
      ),
    );
  }

  List<Widget> _alerts(BuildContext context) {
    final out = <Widget>[];
    if (store.offers.isNotEmpty) {
      final o = store.offers.first;
      out.add(Padding(padding: const EdgeInsets.fromLTRB(20, 14, 20, 0), child: Card2(color: C.amberSoft, border: false, onTap: () => Navigator.push(context, slide(const OffersPage())), child: Row(children: [
        Container(width: 40, height: 40, decoration: BoxDecoration(color: C.amber.withValues(alpha: .18), borderRadius: BorderRadius.circular(12)), alignment: Alignment.center, child: const LIcon(Ic.doc, color: C.amber)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Proposta de acordo disponível', style: T(14.5, w: FontWeight.w800)), Text('${o['terms']}× de ${brl(o['installment_value'])}${n(o['discount']) > 0 ? ' com ${brl(o['discount'])} de desconto' : ''}', style: T(12.5, color: C.ink2))])),
        const LIcon(Ic.arrowR, size: 18, color: C.amber),
      ]))));
    }
    final p = store.pending;
    if (p != null) {
      final st = '${p['status']}';
      out.add(Padding(padding: const EdgeInsets.fromLTRB(20, 14, 20, 0), child: Card2(onTap: () => Navigator.push(context, slide(LoanDetailPage(id: n(p['id']).toInt()))), child: Row(children: [
        Container(width: 40, height: 40, decoration: BoxDecoration(color: C.infoSoft, borderRadius: BorderRadius.circular(12)), alignment: Alignment.center, child: LIcon(st == 'assinatura' ? Ic.doc : Ic.history, color: C.info)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(st == 'assinatura' ? 'Contrato pronto para assinar' : 'Solicitação de ${brl0(p['principal'])} em análise', style: T(14.5, w: FontWeight.w800)),
          Text(st == 'assinatura' ? 'Revise e assine para receber o valor.' : 'Nossa equipe responde em até 1 dia útil.', style: T(12.5, color: C.mut)),
        ])),
        const LIcon(Ic.arrowR, size: 18, color: C.mut),
      ]))));
    }
    if (store.kyc != 'aprovado') {
      final em = store.kyc == 'em_analise', rec = store.kyc == 'recusado';
      out.add(Padding(padding: const EdgeInsets.fromLTRB(20, 14, 20, 0), child: Card2(onTap: () => Navigator.push(context, slide(const KycPage())), child: Row(children: [
        Container(width: 40, height: 40, decoration: BoxDecoration(color: rec ? C.badSoft : C.mintSoft, borderRadius: BorderRadius.circular(12)), alignment: Alignment.center, child: LIcon(Ic.shield, color: rec ? C.bad : C.spruce)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(em ? 'Identidade em análise' : rec ? 'Verificação não aprovada' : 'Verifique sua identidade', style: T(14.5, w: FontWeight.w800)),
          Text(em ? 'Avisaremos assim que terminar.' : rec ? 'Veja o motivo e reenvie.' : 'Necessário para solicitar crédito.', style: T(12.5, color: C.mut)),
        ])),
        const LIcon(Ic.arrowR, size: 18, color: C.mut),
      ]))));
    }
    return out;
  }

  Widget _quick(BuildContext context) {
    Widget a(Ic ic, String t, VoidCallback f) => Expanded(child: GestureDetector(onTap: f, child: Column(children: [
          Container(width: 58, height: 58, decoration: BoxDecoration(color: C.paper, borderRadius: BorderRadius.circular(18), border: Border.all(color: C.line)), alignment: Alignment.center, child: LIcon(ic, size: 24, color: C.spruce)),
          const SizedBox(height: 7), Text(t, style: T(12, w: FontWeight.w700, color: C.ink2), textAlign: TextAlign.center),
        ])));
    return Padding(padding: const EdgeInsets.fromLTRB(20, 22, 20, 0), child: Row(children: [
      a(Ic.loans, 'Simular', () => Navigator.push(context, slide(const SimulatePage()))),
      a(Ic.calendar, 'Calendário', () => Navigator.push(context, slide(const CalendarPage()))),
      a(Ic.receipt, 'Recibos', () => go(3)),
      a(Ic.support, 'Ajuda', () => Navigator.push(context, slide(const SupportPage()))),
    ]));
  }

  List<Widget> _loansSection(BuildContext context) {
    final act = store.active;
    return [
      SectionTitle('Meus contratos', trailing: GestureDetector(onTap: () => go(1), child: Text('Ver todos', style: T(13, w: FontWeight.w700, color: C.mut)))),
      if (act.isEmpty) Pad(Card2(child: EmptyState(Ic.loans, 'Nenhum contrato ativo', 'Simule um valor e veja as condições antes de solicitar.', action: SizedBox(width: 190, child: Btn('Simular empréstimo', onTap: () => Navigator.push(context, slide(const SimulatePage()))))))),
      for (final l in act) Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 10), child: LoanCard(l)),
    ];
  }

  List<Widget> _recent(BuildContext context) {
    if (store.payments.isEmpty) return [];
    return [
      SectionTitle('Últimos pagamentos', trailing: GestureDetector(onTap: () => go(3), child: Text('Extrato', style: T(13, w: FontWeight.w700, color: C.mut)))),
      Pad(Card2(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(children: [for (var i = 0; i < store.payments.take(3).length; i++) PaymentRow(store.payments[i], last: i == 2 || i == store.payments.length - 1)]))),
    ];
  }
}

class _HomeSkeleton extends StatelessWidget {
  const _HomeSkeleton();
  @override
  Widget build(BuildContext context) => const Padding(padding: EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(height: 14), Row(children: [Skel(h: 42, w: 42, r: 13), SizedBox(width: 12), Skel(h: 20, w: 140)]), SizedBox(height: 20), Skel(h: 210, r: 24), SizedBox(height: 22), Row(children: [Expanded(child: Skel(h: 58, r: 18)), SizedBox(width: 12), Expanded(child: Skel(h: 58, r: 18)), SizedBox(width: 12), Expanded(child: Skel(h: 58, r: 18))]), SizedBox(height: 26), Skel(h: 110, r: 18),
      ]));
}
