import json
from urllib.request import Request, urlopen
url = 'http://127.0.0.1:8001/api/auth/google'
data = json.dumps({'credential': 'dev-google-test-123'}).encode()
req = Request(url, data=data, headers={'Content-Type':'application/json'})
resp = urlopen(req)
print(resp.status)
print(resp.read().decode())
