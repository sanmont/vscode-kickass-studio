import { EventEmitter } from 'events';
import { WaitingSocket } from './waitingSocket';
import { parseVariable, IVariableInfo, VariableFormat, addToMemoryAddress, derefferenceToAddress } from './viceVariableInfo';


const CONNECTION_OPTS = { port: 6510 };
const WaitRetry = 500;
const Retries = 100;

interface Checkpoint {
	id: string;
	address: string;
	type: string;
}

export interface IRegister {
	name: string;
	value: string;
}

export const ViceInspectorEvent = {
	stopped: 'stopped',
};

const stoppedOnBreakRE = /\#(\d+)\s\(Stop\son\s+exec\s+([0-f]{4})/i;
const readyRE =  /^\([0-f]{4}\)$/i;
const stackTraceRE = /([0-f]{4})/gi;

const checkpointRe = /(BREAK|TRACE|WATCH)\:\s+(\d+)\s+C\:(\$[0-f]{4})/gi;

const memValRE = /( [0-f]{2})/gi;



const formatValue = (value: string, varinfo: VariableFormat) => {
	switch(varinfo) {
		case VariableFormat.HEX:
			return '$' + value;
			break;
		case VariableFormat.DEC:
			return parseInt(value, 16);
			break;
		case VariableFormat.BIN:
			return '%' + (parseInt(value, 16).toString(2).padStart(8,'0'));
			break;
	}
};

const parseVariableValue = (value: string, char: boolean = false) => {
	if(!char) {
		value = value.split('\n').map(c => c.substr(8, 52)).join('');
		return [...(value as any).matchAll(memValRE)].map(a => a[0].trim());
	} else {
		return value.split('\n').map(c => c.substr(62)).join('');
	}
}

export class ViceInspector extends EventEmitter {
	private socket: WaitingSocket = new WaitingSocket();
	private _isRunning:boolean = true;

	public get isRunning(){
		return this._isRunning;
	}

	public constructor() {
		super();
		this.onData = this.onData.bind(this);

		this.socket.on('data', this.onData);
		this.on(ViceInspectorEvent.stopped,() => {
			this.flushQueue();
			this._isRunning = false;
		});
	}

    public async connect() {
		await this.socket.connect(CONNECTION_OPTS);
    }

	public disconnect() {
		this.flushQueue();
		this.socket.end();
		this.socket.off('data', this.onData);
		this.socket.destroy();
		this.socket = new WaitingSocket();
		this.socket.on('data', this.onData);
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
			checkPoints.push({ type: item[1], id: item[2], address: item[3] });
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

	public async readMemory(variableName, labelsMap) {
		let variable = parseVariable(variableName, labelsMap);

		if (!variable) {
			return "Unknown";
		}

		if (variable.directValue) {
			return variable.from;
		}

		let derreferenceAddress = variable.from;

		for (let i = 0; i < variable.derreference; i++) {
			derreferenceAddress = (await this.sendViceMessage(`m ${derreferenceAddress} ${addToMemoryAddress(derreferenceAddress,1)}`)).toString();
			derreferenceAddress = '$' + (parseVariableValue(derreferenceAddress) as any[]).reverse().join('')
		}

		if (variable.derreference) {
			variable = derefferenceToAddress(variable, derreferenceAddress);
		}

		const res:string = (await this.sendViceMessage(`m ${variable.from} ${variable.to}`)).toString();

		if (res.includes('ERROR')) {
			throw new Error(res);
		}

		if ((variable as IVariableInfo).format === VariableFormat.CHAR) {
			return parseVariableValue(res, true);
		}

		return (parseVariableValue(res) as any[]).map(a => formatValue(a, (variable as IVariableInfo).format)).join(' ');
	}

    private sendMessage = this.socket.sendMessage.bind(this.socket);

	// --- private

	private onData(data) {
		if (data.toString().includes("(Stop on exec)")) {
			this.emit(ViceInspectorEvent.stopped);
		}
	}

}