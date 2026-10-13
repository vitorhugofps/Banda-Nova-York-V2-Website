<?php
/* /api/videos · últimos vídeos do canal oficial (versão PHP para a hospedagem Apache em bandanovayork.com.br).
   Mesmo contrato da função da Vercel (api/videos.js). Não usa chave de API.
   Fontes, em ordem:
   1. RSS público do canal: 15 mais recentes, com data exata. Shorts são detectados pelo link /shorts/.
   2. Página da playlist de envios do canal, quando o RSS falha.
   3. A última lista boa guardada (até 1 dia) e, por fim, assets/data/videos.json, a lista de reserva.
   Títulos curados e o vídeo em destaque vêm sempre de assets/data/videos.json.
   O formato (vertical ou horizontal) é conferido no oEmbed do YouTube pelo endereço /shorts/.
   Cache em arquivo: 30 min para a lista boa (o .htaccess bloqueia pastas que começam com ponto).
   O .htaccess manda /api/videos para cá; /api/videos.php chamado direto dá 404. */

declare(strict_types=1);

const CANAL = 'UCI7G43SicG2nEoRWxZ72fnA';
const MAXV = 15;
const MAX_BYTES = 3000000;
const TTL = 1800;          // lista boa vale 30 min
const TTL_VELHA = 86400;   // se o YouTube falhar, a última lista boa ainda serve por 1 dia
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

