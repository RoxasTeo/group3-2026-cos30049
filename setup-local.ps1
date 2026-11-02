<#
.SYNOPSIS
  One-step local setup for the Niah Biodiversity System (PHP backend, Web portal, mobile app).

.DESCRIPTION
  Safe to run again at any time; every step skips work that is already done.
    1. Finds PHP, MySQL/MariaDB and Node (including XAMPP and MySQL Server installs).
    2. Creates the private encryption key outside the repository (never overwrites one).
    3. Creates or completes Biodiversity-Web/backend/.env without changing values you set.
    4. New database: creates it, the runtime account and the schema.
       Existing database: backs it up, applies missing migrations 006/007 and encrypts plaintext fields.
    5. Creates the first accounts when the database has none
       (-Demo: shared demo accounts and sample data instead, for local development only).
    6. Installs Web and mobile dependencies.

  Run from the repository root:
    powershell -ExecutionPolicy Bypass -File .\setup-local.ps1
    powershell -ExecutionPolicy Bypass -File .\setup-local.ps1 -Demo

  The MySQL administrator (root) password is asked for and used only by this script's
  child processes. Set NIAH_DB_ROOT_PASSWORD to skip the prompt (empty is allowed for XAMPP).
#>
[CmdletBinding()]
param(
    [string]$DbHost = 'localhost',
    [int]$DbPort = 3306,
    [string]$DbName = 'biodiversity_db',
    [string]$DbUser = 'biodiversity_app',
    [string]$DbRootUser = 'root',
    [string]$PrivateDir = (Join-Path $env:LOCALAPPDATA 'NiahBiodiversity'),
    [switch]$SkipAccounts,
    [switch]$Demo,
    [switch]$SkipNpm
)

# Native tools write warnings to stderr; failures are detected through exit codes instead.
$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
$backend = Join-Path $root 'Biodiversity-Web\backend'
$envFile = Join-Path $backend '.env'
$utf8 = New-Object System.Text.UTF8Encoding $false
$OutputEncoding = $utf8

function Step($text) { Write-Host ''; Write-Host "==> $text" -ForegroundColor Cyan }
function Ok($text) { Write-Host "    $text" -ForegroundColor Green }
function Note($text) { Write-Host "    $text" -ForegroundColor Yellow }
function Fail($text) { Write-Host ''; Write-Host "SETUP STOPPED: $text" -ForegroundColor Red; exit 1 }

function Find-Tool([string]$name, [string[]]$candidates) {
    $command = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) { return $command.Source }
    foreach ($pattern in $candidates) {
        $match = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
        if ($match) { return $match.FullName }
    }
    return $null
}

# ---------------------------------------------------------------- 1. Tools
Step 'Checking tools'
if (-not (Test-Path (Join-Path $backend 'schema.sql'))) { Fail 'Run this script from the repository root (setup-local.ps1 sits next to README.md).' }
$php = Find-Tool 'php' @('C:\xampp\php\php.exe')
$mysql = Find-Tool 'mysql' @('C:\xampp\mysql\bin\mysql.exe', 'C:\Program Files\MySQL\MySQL Server *\bin\mysql.exe', 'C:\Program Files\MariaDB *\bin\mysql.exe')
$npm = Find-Tool 'npm.cmd' @('C:\Program Files\nodejs\npm.cmd')
if (-not $php) { Fail 'PHP 8.1+ was not found. Install XAMPP or PHP and add it to PATH.' }
if (-not $mysql) { Fail 'The mysql client was not found. Install XAMPP or MySQL Server and start its database service.' }
if (-not $npm -and -not $SkipNpm) { Fail 'Node.js/npm was not found. Install Node.js LTS.' }
$mysqldump = Join-Path (Split-Path $mysql) 'mysqldump.exe'
Ok "PHP:   $php"
Ok "MySQL: $mysql"
if ($npm) { Ok "npm:   $npm" }
# Windows PowerShell strips double quotes from native arguments, so run the check from a file.
$phpCheck = Join-Path ([System.IO.Path]::GetTempPath()) 'niah-php-check.php'
[System.IO.File]::WriteAllText($phpCheck, '<?php echo (version_compare(PHP_VERSION, "8.1", ">=") ? "" : "PHP 8.1+ ") . (extension_loaded("pdo_mysql") ? "" : "pdo_mysql ") . (extension_loaded("openssl") ? "" : "openssl ") . (function_exists("getimagesizefromstring") ? "" : "gd");', $utf8)
$extensions = "$(& $php $phpCheck)"
Remove-Item $phpCheck -ErrorAction SilentlyContinue
if ($extensions.Trim()) { Fail "PHP is missing: $extensions. Enable them in php.ini (php --ini shows which file)." }
Ok 'PHP version and extensions are fine'

