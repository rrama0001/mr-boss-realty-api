const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const API_ROOT = path.join(__dirname, '..');
const LOCK_PATH = path.join(API_ROOT, '.dev-server.lock');
const API_PATH_MARKER = 'mr-boss-realty';
const API_DIR_MARKER = `${API_PATH_MARKER}${path.sep}api`;

function readLockFile() {
    if (!fs.existsSync(LOCK_PATH)) {
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
    } catch {
        return null;
    }
}

function clearLockFile() {
    try {
        if (fs.existsSync(LOCK_PATH)) {
            fs.unlinkSync(LOCK_PATH);
        }
    } catch {
        // ignore
    }
}

function isProcessRunning(pid) {
    if (!pid || Number.isNaN(Number(pid))) {
        return false;
    }

    try {
        if (process.platform === 'win32') {
            const out = execSync(
                `tasklist /FI "PID eq ${pid}" /NH`,
                { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
            );
            return out.includes(String(pid));
        }

        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function killProcessTree(pid) {
    if (!pid || !isProcessRunning(pid)) {
        return false;
    }

    try {
        if (process.platform === 'win32') {
            execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
        } else {
            process.kill(pid, 'SIGTERM');
        }

        return true;
    } catch {
        return false;
    }
}

function listApiNodePids() {
    const pids = new Set();

    try {
        if (process.platform === 'win32') {
            const command = [
                'Get-CimInstance Win32_Process -Filter "name = \'node.exe\'"',
                '| Where-Object { $_.CommandLine -like \'*mr-boss-realty*api*\' }',
                '| Select-Object -ExpandProperty ProcessId',
            ].join(' ');

            const out = execSync(
                `powershell -NoProfile -Command "${command}"`,
                { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
            );

            out.trim().split(/\r?\n/).forEach((line) => {
                const pid = Number.parseInt(line.trim(), 10);
                if (pid > 0) {
                    pids.add(pid);
                }
            });

            return [...pids];
        }

        const out = execSync('pgrep -f "mr-boss-realty/api"', {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });

        out.trim().split(/\r?\n/).forEach((line) => {
            const pid = Number.parseInt(line.trim(), 10);
            if (pid > 0) {
                pids.add(pid);
            }
        });
    } catch {
        // no matching processes
    }

    return [...pids];
}

function listPortListenerPids(port) {
    const pids = new Set();

    try {
        if (process.platform === 'win32') {
            const out = execSync(`netstat -ano | findstr :${port}`, {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
            });

            out.split(/\r?\n/).forEach((line) => {
                if (!line.includes('LISTENING')) {
                    return;
                }

                const pid = Number.parseInt(line.trim().split(/\s+/).pop(), 10);
                if (pid > 0) {
                    pids.add(pid);
                }
            });
        } else {
            const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
            });

            out.trim().split(/\r?\n/).forEach((line) => {
                const pid = Number.parseInt(line.trim(), 10);
                if (pid > 0) {
                    pids.add(pid);
                }
            });
        }
    } catch {
        // port is free
    }

    return [...pids];
}

function stopDevServer(options = {}) {
    const port = Number(options.port || process.env.PORT || 3000);
    const quiet = Boolean(options.quiet);
    const stopped = new Set();

    const lock = readLockFile();
    const lockPids = [];

    if (lock?.nodemonPid) {
        lockPids.push(lock.nodemonPid);
    }

    if (lock?.serverPid) {
        lockPids.push(lock.serverPid);
    }

    [...lockPids, ...listApiNodePids(), ...listPortListenerPids(port)].forEach((pid) => {
        if (stopped.has(pid)) {
            return;
        }

        if (killProcessTree(pid)) {
            stopped.add(pid);
        }
    });

    clearLockFile();

    if (!quiet && stopped.size) {
        console.log(`Stopped ${stopped.size} API dev process(es) on port ${port}.`);
    }

    return stopped.size;
}

module.exports = {
    API_ROOT,
    LOCK_PATH,
    API_DIR_MARKER,
    readLockFile,
    clearLockFile,
    writeLockFile(lock) {
        fs.writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`);
    },
    killProcessTree,
    stopDevServer,
};
