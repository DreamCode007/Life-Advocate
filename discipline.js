var taskDate = document.getElementById('taskDate');
var taskForm = document.getElementById('taskForm');
var taskInput = document.getElementById('taskInput');
var taskList = document.getElementById('taskList');
var taskSummary = document.getElementById('taskSummary');
var clearDoneBtn = document.getElementById('clearDoneBtn');
var taskError = document.getElementById('taskError');

function getTodayLocal() {
  var now = new Date();
  var year = now.getFullYear();
  var month = String(now.getMonth() + 1).padStart(2, '0');
  var day = String(now.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function setError(message) {
  taskError.textContent = message || '';
}

async function apiRequest(payload, queryDate) {
  var url = 'discipline_api.php';
  if (queryDate) {
    url += '?date=' + encodeURIComponent(queryDate);
  }

  var options = {
    method: payload ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (payload) {
    options.body = JSON.stringify(payload);
  }

  var response = await fetch(url, options);
  var data = {};

  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  if (!response.ok) {
    var message = data.error || 'Request failed.';
    if (response.status === 401) {
      message = 'Please log in first from login.php to use personal tasks.';
    }
    throw new Error(message);
  }

  return data;
}

function renderTasks(tasks) {
  taskList.innerHTML = '';

  if (!tasks.length) {
    var empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'No tasks for this day yet. Add one to start.';
    taskList.appendChild(empty);
    taskSummary.textContent = '0 of 0 completed';
    return;
  }

  var completed = 0;

  tasks.forEach(function(task) {
    if (task.is_done) {
      completed += 1;
    }

    var item = document.createElement('li');
    item.className = 'task-item' + (task.is_done ? ' done' : '');

    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = !!task.is_done;
    checkbox.addEventListener('change', function() {
      updateTaskStatus(task.id, checkbox.checked);
    });

    var text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = task.task_text;

    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'task-delete';
    del.textContent = 'Delete';
    del.addEventListener('click', function() {
      deleteTask(task.id);
    });

    item.appendChild(checkbox);
    item.appendChild(text);
    item.appendChild(del);
    taskList.appendChild(item);
  });

  taskSummary.textContent = completed + ' of ' + tasks.length + ' completed';
}

async function loadTasks() {
  setError('');

  try {
    var data = await apiRequest(null, taskDate.value);
    renderTasks(data.tasks || []);
  } catch (error) {
    setError(error.message || 'Could not load tasks.');
  }
}

async function addTask() {
  var text = taskInput.value.trim();
  if (!text) {
    setError('Enter a task first.');
    return;
  }

  setError('');

  try {
    await apiRequest({
      action: 'add',
      date: taskDate.value,
      task_text: text
    });

    taskInput.value = '';
    await loadTasks();
  } catch (error) {
    setError(error.message || 'Could not add task.');
  }
}

async function updateTaskStatus(taskId, isDone) {
  setError('');

  try {
    await apiRequest({
      action: 'toggle',
      id: taskId,
      is_done: isDone,
      date: taskDate.value
    });

    await loadTasks();
  } catch (error) {
    setError(error.message || 'Could not update task.');
  }
}

async function deleteTask(taskId) {
  setError('');

  try {
    await apiRequest({
      action: 'delete',
      id: taskId,
      date: taskDate.value
    });

    await loadTasks();
  } catch (error) {
    setError(error.message || 'Could not delete task.');
  }
}

async function clearCompleted() {
  setError('');

  try {
    await apiRequest({
      action: 'clear_done',
      date: taskDate.value
    });

    await loadTasks();
  } catch (error) {
    setError(error.message || 'Could not clear completed tasks.');
  }
}

taskDate.value = getTodayLocal();

taskDate.addEventListener('change', function() {
  loadTasks();
});

taskForm.addEventListener('submit', function(event) {
  event.preventDefault();
  addTask();
});

clearDoneBtn.addEventListener('click', function() {
  clearCompleted();
});

loadTasks();