# ---------------------------------------------------------------- 2. Encryption key
Step 'Encryption key'
$keyFile = Join-Path $PrivateDir 'data.key'
$backupDir = Join-Path $PrivateDir 'backups'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
if (Test-Path $keyFile) {
    Ok "Using existing key: $keyFile"
} else {
    & $php (Join-Path $backend 'bin\generate-data-key.php') $keyFile
    if ($LASTEXITCODE -ne 0) { Fail 'Could not create the encryption key.' }
    Ok "Created $keyFile"
    Note 'Keep a private backup copy of this file. Never commit it or share it in chat.'
}

# ---------------------------------------------------------------- 3. .env
Step 'Backend configuration (.env)'
if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $backend '.env.example') $envFile
    Ok 'Created .env from .env.example'
}
$lines = [System.Collections.Generic.List[string]]([System.IO.File]::ReadAllLines($envFile))
function Get-EnvValue([string]$key) {
    foreach ($line in $lines) { if ($line -match "^\s*$([regex]::Escape($key))\s*=(.*)$") { return $Matches[1].Trim() } }
    return $null
}
function Set-EnvValue([string]$key, [string]$value) {
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^\s*$([regex]::Escape($key))\s*=") { $lines[$i] = "$key=$value"; return }
    }
    $lines.Add("$key=$value")
}
# Only fill values that are missing, empty or still the example placeholder.
function Default-EnvValue([string]$key, [string]$value) {
    $current = Get-EnvValue $key
    if ($null -eq $current -or $current -eq '' -or $current -eq 'change-me') { Set-EnvValue $key $value; return $value }
    return $current
}
# Values given on the command line win; otherwise existing .env values are kept.
foreach ($pair in @(@('DbHost', 'DB_HOST'), @('DbPort', 'DB_PORT'), @('DbName', 'DB_NAME'), @('DbUser', 'DB_USER'))) {
    $value = "$(Get-Variable $pair[0] -ValueOnly)"
    if ($PSBoundParameters.ContainsKey($pair[0])) { Set-EnvValue $pair[1] $value } else { Set-Variable $pair[0] (Default-EnvValue $pair[1] $value) }
}
$DbPort = [int]$DbPort
$bytes = New-Object byte[] 18
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$generated = [Convert]::ToBase64String($bytes) -replace '[^A-Za-z0-9]', 'x'
$DbPassword = Default-EnvValue 'DB_PASSWORD' $generated
Default-EnvValue 'APP_ORIGIN' 'http://localhost:5173' | Out-Null
Default-EnvValue 'APP_ENV' 'development' | Out-Null
# Lets the Expo web preview (npx expo start, then press w) call the mobile API; phones send no Origin.
Default-EnvValue 'MOBILE_WEB_ORIGINS' 'http://localhost:8081' | Out-Null
Default-EnvValue 'COOKIE_SECURE' 'false' | Out-Null
Default-EnvValue 'DATA_ENCRYPTION_KEY_FILE' ($keyFile -replace '\\', '/') | Out-Null
Default-EnvValue 'DATA_ENCRYPTION_BACKUP_DIR' ($backupDir -replace '\\', '/') | Out-Null
Default-EnvValue 'DATA_ENCRYPTION_MAINTENANCE' 'false' | Out-Null
if ((Get-EnvValue 'DATA_ENCRYPTION_MAINTENANCE') -eq 'true') { Set-EnvValue 'DATA_ENCRYPTION_MAINTENANCE' 'false'; Note 'Turned maintenance mode off.' }
# The .env loader reads plain KEY=value lines; a UTF-8 BOM would corrupt the first key.
[System.IO.File]::WriteAllLines($envFile, $lines, $utf8)
Ok "Database $DbName on ${DbHost}:$DbPort, runtime account $DbUser"
if ($DbUser -eq 'root') { Note 'DB_USER is root. A dedicated account is safer; the script leaves your choice unchanged.' }

