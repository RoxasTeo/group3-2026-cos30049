"""Map API checks on real, isolated PHP/MySQL; use observation review test fixtures."""
import json
import os
from pathlib import Path
import subprocess
import unittest
import urllib.parse
import uuid
from observations_integration import Client


class Distribution(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.officer, cls.bot, cls.user, cls.admin = [Client(name) for name in ('officer', 'botanist', 'user', 'admin')]
        cls.ids = json.loads(subprocess.check_output([os.environ['REVIEW_TEST_PHP'], str(Path(__file__).with_name('seed_distribution.php'))]))
        cls.tag = 'DIST-' + uuid.uuid4().hex[:12]
        cls.records = []
        for species, review, gps in [(cls.ids[0], 'Approved', True), (cls.ids[0], 'Approved', False), (cls.ids[1], 'Approved', True), (cls.ids[2], 'Approved', True), (cls.ids[0], 'Pending', True), (cls.ids[0], 'Rejected', True), (cls.ids[1], 'Changes requested', True), (None, 'Approved', True), (None, 'Pending', True)]:
            payload = {'client_reference': str(uuid.uuid4()), 'plant_tag': cls.tag, 'species_id': species, 'common_name': 'Provisional field label', 'field_notes': 'Isolated map eligibility test.', 'latitude': 3.81 if gps else None, 'longitude': 113.78 if gps else None, 'photos': []}
            code, result = cls.bot.call('/api/submit_observation.php', payload)
            assert code == 201, result
            record = result['observation']
            cls.records.append(record)
            if review != 'Pending':
                code, result = cls.officer.call('/api/review_observation.php', {'id': record['id'], 'version': 1, 'decision': review, 'notes': 'Test-only decision.', 'checks': {'notes': True, 'photos': True, 'gps': True}})
                assert code == 200, result

    def load(self, **params):
        return self.officer.call('/api/get_species_distribution.php?' + urllib.parse.urlencode({'q': self.tag, **params}))

    def test_approved_linked_default_excludes_pending_rejected_and_unlinked(self):
        code, body = self.load()
        self.assertEqual(code, 200, body)
        self.assertEqual(body['summary'], {'linked_count': 4, 'mapped_available': 3, 'missing_gps': 1, 'unlinked_count': 1})
        self.assertEqual(len(body['records']), 4)
        self.assertFalse(body['truncated'])
        self.assertTrue(all(r['review_status'] == 'Approved' for r in body['records']))
        self.assertEqual(len({r['species_id'] for r in body['records']}), 3)
        self.assertTrue(all('photos' not in r and 'field_notes' not in r for r in body['records']))
        # Species identity and assessment come from the linked knowledge record, not provisional field text.
        self.assertTrue(all(r['common_name'].startswith('Distribution Test') for r in body['records']))

    def test_pending_opt_in_never_includes_rejected_or_changes_requested(self):
        code, body = self.load(include_pending=1)
        self.assertEqual(code, 200)
        self.assertEqual(body['summary']['linked_count'], 5)
        self.assertEqual(body['summary']['mapped_available'], 4)
        self.assertEqual(body['summary']['unlinked_count'], 2)
        self.assertEqual({r['review_status'] for r in body['records']}, {'Approved', 'Pending'})

    def test_combined_filters_empty_and_input_validation(self):
        code, body = self.load(species_id=self.ids[0], conservation_status='Vulnerable')
        self.assertEqual(code, 200)
        self.assertEqual(body['summary']['linked_count'], 2)
        self.assertEqual(body['summary']['missing_gps'], 1)
        _, empty = self.load(species_id=self.ids[0], conservation_status='Least Concern')
        self.assertEqual(empty['records'], [])
        for params in [{'include_pending': 'yes'}, {'species_id': 'invalid'}, {'conservation_status': 'Approved'}, {'q': 'x' * 201}]:
            self.assertEqual(self.load(**params)[0], 400)
        _, empty = self.load(q="%' OR 1=1")
        self.assertEqual(empty['records'], [])

    def test_officer_admin_only(self):
        path = '/api/get_species_distribution.php'
        self.assertEqual(Client().call(path)[0], 401)
        self.assertEqual(self.bot.call(path)[0], 403)
        self.assertEqual(self.user.call(path)[0], 403)
        self.assertEqual(self.admin.call(path)[0], 200)


if __name__ == '__main__':
    unittest.main(verbosity=2)