function responde(int $status, $corpo, string $cache): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: ' . $cache);
  header('X-Robots-Tag: noindex');
  header('X-Content-Type-Options: nosniff');
  if ($_SERVER['REQUEST_METHOD'] !== 'HEAD' && $corpo !== null) echo json_encode($corpo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($metodo !== 'GET' && $metodo !== 'HEAD') { header('Allow: GET, HEAD'); responde(405, null, 'no-store'); }
// parâmetros extras não furam o cache
if (($_SERVER['QUERY_STRING'] ?? '') !== '') { header('Location: /api/videos', true, 308); header('Cache-Control: public, max-age=86400'); exit; }

$raiz = dirname(__DIR__);
function corta(?string $t): string { $t = (string)$t; return function_exists('mb_substr') ? mb_substr($t, 0, 200, 'UTF-8') : (preg_match('/^.{0,200}/su', $t, $m) ? $m[0] : ''); }
function ponto($n): string { $n = (int)$n; return ($n > 0 && $n <= 0x10ffff && !($n >= 0xd800 && $n <= 0xdfff)) ? html_entity_decode('&#' . $n . ';', ENT_QUOTES | ENT_HTML5, 'UTF-8') : ''; }
function decodifica(?string $s): string {
  $s = (string)$s;
  $s = preg_replace('/<!\[CDATA\[([\s\S]*?)\]\]>/', '$1', $s);
  $s = preg_replace_callback('/&#(\d{1,7});/', fn($m) => ponto((int)$m[1]), $s);
  $s = preg_replace_callback('/&#x([0-9a-f]{1,6});/i', fn($m) => ponto(hexdec($m[1])), $s);
  $s = str_replace(['&quot;', '&apos;', '&lt;', '&gt;'], ['"', "'", '<', '>'], $s);
  return trim(str_replace('&amp;', '&', $s));
}

function estatico(string $raiz): array {
  $j = @file_get_contents($raiz . '/assets/data/videos.json');
  $d = $j ? json_decode($j, true) : null;
  return is_array($d) ? $d : ['v' => 1, 'items' => [], 'titles' => new stdClass(), 'featured' => null];
}

/** GET com teto de tamanho e tempo (curl quando houver; senão, stream). */
function baixa(string $url, string $accept, int $ms = 3000): string {
  $cab = ['User-Agent: ' . UA, 'Accept: ' . $accept, 'Accept-Language: en-US,en;q=0.9', 'Cookie: CONSENT=YES+cb; SOCS=CAI'];
  if (function_exists('curl_init')) {
    $ch = curl_init($url); $buf = '';
    curl_setopt_array($ch, [CURLOPT_HTTPHEADER => $cab, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 3, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
      CURLOPT_TIMEOUT_MS => $ms, CURLOPT_CONNECTTIMEOUT_MS => $ms, CURLOPT_ENCODING => '',
      CURLOPT_WRITEFUNCTION => function ($c, $d) use (&$buf) { $buf .= $d; return strlen($buf) > MAX_BYTES ? 0 : strlen($d); }]);
    $ok = curl_exec($ch); $st = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
    if ($ok === false || $st < 200 || $st >= 300) throw new RuntimeException('http ' . $st);
    return $buf;
  }
  $ctx = stream_context_create(['http' => ['header' => implode("\r\n", $cab), 'timeout' => $ms / 1000, 'ignore_errors' => false]]);
  $t = @file_get_contents($url, false, $ctx, 0, MAX_BYTES + 1);
  if ($t === false || strlen($t) > MAX_BYTES) throw new RuntimeException('falhou');
  return $t;
}

// leitura linear, no máximo MAXV * 2 entradas
function le_feed(string $xml): array {
  $out = []; $i = 0; $n = 0;
  while ($n < MAXV * 2) {
    $a = strpos($xml, '<entry>', $i); if ($a === false) break;
    $b = strpos($xml, '</entry>', $a); if ($b === false) break;
    $e = substr($xml, $a, $b + 8 - $a); $i = $b + 8; $n++;
    if (!preg_match('/<yt:videoId>([\w-]{11})<\/yt:videoId>/', $e, $m)) continue;
    preg_match('/<title>([\s\S]*?)<\/title>/', $e, $t);
    preg_match('/<published>([^<]+)<\/published>/', $e, $p);
    preg_match('/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/', $e, $h) || preg_match('/<link[^>]+href="([^"]+)"/', $e, $h);
    $out[] = ['id' => $m[1], 'title' => corta(decodifica($t[1] ?? '')), 'publishedAt' => $p[1] ?? null, 'isShort' => (bool)preg_match('#/shorts/#', $h[1] ?? '')];
  }
  return $out;
}

function texto($t): string {
  if (!$t) return '';
  if (is_string($t)) return $t;
  if (isset($t['simpleText'])) return (string)$t['simpleText'];
  if (isset($t['content'])) return (string)$t['content'];
  if (isset($t['runs']) && is_array($t['runs'])) return implode('', array_map(fn($r) => (string)($r['text'] ?? ''), $t['runs']));
  return '';
}
function data_relativa(?string $txt, int $agora): ?string {
  $un = ['second' => 1, 'minute' => 60, 'hour' => 3600, 'day' => 86400, 'week' => 604800, 'month' => 2629800, 'year' => 31557600];
  if (!preg_match('/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i', (string)$txt, $m)) return null;
  return gmdate('Y-m-d\TH:i:s.000\Z', $agora - (int)$m[1] * $un[strtolower($m[2])]);
}
// objeto JSON que começa em $html[$ini], respeitando strings
function le_json(string $html, int $ini): ?array {
  $prof = 0; $str = false; $esc = false; $n = strlen($html);
  for ($j = $ini; $j < $n; $j++) {
    $c = $html[$j];
    if ($str) { if ($esc) $esc = false; elseif ($c === '\\') $esc = true; elseif ($c === '"') $str = false; continue; }
    if ($c === '"') $str = true;
    elseif ($c === '{') $prof++;
    elseif ($c === '}' && --$prof === 0) { $d = json_decode(substr($html, $ini, $j + 1 - $ini), true); return is_array($d) ? $d : null; }
  }
  return null;
}
function le_playlist(string $html, int $agora): array {
  if (!preg_match('/ytInitialData\s*=\s*\{/', $html, $m, PREG_OFFSET_CAPTURE)) return [];
  $d = le_json($html, $m[0][1] + strlen($m[0][0]) - 1);
  $out = []; $visto = [];
  $anda = function ($o) use (&$anda, &$out, &$visto, $agora) {
    if (!is_array($o)) return;
    if (isset($o['playlistVideoRenderer']['videoId'])) {
      $pv = $o['playlistVideoRenderer']; $id = (string)$pv['videoId'];
      if (preg_match('/^[\w-]{11}$/', $id) && !isset($visto[$id])) {
        $visto[$id] = 1; $s = (int)($pv['lengthSeconds'] ?? 0);
        $out[] = ['id' => $id, 'title' => corta(texto($pv['title'] ?? '')), 'publishedAt' => data_relativa(texto($pv['videoInfo'] ?? ''), $agora),
          'isShort' => isset($pv['navigationEndpoint']['reelWatchEndpoint']) || ($s > 0 && $s <= 60)];
      }
      return;
    }
    if (isset($o['lockupViewModel']['contentId']) && preg_match('/VIDEO/', (string)($o['lockupViewModel']['contentType'] ?? ''))) {
      $lv = $o['lockupViewModel']; $id = (string)$lv['contentId'];
      if (preg_match('/^[\w-]{11}$/', $id) && !isset($visto[$id])) {
        $visto[$id] = 1; $md = $lv['metadata']['lockupMetadataViewModel'] ?? [];
        preg_match('/\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago/i', json_encode($md['metadata'] ?? []), $r);
        $out[] = ['id' => $id, 'title' => corta(texto($md['title'] ?? '')), 'publishedAt' => data_relativa($r[0] ?? null, $agora), 'isShort' => strpos(json_encode($lv), 'reelWatchEndpoint') !== false];
      }
      return;
    }
    foreach ($o as $v) $anda($v);
  };
  $anda($d);
  return $out;
}
// dados conhecidos (data exata e Shorts) valem mais que os aproximados
function junta_conhecidos(array $itens, array $base, int $agora): array {
  $conh = []; foreach ($base['items'] ?? [] as $i) $conh[$i['id']] = $i;
  $ult = $agora; $out = [];
  foreach ($itens as $i) {
    if (isset($conh[$i['id']])) { $k = $conh[$i['id']]; $i['publishedAt'] = $k['publishedAt'] ?: $i['publishedAt']; $i['isShort'] = !empty($k['isShort']); }
    if ($i['publishedAt']) $ult = strtotime($i['publishedAt']) ?: $ult; else { $ult -= 60; $i['publishedAt'] = gmdate('Y-m-d\TH:i:s.000\Z', $ult); }
    $out[] = $i;
  }
  return $out;
}
// vertical × horizontal pelo oEmbed, em paralelo (se falhar, mantém o que já se sabia)
function confere_formato(array $itens): array {
  if (!function_exists('curl_multi_init')) return $itens;
  $mh = curl_multi_init(); $hs = [];
  foreach (array_slice($itens, 0, MAXV, true) as $k => $it) {
    $u = 'https://www.youtube.com/oembed?format=json&url=' . rawurlencode('https://www.youtube.com/shorts/' . $it['id']);
    $ch = curl_init($u);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT_MS => 2500, CURLOPT_CONNECTTIMEOUT_MS => 2500, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
      CURLOPT_HTTPHEADER => ['User-Agent: ' . UA, 'Accept: application/json']]);
    curl_multi_add_handle($mh, $ch); $hs[$k] = $ch;
  }
  do { $st = curl_multi_exec($mh, $ativos); if ($ativos) curl_multi_select($mh, 0.5); } while ($ativos && $st === CURLM_OK);
  foreach ($hs as $k => $ch) {
    $j = json_decode((string)curl_multi_getcontent($ch), true);
    if (is_array($j) && !empty($j['width']) && !empty($j['height'])) $itens[$k]['isShort'] = $j['height'] > $j['width'];
    curl_multi_remove_handle($mh, $ch); curl_close($ch);
  }
  curl_multi_close($mh);
  return $itens;
}

