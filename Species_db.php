<?php
header('Access-Control-Allow-Origin: http://localhost:5173');
header('Content-Type: application/json');

$conn = new mysqli("localhost", "root", "");

$sql = "CREATE DATABASE IF NOT EXISTS biodiversity_db";

if ($conn->query($sql) === TRUE) {

    $conn->select_db("biodiversity_db");

    $speciesTable = "
        CREATE TABLE IF NOT EXISTS species (
            species_id INT AUTO_INCREMENT PRIMARY KEY,
            common_name VARCHAR(255) NOT NULL,
            scientific_name VARCHAR(255) NOT NULL,
            family VARCHAR(100) NOT NULL,
            genus VARCHAR(100),
            status VARCHAR(50) NOT NULL DEFAULT 'Not Evaluated',
            habitat VARCHAR(200),

            description TEXT NOT NULL,
            ecological_info TEXT,
            cultural_sign TEXT,

            photo MEDIUMTEXT,
            photo_name VARCHAR(255),

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ";
    
    $result1 = $conn->query($speciesTable);

    if ($result1 === TRUE) {
        echo json_encode([
            "message" => "Database and species table created successfully."
        ]);
    } else {
        echo json_encode([
            "error" => "Table creation failed: " . $conn->error
        ]);
    }

} else {
    echo json_encode([
        "error" => "Database creation failed: " . $conn->error
    ]);
}

$conn->close();

?>