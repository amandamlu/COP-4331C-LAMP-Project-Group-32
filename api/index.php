<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
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
$db   = getDB();
$body = getRequestBody();

if ($method === 'GET' && (isset($_GET['ping']) || (isset($_GET['action']) && $_GET['action'] === 'ping'))) {
    respond(200, ['status' => 'OK', 'timestamp' => time()]);
}
#Login
if ($method === 'POST' && $action === 'login') {
    if (isset($body['username']) && isset($body['password'])) {
        $username = clean($body['username']);
        $password = clean($body['password']);

        if (!$username || !$password) {
            respond(400, ['error' => 'Login and password are required']);
        }
        
        $stmt = $db->prepare(
            "SELECT ID, `First Name`, `Last Name`, `Password`, `Role`, `Acc Status` 
            FROM Users
            WHERE Username = :username
            LIMIT 1"
        );

        $stmt->execute([
            ':username' => $username
        ]);

        $user = $stmt->fetch();
        if ($user && password_verify($password, $user['Password'])) {
            if ($user['Acc Status'] !== 'Active') {
                respond(403, [
                    'id' => 0,
                    'firstName' => '',
                    'lastName' => '',
                    'error' => 'Account is disabled'
                ]);
            }
            respond(200, [
                'id'        => (int) $user['ID'],
                'firstName' => $user['First Name'],
                'lastName'  => $user['Last Name'],
                'token'     => (string) $user['ID'],
                'role'      => $user['Role'],
                'accStatus' => $user['Acc Status'],
                'error'     => ''
            ]);
        }
         else {
            respond(401, [
                'id'        => 0,
                'firstName' => '',
                'lastName'  => '',
                'error'     => ''
            ]);
        }
    }
}
#Register
if ($method === 'POST' && $action ==='register'){
    $firstName = clean($body['firstName']);
    $lastName = clean($body['lastName']);
    $username = clean($body['username']);
    $password = clean($body['password']); 

    if (!$firstName ||!$lastName||!$username||!$password) {
        respond(400, ['error'=> 'First name, last name, username, and password are required']);
    }

    $temp = $db->prepare('SELECT ID FROM Users WHERE Username = :username LIMIT 1');

    $temp->execute([':username' => $username]); $user = $temp->fetch();

    if($user){
        respond(401, ['error' => 'Username is taken. Please write a UNIQUE username this time >:)']);
    }
    
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    $temp = $db->prepare("INSERT INTO Users (`First Name`, `Last Name`, Username, Password) VALUES (:firstName, :lastName,:username, :password)");
    $temp->execute([':firstName' => $firstName, ':lastName' => $lastName, ':username' => $username, ':password'=> $hashedPassword]);

    respond(201, [
        'message' => 'User registered!',
        'id'      => (int) $db->lastInsertId(),
        'error'   => ''
    ]);    
}
#Get User's contacts
if ($method === 'POST' && $action === 'getall'){
    $accstatus = clean($body['accstatus']);
    $userid = clean($body['userid']);

    if ($accstatus !== 'Active') {
        respond(403, [
            'message' => 'This action is not available',
            'error' => ''
        ]);
    } else {
        $stmt = $db->prepare(
            "SELECT `ID`, `First Name`, `Last Name`, `E-mail Address`, `Phone Number`
            FROM Contacts
            WHERE `User ID` = :userid"
        );

        $stmt->execute([
            ':userid' => $userid
        ]);

        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        respond(200, [
            'message' => 'All Contacts fetched!',
            'contacts' => $results,
            'error' => ''
        ]);
    }
}
#Search specifics
if ($method === 'POST' && $action === 'getpartial'){
    $accstatus = clean($body['accstatus']);
    $userid = clean($body['userid']);
    $firstName = clean($body['firstName']);
    $lastName = clean($body['lastName']);

    if ($accstatus !== 'Active') {
        respond(403, [
            'message' => 'This action is not available',
            'error' => ''
        ]);
    } else {
        $stmt = $db->prepare(
            "SELECT `ID`, `First Name`, `Last Name`, `E-mail Address`, `Phone Number`
            FROM Contacts
            WHERE `User ID` = :userid
            AND `First Name` = :firstName
            AND `Last Name` = :lastName"
        );

        $stmt->execute([
            ':userid' => $userid,
            ':firstName' => $firstName,
            ':lastName' => $lastName
        ]);

        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        respond(200, [
            'message' => 'Some Contacts fetched!',
            'contacts' => $results,
            'error' => ''
        ]);
    }
}
#Add contact 
if ($method === 'POST' && $action === 'add'){
    $accstatus = clean($body['accstatus']);
    $userid = clean($body['userid']);
    $firstName = clean($body['firstName']);
    $lastName = clean($body['lastName']);
    $emailAddress = clean($body['emailAddress']);
    $phoneNumber = clean($body['phoneNumber']); 

    if ($accstatus !== 'Active') {
        respond(403, [
            'message' => 'This action is not available',
            'error' => ''
        ]);
    } else {
        if (!$firstName || !$lastName || !$emailAddress || !$phoneNumber) {
            respond(400, ['error' => 'Some fields are not filled in']);
        }

        //if same email address
        $temp = $db->prepare('SELECT ID FROM Contacts WHERE `E-mail Address` = :emailAddress LIMIT 1');
        $temp->execute([':emailAddress' => $emailAddress]); 
        if($temp->fetch()){
            respond(401, ['error' => 'user already in system']);
        }
        
        //if same phone number
        $temp = $db->prepare('SELECT ID FROM Contacts WHERE `Phone Number` = :phoneNumber LIMIT 1');
        $temp->execute([':phoneNumber' => $phoneNumber]); 
        if($temp->fetch()){
            respond(401, ['error' => 'user already in system']);
        }  

        $stmt = $db->prepare(
            "INSERT INTO 
            Contacts (`First Name`, `Last Name`, `E-mail Address`, `Phone Number`, `User ID`)
            VALUES (:firstName, :lastName, :emailAddress, :phoneNumber, :userid)"
        );

        $stmt->execute([
            ':userid' => $userid,
            ':firstName' => $firstName,
            ':lastName' => $lastName,
            ':emailAddress' => $emailAddress,
            ':phoneNumber' => $phoneNumber
        ]);

        respond(201, [
            'message' => 'Contact added',
            'error' =>  ''
        ]);
    }
}
#Delete contact
if ($method === 'DELETE'){
    $accstatus = clean($body['accstatus']);
    $id = clean($body['id']);
    $userid = clean($body['userid']);

    if ($accstatus !== 'Active') {
        respond(403, [
            'message' => 'This action is not available',
            'error' => ''
        ]);
    } else {
        $stmt = $db->prepare(
            "DELETE FROM Contacts
            WHERE `ID` = :id
            AND `User ID` = :userid"
        );

        $stmt->execute([
            ':id' => $id,
            ':userid' => $userid
        ]);

        respond(204, [
            'error' =>  ''
        ]);
    }
}
#Update contact
if ($method === 'PATCH' && $action === ''){
    $accstatus = clean($body['accstatus']);
    $id = clean($body['id']);
    $firstName = clean($body['firstName']);
    $lastName = clean($body['lastName']);
    $emailAddress = clean($body['emailAddress']);
    $phoneNumber = clean($body['phoneNumber']); 

    if ($accstatus !== 'Active') {
        respond(403, [
            'message' => 'This action is not available',
            'error' => ''
        ]);
    } else {
        $stmt = $db->prepare(
            "UPDATE Contacts
            SET
                `First Name` = COALESCE(:firstName, `First Name`),
                `Last Name` = COALESCE(:lastName, `Last Name`),
                `E-mail Address` = COALESCE(:emailAddress, `E-mail Address`),
                `Phone Number` = COALESCE(:phoneNumber, `Phone Number`)
            WHERE ID = :id"
        );

        $stmt->execute([
            ':firstName' => $firstName,
            ':lastName' => $lastName,
            ':emailAddress' => $emailAddress,
            ':phoneNumber' => $phoneNumber,
            ':id' => $id
        ]);

        respond(200, [
            'message' => 'Contact updated',
            'error' =>  ''
        ]);
    }
}
#Get a user's org chart
if ($method === 'POST' && $action === 'getorg') {
    $userid = clean($body['userid']);
    // Check requesting user
    $temp = $db->prepare('SELECT ID, Role, Boss FROM Users WHERE ID = :userid LIMIT 1');
    $temp->execute([':userid' => $userid]);$user = $temp->fetch();

    if (!$user) {
        respond(404, [
            'error' => 'User not found'
        ]);
    }
    //if admin
    $role = $user['Role'];$bossOutput = null;
    $role = $user['Role'];
    if ($role === 'Admin') {
        $stmt3 = $db->prepare("SELECT ID, `First Name`,`Last Name`,Username,Role,`Acc Status`,Boss FROM Users ORDER BY Role DESC, `Last Name`, `First Name`");
        $stmt3->execute();
        $results = $stmt3->fetchAll(PDO::FETCH_ASSOC);
    } else {
    //If user, get boss 
    $bossTemp2 = $user['Boss'];
    $stmt = $db->prepare("SELECT ID, Boss FROM Users WHERE Boss = :boss LIMIT 1");
    $stmt->execute([':boss' => $bossTemp2]);
    $bossOutput = $stmt->fetchAll(PDO::FETCH_ASSOC);
    //If user, get other users with the same boss 
    $bossTemp = $user['Boss'];
    $stmt2 = $db->prepare("SELECT ID, `First Name`,`Last Name`,Username,Role,`Acc Status`,Boss FROM Users WHERE Boss = :boss ORDER BY Role DESC, `Last Name`, `First Name`");
    $stmt2->execute([':boss' => $bossTemp]);

    $results = $stmt2->fetchAll(PDO::FETCH_ASSOC);
	}

    respond(200, [
        'message' => 'Organization chart, here!',
        'boss' => $bossOutput,
        'users' => $results,
        'error' => ''
    ]);
}
#===Admin===
# Get users
if ($method === 'GET' && $action === 'getusers') {
    $username = clean($body['username']);
    $temp = $db->prepare('SELECT ID, Role FROM Users WHERE Username = :username LIMIT 1');
    $temp->execute([':username' => $username]); $user = $temp->fetch();
    $userid = $user['ID'];
    $role = $user['Role'];
    if ($role !== 'Admin') {
        respond(403, [
            'error' => 'Not an admin'
        ]);
    }
     else {
        $stmt = $db->prepare(
            "SELECT ID, `First Name`, `Last Name`, Username, Role, `Acc Status`
            FROM Users"
        );
        $stmt->execute();
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        respond(200, [
            'message' => 'Got Users',
            'users' => $results,
            'error' => ''
        ]);
    }
}
# Get User's contacts
if ($method === 'GET' && $action === 'getusercontacts') {
    $username = clean($body['username']);
    $searchedUsername=clean($body['searchedUsername']);
    $temp = $db->prepare('SELECT ID, Role FROM Users WHERE Username = :username LIMIT 1');
    $temp->execute([':username' => $username]); $user = $temp->fetch();
    $userid = $user['ID'];
    $role = $user['Role'];
    if ($role !== 'Admin') {
        respond(403, [
            'error' => 'Admin access required'
        ]);
    }
     else {
        $temp2 = $db->prepare('SELECT ID FROM Users WHERE Username = :username LIMIT 1');
        $temp2->execute([':username' => $searchedUsername]);$searchedUser = $temp2->fetch();
        if (!$searchedUser) {
            respond(404, [
                'error' => 'Target user not found'
            ]);
        }
        $searchedUserID = $searchedUser['ID'];
        $stmt = $db->prepare(
            "SELECT `ID`, `First Name`, `Last Name`,`E-mail Address`, `Phone Number` FROM Contacts WHERE `User ID` = :userid");
        $stmt->execute([
            ':userid' => $searchedUserID
        ]);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        respond(200, [
            'message' => 'Got User contacts',
            'contacts' => $results,
            'error' => ''
        ]);
    }
}
# Disable a user
if ($method === 'PATCH' && $action === 'disable') {
    $username = clean($body['username']);
    $searchedUser=clean($body['searchedUser']);
    $temp = $db->prepare('SELECT ID, Role FROM Users WHERE Username = :username LIMIT 1');
    $temp->execute([':username' => $username]); $user = $temp->fetch();
    if (!$user) {
        respond(404, ['error' => 'Admin not in database']);
    }
    $userid = $user['ID'];
    $role = $user['Role'];
    if ($role !== 'Admin') {
        respond(403, [
            'error' => 'Youre not an admin'
        ]);
    } 


    $userid = $user['ID'];
    $temp2 = $db->prepare('SELECT ID FROM Users WHERE Username = :username LIMIT 1'); //look in database for usernames
    $temp2->execute([':username' => $searchedUser]); $searchedUsertemp = $temp2->fetch();//find the one that matches $username
    if (!$searchedUsertemp) {
        respond(404, [
        'error' => 'User not found'
    ]);}
    $stmt = $db->prepare("UPDATE Users SET `Acc Status` = 'Disabled' WHERE ID = :userid");//set up an inactive element in acc status column
    $stmt->execute([':userid' => $searchedUsertemp['ID']]);//give it to searchedUsertemp
    respond(200, [
        'message' => 'Disabled',
        'error' => ''
    ]);  
    
}
# Change a user poassword
if ($method === 'PATCH' && $action === 'changepass'){
    $username = clean($body['username']);
    $searchedUser = clean($body['searchedUser']);
    $newPassword = clean($body['newPassword']);

    //check admin
    $temp = $db->prepare('SELECT ID, Role FROM Users WHERE Username = :username LIMIT 1');
    $temp->execute([':username' => $username]);$user = $temp->fetch();
    if (!$user) {
        respond(404, [
            'error' => 'Admin user not found'
        ]);
    }
    $role = $user['Role'];
    if ($role !== 'Admin') {
        respond(403, [
            'error' => 'Admin access required'
        ]);
    }
    //Check all fields added
    if (!$searchedUser || !$newPassword) {
        respond(400, [
            'error' => 'Username and new password are required'
        ]);
    }

    //change password
    $temp2 = $db->prepare('SELECT ID FROM Users WHERE Username = :username LIMIT 1');

    $temp2->execute([':username' => $searchedUser ]); $searchedUsertemp = $temp2->fetch();
    if (!$searchedUsertemp) {
        respond(404, [
            'error' => 'User not found'
        ]);
    }
    $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
    $stmt = $db->prepare(
        "UPDATE Users
         SET Password = :password
         WHERE ID = :userid"
    );
    $stmt->execute([
        ':password' => $hashedPassword,
        ':userid' => $searchedUsertemp['ID']
    ]);
    respond(200, [
        'message' => 'Password changed',
        'error' => ''
    ]);
}
# Create an Admin
if ($method === 'POST' && $action === 'createadmin') {
    $adminUser = clean($body['adminUser']);
    $firstName = clean($body['firstName']);
    $lastName = clean($body['lastName']);
    $username = clean($body['username']);
    $password = clean($body['password']);
    $username = clean($body['username']);
    //check admin
    $temp = $db->prepare('SELECT ID, Role FROM Users WHERE Username = :username LIMIT 1');
    $temp->execute([':username' => $adminUser]); $user = $temp->fetch();

    $userid = $user['ID'];
    $role = $user['Role'];
    if ($role !== 'Admin') {
        respond(403, [
            'error' => 'Admin access required'
        ]);
    }
    //creating the user 
    if (!$firstName || !$lastName || !$username || !$password) {
        respond(400, [
            'error' => 'First name, last name, username, and password are required'
        ]);
    }
    $temp = $db->prepare('SELECT ID FROM Users WHERE Username = :username LIMIT 1');
    $temp->execute([':username' => $username]);

    $existingUser = $temp->fetch();

    if ($existingUser) {
        respond(409, [
            'error' => 'Username is taken'
        ]);
    }

    $hashedPassword = password_hash(
        $password,
        PASSWORD_DEFAULT
    );

    $stmt = $db->prepare(
        "INSERT INTO Users
        (`First Name`, `Last Name`, Username, Password, Role, `Acc Status`)
        VALUES
        (:firstName, :lastName, :username, :password, 'Admin', 'Active')"
    );

    $stmt->execute([
        ':firstName' => $firstName,
        ':lastName' => $lastName,
        ':username' => $username,
        ':password' => $hashedPassword
    ]);

    respond(201, [
        'message' => 'New admin added',
        'id' => (int) $db->lastInsertId(),
        'error' => ''
    ]);

}
#Assign to a user and admin for org chart
if ($method === 'PATCH' && $action === 'assignboss') {
    $username = clean($body['username']);
    $searchedUser = clean($body['searchedUser']);
    $bossman = clean($body['boss']);

    $temp = $db->prepare('SELECT ID, Role FROM Users WHERE Username = :username LIMIT 1');
    $temp->execute([':username' => $username]);$user = $temp->fetch();

    if (!$user) {
        respond(404, [
            'error' => 'Admin user not found'
        ]);
    }

    //general checks 
    if ($user['Role'] !== 'Admin') {
        respond(403, [
            'error' => 'Admin access required'
        ]);
    }
    if (!$searchedUser || !$bossman) {
        respond(400, [
            'error' => 'User and boss are required'
        ]);
    }

    //fetch employee
    $temp2 = $db->prepare('SELECT ID, Username, Role FROM Users WHERE Username = :username LIMIT 1');
    $temp2->execute([':username' => $searchedUser]);$employee = $temp2->fetch();

    if (!$employee) {
        respond(404, [
            'error' => 'User to assign not found'
        ]);
    }

    //fetch boss
    $temp3 = $db->prepare('SELECT ID, Username, Role FROM Users WHERE Username = :username LIMIT 1');
    $temp3->execute([':username' => $bossman]);$bossUser = $temp3->fetch();

    if (!$bossUser) {
        respond(404, [
            'error' => 'Boss not found'
        ]);
    }

    //check boss is really boss
    if ($bossUser['Role'] !== 'Admin') {
        respond(400, [
            'error' => 'Boss is not a true boss. Disgrace.'
        ]);
    }

    //set boss to user
    $stmt = $db->prepare('UPDATE Users SET Boss = :boss WHERE ID = :userid');

    $stmt->execute([':boss' => $bossUser['Username'],':userid' => $employee['ID']]);

    respond(200, [
        'message' => 'User assigned to admin',
        'user' => $employee['Username'],
        'boss' => $bossUser['Username'],
        'error' => ''
    ]);
}

