const url = new URL(window.location.href);
const websocket = new WebSocket(
	`ws${url.protocol === 'https:' ? 's' : ''}://${url.host}`
);

const uuid = localStorage.getItem('uuid') || crypto.randomUUID();

if (localStorage.getItem('uuid') === null) {
	localStorage.setItem('uuid', uuid);
}

let jwt;

websocket.addEventListener('open', () => {
	if (localStorage.getItem('jwt') !== null) {
		jwt = localStorage.getItem('jwt');
		websocket.send(
			JSON.stringify({
				type: 'reauthenticate',
				payload: {
					jwt,
				},
			})
		);
	}
});

document.querySelector('#password-submit').addEventListener('click', event => {
	websocket.send(
		JSON.stringify({
			type: 'authenticate',
			payload: {
				otp: document.querySelector('#password').value,
				uuid,
			},
		})
	);
});

function showButtons() {
	document.querySelector('.auth-container').className =
		'auth-container hidden';
	document.querySelector('.buttons-container').className =
		'buttons-container';
}

function hideButtons() {
	document.querySelector('.auth-container').className = 'auth-container';
	document.querySelector('.buttons-container').className =
		'buttons-container hidden';
}

websocket.addEventListener('message', message => {
	const content = JSON.parse(message.data);
	if (
		(content.type === 'authenticate' ||
			content.type === 'reauthenticate') &&
		content.response === 'ok'
	) {
		showButtons();
		localStorage.setItem('jwt', content.payload.jwt);
		jwt = content.payload.jwt;
	}
	if (
		content.type === 'command' &&
		content.response === 'not_authenticated'
	) {
		hideButtons();
	}
});

document.querySelectorAll('.remote-button').forEach(element => {
	element.addEventListener('click', event => {
		websocket.send(
			JSON.stringify({
				type: 'command',
				payload: {
					code: element.getAttribute('data-code'),
					jwt,
				},
			})
		);
	});
});
