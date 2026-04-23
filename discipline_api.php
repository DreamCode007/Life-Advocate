<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

function send_error($message, $code = 500) {
  http_response_code($code);
  echo json_encode(array('error' => $message));
  exit;
}

function send_success($tasks) {
  echo json_encode(array('tasks' => $tasks));
  exit;
}

function read_json_body() {
  $raw = file_get_contents('php://input');
  if (!$raw) {
    return array();
  }

  $data = json_decode($raw, true);
  if (!is_array($data)) {
    send_error('Invalid JSON body.', 400);
  }

  return $data;
}

function normalize_date($dateValue) {
  if (!$dateValue) {
    return date('Y-m-d');
  }

  $dt = DateTime::createFromFormat('Y-m-d', $dateValue);
  if (!$dt || $dt->format('Y-m-d') !== $dateValue) {
    send_error('Invalid date format. Use YYYY-MM-DD.', 400);
  }

  return $dateValue;
}

function users_has_id_column($db) {
  static $cached = null;

  if ($cached !== null) {
    return $cached;
  }

  $result = mysqli_query($db, "SHOW COLUMNS FROM users LIKE 'id'");
  $cached = $result && mysqli_num_rows($result) > 0;

  if ($result) {
    mysqli_free_result($result);
  }

  return $cached;
}

function get_user_key($db) {
  if (isset($_SESSION['user_id']) && (int)$_SESSION['user_id'] > 0) {
    return 'uid:' . (int)$_SESSION['user_id'];
  }

  if (isset($_SESSION['username']) && $_SESSION['username'] !== '') {
    $username = $_SESSION['username'];
    if (users_has_id_column($db)) {
      $stmt = mysqli_prepare($db, 'SELECT id FROM users WHERE username = ? LIMIT 1');

      if ($stmt) {
        mysqli_stmt_bind_param($stmt, 's', $username);
        if (mysqli_stmt_execute($stmt)) {
          $result = mysqli_stmt_get_result($stmt);
          $row = $result ? mysqli_fetch_assoc($result) : null;

          if ($row && isset($row['id'])) {
            $_SESSION['user_id'] = (int)$row['id'];
            mysqli_stmt_close($stmt);
            return 'uid:' . (int)$row['id'];
          }
        }

        mysqli_stmt_close($stmt);
      }
    }

 
    return 'uname:' . $username;
  }

  send_error('Please log in to manage personal tasks.', 401);
}

$db = mysqli_connect('localhost', 'root', '', 'ap project');
if (!$db) {
  send_error('Database connection failed.', 500);
}


$userKey = get_user_key($db);
$method = $_SERVER['REQUEST_METHOD'];

function fetch_tasks($db, $userKey, $taskDate) {
  $stmt = mysqli_prepare(
    $db,
    'SELECT id, task_text, is_done, task_date FROM daily_tasks WHERE user_key = ? AND task_date = ? ORDER BY created_at ASC, id ASC'
  );

  if (!$stmt) {
    send_error('Could not prepare list query.', 500);
  }

  mysqli_stmt_bind_param($stmt, 'ss', $userKey, $taskDate);
  mysqli_stmt_execute($stmt);
  $result = mysqli_stmt_get_result($stmt);

  $tasks = array();
  while ($row = mysqli_fetch_assoc($result)) {
    $row['id'] = (int)$row['id'];
    $row['is_done'] = ((int)$row['is_done']) === 1;
    $tasks[] = $row;
  }

  mysqli_stmt_close($stmt);
  return $tasks;
}

if ($method === 'GET') {
  $taskDate = normalize_date(isset($_GET['date']) ? $_GET['date'] : null);
  send_success(fetch_tasks($db, $userKey, $taskDate));
}

if ($method !== 'POST') {
  send_error('Method not allowed.', 405);
}

$payload = read_json_body();
$action = isset($payload['action']) ? $payload['action'] : '';
$taskDate = normalize_date(isset($payload['date']) ? $payload['date'] : null);

if ($action === 'add') {
  $taskText = trim(isset($payload['task_text']) ? $payload['task_text'] : '');

  if ($taskText === '') {
    send_error('Task text is required.', 400);
  }

  if (strlen($taskText) > 255) {
    send_error('Task must be 255 characters or less.', 400);
  }

  $stmt = mysqli_prepare(
    $db,
    'INSERT INTO daily_tasks (user_key, task_date, task_text, is_done) VALUES (?, ?, ?, 0)'
  );

  if (!$stmt) {
    send_error('Could not prepare insert query.', 500);
  }

  mysqli_stmt_bind_param($stmt, 'sss', $userKey, $taskDate, $taskText);
  if (!mysqli_stmt_execute($stmt)) {
    mysqli_stmt_close($stmt);
    send_error('Could not save task.', 500);
  }
  mysqli_stmt_close($stmt);

  send_success(fetch_tasks($db, $userKey, $taskDate));
}

if ($action === 'toggle') {
  $taskId = isset($payload['id']) ? (int)$payload['id'] : 0;
  $isDone = !empty($payload['is_done']) ? 1 : 0;

  if ($taskId <= 0) {
    send_error('Valid task id is required.', 400);
  }

  $stmt = mysqli_prepare(
    $db,
    'UPDATE daily_tasks SET is_done = ? WHERE id = ? AND user_key = ?'
  );

  if (!$stmt) {
    send_error('Could not prepare update query.', 500);
  }

  mysqli_stmt_bind_param($stmt, 'iis', $isDone, $taskId, $userKey);
  if (!mysqli_stmt_execute($stmt)) {
    mysqli_stmt_close($stmt);
    send_error('Could not update task.', 500);
  }
  mysqli_stmt_close($stmt);

  send_success(fetch_tasks($db, $userKey, $taskDate));
}

if ($action === 'delete') {
  $taskId = isset($payload['id']) ? (int)$payload['id'] : 0;

  if ($taskId <= 0) {
    send_error('Valid task id is required.', 400);
  }

  $stmt = mysqli_prepare(
    $db,
    'DELETE FROM daily_tasks WHERE id = ? AND user_key = ?'
  );

  if (!$stmt) {
    send_error('Could not prepare delete query.', 500);
  }

  mysqli_stmt_bind_param($stmt, 'is', $taskId, $userKey);
  if (!mysqli_stmt_execute($stmt)) {
    mysqli_stmt_close($stmt);
    send_error('Could not delete task.', 500);
  }
  mysqli_stmt_close($stmt);

  send_success(fetch_tasks($db, $userKey, $taskDate));
}

if ($action === 'clear_done') {
  $stmt = mysqli_prepare(
    $db,
    'DELETE FROM daily_tasks WHERE user_key = ? AND task_date = ? AND is_done = 1'
  );

  if (!$stmt) {
    send_error('Could not prepare clear query.', 500);
  }

  mysqli_stmt_bind_param($stmt, 'ss', $userKey, $taskDate);
  if (!mysqli_stmt_execute($stmt)) {
    mysqli_stmt_close($stmt);
    send_error('Could not clear completed tasks.', 500);
  }
  mysqli_stmt_close($stmt);

  send_success(fetch_tasks($db, $userKey, $taskDate));
}

send_error('Unsupported action.', 400);
