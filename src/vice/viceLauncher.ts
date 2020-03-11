import { EventEmitter } from 'events';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { ViceInspector } from './viceInspector';
import { changeExtension } from '../helpers/pathHelper';


export const ViceLauncherEvent = {
	closed: 'closed'
};

export class ViceLauncher extends EventEmitter {
	private viceProcess: ChildProcessWithoutNullStreams;
	/**
	 * Start executing the given program.
	 */
	public launch(program: string, cwd: string) {
		console.log('deberia lanzar: ' + program);

		const args = ['-remotemonitor', '-logfile', changeExtension(program, '-vice.log') ,
		//const args = ['-logfile', changeExtension(program, '-vice.log') ,
			'-moncommands',  changeExtension(program, '.vs'),
			changeExtension(program, '.prg')
		];

		console.log('hey');
		console.log('los args son');
		console.log(args);
		console.log(cwd);

		this.viceProcess = spawn('x64sc',args, {cwd});

		this.viceProcess.stdout.on('data', (data) => {
			console.log(`stdout: ${data}`);
		});

		this.viceProcess.stderr.on('data', (data) => {
			console.error(`stderr: ${data}`);
		});

		this.viceProcess.on('close', (code) => this.sendEvent(ViceLauncherEvent.closed))
	}

	public close() {
		this.viceProcess.kill();
	}

	private sendEvent(event: string, ... args: any[]) {
		setImmediate(_ => {
			this.emit(event, ...args);
		});
	}
}