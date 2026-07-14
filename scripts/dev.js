#!/usr/bin/env node

const path = require('path');
const { spawn } = require('child_process');
const { stopDevServer, killProcessTree } = require('./dev-process');

const API_ROOT = path.join(__dirname, '..');

stopDevServer({ quiet: true });

const nodemon = spawn('npx', ['nodemon', 'server.js'], {
    cwd: API_ROOT,
    stdio: 'inherit',
    shell: true,
});

let exiting = false;

function cleanup() {
    if (exiting) {
        return;
    }

    exiting = true;

    if (nodemon.pid) {
        killProcessTree(nodemon.pid);
    }

    stopDevServer({ quiet: true });
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

nodemon.on('exit', (code, signal) => {
    if (exiting) {
        return;
    }

    if (signal === 'SIGINT' || signal === 'SIGTERM') {
        cleanup();
        return;
    }

    process.exit(code ?? 0);
});