// cache em arquivo (pasta com ponto: o .htaccess não serve)
$pasta = $raiz . '/.cache';
if (!is_dir($pasta)) @mkdir($pasta, 0700, true);
if (!is_dir($pasta) || !is_writable($pasta)) $pasta = sys_get_temp_dir();
$arq = $pasta . '/bny-videos-' . substr(sha1($raiz), 0, 8) . '.json';
$agora = time();
$guardado = is_file($arq) ? json_decode((string)@file_get_contents($arq), true) : null;
$idade = is_array($guardado) ? $agora - (int)($guardado['t'] ?? 0) : PHP_INT_MAX;
$cacheBom = 'public, max-age=300, stale-while-revalidate=1800';
if ($idade < TTL) responde(200, $guardado['body'], $cacheBom);

// trava simples: só um pedido por vez atualiza; os outros recebem a lista guardada, se houver
$trava = @fopen($arq . '.lock', 'c');
if ($trava && !flock($trava, LOCK_EX | LOCK_NB) && is_array($guardado) && $idade < TTL_VELHA) responde(200, $guardado['body'], $cacheBom);

$base = estatico($raiz);
$comum = ['v' => 1, 'generatedAt' => gmdate('Y-m-d\TH:i:s.000\Z', $agora), 'channel' => $base['channel'] ?? null, 'featured' => $base['featured'] ?? null, 'titles' => $base['titles'] ?? new stdClass()];
$extras = function (array $itens) use ($base): array {
  $ids = array_flip(array_column($itens, 'id'));
  foreach ($base['items'] ?? [] as $i) if (!isset($ids[$i['id']])) $itens[] = $i;
  return $itens;
};
$guarda = function (array $corpo) use ($arq, $agora): void {
  $tmp = $arq . '.' . getmypid() . '.tmp';
  if (@file_put_contents($tmp, json_encode(['t' => $agora, 'body' => $corpo], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) !== false) @rename($tmp, $arq);
};

try {
  $itens = le_feed(baixa('https://www.youtube.com/feeds/videos.xml?channel_id=' . CANAL, 'application/atom+xml,text/xml'));
  if (!$itens) throw new RuntimeException('vazio');
  $corpo = $comum + ['source' => 'rss', 'items' => $extras(confere_formato($itens))];
  $guarda($corpo); responde(200, $corpo, $cacheBom);
} catch (Throwable $e) { /* tenta a playlist */ }

try {
  $pag = le_playlist(baixa('https://www.youtube.com/playlist?list=UU' . substr(CANAL, 2) . '&hl=en&gl=US', 'text/html'), $agora);
  $itens = junta_conhecidos(array_slice($pag, 0, MAXV), $base, $agora);
  if (count($itens) < 3) throw new RuntimeException('lista curta');
  $corpo = $comum + ['source' => 'canal', 'items' => $extras(confere_formato($itens))];
  $guarda($corpo); responde(200, $corpo, $cacheBom);
} catch (Throwable $e) { /* usa o que houver */ }

if (is_array($guardado) && $idade < TTL_VELHA) responde(200, $guardado['body'], 'public, max-age=120');
$base['source'] = 'static';
responde(200, $base, 'public, max-age=120');
