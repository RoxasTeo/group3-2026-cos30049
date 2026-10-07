<?php
session_start();

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");

$conn = new mysqli("localhost", "root", "", "biodiversity_db");

if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "Not logged in"]);
    exit;
}

$user_id = $_SESSION['user_id'];

$data = json_decode(file_get_contents("php://input"), true);

$id = intval($_GET['species_id']);
$commonName = $data["commonName"];
$scientificName = $data["scientificName"];
$family = $data["family"];
$genus = $data["genus"] ?? "";
$status = $data["status"];
$habitat = $data["habitat"] ?? "";
$description = $data["description"];
$ecologicalInfo = $data["ecologicalNotes"] ?? "";
$culturalSign = $data["culturalNotes"] ?? "";
$photo = $data["photo"] ?? "";
$photoName = $data["photoName"] ?? "";

$sql = 
"
    UPDATE species
    SET
        common_name = ?,
        scientific_name = ?,
        family = ?,
        genus = ?,
        status = ?,
        habitat = ?,
        description = ?,
        ecological_info = ?,
        cultural_sign = ?,
        photo = ?,
        photo_name = ?
    WHERE species_id = ?
";

$stmt = $conn->prepare($sql);

$stmt->bind_param(
    "sssssssssssi",
    $commonName,
    $scientificName,
    $family,
    $genus,
    $status,
    $habitat,
    $description,
    $ecologicalInfo,
    $culturalSign,
    $photo,
    $photoName
    $id
);

if ($stmt->execute()) {

    echo json_encode([
        "message" => "Species updated successfully.",
        "species_id" => $id
    ]);

} else {

    http_response_code(500);
    echo json_encode([
        "error" => "Failed to update species."
    ]);
}

$stmt->close();
$conn->close();

?>