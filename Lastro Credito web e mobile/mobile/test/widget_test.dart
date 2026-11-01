import 'package:flutter_test/flutter_test.dart';
import 'package:lastro/theme.dart';

void main() {
  test('formata valores em reais no padrão brasileiro', () {
    expect(brl(1234.5), 'R\$ 1.234,50');
    expect(brl0(5000), 'R\$ 5.000');
    expect(brl(null), 'R\$ 0,00');
  });

  test('converte números vindos da API como texto (NUMERIC do PostgreSQL)', () {
    expect(n('569.92'), 569.92);
    expect(n(null), 0);
    expect(n(12), 12);
  });

  test('formata datas ISO sem deslocar o dia', () {
    expect(dmy('2026-03-14'), '14/03/2026');
    expect(dmy(null), '—');
  });
}
