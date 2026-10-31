"""Destructive only to a newly-created, random, disposable database owned by this test."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import uuid

PHP = os.environ.get('REVIEW_TEST_PHP', '')
if os.environ.get('REVIEW_TEST_FIXTURES') != '1' or os.environ.get('DB_HOST') != '127.0.0.1' or not os.environ.get('DB_NAME', '').endswith('_test'):
    raise RuntimeError('Explicit disposable loopback test environment required.')
ROOT = Path(__file__).resolve().parents[3]
BACKEND = Path(__file__).resolve().parents[1]

def php(code, env):
    result = subprocess.run([PHP], input="<?php\nrequire 'Biodiversity-Web/backend/bootstrap.php';\n" + code, encoding='utf-8', capture_output=True, cwd=ROOT, env=env)
    if result.returncode:
        raise AssertionError(result.stderr + result.stdout)
    return result.stdout

class Migration(unittest.TestCase):
    def test_legacy_migration_idempotence_and_encrypted_restore(self):
        # The application key is never copied or printed. Backups are private test artifacts.
        original = dict(os.environ)
        key_directory = php("echo dirname(privateDataPath(setting('DATA_ENCRYPTION_KEY_FILE')));", original).strip()
        backup_dir = tempfile.mkdtemp(prefix='migration-test-', dir=key_directory)
        name = 'crypto_migration_' + uuid.uuid4().hex[:12] + '_test'
        env = dict(original, DB_NAME=name, DATA_ENCRYPTION_MAINTENANCE='true', DATA_ENCRYPTION_BACKUP_DIR=backup_dir)
        admin = "$name=setting('DB_NAME');if(!preg_match('/^crypto_migration_[a-f0-9]+_test$/D',$name))throw new RuntimeException('Invalid test name');$admin=new PDO('mysql:host=127.0.0.1;port='.setting('DB_PORT'),setting('DB_USER'),setting('DB_PASSWORD'),databaseOptions());"
        created = False
        def migrate(mode, expected):
            result = subprocess.run([PHP, str(BACKEND / 'bin/encrypt-sensitive-data.php'), mode], env=env, cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(result.returncode, expected, result.stderr + result.stdout)
        try:
            php(admin + '$admin->exec("CREATE DATABASE `$name`");', env); created = True
            php("""
$db=database();$db->exec(file_get_contents('Biodiversity-Web/backend/schema.sql'));
assertDatabaseKey($db,true);$db->exec('DELETE FROM data_protection_state');
$db->exec('ALTER TABLE users DROP INDEX email_lookup, DROP COLUMN email_lookup, MODIFY name VARCHAR(120) NOT NULL, MODIFY email VARCHAR(254) NOT NULL, ADD UNIQUE KEY legacy_email (email)');
$q=$db->prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)');$q->execute(['Legacy migration fixture','legacy@example.test',password_hash('Migration-Test-Only-2026!',PASSWORD_BCRYPT),'conservation_officer']);
$q=$db->prepare('INSERT INTO observations(submitted_by,client_reference,plant_tag,common_name,field_notes,habitat,photos,photo_count) VALUES(1,?,?,?,?,?,?,0)');$q->execute(['crypto-reference','CRYPTO-TAG','Test plant','Sensitive note / 中文','Test habitat','[]']);
$q=$db->prepare('INSERT INTO observation_reviews(observation_id,reviewer_id,decision,notes,checks,observation_version) VALUES(1,1,?,?,?,1)');$q->execute(['Approved','Sensitive reviewer note','{}']);
""", env)
            migrate('--check', 2); migrate('--apply', 0); migrate('--check', 0)
            php("""
$db=database();$row=$db->query('SELECT * FROM users WHERE id=1')->fetch();$plain=revealUser($row);
if($plain['name']!=='Legacy migration fixture'||$plain['email']!=='legacy@example.test'||!password_verify('Migration-Test-Only-2026!',$row['password_hash'])||$row['email_lookup']!==emailLookup('legacy@example.test'))throw new RuntimeException('Migration changed identity or password.');
createProtectedUser($db,'New encrypted fixture','new@example.test',password_hash('Migration-Test-Only-2026!',PASSWORD_BCRYPT),'user');
$db->exec("UPDATE users SET name='enc:v1:invalid' WHERE id=1");
""", env)
            backups = list(Path(backup_dir).glob('sensitive-*.enc')); self.assertEqual(len(backups), 1)
            restored = subprocess.run([PHP, str(BACKEND / 'bin/restore-sensitive-data.php'), str(backups[0]), '--apply'], env=env, cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(restored.returncode, 0, restored.stderr + restored.stdout)
            php("""
$db=database();$rows=$db->query('SELECT * FROM users ORDER BY id')->fetchAll();
if(count($rows)!==2||revealUser($rows[0])['name']!=='Legacy migration fixture'||revealUser($rows[1])['name']!=='New encrypted fixture')throw new RuntimeException('Encrypted restore failed or newer row was overwritten.');
$row=$db->query('SELECT * FROM observations WHERE id=1')->fetch();if(revealData($row['field_notes'],observationSecretContext($row,'field_notes'))!=='Sensitive note / 中文')throw new RuntimeException('Observation changed.');
$row=$db->query('SELECT * FROM observation_reviews WHERE id=1')->fetch();if(revealData($row['notes'],'reviews.notes:1:1:1')!=='Sensitive reviewer note')throw new RuntimeException('Review changed.');
""", env)
            migrate('--apply', 0); migrate('--check', 0)
            print('PASS legacy schema migration, preserved IDs/passwords, authenticated backup restore, newer-row preservation and repeat migration.')
        finally:
            if created: php(admin + '$admin->exec("DROP DATABASE `$name`");', env)
            for file in Path(backup_dir).glob('sensitive-*.enc'): file.unlink()
            Path(backup_dir).rmdir()

if __name__ == '__main__': unittest.main(verbosity=2)
