import json
import os
from pathlib import Path
import subprocess
import unittest
import urllib.request
import urllib.error
import uuid
from observations_integration import Client, BASE

@unittest.skipUnless(os.environ.get('REVIEW_TEST_DEVICE_KEY'), 'Dedicated test device key required')
class Monitoring(unittest.TestCase):
    def test_write_aliases_read_mapping_and_access(self):
        officer = Client('officer')
        code, result = officer.call('/api/add_species.php', dict(common_name='Monitoring acceptance ' + uuid.uuid4().hex, scientific_name='Monitorus test', family='Testaceae', description='Disposable monitoring fixture'))
        self.assertEqual(code, 201, result)
        row = result['species_id']
        def device(path, payload, key=None):
            req = urllib.request.Request(BASE + path, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json', 'X-Device-Key': key if key is not None else os.environ['REVIEW_TEST_DEVICE_KEY']})
            try: response = urllib.request.urlopen(req)
            except urllib.error.HTTPError as error: response = error
            return response.code, json.load(response)
        try:
            for field in ['plant_id', 'species_id']:
                reading = dict(temperature=28.5, humidity=75, distance_cm=100, latitude=3.81, longitude=113.78, **{field: row})
                alert = dict(alert_type='motion', severity='warning', message='Monitoring test only', latitude=3.81, longitude=113.78, **{field: row})
                self.assertEqual(device('/api/add_sensor_reading.php', reading)[0], 201)
                self.assertEqual(device('/api/add_threat_alerts.php', alert)[0], 201)
            bad = dict(reading, plant_id=row, species_id=row + 1)
            self.assertEqual(device('/api/add_sensor_reading.php', bad)[0], 400)
            self.assertEqual(device('/api/add_threat_alerts.php', dict(alert, plant_id=row, species_id=row + 1))[0], 400)
            self.assertEqual(device('/api/add_sensor_reading.php', reading, key='invalid')[0], 401)
            for endpoint in ['get_sensor_readings', 'get_threat_alerts']:
                path = '/api/' + endpoint + '.php'
                code, records = officer.call(path)
                self.assertEqual(code, 200, records)
                own = [r for r in records if int(r['species_id']) == row]
                self.assertEqual(len(own), 2)
                self.assertTrue(all('plant_id' not in r for r in own))
                self.assertEqual(Client().call(path)[0], 401)
                self.assertEqual(Client('user').call(path)[0], 403)
                self.assertEqual(Client('admin').call(path)[0], 200)
        finally:
            subprocess.run([os.environ['REVIEW_TEST_PHP'], str(Path(__file__).with_name('cleanup_monitoring.php')), str(row)], check=True)

if __name__ == '__main__': unittest.main(verbosity=2)
