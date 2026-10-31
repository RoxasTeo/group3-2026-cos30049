"""HTTP checks against real PHP/MySQL. Use only disposable seed_observations.php fixtures."""
import copy
import http.cookiejar
import json
import os
from pathlib import Path
import subprocess
import unittest
import urllib.error
import urllib.parse
import urllib.request
import uuid

BASE = os.environ.get('REVIEW_TEST_URL', '')
if os.environ.get('REVIEW_TEST_FIXTURES') != '1' or not BASE.startswith('http://localhost:'):
    raise RuntimeError('Set REVIEW_TEST_FIXTURES=1 and REVIEW_TEST_URL=http://localhost:<disposable-test-port>')


class Client:
    def __init__(self, account=None):
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.csrf = ''
        if account:
            code, body = self.call('/auth/csrf.php')
            assert code == 200, body
            self.csrf = body['csrf_token']
            code, body = self.call('/auth/login.php', {'email': account + '@review.test', 'password': 'Review-Test-Only-2026!'})
            assert code == 200, body
            self.csrf = body['csrf_token']

    def call(self, path, body=None, csrf=True):
        headers = {'Accept': 'application/json'}
        if body is not None:
            headers.update({'Content-Type': 'application/json', 'X-CSRF-Token': self.csrf if csrf else 'invalid'})
        req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None, headers=headers)
        try:
            response = self.opener.open(req, timeout=20)
        except urllib.error.HTTPError as error:
            response = error
        return response.code, json.load(response)


