import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class ApiError implements Exception {
  final String message; final int status; final Map<String, dynamic> fields;
  ApiError(this.message, [this.status = 0, this.fields = const {}]);
  @override String toString() => message;
}

/// Cliente HTTP da API Lastro. Tokens ficam no armazenamento seguro do sistema
/// (Keychain/Keystore; no navegador, armazenamento local do origin).
class Api {
  static const _env = String.fromEnvironment('API_URL');
  static String get base => _env.isNotEmpty ? _env : (kIsWeb ? Uri.base.origin : 'http://10.0.2.2:3300');
  static const _store = FlutterSecureStorage();
  static String? _access, _refresh;
  static Map<String, dynamic>? user;
  static void Function()? onExpired;

  static Future<bool> restore() async {
    try { _access = await _store.read(key: 'at'); _refresh = await _store.read(key: 'rt'); } catch (_) {}
    if (_refresh == null) return false;
    try { final r = await get('/api/me'); user = r['user']; return true; } catch (_) { await clear(); return false; }
  }

  static Future<void> _save(Map r) async {
    if (r['access_token'] != null) { _access = r['access_token']; _refresh = r['refresh_token'] ?? _refresh; user = (r['user'] as Map?)?.cast<String, dynamic>() ?? user; }
    try { if (_access != null) await _store.write(key: 'at', value: _access); if (_refresh != null) await _store.write(key: 'rt', value: _refresh); } catch (_) {}
  }

  static Future<void> clear() async { _access = _refresh = null; user = null; try { await _store.deleteAll(); } catch (_) {} }

  static Future<dynamic> _send(String method, String path, [Object? body, bool retry = true]) async {
    final uri = Uri.parse(base + path);
    final h = {'Content-Type': 'application/json', if (_access != null) 'Authorization': 'Bearer $_access'};
    http.Response res;
    try {
      final b = body == null ? null : jsonEncode(body);
      res = await (switch (method) { 'GET' => http.get(uri, headers: h), 'POST' => http.post(uri, headers: h, body: b ?? '{}'), 'PATCH' => http.patch(uri, headers: h, body: b), _ => http.delete(uri, headers: h) }).timeout(const Duration(seconds: 20));
    } catch (_) {
      throw ApiError('Sem conexão com o servidor. Verifique sua internet e tente de novo.');
    }
    if (res.statusCode == 401 && retry && _refresh != null && !path.startsWith('/api/auth/')) {
      final r = await http.post(Uri.parse('$base/api/auth/refresh'), headers: {'Content-Type': 'application/json'}, body: jsonEncode({'refresh_token': _refresh}));
      if (r.statusCode == 200) { await _save(jsonDecode(r.body)); return _send(method, path, body, false); }
      await clear(); onExpired?.call();
    }
    final data = res.body.isEmpty ? {} : jsonDecode(utf8.decode(res.bodyBytes));
    if (res.statusCode >= 400) throw ApiError((data is Map ? data['error'] : null) ?? 'Erro inesperado.', res.statusCode, (data is Map ? (data['errors'] as Map?)?.cast<String, dynamic>() : null) ?? {});
    return data;
  }

  static Future<Map<String, dynamic>> get(String p) async => (await _send('GET', p) as Map).cast<String, dynamic>();
  static Future<Map<String, dynamic>> post(String p, [Object? b]) async => (await _send('POST', p, b ?? {}) as Map).cast<String, dynamic>();
  static Future<Map<String, dynamic>> del(String p) async => (await _send('DELETE', p) as Map).cast<String, dynamic>();
  static Future<Map<String, dynamic>> patch(String p, Object b) async => (await _send('PATCH', p, b) as Map).cast<String, dynamic>();

  /// Retorna `mfa_token` quando a conta exige o segundo fator.
  static Future<String?> login(String email, String pw) async {
    final r = await post('/api/auth/login', {'email': email, 'password': pw});
    if (r['mfa_required'] == true) return r['mfa_token'];
    await _save(r); return null;
  }
  static Future<void> mfa(String token, String code) async => _save(await post('/api/auth/mfa', {'mfa_token': token, 'code': code}));
  static Future<void> register(Map<String, dynamic> b) async => _save(await post('/api/auth/register', b));
  static Future<void> logout() async { try { await post('/api/auth/logout'); } catch (_) {} await clear(); }
}
