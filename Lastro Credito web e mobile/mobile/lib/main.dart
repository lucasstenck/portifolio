import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'api.dart';
import 'theme.dart';
import 'auth.dart';
import 'shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('pt_BR');
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(statusBarColor: Colors.transparent, statusBarIconBrightness: Brightness.dark));
  runApp(const LastroApp());
}

class LastroApp extends StatelessWidget {
  const LastroApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Lastro', debugShowCheckedModeBanner: false, theme: buildTheme(),
        builder: (c, child) => Container(color: C.sand, alignment: Alignment.topCenter, child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 520), child: child)),
        home: const Root(),
      );
}

class Root extends StatefulWidget {
  const Root({super.key});
  @override State<Root> createState() => _RootState();
}

class _RootState extends State<Root> {
  Widget? page;
  @override
  void initState() {
    super.initState();
    Api.onExpired = () { if (mounted) setState(() => page = Welcome(onDone: _enter)); };
    _boot();
  }
  Future<void> _boot() async {
    final started = DateTime.now();
    final ok = await Api.restore();
    final wait = 1500 - DateTime.now().difference(started).inMilliseconds;
    if (wait > 0) await Future.delayed(Duration(milliseconds: wait));
    if (!mounted) return;
    setState(() => page = ok && Api.user?['role'] == 'client' ? Shell(onLogout: _out) : Welcome(onDone: _enter));
  }
  void _enter() => setState(() => page = Shell(onLogout: _out));
  Future<void> _out() async { await Api.logout(); if (mounted) setState(() => page = Welcome(onDone: _enter)); }

  @override
  Widget build(BuildContext context) => AnimatedSwitcher(duration: const Duration(milliseconds: 350), child: page ?? const Splash());
}

class Splash extends StatefulWidget {
  const Splash({super.key});
  @override State<Splash> createState() => _SplashState();
}

class _SplashState extends State<Splash> with SingleTickerProviderStateMixin {
  late final AnimationController a = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..forward();
  @override void dispose() { a.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: C.spruce,
        body: Stack(children: [
          Positioned(right: -90, top: -60, child: _ring(300, .06)),
          Positioned(left: -120, bottom: -100, child: _ring(340, .05)),
          Center(
            child: AnimatedBuilder(
              animation: a,
              builder: (_, __) {
                final t = Curves.easeOutCubic.transform(a.value.clamp(0, 1));
                final t2 = Curves.easeOut.transform(((a.value - .35) / .65).clamp(0, 1));
                return Column(mainAxisSize: MainAxisSize.min, children: [
                  Opacity(opacity: t, child: Transform.scale(scale: .82 + .18 * t, child: const Logo(size: 76, light: true))),
                  const SizedBox(height: 22),
                  Opacity(opacity: t2, child: Transform.translate(offset: Offset(0, 8 * (1 - t2)), child: Column(children: [
                    Text('lastro', style: T(36, w: FontWeight.w800, color: Colors.white, ls: -1)),
                    const SizedBox(height: 4),
                    Text('CRÉDITO COM CLAREZA', style: T(11.5, w: FontWeight.w700, color: const Color(0xFF7FB6A4), ls: 2.4)),
                  ]))),
                ]);
              },
            ),
          ),
          Positioned(left: 0, right: 0, bottom: 38, child: Center(child: Text('Uma criação Oryveen • ambiente de demonstração', style: T(12, color: const Color(0xFF6F968A))))),
        ]),
      );
  Widget _ring(double s, double o) => Container(width: s, height: s, decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.white.withValues(alpha: o), width: 38)));
}
