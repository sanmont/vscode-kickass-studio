import { EventEmitter } from 'events';
import { WaitingSocket } from './waitingSocket';


const CONNECTION_OPTS = { port: 6510 };
const WaitRetry = 500;
const Retries = 100;

interface Response {
	type: string;
}

interface Checkpoint {
	id: string;
	address: string;
	type: string;
}

interface BreakResponse extends Response {
	id: number;
	address: string;
}

export interface IRegister {
	name: string;
	value: string;
}


export const ViceInspectorEvent = {
	stopped: 'stopped',
};


const stoppedOnBreakRE = /\#(\d+)\s\(Stop\son\s+exec\s+([0-f]{4})/i;
const readyRE =  /^\([0-f]{4}\)$/i
const stackTraceRE = /([0-f]{4})/gi;

const checkpointRe = /(BREAK|TRACE|WATCH)\:\s+(\d+)\s+C\:(\$[0-f]{4})/gi

const memValRE = />C:[0-f]{4}\s+([0-f]{2})/gi

export class ViceInspector extends EventEmitter {
	private socket: WaitingSocket = new WaitingSocket();
	private _isRunning:boolean = true;

	public get isRunning(){
		return this._isRunning;
	}

	public constructor() {
		super();
		this.socket.on('data', this.onData.bind(this));
		this.on(ViceInspectorEvent.stopped,() => {
			this.flushQueue();
			this._isRunning = false;
		});
	}

    public async connect() {
		await this.socket.connect(CONNECTION_OPTS);
    }

	public disconnect() {
		this.socket.end();
	}

	private async sendViceMessage(mssg, inmediate = false, dontWaitForResult = false) {
		return await this.sendMessage(`${mssg}\n`, {inmediate, dontWaitForResult});
	}

	public flushQueue(){
		this.sendMessage({flush: true});
	}

	public async pause() {
		const res =  await this.sendViceMessage('', true, true);
		this.emit(ViceInspectorEvent.stopped);
		return res;
	}

	public async next() {
		const res =  await this.sendViceMessage('n');
		this.emit(ViceInspectorEvent.stopped);
		return res;
	}

	public async stepIn() {
		const res =  await this.sendViceMessage('z');
		this.emit(ViceInspectorEvent.stopped);
		return res;
	}

	public async stepOut() {
		const res =  await this.sendViceMessage('ret', true);
		this.emit(ViceInspectorEvent.stopped);
		return res;
	}

	public async continue() {
		this._isRunning = true;
		return await this.sendViceMessage('g', true, true);
	}

	public async registers(): Promise<IRegister[]> {
		let res = (await this.sendViceMessage('registers')).split('\n');
		let keys = res[0].trim().split(/\s+/);
		let vals = res[1].trim().split(/\s+/);
		return keys.map((name,i) => ({ name, value:vals[i]}));
    }

    public async setBreakpoint(address) {
		return (await this.sendViceMessage(`break ${address}`)).toString();
    }

	public async setBreakpoints(breakpoints:string[]) {
		return await Promise.all(breakpoints.map(this.setBreakpoint.bind(this)));
	}

	public async getCheckpoints(): Promise<Checkpoint[]> {
		const checkpointsStr = (await this.sendViceMessage('break')).toString();
		const checkPoints:Checkpoint[] = [];
		let item: RegExpExecArray | null = null;
		while(item = checkpointRe.exec(checkpointsStr)) {
			checkPoints.push({ type: item[1], id: item[2], address: item[3] })
		}

		return checkPoints;
	}

	public async getBreakpoints(): Promise<Checkpoint[]> {
		const checkpoints = await this.getCheckpoints();
		return checkpoints.filter(c => c.type === 'BREAK');
	}

	public async deleteBreakpoint(id:string) {
		return await this.sendViceMessage(`del ${id}`);
	}

	public async deleteBreakpoints(ids: string[] = []) {
		return await Promise.all(ids.map(this.deleteBreakpoint.bind(this)));
	}

	public async getStackTrace() {
		let stackTrace = (await this.sendViceMessage('bt')).toString();
		stackTrace = stackTrace.match(stackTraceRE);
		let lastAdd = stackTrace.pop();
		stackTrace.unshift(lastAdd);
		return stackTrace;
	}

	public async readMemoryAddress(address) {
		const res:string = (await this.sendViceMessage(`m ${address} ${address}`)).toString();
		if (res.includes('ERROR')) {
			throw new Error(res);
		}

		memValRE.exec('');
		return (memValRE.exec(res) || {})[1];
	}

    private sendMessage = this.socket.sendMessage.bind(this.socket);

	// --- private

	private onData(data) {

		let response = this.parseSocketData(data.toString());
		switch(response.type) {
			case 'breakpoint':
				this.emit(ViceInspectorEvent.stopped);
				this._isRunning = false;
				break;
		}
	}


	// --- helpers
	private parseSocketData(data:string): Response  {
		if (stoppedOnBreakRE.test(data)) {
			const matches = data.match(stoppedOnBreakRE) || [];
			return <BreakResponse> {type:'breakpoint', id: parseInt(matches[1],10), address: matches[2]};
		}

		if (readyRE.test(data)) {
			return {type: 'ready'};
		}
		return {type: 'unknown'};
	}

}