if ($method === 'POST' && $action === 'getpwdresetcode') {
    $username = clean($body['username']);
    $code = rand_int(100000, 999999);

    $stmt = $db->prepare('UPDATE Users SET code = :code WHERE Username = :username');
    $stmt->execute([':code' => $code, ':username' => $username]);

    if ($stmt->rowCount() === 0) {
        respond(400, [
            'message' => 'That user does not exist!',
            'error' => ''
        ]);
    }

    respond(200, [
        'message' => 'Reset code generated',
        'code' => $code,
        'error' => ''
    ]);
}

if ($method === 'POST' && $action === 'setnewpwd') {
    $username = clean($body['username']);
    $newPassword = clean($body['newpassword']);
    $code = clean($body['code']);

    $stmt = $db->prepare('SELECT Username FROM Users WHERE code = :code');
    $stmt->execute([':code' => $code]);
    
    if ($stmt->rowCount() === 0) {
        respond(400, [
            'message' => 'That user does not exist!',
            'error' => ''
        ]);
    }

    $user = $stmt->fetch();
    if ($username !== $user['Username']) {
        respond(400, [
            'message' => 'Wrong code!',
            'error' => ''
        ]);
    }
    $stmt = $db->prepare('UPDATE Users SET Password = :newPassword, code = NULL WHERE Username = :username');
    $stmt->execute([':newPassword' => $newPassword, ':username' => $username]);

    respond(200, [
        'message' => 'Password changed successfully!',
        'error' => ''
    ]);
}
