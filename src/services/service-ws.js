/**
 * Copyright (C) 2026 Zukaritasu
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

const WebSocket = require('ws');
const crypto = require('crypto');
const { WEBSOCKET_PORT, WEBSOCKET_AUTH_TOKEN } = require('../../.botconfig/token.json');
const logger = require('../logger');

/**
 * @typedef {import('axios').AxiosResponse & {
 *   id: string,
 *   success: boolean
 * }} ClientResponse
 */

/** @type {WebSocket.Server} */
let wss = null;
/** @type {WebSocket} */
let localClient = null;
/** @type {Map<string, { resolve: Function, reject: Function, timeout: NodeJS.Timeout }>} */
const pendingRequests = new Map();
/** @type {NodeJS.Timeout} */
let heartbeatInterval = null;

const PING_INTERVAL = 60000; // 60 seconds
const REQUEST_TIMEOUT = 25000; // 25 seconds

/**
 * Checks if the given object is a valid client response.
 * @param {ClientResponse} response - The response to validate.
 * @returns {boolean} True if the response is valid, false otherwise.
 */
function isClientResponse(response) {
	return (
		response !== null &&
		typeof response === 'object' &&
		typeof response.id === 'string' &&
		typeof response.success === 'boolean'
	);
}

/**
 * Cleans up and rejects all pending requests when the connection drops.
 */
function cleanupPendingRequests() {
	for (const [, req] of pendingRequests.entries()) {
		clearTimeout(req.timeout);
		req.reject(new Error('WebSocket client disconnected'));
	}

	pendingRequests.clear();
}

/**
 * Sends a POST request over the WebSocket connection.
 * 
 * @param {string} url - The URL to send the POST request to.
 * @param {URLSearchParams} searchParams - The search parameters to include in the request body.
 * @param {import('axios').AxiosRequestConfig} config - The configuration options for the request.
 * @returns {Promise<import('axios').AxiosResponse>} A promise that resolves with the response data or rejects with an error.
 */
async function post(url, searchParams, config) {
	return new Promise((resolve, reject) => {
		if (!localClient || localClient.readyState !== WebSocket.OPEN) {
			return reject(new Error('WebSocket client is not connected.'));
		}

		const requestId = crypto.randomUUID();
		const timeout = setTimeout(() => {
			if (pendingRequests.has(requestId)) {
				pendingRequests.delete(requestId);
				reject(new Error(`Request timed out after ${REQUEST_TIMEOUT} ms`));
			}
		}, REQUEST_TIMEOUT);

		pendingRequests.set(requestId, { resolve, reject, timeout });

		try {
			localClient.send(JSON.stringify({
				id: requestId,
				url,
				searchParams: searchParams.toString(),
				config
			}));
		} catch (err) {
			clearTimeout(timeout);
			pendingRequests.delete(requestId);
			reject(err);
		}
	});
}

/**
 * Initializes the WebSocket service.
 * 
 * This function sets up the WebSocket server and handles client connections.
 * @param {any} _db - The database instance.
 * @param {any} _client - The client instance.
 * @returns {Promise<void>} A promise that resolves when the service is initialized.
 */
async function service(_db, _client) {
	wss = new WebSocket.Server({
		port: WEBSOCKET_PORT,
		host: '127.0.0.1',
		maxPayload: 10 * 1024 * 1024 // 10 MB
	});

	// Handle heartbeat to detect dead connections
	heartbeatInterval = setInterval(() => {
		if (localClient) {
			if (localClient.isAlive === false) {
				return localClient.terminate();
			}

			localClient.isAlive = false;
			localClient.ping();
		}
	}, PING_INTERVAL);

	wss.on('connection', (ws, req) => {
		const authHeader = req.headers['authorization'] || req.headers['x-auth-token'];
		if (authHeader !== WEBSOCKET_AUTH_TOKEN) {
			logger.ERR(`Unauthorized WebSocket connection rejected from ${req.socket.remoteAddress}`);
			return ws.close(4001, 'Unauthorized');
		}

		if (localClient && localClient !== ws) {
			cleanupPendingRequests();
			localClient.terminate();
		}

		logger.INF(`WebSocket client connected from ${req.socket.remoteAddress}:${req.socket.remotePort}`);

		localClient = ws;

		// Insert a property to track the alive status of the connection
		ws.isAlive = true;

		ws.on('pong', () => {
			ws.isAlive = true;
		});

		ws.on('message', (message) => {
			try {
				/** @type {ClientResponse} */
				const res = JSON.parse(message);

				if (isClientResponse(res) && pendingRequests.has(res.id)) {
					logger.DBG(`Received response for request ID ${res.id}:`, JSON.stringify(res));

					const { resolve, reject, timeout } = pendingRequests.get(res.id);
					clearTimeout(timeout);
					pendingRequests.delete(res.id);

					const { id, success, ...axiosResponse } = res;
					if (success) {
						resolve(axiosResponse);
					} else {
						const error = new Error(axiosResponse.statusText || 'Request failed');
						error.response = axiosResponse;
						error.status = axiosResponse.status;

						reject(error);
					}
				}
			} catch (error) {
				logger.ERR('Error parsing WebSocket message:', error);
			}
		});

		ws.on('close', (_code, _reason) => {
			if (localClient === ws) {
				localClient = null;
				cleanupPendingRequests();
			}
		});

		ws.on('error', (err) => {
			logger.ERR('WebSocket client socket error:', err);
		});
	});

	wss.on('error', (err) => {
		logger.ERR('WebSocket server error:', err);
	});

	return {
		stop: () => {
			if (heartbeatInterval) clearInterval(heartbeatInterval);
			cleanupPendingRequests();
			if (wss) {
				wss.close((err) => {
					if (err) logger.ERR('Error closing WebSocket server:', err);
				});
			}
		},

		description: 'WebSocket service for the main server',
		name: 'service-ws',
		fullname: 'WebSocket Service',
	};
}
module.exports = { start: service, post };