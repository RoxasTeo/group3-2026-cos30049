import json
import os
from pathlib import Path
import subprocess
import unittest
import urllib.request
import urllib.error
import uuid
from observations_integration import Client, BASE

class Tracking(unittest.TestCase):
    def setUp(self):
        self.officer=Client('officer');self.suffix=uuid.uuid4().hex[:10]
        code,body=self.officer.call('/api/add_species.php',dict(common_name='Tracking acceptance '+self.suffix,scientific_name='Trackus test',family='Testaceae',description='Fictional tracking fixture'))
        self.assertEqual(code,201,body);self.species=body['species_id']
        self.plant1=self.save(action='plant',species_id=self.species,plant_tag='TRACK-TEST-A-'+self.suffix,label='Plant A',latitude=3.81,longitude=113.78)['id']
        self.plant2=self.save(action='plant',species_id=self.species,plant_tag='TRACK-TEST-B-'+self.suffix,label='Plant B',latitude=None,longitude=None)['id']
        self.device1=self.save(action='device',device_code='TRACK-TEST-A-'+self.suffix,name='Device A',is_active=True)
        self.device2=self.save(action='device',device_code='TRACK-TEST-B-'+self.suffix,name='Device B',is_active=True)
        self.assign(self.device1,self.plant1);self.assign(self.device2,self.plant2)

    def tearDown(self):
        subprocess.run([os.environ['REVIEW_TEST_PHP'],str(Path(__file__).with_name('cleanup_tracking.php')),str(self.species)],check=True)

    def save(self,**body):
        code,result=self.officer.call('/api/save_tracking.php',body);self.assertEqual(code,200,result);return result

    def snapshot(self,device=None):
        code,data=self.officer.call('/api/get_tracking.php'+('?device_id='+str(device) if device else ''));self.assertEqual(code,200,data);return data

    def device(self,entry):return next(d for d in self.snapshot()['devices'] if int(d['id'])==entry['id'])
    def assign(self,entry,plant):self.save(action='assign',id=entry['id'],version=self.device(entry)['version'],plant_id=plant)

    def submit(self,entry,**patch):
        payload=dict(device_code=self.device(entry)['device_code'],temperature=25,humidity=70,distance_cm=100,latitude=3.8101,longitude=113.7801);payload.update(patch)
        req=urllib.request.Request(BASE+'/api/submit_device_reading.php',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','X-Device-Key':entry['device_key']})
        try:response=urllib.request.urlopen(req)
        except urllib.error.HTTPError as error:response=error
        return response.code,json.load(response)

    def test_device_isolation_alerts_and_private_keys(self):
        first=self.submit(self.device1,temperature=40);second=self.submit(self.device2,temperature=40)
        self.assertEqual(first[0],201,first);self.assertEqual(second[0],201,second)
        self.assertEqual(len(first[1]['automatic_alerts']),1);self.assertEqual(len(second[1]['automatic_alerts']),1)
        self.assertEqual(self.submit(self.device1,temperature=40)[1]['automatic_alerts'],[])
        data=self.snapshot(self.device1['id']);self.assertEqual(len(data['trail']),2)
        self.assertEqual(int(self.device(self.device1)['plant_id']),self.plant1)
        self.assertNotIn('key_hash',json.dumps(data));self.assertNotIn(self.device1['device_key'],json.dumps(data))
        self.assertEqual(self.submit(self.device1,species_id=self.species)[0],400)
        bad=dict(self.device1,device_key=self.device2['device_key']);self.assertEqual(self.submit(bad)[0],401)

    def test_reassignment_history_no_inherited_location_or_baseline(self):
        self.submit(self.device1,distance_cm=100)
        old=self.snapshot(self.device1['id'])['trail'][0]['reading_id']
        self.assign(self.device1,self.plant2)
        before=self.snapshot(self.device1['id']);self.assertEqual(before['trail'],[])
        self.assertIsNone(self.device(self.device1)['latitude']);self.assertEqual(len(before['assignments']),2)
        # No cross-assignment distance change: first report at new plant has no baseline.
        code,new=self.submit(self.device1,distance_cm=200);self.assertEqual(code,201,new);self.assertEqual(new['automatic_alerts'],[])
        self.assertNotEqual(self.snapshot(self.device1['id'])['trail'][0]['reading_id'],old)
        d=self.device(self.device1);self.save(action='unassign',id=d['id'],version=d['version'])
        self.assertEqual(self.submit(self.device1)[0],409)

    def test_plant_edit_validation_and_protected_species(self):
        p=next(p for p in self.snapshot()['plants'] if int(p['id'])==self.plant1)
        payload=dict(action='plant',id=p['id'],version=p['version'],species_id=self.species,plant_tag=p['plant_tag'],label='Updated plant label',latitude=0,longitude=0)
        self.save(**payload)
        updated=next(p for p in self.snapshot()['plants'] if int(p['id'])==self.plant1)
        self.assertEqual(updated['label'],'Updated plant label')
        self.assertEqual(float(updated['latitude']),0)
        self.assertEqual(self.officer.call('/api/save_tracking.php',payload)[0],409)
        duplicate=dict(action='plant',species_id=self.species,plant_tag=p['plant_tag'],label='Duplicate')
        self.assertEqual(self.officer.call('/api/save_tracking.php',duplicate)[0],409)
        self.assertEqual(self.officer.call('/api/delete_species.php?id='+str(self.species),{})[0],409)
        self.assertEqual(self.officer.call('/api/save_tracking.php',payload,csrf=False)[0],403)

    def test_disabled_rotated_key_conflicts_and_roles(self):
        d=self.device(self.device1)
        replacement=self.save(action='rotate_key',id=d['id'],version=d['version'])
        self.assertEqual(self.submit(self.device1)[0],401)
        self.device1['device_key']=replacement['device_key'];self.assertEqual(self.submit(self.device1)[0],201)
        d=self.device(self.device1)
        self.save(action='device',id=d['id'],version=d['version'],device_code=d['device_code'],name='Disabled test',is_active=False)
        self.assertEqual(self.submit(self.device1)[0],401)
        self.assertEqual(self.officer.call('/api/save_tracking.php',dict(action='unassign',id=d['id'],version=d['version']))[0],409)
        for path in ['/api/get_tracking.php','/api/save_tracking.php']:
            body={} if 'save_' in path else None
            self.assertEqual(Client().call(path,body)[0],401)
            self.assertEqual(Client('user').call(path,body)[0],403)
        self.assertEqual(Client('admin').call('/api/get_tracking.php')[0],200)
        invalid=dict(action='plant',species_id=self.species,plant_tag='TEST-INVALID',label='Bad coordinates',latitude=999,longitude=1)
        self.assertEqual(self.officer.call('/api/save_tracking.php',invalid)[0],400)

if __name__=='__main__':unittest.main(verbosity=2)
