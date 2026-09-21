"""Drive the interactive surge CLI over a pty to create the account and deploy."""
import json, os, pty, select, sys, time

VAULT = '/root/.hermes/profiles/coin/workspace/vault/real_mailbox.json'
mb = json.load(open(VAULT))
EMAIL, PASSWORD = mb['address'], mb['password']
CWD = '/root/.hermes/profiles/coin/workspace/cookieguard'
DOMAIN = sys.argv[1] if len(sys.argv) > 1 else 'cookieguard.surge.sh'

os.chdir(CWD)
pid, fd = pty.fork()
if pid == 0:
    os.environ.pop('SURGE_LOGIN', None)
    os.environ.pop('SURGE_PASSWORD', None)
    os.execvp('surge', ['surge', '--project', 'dist', '--domain', DOMAIN])
    os._exit(1)

buf = b''
sent = set()
deadline = time.time() + 170
while time.time() < deadline:
    r, _, _ = select.select([fd], [], [], 1.0)
    if r:
        try:
            chunk = os.read(fd, 4096)
        except OSError:
            break
        if not chunk:
            break
        buf += chunk
        sys.stdout.write(chunk.decode(errors='replace'))
        sys.stdout.flush()
    low = buf.decode(errors='replace').lower()
    if 'email:' in low and 'email' not in sent:
        os.write(fd, (EMAIL + '\n').encode()); sent.add('email'); time.sleep(0.6)
    elif 'password:' in low and 'password' not in sent:
        os.write(fd, (PASSWORD + '\n').encode()); sent.add('password'); time.sleep(0.6)

try:
    os.close(fd)
except OSError:
    pass
os.waitpid(pid, 0)
print('\n--- prompts handled:', sorted(sent))
