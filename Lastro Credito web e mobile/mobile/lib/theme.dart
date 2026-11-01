import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class C {
  static const spruce = Color(0xFF0F2F2B);
  static const spruce2 = Color(0xFF16403A);
  static const mint = Color(0xFF4FC79B);
  static const mintSoft = Color(0xFFDDF4EA);
  static const sand = Color(0xFFF5F3EE);
  static const paper = Colors.white;
  static const ink = Color(0xFF10201D);
  static const ink2 = Color(0xFF3B4C48);
  static const mut = Color(0xFF6B7A76);
  static const faint = Color(0xFFA3ADA9);
  static const line = Color(0xFFE4E1D8);
  static const line2 = Color(0xFFEEECE4);
  static const amber = Color(0xFFC0792A);
  static const amberSoft = Color(0xFFF8EBD6);
  static const bad = Color(0xFFB3382A);
  static const badSoft = Color(0xFFF7E1DC);
  static const info = Color(0xFF2F6A8F);
  static const infoSoft = Color(0xFFDDEBF4);
}

TextStyle T(double size, {FontWeight w = FontWeight.w500, Color color = C.ink, double? h, double? ls, bool num = false}) => TextStyle(
      fontFamily: 'Manrope',
      fontSize: size,
      fontWeight: w,
      color: color,
      height: h,
      letterSpacing: ls,
      fontVariations: [FontVariation('wght', w.value.toDouble())],
      fontFeatures: num ? const [FontFeature.tabularFigures()] : null,
    );

final _brl = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$', decimalDigits: 2);
String brl(num? v) => _brl.format(v ?? 0).replaceAll(' ', ' ');
String brl0(num? v) => NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$', decimalDigits: 0).format(v ?? 0).replaceAll(' ', ' ');
num n(dynamic v) => v is num ? v : (num.tryParse('$v') ?? 0);
DateTime? pd(dynamic s) => s == null ? null : DateTime.tryParse('$s')?.toLocal();
String dmy(dynamic s) { final d = pd(s); return d == null ? '—' : DateFormat('dd/MM/yyyy').format(d); }
String dm(dynamic s) { final d = pd(s); return d == null ? '—' : DateFormat('dd MMM', 'pt_BR').format(d).replaceAll('.', ''); }
const periodNames = {'diaria': 'diária', 'semanal': 'semanal', 'mensal': 'mensal'};

ThemeData buildTheme() => ThemeData(
      useMaterial3: true,
      fontFamily: 'Manrope',
      scaffoldBackgroundColor: C.sand,
      colorScheme: ColorScheme.fromSeed(seedColor: C.spruce, primary: C.spruce, secondary: C.mint, surface: C.paper),
      splashFactory: InkRipple.splashFactory,
      textSelectionTheme: const TextSelectionThemeData(cursorColor: C.spruce),
    );

/// Ícones próprios da marca, desenhados em traço (24×24).
enum Ic { home, loans, pix, history, user, bell, calendar, shield, doc, arrowR, arrowUp, check, back, plus, camera, lock, support, close, receipt, qr }

class LIcon extends StatelessWidget {
  final Ic ic; final double size; final Color color; final double stroke;
  const LIcon(this.ic, {super.key, this.size = 22, this.color = C.ink, this.stroke = 1.8});
  @override
  Widget build(BuildContext context) => CustomPaint(size: Size(size, size), painter: _IconPainter(ic, color, stroke));
}