# ---------------------------------------------------------------- 4. Database
Step 'Database'
if ($null -ne $env:NIAH_DB_ROOT_PASSWORD) {
    $rootPassword = $env:NIAH_DB_ROOT_PASSWORD
} else {
    $secure = Read-Host "MySQL $DbRootUser password (XAMPP default: press Enter)" -AsSecureString
    $rootPassword = [System.Net.NetworkCredential]::new('', $secure).Password
}
# MYSQL_PWD keeps the password off the command line; it is removed again at the end.
$env:MYSQL_PWD = $rootPassword
function Sql([string]$query, [string]$database = '') {
    $arguments = @('-h', $DbHost, '-P', "$DbPort", '-u', $DbRootUser, '--batch', '--skip-column-names', '--default-character-set=utf8mb4')
    if ($database) { $arguments += $database }
    $output = $query | & $mysql @arguments 2>&1
    if ($LASTEXITCODE -ne 0) { Fail "MySQL error: $($output -join ' ')" }
    return $output
}
function SqlFile([string]$path, [string]$database) { Sql ([System.IO.File]::ReadAllText($path, $utf8)) $database | Out-Null }
function Has([string]$query) { return [int]((Sql $query) | Select-Object -First 1) -gt 0 }
$q = $DbName -replace "'", "''"
Sql 'SELECT 1' | Out-Null
Ok 'Connected as administrator'

$exists = Has "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='$q'"
$hasUsers = $exists -and (Has "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$q' AND TABLE_NAME='users'")
if (-not $exists) { Sql "CREATE DATABASE ``$DbName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci" | Out-Null; Ok "Created database $DbName" }

# Runtime account: data access only. PHP may connect as localhost or 127.0.0.1, so allow both.
$pw = $DbPassword -replace "'", "''"
foreach ($from in @('localhost', '127.0.0.1')) {
    Sql "CREATE USER IF NOT EXISTS '$DbUser'@'$from' IDENTIFIED BY '$pw'; ALTER USER '$DbUser'@'$from' IDENTIFIED BY '$pw'; GRANT SELECT, INSERT, UPDATE, DELETE ON ``$DbName``.* TO '$DbUser'@'$from'; FLUSH PRIVILEGES;" | Out-Null
}
Ok "Runtime account $DbUser can read and write $DbName"

