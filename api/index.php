<?php
// ============================================================
//  api/index.php — Unified Colors Manager RESTful API
//
//  GET    /api/index.php?ping=1   — status ping health check
//  POST   /api/index.php (login)  — authenticate user
//  GET    /api/index.php          — list all colors for user
//  GET    /api/index.php?q=term   — partial search colors
//  GET    /api/index.php?id=1     — get single color by ID
//  POST   /api/index.php (color)  — create new color
//  PUT    /api/index.php?id=1     — update color by ID
//  DELETE /api/index.php?id=1     — delete color by ID
// ============================================================

require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/config/helpers.php';

setCORSHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$action= $_GET['action'] ?? '';
$db     = getDB();
$body = getRequestBody(); //asks like "let me read everything" 

// 1. Unauthenticated Health Check (Ping)
if ($method === 'GET' && (isset($_GET['ping']) || (isset($_GET['action']) && $_GET['action'] === 'ping'))) {
    respond(200, ['status' => 'OK', 'timestamp' => time()]);
}

// 2. Unauthenticated Login (POST with login & password in body)
if ($method === 'POST' && $action === 'login') {
    if (isset($body['username']) && isset($body['password'])) { //"ah, so youre talking about login" 
        $username    = clean($body['username']); //"let me parse this up with a helpers.php function so i can use this"
        $password = clean($body['password']);

        if (!$username || !$password) { //"hark! the password is empty, ipso facto you shall not pass" 
            respond(400, ['error' => 'Login and password are required']);
        }
        
        $stmt = $db->prepare(
            "SELECT ID, `First Name`, `Last Name`, Password
            FROM Users
            WHERE Username = :username
            LIMIT 1"
        );

        $stmt->execute([
            ':username' => $username
        ]);

        $user = $stmt->fetch();
        if ($user && password_verify($password, $user['Password'])) {
            respond(200, [
                'id'        => (int) $user['ID'],
                'firstName' => $user['First Name'],
                'lastName'  => $user['Last Name'],
                'token'     => (string) $user['ID'],
                'error'     => ''
            ]);
        } else {
            respond(401, [
                'id'        => 0,
                'firstName' => '',
                'lastName'  => '',
                'error'     => ''
            ]);
        }
    }
}

if ($method === 'POST' && $action ==='register'){
    $firstName = clean($body['firstName']);
    $lastName = clean($body['lastName']);
    $username = clean($body['username']);
    $password = clean($body['password']); 

    if (!$firstName ||!$lastName||!$username||!$password) {
        respond(400, ['error'=> 'First name, last name, username, and password are required']);
    }

    //check our database to see if the user already exists
    $temp = $db->prepare('SELECT ID FROM Users WHERE Username = :username LIMIT 1');
    //executes the database search stored in temp where :username because the actual username
    //then give back whats at the row if found with that username, stored in $user
    $temp->execute([':username' => $username]); $user = $temp->fetch();

    if($user){
        respond(401, ['error' => 'Username is taken. Please write a UNIQUE username this time >:)']);
    }
   
    //password extra hashed extra salted side order of a chocolate shake  
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    $temp = $db->prepare("INSERT INTO Users (`First Name`, `Last Name`, Username, Password) VALUES (:firstName, :lastName,:username, :password)");
    $temp->execute([':firstName' => $firstName, ':lastName' => $lastName, ':username' => $username, ':password'=> $hashedPassword]);

    respond(201, [
        'message' => 'User registered!',
        'id'      => (int) $db->lastInsertId(),
        'error'   => ''
    ]);    
}

if ($method === 'GET' && $action === 'getall'){
    $id = clean($body['id']);

    $stmt = $db->prepare(
        "SELECT `FIrst Name`, `Last Name`, `E-mail Address`, `Phone Number`
         FROM Contacts
         WHERE  "
    )
}