class _IconPainter extends CustomPainter {
  final Ic ic; final Color color; final double sw;
  _IconPainter(this.ic, this.color, this.sw);
  @override
  void paint(Canvas c, Size s) {
    final k = s.width / 24;
    c.scale(k);
    final p = Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = sw..strokeCap = StrokeCap.round..strokeJoin = StrokeJoin.round;
    Path path() => Path();
    RRect rr(double x, double y, double w, double h, double r) => RRect.fromRectAndRadius(Rect.fromLTWH(x, y, w, h), Radius.circular(r));
    switch (ic) {
      case Ic.home:
        c.drawPath(path()..moveTo(4, 11)..lineTo(12, 4)..lineTo(20, 11)..lineTo(20, 20)..lineTo(14.5, 20)..lineTo(14.5, 14)..lineTo(9.5, 14)..lineTo(9.5, 20)..lineTo(4, 20)..close(), p);
      case Ic.loans:
        c.drawRRect(rr(3, 6, 18, 12, 2.5), p); c.drawCircle(const Offset(12, 12), 2.6, p);
        c.drawLine(const Offset(6.5, 9), const Offset(6.5, 9.01), p); c.drawLine(const Offset(17.5, 15), const Offset(17.5, 15.01), p);
      case Ic.pix:
        c.save(); c.translate(12, 12); c.rotate(math.pi / 4);
        c.drawRRect(rr(-6.2, -6.2, 12.4, 12.4, 2.2), p); c.restore();
        c.drawLine(const Offset(8.4, 8.4), const Offset(15.6, 15.6), p); c.drawLine(const Offset(15.6, 8.4), const Offset(14.2, 9.8), p);
      case Ic.history:
        c.drawArc(const Rect.fromLTWH(3.5, 3.5, 17, 17), math.pi * 0.2, math.pi * 1.65, false, p);
        c.drawPath(path()..moveTo(12, 8)..lineTo(12, 12.3)..lineTo(15, 14), p); c.drawPath(path()..moveTo(3.2, 4)..lineTo(3.6, 8.4)..lineTo(8, 8), p);
      case Ic.user:
        c.drawCircle(const Offset(12, 8.3), 3.7, p); c.drawPath(path()..moveTo(4.5, 20)..cubicTo(4.5, 14.5, 19.5, 14.5, 19.5, 20), p);
      case Ic.bell:
        c.drawPath(path()..moveTo(6, 16.5)..lineTo(6, 11)..cubicTo(6, 4.5, 18, 4.5, 18, 11)..lineTo(18, 16.5)..lineTo(20, 18.5)..lineTo(4, 18.5)..close(), p);
        c.drawPath(path()..moveTo(10, 21)..lineTo(14, 21), p);
      case Ic.calendar:
        c.drawRRect(rr(3.5, 5, 17, 15.5, 2.5), p); c.drawLine(const Offset(3.5, 10), const Offset(20.5, 10), p);
        c.drawLine(const Offset(8, 3), const Offset(8, 7), p); c.drawLine(const Offset(16, 3), const Offset(16, 7), p);
      case Ic.shield:
        c.drawPath(path()..moveTo(12, 3)..lineTo(19.5, 6)..lineTo(19.5, 12)..cubicTo(19.5, 16.5, 16, 19.7, 12, 21)..cubicTo(8, 19.7, 4.5, 16.5, 4.5, 12)..lineTo(4.5, 6)..close(), p);
        c.drawPath(path()..moveTo(8.8, 12)..lineTo(11, 14.2)..lineTo(15.4, 9.8), p);
      case Ic.doc:
        c.drawPath(path()..moveTo(14, 3)..lineTo(6.5, 3)..quadraticBezierTo(4.5, 3, 4.5, 5)..lineTo(4.5, 19)..quadraticBezierTo(4.5, 21, 6.5, 21)..lineTo(17.5, 21)..quadraticBezierTo(19.5, 21, 19.5, 19)..lineTo(19.5, 8.5)..close(), p);
        c.drawPath(path()..moveTo(14, 3)..lineTo(14, 8.5)..lineTo(19.5, 8.5), p); c.drawLine(const Offset(8, 13), const Offset(16, 13), p); c.drawLine(const Offset(8, 16.5), const Offset(13, 16.5), p);
      case Ic.arrowR:
        c.drawPath(path()..moveTo(5, 12)..lineTo(19, 12)..moveTo(13, 6)..lineTo(19, 12)..lineTo(13, 18), p);
      case Ic.arrowUp:
        c.drawPath(path()..moveTo(7, 17)..lineTo(17, 7)..moveTo(9, 7)..lineTo(17, 7)..lineTo(17, 15), p);
      case Ic.check:
        c.drawPath(path()..moveTo(5, 12.5)..lineTo(10, 17.5)..lineTo(19, 7), p);
      case Ic.back:
        c.drawPath(path()..moveTo(19, 12)..lineTo(5, 12)..moveTo(11, 6)..lineTo(5, 12)..lineTo(11, 18), p);
      case Ic.plus:
        c.drawPath(path()..moveTo(12, 5)..lineTo(12, 19)..moveTo(5, 12)..lineTo(19, 12), p);
      case Ic.camera:
        c.drawPath(path()..moveTo(4, 8)..lineTo(8, 8)..lineTo(9.5, 5.5)..lineTo(14.5, 5.5)..lineTo(16, 8)..lineTo(20, 8)..lineTo(20, 19)..lineTo(4, 19)..close(), p); c.drawCircle(const Offset(12, 13), 3.4, p);
      case Ic.lock:
        c.drawRRect(rr(5, 10.5, 14, 10, 2.5), p); c.drawPath(path()..moveTo(8, 10.5)..lineTo(8, 8)..cubicTo(8, 2.5, 16, 2.5, 16, 8)..lineTo(16, 10.5), p);
      case Ic.support:
        c.drawPath(path()..moveTo(4, 6.5)..quadraticBezierTo(4, 4.5, 6, 4.5)..lineTo(18, 4.5)..quadraticBezierTo(20, 4.5, 20, 6.5)..lineTo(20, 14.5)..quadraticBezierTo(20, 16.5, 18, 16.5)..lineTo(10, 16.5)..lineTo(6, 20)..lineTo(6, 16.5)..quadraticBezierTo(4, 16.5, 4, 14.5)..close(), p);
      case Ic.close:
        c.drawPath(path()..moveTo(6, 6)..lineTo(18, 18)..moveTo(18, 6)..lineTo(6, 18), p);
      case Ic.receipt:
        c.drawPath(path()..moveTo(6, 3.5)..lineTo(18, 3.5)..lineTo(18, 20.5)..lineTo(15, 18.7)..lineTo(12, 20.5)..lineTo(9, 18.7)..lineTo(6, 20.5)..close(), p);
        c.drawLine(const Offset(9, 8), const Offset(15, 8), p); c.drawLine(const Offset(9, 12), const Offset(15, 12), p);
      case Ic.qr:
        for (final o in const [Offset(4, 4), Offset(14, 4), Offset(4, 14)]) { c.drawRRect(rr(o.dx, o.dy, 6, 6, 1.2), p); }
        c.drawLine(const Offset(14, 14), const Offset(14.01, 14), p); c.drawLine(const Offset(20, 14), const Offset(20, 20), p); c.drawLine(const Offset(14, 20), const Offset(17, 20), p);
    }
  }
  @override
  bool shouldRepaint(_IconPainter o) => o.ic != ic || o.color != color;
}

