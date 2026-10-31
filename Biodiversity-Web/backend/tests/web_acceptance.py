"""Non-IoT business/security regression against disposable PHP/MySQL fixtures."""
import base64
import copy
import os
from pathlib import Path
import struct
import subprocess
import unittest
import uuid
import zlib
from observations_integration import Client


def photo():
    # Valid PNG over 8 KiB: regression for the old JSON body limit.
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))
    pixels = b''.join(b'\0' + os.urandom(128 * 3) for _ in range(128))
    raw = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', 128, 128, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(pixels)) + chunk(b'IEND', b'')
    return 'data:image/png;base64,' + base64.b64encode(raw).decode()


class WebAcceptance(unittest.TestCase):
    def setUp(self):
        self.officer = Client('officer')
        self.admin = Client('admin')
        self.ids = []

    def tearDown(self):
        for row in self.ids:
            self.officer.call(f'/api/delete_species.php?id={row}', {})

    def payload(self):
        return dict(common_name='Acceptance ' + uuid.uuid4().hex, scientific_name='Testus validation', family='Testaceae', description='Field description / 中文', status='Endangered', photo=photo(), photo_name='test.png', ecological_info='Forest habitat', cultural_sign='Supporting information')

    def create(self):
        payload = self.payload()
        code, result = self.officer.call('/api/add_species.php', payload)
        self.assertEqual(code, 201, result)
        self.ids.append(result['species_id'])
        return result['species_id'], payload

    def test_crud_photograph_supporting_information_report(self):
        row, payload = self.create()
        code, result = self.officer.call(f'/api/get_species.php?id={row}')
        self.assertEqual(code, 200)
        for key, value in payload.items(): self.assertEqual(result[key], value)
        payload.update(common_name='Updated acceptance plant', photo='', photo_name='')
        self.assertEqual(self.officer.call(f'/api/edit_species.php?id={row}', payload)[0], 200)
        saved = self.officer.call(f'/api/get_species.php?id={row}')[1]
        self.assertIsNone(saved['photo'])
        self.assertEqual(saved['photo_name'], '')
        reports = self.officer.call('/api/get_biodiversity_report.php')[1]
        self.assertEqual(next(r for r in reports if int(r['species_id']) == row)['common_name'], payload['common_name'])
        self.assertEqual(self.officer.call(f'/api/delete_species.php?id={row}', {})[0], 200)
        self.assertEqual(self.officer.call(f'/api/get_species.php?id={row}')[0], 404)
        self.assertEqual(self.officer.call(f'/api/edit_species.php?id={row}', payload)[0], 404)
        self.ids.remove(row)

    def test_invalid_input_and_photo_content(self):
        for patch in [{'family': []}, {'common_name': ''}, {'description': 'x' * 10001}, {'status': 'invented'}, {'photo': 'data:image/svg+xml;base64,PHN2Zz4='}, {'photo': 'data:image/png;base64,aGVsbG8='}, {'photo': []}]:
            payload = self.payload(); payload.update(patch)
            self.assertEqual(self.officer.call('/api/add_species.php', payload)[0], 400, patch.keys())
        self.assertEqual(self.officer.call('/api/get_species.php?id=-1')[0], 400)
        self.assertEqual(self.officer.call('/api/add_species.php', self.payload(), csrf=False)[0], 403)

    def test_anonymous_and_role_policy(self):
        reads = ['/api/get_species.php', '/api/get_users.php', '/api/get_observations.php', '/api/get_biodiversity_report.php', '/api/get_species_distribution.php']
        writes = ['/api/add_species.php', '/api/edit_species.php?id=1', '/api/delete_species.php?id=1', '/api/add_user.php', '/api/update_user_role.php', '/api/deactivate_user.php']
        anonymous = Client()
        for path in reads: self.assertEqual(anonymous.call(path)[0], 401, path)
        for path in writes: self.assertEqual(anonymous.call(path, {})[0], 401, path)
        for role in ['user', 'botanist']:
            client = Client(role)
            for path in writes: self.assertEqual(client.call(path, {})[0], 403, (role, path))
        self.assertEqual(Client('user').call('/api/get_species.php')[0], 200)
        self.assertEqual(Client('botanist').call('/api/get_species.php')[0], 403)
        for path in ['/api/get_users.php', '/api/add_user.php', '/api/update_user_role.php', '/api/deactivate_user.php']:
            self.assertEqual(self.officer.call(path, {} if 'get_users' not in path else None)[0], 403)

    def test_live_role_disabled_and_logout_enforcement(self):
        def change(role, active):
            subprocess.run([os.environ['REVIEW_TEST_PHP'], str(Path(__file__).with_name('change_fixture_user.php')), 'officer', role, active], check=True, capture_output=True)
        try:
            change('user', '1')
            for path in ['/api/add_species.php', '/api/edit_species.php?id=1', '/api/delete_species.php?id=1']:
                self.assertEqual(self.officer.call(path, {})[0], 403)
            change('conservation_officer', '0')
            self.assertEqual(self.officer.call('/api/get_species.php')[0], 401)
        finally: change('conservation_officer', '1')
        self.officer = Client('officer')
        self.assertEqual(self.officer.call('/auth/logout.php', {})[0], 200)
        self.assertEqual(self.officer.call('/api/get_species.php')[0], 401)

    def test_admin_provisioning_password_validation_and_registration_types(self):
        for password in ['short', 'x' * 73]:
            self.assertEqual(self.admin.call('/api/add_user.php', dict(name='Test', email='test@example.test', password=password, role='user'))[0], 400)
        self.assertEqual(self.admin.call('/api/update_user_role.php', dict(user_id=[], role=[]))[0], 400)
        self.assertEqual(self.admin.call('/api/deactivate_user.php', dict(user_id=[]))[0], 400)
        self.assertEqual(self.admin.call('/api/update_user_role.php', dict(user_id=2147483647, role='user'))[0], 404)
        self.assertEqual(self.admin.call('/auth/register.php', dict(name=[], email=[], password=[]))[0], 400)

    def test_origin_headers_and_sensitive_paths(self):
        import urllib.request
        import urllib.error
        from observations_integration import BASE
        req = urllib.request.Request(BASE + '/auth/csrf.php', headers={'Origin': 'https://untrusted.example'})
        with self.assertRaises(urllib.error.HTTPError) as error: urllib.request.urlopen(req)
        self.assertEqual(error.exception.code, 403)
        with urllib.request.urlopen(BASE + '/auth/csrf.php') as response:
            self.assertEqual(response.headers['Cache-Control'], 'no-store')
            self.assertEqual(response.headers['X-Frame-Options'], 'DENY')
            self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
        for path in ['/.env', '/schema.sql', '/bootstrap.php', '/bin/create-user.php']:
            with self.assertRaises(urllib.error.HTTPError) as error: urllib.request.urlopen(BASE + path)
            self.assertEqual(error.exception.code, 404)


if __name__ == '__main__': unittest.main(verbosity=2)