if (-not $hasUsers) {
    SqlFile (Join-Path $backend 'schema.sql') $DbName
    # A damaged MySQL/MariaDB data folder can accept CREATE DATABASE but fail every CREATE TABLE.
    $required = @('users', 'species', 'observations', 'data_protection_state', 'mobile_tokens', 'sensor_readings', 'threat_alerts')
    $found = @(Sql "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='$q'")
    $missing = @($required | Where-Object { $found -notcontains $_ })
    if ($missing.Count) {
        Fail "schema.sql did not create these tables: $($missing -join ', '). MySQL itself may be damaged: check its error log (XAMPP: C:\xampp\mysql\data\mysql_error.log) for InnoDB errors, then run this script again."
    }
    Ok "Imported schema.sql (new database, $($found.Count) tables)"
} else {
    Note 'Existing data found: backing up, then upgrading in place.'
    $dump = Join-Path $backupDir ("$DbName-before-setup-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.sql')
    & $mysqldump -h $DbHost -P $DbPort -u $DbRootUser --single-transaction --routines --result-file=$dump $DbName 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $dump)) { Fail 'Backup with mysqldump failed; nothing was changed.' }
    Ok "Backup: $dump"
    Note 'This backup is not encrypted. Keep it private and delete it once you no longer need it.'
    if (-not (Has "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$q' AND TABLE_NAME='tracked_plants'")) {
        Fail 'This database predates migrations 001-004. Apply them first as described in Biodiversity-Web/SETUP.md section 9, then run this script again.'
    }
    if (-not (Has "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$q' AND TABLE_NAME='observations' AND COLUMN_NAME='morphology'")) {
        SqlFile (Join-Path $backend 'migrations\006_mobile_api.sql') $DbName; Ok 'Applied migration 006 (mobile)'
    } else { Ok 'Migration 006 already applied' }
    if (-not (Has "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$q' AND TABLE_NAME='sensor_readings' AND COLUMN_NAME='distance_cm'")) {
        SqlFile (Join-Path $backend 'migrations\007_iot_movement_gps_alerts.sql') $DbName; Ok 'Applied migration 007 (IoT)'
    } else { Ok 'Migration 007 already applied' }
}

# Encrypt plaintext fields (no-op on new or already encrypted databases). The tool changes
# columns, so the runtime account gets schema privileges only while it runs.
$userCount = [int]((Sql "SELECT COUNT(*) FROM users" $DbName) | Select-Object -First 1)
if ($userCount -gt 0) {
    $saved = $env:DATA_ENCRYPTION_MAINTENANCE
    $schemaGrant = "ALTER, CREATE, DROP, INDEX ON ``$DbName``.*"
    foreach ($from in @('localhost', '127.0.0.1')) { Sql "GRANT $schemaGrant TO '$DbUser'@'$from'" | Out-Null }
    try {
        $encrypt = Join-Path $backend 'bin\encrypt-sensitive-data.php'
        $check = & $php $encrypt --check 2>&1
        if ($LASTEXITCODE -eq 2) {
            Note 'Stop any running PHP server for this project before continuing.'
            $env:DATA_ENCRYPTION_MAINTENANCE = 'true'
            & $php $encrypt --apply 2>&1 | ForEach-Object { Write-Host "    $_" }
            if ($LASTEXITCODE -ne 0) { Fail 'Encryption migration failed. Your backup is in the backups folder; see the error above.' }
            $env:DATA_ENCRYPTION_MAINTENANCE = 'false'
            $check = & $php $encrypt --check 2>&1
        }
        if ($LASTEXITCODE -ne 0) { Fail "Encryption check failed: $($check -join ' '). If this database was encrypted with another key, use that key file." }
        Ok "Sensitive fields are encrypted ($($check -join ' '))"
    } finally {
        if ($null -eq $saved) { Remove-Item Env:DATA_ENCRYPTION_MAINTENANCE -ErrorAction SilentlyContinue } else { $env:DATA_ENCRYPTION_MAINTENANCE = $saved }
        foreach ($from in @('localhost', '127.0.0.1')) { Sql "REVOKE $schemaGrant FROM '$DbUser'@'$from'" | Out-Null }
    }
}