/// Logotipo: marca em "L" sobre quadrado arredondado.
class Logo extends StatelessWidget {
  final double size; final bool light;
  const Logo({super.key, this.size = 36, this.light = false});
  @override
  Widget build(BuildContext context) => CustomPaint(size: Size(size, size), painter: _LogoPainter(light));
}
class _LogoPainter extends CustomPainter {
  final bool light; _LogoPainter(this.light);
  @override
  void paint(Canvas c, Size s) {
    final k = s.width / 32; c.scale(k);
    c.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(0, 0, 32, 32), const Radius.circular(9)), Paint()..color = light ? C.mint : C.spruce2);
    c.drawPath(Path()..moveTo(10, 22)..lineTo(10, 9)..moveTo(10, 22)..lineTo(22, 22), Paint()..color = light ? C.spruce : const Color(0xFF7EE0B5)..style = PaintingStyle.stroke..strokeWidth = 3.2..strokeCap = StrokeCap.round);
  }
  @override
  bool shouldRepaint(_LogoPainter o) => false;
}

/* ---------- componentes ---------- */

class Pad extends StatelessWidget { final Widget child; const Pad(this.child, {super.key}); @override Widget build(BuildContext c) => Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: child); }

class Card2 extends StatelessWidget {
  final Widget child; final EdgeInsets padding; final VoidCallback? onTap; final Color color; final bool border;
  const Card2({super.key, required this.child, this.padding = const EdgeInsets.all(18), this.onTap, this.color = C.paper, this.border = true});
  @override
  Widget build(BuildContext context) => Material(
        color: color, borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18), onTap: onTap,
          child: Ink(
            padding: padding,
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), border: border ? Border.all(color: C.line) : null),
            child: child,
          ),
        ),
      );
}

class Pill extends StatelessWidget {
  final String text; final Color bg; final Color fg;
  const Pill(this.text, {super.key, this.bg = C.line2, this.fg = C.ink2});
  factory Pill.ok(String t) => Pill(t, bg: C.mintSoft, fg: const Color(0xFF14664A));
  factory Pill.warn(String t) => Pill(t, bg: C.amberSoft, fg: const Color(0xFF8A5214));
  factory Pill.bad(String t) => Pill(t, bg: C.badSoft, fg: C.bad);
  factory Pill.info(String t) => Pill(t, bg: C.infoSoft, fg: C.info);
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4), decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)), child: Text(text, style: T(11.5, w: FontWeight.w700, color: fg)));
}

class Btn extends StatefulWidget {
  final String label; final VoidCallback? onTap; final bool ghost; final bool busy; final Ic? icon; final bool danger; final bool mint;
  const Btn(this.label, {super.key, this.onTap, this.ghost = false, this.busy = false, this.icon, this.danger = false, this.mint = false});
  @override State<Btn> createState() => _BtnState();
}
class _BtnState extends State<Btn> {
  bool down = false;
  @override
  Widget build(BuildContext context) {
    final off = widget.onTap == null || widget.busy;
    final bg = widget.ghost ? Colors.transparent : widget.mint ? C.mint : widget.danger ? C.bad : C.spruce;
    final fg = widget.ghost ? C.ink : widget.mint ? C.spruce : Colors.white;
    return GestureDetector(
      onTapDown: (_) => setState(() => down = true), onTapUp: (_) => setState(() => down = false), onTapCancel: () => setState(() => down = false),
      onTap: off ? null : widget.onTap,
      child: AnimatedScale(
        scale: down ? .975 : 1, duration: const Duration(milliseconds: 110), curve: Curves.easeOut,
        child: AnimatedOpacity(
          opacity: off && !widget.busy ? .45 : 1, duration: const Duration(milliseconds: 150),
          child: Container(
            height: 52, alignment: Alignment.center,
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14), border: widget.ghost ? Border.all(color: C.line) : null),
            child: widget.busy
                ? SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2, color: fg))
                : Row(mainAxisSize: MainAxisSize.min, children: [if (widget.icon != null) ...[LIcon(widget.icon!, size: 18, color: fg), const SizedBox(width: 8)], Text(widget.label, style: T(15.5, w: FontWeight.w700, color: fg))]),
          ),
        ),
      ),
    );
  }
}

