import json
import os
from pathlib import Path
import subprocess
import unittest
import urllib.error
import urllib.request
import uuid
from observations_integration import Client

class EncryptionAPI(unittest.TestCase):
    def test_tampered_profile_never_creates_authenticated_session(self):
        email='auth-acceptance-'+uuid.uuid4().hex+'@review.test'
        client=Client();client.csrf=client.call('/auth/csrf.php')[1]['csrf_token']
        try:
            code,result=client.call('/auth/register.php',dict(name='Encryption API fixture',email=email,password='Encryption-Only-2026!'))
            self.assertEqual(code,201,result)
            subprocess.run([os.environ['REVIEW_TEST_PHP'],str(Path(__file__).with_name('tamper_auth_fixture.php')),email],check=True)
            code,result=client.call('/auth/login.php',dict(email=email,password='Encryption-Only-2026!'))
            self.assertEqual(code,500)
            self.assertEqual(result,{'error':'Internal server error'})
            self.assertEqual(client.call('/auth/me.php')[0],401)
        finally:
            subprocess.run([os.environ['REVIEW_TEST_PHP'],str(Path(__file__).with_name('cleanup_auth.php')),email],check=True)

    @unittest.skipUnless(os.environ.get('REVIEW_TEST_FAILURE_URL'),'Explicit missing-key test server required')
    def test_missing_key_does_not_disclose_sensitive_fields(self):
        target=os.environ['REVIEW_TEST_FAILURE_URL']
        self.assertTrue(target.startswith('http://localhost:'))
        client=Client('officer')
        self.assertEqual(client.call('/auth/me.php')[0],200)
        for path in ['/auth/me.php','/api/get_species_distribution.php']:
            with self.assertRaises(urllib.error.HTTPError) as error:
                client.opener.open(target+path)
            self.assertEqual(error.exception.code,500)
            self.assertEqual(json.load(error.exception),{'error':'Internal server error'})
        self.assertEqual(client.call('/auth/me.php')[0],200)
        # A wrong but structurally valid key must also reject new protected writes.
        anonymous=Client();anonymous.csrf=anonymous.call('/auth/csrf.php')[1]['csrf_token']
        email='auth-acceptance-'+uuid.uuid4().hex+'@review.test'
        try:
            req=urllib.request.Request(target+'/auth/register.php',data=json.dumps(dict(name='Wrong key fixture',email=email,password='Encryption-Only-2026!')).encode(),headers={'Content-Type':'application/json','X-CSRF-Token':anonymous.csrf})
            with self.assertRaises(urllib.error.HTTPError) as error: anonymous.opener.open(req)
            self.assertEqual(error.exception.code,500)
            self.assertEqual(json.load(error.exception),{'error':'Internal server error'})
        finally:
            subprocess.run([os.environ['REVIEW_TEST_PHP'],str(Path(__file__).with_name('cleanup_auth.php')),email],check=True)

if __name__=='__main__':unittest.main(verbosity=2)
