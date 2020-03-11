import { Socket } from 'net';
import { debounce } from 'lodash';

const delay = timeout => new Promise(resolve => setTimeout(resolve, timeout));
const WaitRetry = 500;
const Retries = 100;
import { Subject } from 'await-notify';
import { queuableFunction } from '../helpers/asyncHelper';

export class WaitingSocket {
	private socket: Socket = new Socket({ readable: true, writable:true });
    private connected: boolean = false;
    private event = new Subject();
    private buffer:string = '';


    public constructor() {
		this.socket.on('connect', this.onConnect.bind(this));
		this.socket.on('close', this.onClose.bind(this));
		this.socket.on('data', this.onData.bind(this));

		this.endBuffer = debounce(this.endBuffer, 100);

		this.sendMessage = queuableFunction(this.sendMessage.bind(this));
	}

	private endBuffer(){
		this.event.message = this.buffer;
		this.buffer = '';
		this.event.notify();
	}

	public async connect(opts) {
		console.log('Connecting...');

		for (let i=0; i < Retries && !this.connected; i++) {
            this.socket.connect(opts);

			if (this.connected) {
				console.log('Retrying connect');
			}
			await delay(WaitRetry);
		}

		if (!this.connected) {
			console.log('Connection failed: timeout');
		}
    }

    private onData(data) {
		this.buffer += data.toString();
		this.endBuffer();
    }

    // --- helpers
	public async sendMessage(message) {
		if (!this.connected) {
			console.log('socket not connected, couldnt send' + message);
			return;
        }
		this.event = new Subject();

		this.socket.write(message);
        await this.event.wait();
		return this.event.message;
	}


    public on = this.socket.on.bind(this.socket);
    public off = this.socket.off.bind(this.socket);
    public end = this.socket.end.bind(this.socket);


	private onConnect() {
		this.connected = true;
		console.log('Connected');
	}


	private onClose() {
		this.connected = false;
		console.log('Disconnected');
    }

}