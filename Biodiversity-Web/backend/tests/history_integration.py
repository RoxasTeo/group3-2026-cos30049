import os
from pathlib import Path
import subprocess
import unittest
from observations_integration import Client

class History(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.row = int(subprocess.check_output([os.environ['REVIEW_TEST_PHP'], str(Path(__file__).with_name('seed_history.php'))]))
        cls.officer = Client('officer')

    @classmethod
    def tearDownClass(cls):
        subprocess.run([os.environ['REVIEW_TEST_PHP'], str(Path(__file__).with_name('cleanup_monitoring.php')), str(cls.row)], check=True)

    def url(self, query=''):
        return f'/api/get_monitoring_history.php?start=2026-10-10&end=2026-10-13&species_id={self.row}' + query

    def test_inclusive_range_aggregation_gaps_and_page(self):
        code, data = self.officer.call(self.url())
        self.assertEqual(code, 200, data)
        self.assertEqual(data['summary']['count'], 55)
        self.assertEqual(data['summary']['min_temperature'], 20)
        self.assertEqual(data['summary']['max_temperature'], 40)
        self.assertAlmostEqual(data['summary']['avg_temperature'], 1140 / 55, places=3)
        self.assertEqual([p['bucket'] for p in data['trend']], ['2026-10-10', '2026-10-11', '2026-10-13'])
        self.assertEqual([p['count'] for p in data['trend']], [52, 2, 1])
        self.assertEqual([p['temperature'] for p in data['trend']], [20, 30, 40])
        self.assertEqual(len(data['readings']), 50)
        self.assertEqual(data['pages'], 2)
        page2 = self.officer.call(self.url('&page=2'))[1]
        self.assertEqual(len(page2['readings']), 5)
        self.assertFalse(set(r['reading_id'] for r in data['readings']) & set(r['reading_id'] for r in page2['readings']))
        self.assertEqual(self.officer.call(self.url('&page=999'))[1]['page'], 2)

    def test_same_day_empty_and_monthly(self):
        base = '/api/get_monitoring_history.php?'
        same = self.officer.call(base + f'start=2026-10-11&end=2026-10-11&species_id={self.row}')[1]
        self.assertEqual(same['summary']['count'], 2)
        empty = self.officer.call(base + f'start=2026-10-12&end=2026-10-12&species_id={self.row}')[1]
        self.assertEqual(empty['summary']['count'], 0)
        self.assertIsNone(empty['summary']['avg_temperature'])
        self.assertEqual(empty['trend'], [])
        monthly = self.officer.call(base + f'start=2025-01-01&end=2027-01-01&species_id={self.row}')[1]
        self.assertEqual(monthly['interval'], 'month')
        self.assertEqual(monthly['trend'][0]['bucket'], '2026-10-01')
        self.assertEqual(monthly['summary']['count'], 57)

    def test_validation_and_roles(self):
        for query in ['start=2026-02-30&end=2026-03-01', 'start=2026-10-20&end=2026-10-10', 'start=2000-01-01&end=2026-01-01', 'start[]=x&end=2026-10-10', 'start=2026-10-10&end=2026-10-10&species_id=-1', 'start=2026-10-10&end=2026-10-10&page=0']:
            self.assertEqual(self.officer.call('/api/get_monitoring_history.php?' + query)[0], 400, query)
        self.assertEqual(Client().call(self.url())[0], 401)
        self.assertEqual(Client('user').call(self.url())[0], 403)
        self.assertEqual(Client('botanist').call(self.url())[0], 403)
        self.assertEqual(Client('admin').call(self.url())[0], 200)

if __name__ == '__main__': unittest.main(verbosity=2)
