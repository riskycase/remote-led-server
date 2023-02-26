import express, { static as serveStatic } from 'express';
import { Server, WebSocket } from 'ws';
import { join } from 'path';
import { verify, sign } from 'jsonwebtoken';
import dotenv from 'dotenv';
import totp from 'totp-generator';

dotenv.config();

interface socketStatus {
	socket: WebSocket;
	timer: NodeJS.Timeout;
	isAlive: boolean;
	type: 'server' | 'client';
}

let webSocketStatuses: socketStatus[] = [];

const app = express();

app.use(serveStatic(join(__dirname, '..', 'public')));

const wss = new Server({ noServer: true });
wss.on('connection', socket => {
	webSocketStatuses.push({
		socket,
		isAlive: true,
		timer: setInterval(() => {
			const socketIndex = webSocketStatuses.findIndex(
				status => status.socket === socket
			);
			if (!webSocketStatuses[socketIndex].isAlive) socket.terminate();
			else {
				webSocketStatuses[socketIndex].isAlive = false;
				socket.ping();
			}
		}, 15000),
		type: 'client',
	});
	socket.on('pong', () => {
		const thisSocket = webSocketStatuses.find(
			status => status.socket === socket
		);
		if (thisSocket) thisSocket.isAlive = true;
	});
	socket.on('close', () => {
		const index = webSocketStatuses.findIndex(
			status => status.socket === socket
		);
		clearInterval(webSocketStatuses[index].timer);
		webSocketStatuses.splice(index, 1);
	});
	socket.on('message', rawMessage => {
		const message = JSON.parse(rawMessage.toString());
		if (message.type === 'upgrade') {
			if (message.accessKey === process.env.ACCESS_KEY) {
				const thisSocket = webSocketStatuses.find(
					status => status.socket === socket
				);
				if (thisSocket) {
					thisSocket.type = 'server';
					socket.send(
						JSON.stringify({ type: 'upgrade', response: 'ok' })
					);
				}
			} else {
				socket.send(
					JSON.stringify({ type: 'upgrade', response: 'invalid_key' })
				);
			}
		} else if (message.type === 'authenticate') {
			const otp1 = totp(process.env.TOTP_KEY);
			const otp2 = totp(process.env.TOTP_KEY, {
				timestamp: Date.now() - 30000,
			});
			if (message.payload.otp == otp1 || message.payload.otp == otp2) {
				const thisSocket = webSocketStatuses.find(
					status => status.socket === socket
				);
				if (thisSocket) {
					socket.send(
						JSON.stringify({
							type: 'authenticate',
							response: 'ok',
							payload: {
								jwt: sign(
									{
										uuid: message.payload.uuid,
									},
									process.env.JWT_KEY,
									{
										expiresIn: '3d',
									}
								),
							},
						})
					);
				}
			} else {
				socket.send(
					JSON.stringify({
						type: 'authenticate',
						response: 'invalid_key',
					})
				);
			}
		} else if (message.type === 'reauthenticate') {
			verify(message.payload.jwt, process.env.JWT_KEY, error => {
				if (error) {
					socket.send(
						JSON.stringify({
							type: 'reauthenticate',
							response: 'not_authenticated',
						})
					);
				} else {
					socket.send(
						JSON.stringify({
							type: 'reauthenticate',
							response: 'ok',
							payload: {
								jwt: sign(
									{
										uuid: message.payload.uuid,
									},
									process.env.JWT_KEY,
									{
										expiresIn: '3d',
									}
								),
							},
						})
					);
				}
			});
		} else if (message.type === 'command') {
			verify(message.payload.jwt, process.env.JWT_KEY, error => {
				if (error) {
					socket.send(
						JSON.stringify({
							type: 'command',
							response: 'not_authenticated',
						})
					);
				} else {
					webSocketStatuses
						.filter(socket => socket.type === 'server')
						.forEach(socket =>
							socket.socket.send(
								JSON.stringify({
									type: 'command',
									code: message.payload.code,
								})
							)
						);
				}
			});
		}
	});
});

const server = app.listen(process.env.PORT || 3000);
server.on('upgrade', (request, socket, head) => {
	wss.handleUpgrade(request, socket, head, socket => {
		wss.emit('connection', socket, request);
	});
});

server.on('listening', () =>
	console.log(`Listening on ${process.env.PORT || 3000}`)
);
