import 'package:flutter/foundation.dart';
import 'api.dart';

/// Estado compartilhado do cliente. Uma única fonte para as abas; recarregada após ações.
class Store extends ChangeNotifier {
  Map<String, dynamic> me = {}, customer = {}, summary = {};
  List<Map<String, dynamic>> loans = [], payments = [], notifications = [], offers = [], documents = [];
  int unread = 0;
  bool loading = true; String? error;

  static List<Map<String, dynamic>> _l(dynamic v) => (v as List? ?? []).map((e) => (e as Map).cast<String, dynamic>()).toList();

  Future<void> load({bool silent = false}) async {
    if (!silent) { loading = true; error = null; notifyListeners(); }
    try {
      final r = await Future.wait([Api.get('/api/me'), Api.get('/api/loans'), Api.get('/api/payments'), Api.get('/api/me/renegotiations'), Api.get('/api/notifications')]);
      me = (r[0]['user'] as Map).cast<String, dynamic>(); customer = (r[0]['customer'] as Map? ?? {}).cast<String, dynamic>(); documents = _l(r[0]['documents']); unread = r[0]['unread'] ?? 0;
      loans = _l(r[1]['loans']); summary = (r[1]['summary'] as Map).cast<String, dynamic>(); payments = _l(r[2]['payments']); offers = _l(r[3]['offers']); notifications = _l(r[4]['notifications']);
      error = null;
    } on ApiError catch (e) { error = e.message; }
    loading = false; notifyListeners();
  }

  List<Map<String, dynamic>> get active => loans.where((l) => l['status'] == 'ativo').toList();
  Map<String, dynamic>? get pending => loans.cast<Map<String, dynamic>?>().firstWhere((l) => ['pendente', 'em_analise', 'aprovado', 'assinatura'].contains(l!['status']), orElse: () => null);
  /// Próxima parcela em aberto entre todos os contratos ativos (a mais antiga/atrasada primeiro).
  Map<String, dynamic>? get nextDue {
    Map<String, dynamic>? best;
    for (final l in active) {
      final nx = l['next'] as Map?; if (nx == null) continue;
      if (best == null || '${nx['due_date']}'.compareTo('${best['due_date']}') < 0) best = {...nx.cast<String, dynamic>(), 'loan_id': l['id']};
    }
    return best;
  }
  String get firstName => ('${me['name'] ?? ''}'.split(' ').firstOrNull) ?? '';
  String get kyc => '${customer['kyc_status'] ?? 'incompleto'}';
}

final store = Store();