# ---------------------------------------------------------------- 5. Accounts
Step 'Accounts'
if ($Demo) {
    & $php (Join-Path $backend 'bin\seed-demo.php') 2>&1 | ForEach-Object { Write-Host "    $_" }
    if ($LASTEXITCODE -ne 0) { Fail 'Adding the demo accounts and sample data failed (see the message above).' }
    Note 'Demo sign-in (local only): officer@niah.demo, botanist@niah.demo, admin@niah.demo - password NiahDemo@2026'
} elseif ($userCount -gt 0) {
    Ok "$userCount account(s) already exist; none created."
} elseif ($SkipAccounts) {
    Note 'Skipped. Create one later: php Biodiversity-Web/backend/bin/create-user.php EMAIL "NAME" conservation_officer'
} else {
    $createUser = Join-Path $backend 'bin\create-user.php'
    foreach ($role in @('conservation_officer', 'botanist', 'admin')) {
        $optional = $role -ne 'conservation_officer'
        $email = Read-Host ("Email for the $role account" + $(if ($optional) { ' (Enter to skip)' } else { '' }))
        if (-not $email) { if ($optional) { continue } else { Fail 'At least one conservation officer account is required.' } }
        $name = Read-Host 'Display name'
        do {
            $secret = Read-Host 'Password (12-72 characters)' -AsSecureString
            $plain = [System.Net.NetworkCredential]::new('', $secret).Password
        } while ($plain.Length -lt 12 -or $plain.Length -gt 72)
        $plain | & $php $createUser $email $name $role 2>&1 | Where-Object { $_ -notmatch 'Password \(' } | ForEach-Object { Write-Host "    $_" }
        if ($LASTEXITCODE -ne 0) { Fail "Could not create $email." }
        $plain = $null
    }
}

# ---------------------------------------------------------------- Readiness check
# Connect exactly as the backend will (.env runtime account and key), so problems surface here, not as a 500 on login.
Step 'Checking the backend can use the database'
$accounts = [int]((Sql "SELECT COUNT(*) FROM users" $DbName) | Select-Object -First 1)
Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
$rootPassword = $null
$probe = Join-Path ([System.IO.Path]::GetTempPath()) 'niah-backend-check.php'
[System.IO.File]::WriteAllText($probe, '<?php require $argv[1] . "/bootstrap.php"; $db = database(); $db->query("SELECT 1 FROM users LIMIT 1"); if ((int) $db->query("SELECT COUNT(*) FROM users")->fetchColumn() > 0) assertDatabaseKey($db); echo "ready";', $utf8)
$result = "$(& $php $probe $backend 2>&1)"
Remove-Item $probe -ErrorAction SilentlyContinue
if ($result -ne 'ready') { Fail "The backend cannot use the database with the settings in .env: $result" }
Ok 'Runtime account, tables and encryption key all work'
if ($accounts -eq 0) {
    $hint = "`"$php`" Biodiversity-Web/backend/bin/create-user.php you@example.com `"Your Name`" conservation_officer"
    if ($SkipAccounts) { Note "No accounts yet; nobody can sign in until you run: $hint" }
    else { Fail "No accounts were created, so nobody can sign in. Run: $hint" }
} else { Ok "$accounts account(s) can sign in" }

# ---------------------------------------------------------------- 6. Dependencies
if (-not $SkipNpm) {
    Step 'Installing Web dependencies'
    Push-Location (Join-Path $root 'Biodiversity-Web\Biodiversity-Website'); & $npm ci --no-audit --no-fund; $webOk = $LASTEXITCODE -eq 0; Pop-Location
    if (-not $webOk) { Fail 'npm ci failed for the Web portal.' }
    Step 'Installing mobile dependencies'
    Push-Location (Join-Path $root 'mobile'); & $npm ci --no-audit --no-fund; $mobileOk = $LASTEXITCODE -eq 0; Pop-Location
    if (-not $mobileOk) { Fail 'npm ci failed for the mobile app.' }
}

# ---------------------------------------------------------------- Done
Step 'Setup complete. Start the project in three terminals:'
Write-Host "    1) Backend : $php -S 0.0.0.0:8080 -t Biodiversity-Web/backend/public"
Write-Host '    2) Web     : cd Biodiversity-Web/Biodiversity-Website; npm run dev    -> http://localhost:5173'
Write-Host '    3) Mobile  : cd mobile; npx expo start                             -> scan with Expo Go (SDK 58)'
Write-Host ''
Note 'Phones need Windows Firewall to allow PHP (8080) and Node.js (8081) on Private networks.'
