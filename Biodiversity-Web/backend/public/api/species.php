<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['role'])) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Authentication required. Please log in.']);
    exit();
}

$current_role = $_SESSION['role'];
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        if (isset($_GET['id'])) {
            handleGetSingleSpecies((int)$_GET['id']);
        } else {
            handleGetSpecies();
        }
        break;

    case 'POST':
        enforceWriteAccess($current_role);
        verifyCsrfToken();
        handleSaveSpecies();
        break;

    case 'DELETE':
        enforceWriteAccess($current_role);
        verifyCsrfToken();
        handleDeleteSpecies((int)$_GET['id']);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed.']);
        break;
}

function getDatabaseConnection() {
    $host = '127.0.0.1';
    $db   = 'biodiversity_db'; 
    $user = 'biodiversity_app';               
    $pass = 'create-me';                   
    $charset = 'utf8mb4';

    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        return new PDO($dsn, $user, $pass, $options);
    } catch (\PDOException $e) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
        exit();
    }
}

function handleGetSpecies() {
    header('Content-Type: application/json');
    $pdo = getDatabaseConnection();
    
    try {
        $stmt = $pdo->query("SELECT * FROM species ORDER BY common_name ASC");
        $species = $stmt->fetchAll();
        echo json_encode($species);
        exit();
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Query failure: ' . $e->getMessage()]);
        exit();
    }
}

function handleGetSingleSpecies($id) {
    header('Content-Type: application/json');
    $pdo = getDatabaseConnection();
    
    try {
        $stmt = $pdo->prepare("SELECT * FROM species WHERE species_id = ?");
        $stmt->execute([$id]);
        $record = $stmt->fetch();
        
        if (!$record) {
            http_response_code(404);
            echo json_encode(['error' => 'Target species record does not exist.']);
            exit();
        }
        
        echo json_encode($record);
        exit();
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Query breakdown: ' . $e->getMessage()]);
        exit();
    }
}

function handleSaveSpecies() {
    header('Content-Type: application/json');
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Core parameters mapping constraint validation check
    if (empty($input['common_name']) || empty($input['scientific_name']) || empty($input['family'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing critical fields: common name, scientific name, and family are required.']);
        exit();
    }

    $pdo = getDatabaseConnection();
    $target_id = isset($_GET['id']) ? (int)$_GET['id'] : null;
    $clean_status = (!isset($input['status']) || trim($input['status']) === '') ? 'Not Evaluated' : trim($input['status']);
    $clean_description = (!isset($input['description']) || trim($input['description']) === '') ? 'No description provided.' : trim($input['description']);

    try {
        if ($target_id) {
            $sql = "UPDATE species SET 
                        common_name = :common_name, scientific_name = :scientific_name, 
                        family = :family, genus = :genus, status = :status, habitat = :habitat, 
                        description = :description, ecological_info = :ecological_info, 
                        cultural_sign = :cultural_sign, photo = :photo, photo_name = :photo_name
                    WHERE species_id = :species_id";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':common_name'      => $input['common_name'],
                ':scientific_name'  => $input['scientific_name'],
                ':family'           => $input['family'],
                ':genus'            => !empty($input['genus']) ? $input['genus'] : null,
                ':status'           => $clean_status, // 🟩 Uses safe fallback
                ':habitat'          => !empty($input['habitat']) ? $input['habitat'] : null,
                ':description'      => $clean_description, // 🟩 Uses safe fallback
                ':ecological_info'  => !empty($input['ecological_info']) ? $input['ecological_info'] : null,
                ':cultural_sign'    => !empty($input['cultural_sign']) ? $input['cultural_sign'] : null,
                ':photo'            => !empty($input['photo']) ? $input['photo'] : null,
                ':photo_name'       => !empty($input['photo_name']) ? $input['photo_name'] : null,
                ':species_id'       => $target_id
            ]);
        } else {
            $sql = "INSERT INTO species (common_name, scientific_name, family, genus, status, habitat, description, ecological_info, cultural_sign, photo, photo_name) 
                    VALUES (:common_name, :scientific_name, :family, :genus, :status, :habitat, :description, :ecological_info, :cultural_sign, :photo, :photo_name)";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':common_name'      => $input['common_name'],
                ':scientific_name'  => $input['scientific_name'],
                ':family'           => $input['family'],
                ':genus'            => !empty($input['genus']) ? $input['genus'] : null,
                ':status'           => $clean_status, // 🟩 Uses safe fallback
                ':habitat'          => !empty($input['habitat']) ? $input['habitat'] : null,
                ':description'      => $clean_description, // 🟩 Uses safe fallback
                ':ecological_info'  => !empty($input['ecological_info']) ? $input['ecological_info'] : null,
                ':cultural_sign'    => !empty($input['cultural_sign']) ? $input['cultural_sign'] : null,
                ':photo'            => !empty($input['photo']) ? $input['photo'] : null,
                ':photo_name'       => !empty($input['photo_name']) ? $input['photo_name'] : null
            ]);
        }
        echo json_encode(['status' => 'success']);
        exit();
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database operation failure: ' . $e->getMessage()]);
        exit();
    }
}

function handleDeleteSpecies($id) {
    header('Content-Type: application/json');
    $pdo = getDatabaseConnection();
    try {
        $stmt = $pdo->prepare("DELETE FROM species WHERE species_id = ?");
        $stmt->execute([$id]);
        echo json_encode(['status' => 'success']);
        exit();
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
        exit();
    }
}

function enforceWriteAccess($role) {
    $allowed_writers = ['conservation_officer', 'admin'];
    if (!in_array($role, $allowed_writers)) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Access Denied: Insufficient write privileges.']);
        exit();
    }
}

function verifyCsrfToken() {
    $headers = getallheaders();
    $received_token = $headers['X-CSRF-Token'] ?? $headers['x-csrf-token'] ?? '';
    if (empty($received_token) || !isset($_SESSION['csrf_token']) || $received_token !== $_SESSION['csrf_token']) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'CSRF integrity check failed.']);
        exit();
    }
}
