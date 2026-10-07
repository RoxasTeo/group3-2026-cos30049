<?php
session_start();

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");

$conn = new mysqli("localhost", "root", "", "biodiversity_db");

if (!isset($_SESSION["user_id"])) {
    echo json_encode(["success" => false, "message" => "Not logged in"]);
    exit;
}

$user_id = $_SESSION["user_id"];

if (!isset($_GET['species_id'])) {

    http_response_code(400);

    echo json_encode([
        "error" => "Species ID is required."
    ]);

    exit;
}

$id = intval($_GET['species_id']);

$sql = "DELETE FROM species WHERE species_id = ?";

$stmt = $conn->prepare($sql);
$stmt->bind_param("i", $id);

if ($stmt->execute()) {

    if ($stmt->affected_rows > 0) {

        echo json_encode([
            "message" => "Species deleted successfully."
        ]);

    } else {

        http_response_code(404);

        echo json_encode([
            "error" => "Species not found."
        ]);
    }

} else {

    http_response_code(500);

    echo json_encode([
        "error" => "Failed to delete species."
    ]);
}

$stmt->close();
$conn->close();

?>