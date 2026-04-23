<?php
header('Content-Type: application/json; charset=utf-8');

function send_json_error($message, $statusCode = 500) {
  http_response_code($statusCode);
  echo json_encode(array('error' => $message));
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  send_json_error('Method not allowed.', 405);
}

$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput, true);

if (!is_array($payload)) {
  send_json_error('Invalid request body.', 400);
}

$userMessage = trim(isset($payload['message']) ? $payload['message'] : '');
$topic = trim(isset($payload['topic']) ? $payload['topic'] : 'default');

if ($userMessage === '') {
  send_json_error('Message is required.', 400);
}

$apiKey = 'API_KEY';


if (!$apiKey) {
  send_json_error('GROQ_API_KEY is not configured on the server.', 500);
}

if (!function_exists('curl_init')) {
  send_json_error('cURL is required to contact Groq.', 500);
}

$systemPrompt = "You are Serenity, a calm and supportive wellness companion inside a web app.\n" .
  "Respond with warmth, empathy, and practical guidance. Keep replies concise but useful.\n" .
  "Use short paragraphs and, when helpful, a simple breathing exercise, grounding step, or reflection prompt.\n" .
  "Do not diagnose or claim to be a therapist. If the user mentions self-harm, suicide, or immediate danger, encourage contacting local emergency services or a trusted person right away.\n" .
  "Wellness topic: " . $topic . ".";

$requestBody = json_encode(array(
  'model' => 'llama-3.1-8b-instant',
  'messages' => array(
    array(
      'role' => 'system',
      'content' => $systemPrompt
    ),
    array(
      'role' => 'user',
      'content' => $userMessage
    )
  ),
  'temperature' => 0.7,
  'max_tokens' => 400
));

$ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
curl_setopt_array($ch, array(
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => array(
    'Authorization: Bearer ' . $apiKey,
    'Content-Type: application/json'
  ),
  CURLOPT_POSTFIELDS => $requestBody,
  CURLOPT_TIMEOUT => 30,
  CURLOPT_CONNECTTIMEOUT => 10
));

$responseBody = curl_exec($ch);

if ($responseBody === false) {
  $curlError = curl_error($ch);
  curl_close($ch);
  send_json_error('Groq request failed: ' . $curlError, 502);
}

$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$responseData = json_decode($responseBody, true);

if ($httpCode < 200 || $httpCode >= 300) {
  $errorMessage = 'Groq request failed.';
  if (is_array($responseData) && isset($responseData['error']['message'])) {
    $errorMessage = $responseData['error']['message'];
  }
  send_json_error($errorMessage, $httpCode > 0 ? $httpCode : 502);
}

$reply = '';
if (is_array($responseData)
  && isset($responseData['choices'][0]['message']['content'])) {
  $reply = trim($responseData['choices'][0]['message']['content']);
}

if ($reply === '') {
  send_json_error('Groq returned an empty response.', 502);
}

echo json_encode(array(
  'reply' => $reply
));