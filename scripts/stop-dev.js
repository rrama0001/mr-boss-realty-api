#!/usr/bin/env node

const { stopDevServer } = require('./dev-process');

const quiet = process.argv.includes('--quiet');
const count = stopDevServer({ quiet });

if (!quiet && count === 0) {
    console.log('No API dev processes were running.');
}
