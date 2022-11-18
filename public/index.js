const url = new URL(window.location.href);
const websocket = new WebSocket(
	`ws${url.protocol === 'https:' ? 's' : ''}://${url.host}`
);

document.querySelector('#password-submit').addEventListener('click', event => {
	websocket.send(
		JSON.stringify({
			type: 'authenticate',
			otp: document.querySelector('#password').value,
		})
	);
});

websocket.addEventListener('message', message => {
	const content = JSON.parse(message.data);
	if (content.type === 'authenticate' && content.response === 'ok') {
		document.querySelector('.auth-container').className =
			'auth-container hidden';
		document.querySelector('.buttons-container').className =
			'buttons-container';
	}
});

document.querySelectorAll('.remote-button').forEach(element => {
	element.addEventListener('click', event => {
		websocket.send(
			JSON.stringify({
				type: 'command',
				code: element.getAttribute('data-code'),
			})
		);
	});
});