class Field extends StatelessWidget {
  final String label; final TextEditingController ctl; final String? hint; final bool obscure; final TextInputType? type; final String? error; final int? maxLength; final ValueChanged<String>? onChanged; final String? prefix; final int lines;
  const Field(this.label, this.ctl, {super.key, this.hint, this.obscure = false, this.type, this.error, this.maxLength, this.onChanged, this.prefix, this.lines = 1});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: T(12.5, w: FontWeight.w700, color: C.ink2)),
          const SizedBox(height: 6),
          TextField(
            controller: ctl, obscureText: obscure, keyboardType: type, maxLength: maxLength, onChanged: onChanged, minLines: lines, maxLines: lines,
            style: T(16, w: FontWeight.w600),
            decoration: InputDecoration(
              counterText: '', hintText: hint, hintStyle: T(16, color: C.faint), prefixText: prefix, prefixStyle: T(16, w: FontWeight.w600, color: C.mut),
              filled: true, fillColor: C.paper, contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: error != null ? C.bad : C.line)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: error != null ? C.bad : C.spruce, width: 1.6)),
            ),
          ),
          if (error != null) Padding(padding: const EdgeInsets.only(top: 5), child: Text(error!, style: T(12.5, w: FontWeight.w600, color: C.bad))),
        ]),
      );
}

class Skel extends StatefulWidget {
  final double h; final double? w; final double r;
  const Skel({super.key, this.h = 16, this.w, this.r = 8});
  @override State<Skel> createState() => _SkelState();
}
class _SkelState extends State<Skel> with SingleTickerProviderStateMixin {
  late final AnimationController a = AnimationController(vsync: this, duration: const Duration(milliseconds: 1300))..repeat();
  @override void dispose() { a.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: a,
        builder: (_, __) => Container(
          height: widget.h, width: widget.w,
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(widget.r), gradient: LinearGradient(begin: Alignment(-1 + a.value * 3, 0), end: Alignment(a.value * 3, 0), colors: const [Color(0xFFEAE7DE), Color(0xFFF4F2EB), Color(0xFFEAE7DE)])),
        ),
      );
}

class EmptyState extends StatelessWidget {
  final Ic icon; final String title; final String text; final Widget? action;
  const EmptyState(this.icon, this.title, this.text, {super.key, this.action});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 38, horizontal: 28),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 54, height: 54, decoration: BoxDecoration(color: C.line2, borderRadius: BorderRadius.circular(16)), alignment: Alignment.center, child: LIcon(icon, color: C.mut)),
          const SizedBox(height: 14),
          Text(title, style: T(16, w: FontWeight.w700), textAlign: TextAlign.center),
          const SizedBox(height: 4),
          Text(text, style: T(13.5, color: C.mut, h: 1.4), textAlign: TextAlign.center),
          if (action != null) ...[const SizedBox(height: 16), action!],
        ]),
      );
}

class ErrorState extends StatelessWidget {
  final String message; final VoidCallback onRetry;
  const ErrorState(this.message, this.onRetry, {super.key});
  @override
  Widget build(BuildContext context) => EmptyState(Ic.shield, 'Algo não saiu como esperado', message, action: SizedBox(width: 180, child: Btn('Tentar de novo', onTap: onRetry, ghost: true)));
}

void toast(BuildContext c, String msg, {bool error = false}) {
  ScaffoldMessenger.of(c).hideCurrentSnackBar();
  ScaffoldMessenger.of(c).showSnackBar(SnackBar(
    content: Text(msg, style: T(14, w: FontWeight.w600, color: Colors.white)), backgroundColor: error ? C.bad : C.spruce, behavior: SnackBarBehavior.floating,
    margin: const EdgeInsets.fromLTRB(16, 0, 16, 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), duration: const Duration(seconds: 3),
  ));
}

class SectionTitle extends StatelessWidget {
  final String text; final Widget? trailing;
  const SectionTitle(this.text, {super.key, this.trailing});
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.fromLTRB(20, 26, 20, 12), child: Row(children: [Expanded(child: Text(text, style: T(17, w: FontWeight.w800))), if (trailing != null) trailing!]));
}

