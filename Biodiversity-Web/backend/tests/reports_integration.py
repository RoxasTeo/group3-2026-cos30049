"""Officer/Admin report dataset authorization on the real disposable backend."""
import json
import os
from pathlib import Path
import subprocess
import unittest
from observations_integration import Client


class Reports(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture_id = int(subprocess.check_output([os.environ['REVIEW_TEST_PHP'], str(Path(__file__).with_name('seed_reports.php'))]))

    def test_live_dataset_and_export_fields(self):
        for role in ['officer', 'admin']:
            code, records = Client(role).call('/api/get_biodiversity_report.php')
            self.assertEqual(code, 200, records)
            fixture = next(r for r in records if int(r['species_id']) == self.fixture_id)
            self.assertEqual(fixture['description'], 'Text, with "quotes"\nand a new line')
            self.assertEqual(fixture['ecological_info'], '=1+1')
            self.assertEqual(fixture['cultural_sign'], 'Sarawak / 沙捞越')
            self.assertNotIn('photo', fixture)

    def test_anonymous_and_non_officer_roles_denied(self):
        self.assertEqual(Client().call('/api/get_biodiversity_report.php')[0], 401)
        for role in ['user', 'botanist']:
            self.assertEqual(Client(role).call('/api/get_biodiversity_report.php')[0], 403)

    def test_current_role_and_disabled_account_are_rechecked(self):
        officer = Client('officer')
        def change(role, active):
            subprocess.run([os.environ['REVIEW_TEST_PHP'], str(Path(__file__).with_name('change_fixture_user.php')), 'officer', role, active], check=True, capture_output=True)
        try:
            change('user', '1')
            self.assertEqual(officer.call('/api/get_biodiversity_report.php')[0], 403)
            change('conservation_officer', '0')
            self.assertEqual(officer.call('/api/get_biodiversity_report.php')[0], 401)
        finally:
            change('conservation_officer', '1')


if __name__ == '__main__':
    unittest.main(verbosity=2)