class Observations(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.officer, cls.admin, cls.bot, cls.other, cls.user = [Client(name) for name in ('officer', 'admin', 'botanist', 'other-botanist', 'user')]

    def payload(self):
        return {'client_reference': str(uuid.uuid4()), 'plant_tag': 'NIAH-TEMP-TEST', 'common_name': 'Review integration tree', 'field_notes': 'Opposite leaves; no flowers observed.', 'habitat': 'Test forest edge', 'height_m': 3, 'latitude': 3.81024, 'longitude': 113.78062, 'accuracy_m': 8, 'photos': []}

    def submit(self, payload=None):
        code, body = self.bot.call('/api/submit_observation.php', payload or self.payload())
        self.assertEqual(code, 201, body)
        return body['observation']

    def review(self, record, decision='Approved', notes='', **kwargs):
        return self.officer.call('/api/review_observation.php', {'id': record['id'], 'version': record['version'], 'decision': decision, 'notes': notes, 'checks': {'notes': True, 'photos': True, 'gps': True}, **kwargs})

    def test_authentication_roles_and_owner_privacy(self):
        record = self.submit()
        self.assertEqual(Client().call('/api/get_observations.php')[0], 401)
        for client in [self.bot, self.user]:
            self.assertEqual(client.call('/api/get_observations.php')[0], 403)
            self.assertEqual(client.call('/api/review_observation.php', {'id': record['id']})[0], 403)
        self.assertEqual(self.other.call(f"/api/get_observation.php?id={record['id']}")[0], 404)
        self.assertEqual(self.bot.call(f"/api/get_observation.php?id={record['id']}")[0], 200)
        self.assertEqual(self.admin.call('/api/get_observations.php')[0], 200)
        self.assertEqual(self.officer.call('/api/submit_observation.php', self.payload())[0], 403)

    def test_submission_validation_duplicate_and_missing_evidence(self):
        payload = self.payload()
        payload.update({'latitude': None, 'longitude': None, 'accuracy_m': None})
        record = self.submit(payload)
        self.assertIsNone(record['latitude'])
        self.assertEqual(record['photo_count'], 0)
        self.assertEqual(self.bot.call('/api/submit_observation.php', payload)[0], 409)
        for patch in [{'latitude': 999}, {'field_notes': ''}, {'species_id': 2147483647}, {'photos': [{'data_url': 'javascript:alert(1)'}]}, {'photos': [{'data_url': 'data:image/png;base64,aGVsbG8='}]}, {'photos': [{}, {}, {}, {}, {}]}, {'common_name': 'x' * 121}]:
            bad = self.payload(); bad.update(patch)
            self.assertEqual(self.bot.call('/api/submit_observation.php', bad)[0], 400, patch)
        self.assertEqual(self.bot.call('/api/submit_observation.php', self.payload(), csrf=False)[0], 403)

    def test_approve_history_evidence_retention_and_repeat_conflict(self):
        record = self.submit()
        self.assertEqual(self.review(record, checks={})[0], 400)
        self.assertEqual(self.review(record, version=record['version'] + 1)[0], 409)
        self.assertEqual(self.officer.call('/api/review_observation.php', {'id': record['id']}, csrf=False)[0], 403)
        code, body = self.review(record, notes='Field evidence accepted; taxonomy remains provisional.')
        self.assertEqual(code, 200, body)
        saved = body['observation']
        self.assertEqual(saved['status'], 'Approved')
        self.assertEqual(saved['version'], record['version'] + 1)
        self.assertEqual(saved['field_notes'], record['field_notes'])
        self.assertEqual(saved['latitude'], record['latitude'])
        self.assertEqual(len(saved['reviews']), 1)
        self.assertEqual(saved['reviews'][0]['reviewer_name'], 'Officer')
        self.assertEqual(self.review(record)[0], 409)
        code, reloaded = self.officer.call(f"/api/get_observation.php?id={record['id']}")
        self.assertEqual(reloaded['observation']['status'], 'Approved')
        self.assertEqual(len(reloaded['observation']['reviews']), 1)

    def test_changes_rejection_notes_and_queue_filters(self):
        for decision in ['Changes requested', 'Rejected']:
            record = self.submit()
            self.assertEqual(self.review(record, decision, '  ')[0], 400)
            code, body = self.review(record, decision, 'Please provide clearer evidence.')
            self.assertEqual(code, 200, body)
            self.assertEqual(body['observation']['status'], decision)
            query = urllib.parse.urlencode({'status': decision, 'q': record['reference'], 'submitter': record['submitted_by']})
            code, result = self.officer.call('/api/get_observations.php?' + query)
            self.assertEqual(code, 200, result)
            self.assertEqual(result['total'], 1)
            self.assertEqual(result['observations'][0]['id'], record['id'])
            self.assertNotIn('photos', result['observations'][0])
            self.assertEqual(result['counts'][decision], 1)
        self.assertEqual(self.officer.call('/api/get_observations.php?status=Unknown')[0], 400)
        self.assertEqual(self.officer.call('/api/get_observation.php?id=invalid')[0], 400)

    def test_valid_photo_is_persisted_and_html_notes_are_plain_text(self):
        payload = self.payload()
        png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1XkAAAAASUVORK5CYII='
        payload['photos'] = [{'data_url': 'data:image/png;base64,' + png, 'caption': '<script>not executable</script>', 'file_name': 'plant.png'}]
        record = self.submit(payload)
        self.assertEqual(record['photo_count'], 1)
        code, result = self.officer.call(f"/api/get_observation.php?id={record['id']}")
        self.assertEqual(code, 200)
        self.assertEqual(result['observation']['photos'], payload['photos'])

    def test_pagination_and_literal_search(self):
        prefix = 'Pagination-' + uuid.uuid4().hex[:8]
        for index in range(21):
            payload = self.payload(); payload['common_name'] = prefix + str(index)
            self.submit(payload)
        query = urllib.parse.urlencode({'status': 'Pending', 'q': prefix})
        _, first = self.officer.call('/api/get_observations.php?' + query)
        _, second = self.officer.call('/api/get_observations.php?' + query + '&page=2')
        self.assertEqual(first['total'], 21)
        self.assertEqual(first['pages'], 2)
        self.assertEqual(len(first['observations']), 20)
        self.assertEqual(len(second['observations']), 1)
        self.assertTrue({r['id'] for r in first['observations']}.isdisjoint({r['id'] for r in second['observations']}))
        _, result = self.officer.call('/api/get_observations.php?status=All&q=%25%27%20OR%201%3D1')
        self.assertEqual(result['total'], 0)

    def test_own_submission_disabled_accounts_and_live_role_changes(self):
        def change(account, role, active='1'):
            subprocess.run([os.environ['REVIEW_TEST_PHP'], str(Path(__file__).with_name('change_fixture_user.php')), account, role, active], check=True, capture_output=True)
        record = self.submit()
        try:
            change('botanist', 'conservation_officer')
            code, _ = self.bot.call('/api/review_observation.php', {'id': record['id'], 'version': 1, 'decision': 'Approved', 'checks': {'notes': True, 'photos': True, 'gps': True}})
            self.assertEqual(code, 403)
        finally:
            change('botanist', 'botanist')
        try:
            change('officer', 'user')
            self.assertEqual(self.officer.call('/api/get_observations.php')[0], 403)
            change('officer', 'conservation_officer', '0')
            self.assertEqual(self.officer.call('/api/get_observations.php')[0], 401)
        finally:
            change('officer', 'conservation_officer')
            type(self).officer = Client('officer')


if __name__ == '__main__':
    unittest.main(verbosity=2)
