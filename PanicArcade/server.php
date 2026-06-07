<?php
// server.php - وسيط آمن للتحقق من اشتراك المستخدم في القناة @s3_s4
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// ====== اضبط هذه القيم ======
$BOT_TOKEN = "8013151676:AAGz3x6i1W3ZyQa8x7y_QtittM3y4bS620g";   // توكن البوت من BotFather
$CHANNEL   = "@s3_s4";                     // معرف القناة
// ============================

$raw  = file_get_contents("php://input");
$data = json_decode($raw, true) ?: $_POST;

$initData = $data['initData'] ?? '';
if (!$initData) { echo json_encode(["ok"=>false,"error"=>"missing_initData"]); exit; }

// 1) التحقق من صحة initData عبر HMAC-SHA256
function verifyTelegramInitData($initData, $botToken) {
    parse_str($initData, $parsed);
    if (empty($parsed['hash'])) return [false, null];
    $hash = $parsed['hash'];
    unset($parsed['hash']);
    ksort($parsed);
    $dataCheck = [];
    foreach ($parsed as $k => $v) { $dataCheck[] = "$k=$v"; }
    $dataCheckString = implode("\n", $dataCheck);
    $secretKey = hash_hmac('sha256', $botToken, "WebAppData", true);
    $calc = hash_hmac('sha256', $dataCheckString, $secretKey);
    if (!hash_equals($calc, $hash)) return [false, null];
    $user = isset($parsed['user']) ? json_decode($parsed['user'], true) : null;
    return [true, $user];
}

list($valid, $user) = verifyTelegramInitData($initData, $BOT_TOKEN);
if (!$valid || !$user || empty($user['id'])) {
    echo json_encode(["ok"=>false,"error"=>"invalid_initData"]); exit;
}

// 2) استدعاء getChatMember
$url = "https://api.telegram.org/bot{$BOT_TOKEN}/getChatMember?chat_id="
     . urlencode($CHANNEL) . "&user_id=" . intval($user['id']);

$ctx = stream_context_create(["http"=>["timeout"=>8]]);
$resp = @file_get_contents($url, false, $ctx);
if ($resp === false) { echo json_encode(["ok"=>false,"error"=>"telegram_unreachable"]); exit; }

$json = json_decode($resp, true);
if (empty($json['ok'])) { echo json_encode(["ok"=>false,"error"=>"telegram_error","raw"=>$json]); exit; }

$status = $json['result']['status'] ?? '';
$joined = in_array($status, ['member','administrator','creator'], true);

echo json_encode(["ok"=>true, "joined"=>$joined, "status"=>$status, "user_id"=>$user['id']]);
