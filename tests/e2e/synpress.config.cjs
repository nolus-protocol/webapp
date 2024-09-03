
const config = require('@agoric/synpress/synpress.config');
const { defineConfig } = require('cypress');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({
    path: path.resolve(__dirname, '../../.env.test')
});

module.exports = defineConfig({
    ...config,
    e2e: {
        ...config.e2e,
        baseUrl: 'http://localhost:8080',
        pageLoadTimeout: 100000,
        defaultCommandTimeout: 100000,
    },
    env: {
        secretWords: process.env.SECRET_WORDS
    },
});
