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
class ThreatDetection(unittest.TestCase):
    def setUp(self):
        self.officer=Client('officer')
        code, result=self.officer.call('/api/add_species.php', dict(common_name='Monitoring acceptance threat '+uuid.uuid4().hex,scientific_name='Threatus test',family='Testaceae',description='Fictional threat detection fixture'))
        self.assertEqual(code,201,result);self.row=result['species_id']

    def tearDown(self):
        subprocess.run([os.environ['REVIEW_TEST_PHP'],str(Path(__file__).with_name('cleanup_monitoring.php')),str(self.row)],check=True)

    def submit(self,**patch):
        payload=dict(species_id=self.row,temperature=25,humidity=70,distance_cm=100,latitude=3.81,longitude=113.78);payload.update(patch)
        req=urllib.request.Request(BASE+'/api/add_sensor_reading.php',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','X-Device-Key':os.environ['REVIEW_TEST_DEVICE_KEY']})
        try:response=urllib.request.urlopen(req)
        except urllib.error.HTTPError as error:response=error
        return response.code,json.load(response)

    def alerts(self):
        return [r for r in self.officer.call('/api/get_threat_alerts.php')[1] if int(r['species_id'])==self.row]

    def age(self,action):
        subprocess.run([os.environ['REVIEW_TEST_PHP'],str(Path(__file__).with_name('adjust_threat_fixture.php')),str(self.row),action],check=True)

    def test_normal_threshold_cooldown_escalation_and_saved_reading(self):
        self.assertEqual(self.submit()[1]['automatic_alerts'],[])
        code, first=self.submit(temperature=35)
        self.assertEqual(code,201);self.assertEqual(first['automatic_alerts'][0]['severity'],'warning')
        self.assertEqual(self.submit(temperature=35)[1]['automatic_alerts'],[])
        critical=self.submit(temperature=40)[1]
        self.assertEqual(critical['automatic_alerts'][0]['severity'],'critical')
        self.assertEqual(self.submit(temperature=35)[1]['automatic_alerts'],[])
        self.assertEqual(len(self.alerts()),2)
        readings=[r for r in self.officer.call('/api/get_sensor_readings.php')[1] if int(r['species_id'])==self.row]
        self.assertEqual(len(readings),5)
        self.assertIn(first['reading_id'],[int(r['reading_id']) for r in readings])
        self.age('expire_alerts')
        self.assertEqual(len(self.submit(temperature=40)[1]['automatic_alerts']),1)

    def test_alert_failure_rolls_back_reading_and_releases_lock(self):
        try:
            self.age('install_failure')
            self.assertEqual(self.submit(temperature=40)[0],500)
            readings=[r for r in self.officer.call('/api/get_sensor_readings.php')[1] if int(r['species_id'])==self.row]
            self.assertEqual(readings,[])
            self.assertEqual(self.alerts(),[])
        finally:
            self.age('remove_failure')
        self.assertEqual(self.submit()[0],201)

    def test_multiple_rules_and_distance_baseline(self):
        self.assertEqual(self.submit()[1]['automatic_alerts'],[])
        alerts=self.submit(temperature=40,humidity=99,distance_cm=20)[1]['automatic_alerts']
        self.assertEqual({r['rule'] for r in alerts},{'temperature_high','humidity_high','proximity','distance_change'})
        self.assertTrue(all(r['severity']=='critical' for r in alerts))
        self.assertEqual(len(self.alerts()),4)
        self.assertEqual(self.submit(temperature=40,humidity=99,distance_cm=20)[1]['automatic_alerts'],[])

    def test_stale_baseline_invalid_input_and_rule_read_permissions(self):
        self.submit();self.age('expire_readings')
        self.assertEqual(self.submit(distance_cm=200)[1]['automatic_alerts'],[])
        self.assertEqual(self.submit(temperature=1000)[0],400)
        self.assertEqual(self.submit(distance_cm=1000000)[0],400)
        self.assertEqual(self.alerts(),[])
        path='/api/get_threat_rules.php'
        self.assertEqual(self.officer.call(path)[1]['configuration']['cooldown_seconds'],300)
        self.assertEqual(Client().call(path)[0],401)
        self.assertEqual(Client('user').call(path)[0],403)
        self.assertEqual(Client('admin').call(path)[0],200)

if __name__=='__main__':unittest.main(verbosity=2)
