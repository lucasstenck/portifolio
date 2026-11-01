import 'package:flutter/material.dart';
import 'theme.dart';
import 'store.dart';
import 'home.dart';
import 'loans.dart';
import 'pix.dart';
import 'history.dart';
import 'profile.dart';

class Shell extends StatefulWidget {
  final Future<void> Function() onLogout;
  const Shell({super.key, required this.onLogout});
  @override State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int tab = 0;
  @override
  void initState() { super.initState(); store.load(); }

  void go(int i) => setState(() => tab = i);

  @override
  Widget build(BuildContext context) {
    final pages = [HomeTab(go: go), const LoansTab(), const PayTab(), const HistoryTab(), ProfileTab(onLogout: widget.onLogout)];
    return Scaffold(
      body: SafeArea(bottom: false, child: IndexedStack(index: tab, children: pages)),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(color: C.paper, border: Border(top: BorderSide(color: C.line))),
        child: SafeArea(top: false, child: SizedBox(height: 64, child: Row(children: [
          _item(0, Ic.home, 'Início'), _item(1, Ic.loans, 'Contratos'), _item(2, Ic.pix, 'Pagar'), _item(3, Ic.history, 'Extrato'), _item(4, Ic.user, 'Perfil'),
        ]))),
      ),
    );
  }

  Widget _item(int i, Ic ic, String label) {
    final on = tab == i;
    return Expanded(
      child: InkResponse(
        onTap: () => go(i), radius: 36,
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 220), curve: Curves.easeOutCubic, width: 46, height: 28,
            decoration: BoxDecoration(color: on ? C.mintSoft : Colors.transparent, borderRadius: BorderRadius.circular(14)),
            alignment: Alignment.center, child: LIcon(ic, size: 21, color: on ? C.spruce : C.mut, stroke: on ? 2 : 1.7),
          ),
          const SizedBox(height: 3),
          Text(label, style: T(11, w: on ? FontWeight.w800 : FontWeight.w600, color: on ? C.spruce : C.mut)),
        ]),
      ),
    );
  }
}
