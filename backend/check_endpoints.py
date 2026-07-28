import urllib.request

for url in ['http://127.0.0.1:8001/api/health', 'http://127.0.0.1:5173']:
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            body = resp.read(200).decode('utf-8', 'ignore')
            print(url, '=>', resp.status)
            print(body)
    except Exception as e:
        print(url, '=> ERROR', repr(e))
