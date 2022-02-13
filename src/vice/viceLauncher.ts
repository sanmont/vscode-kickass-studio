import * as vscode from 'vscode';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { changeExtension } from '../helpers/pathHelper';
import { getConfig } from '../helpers/extension';
import * as ps from 'ps-node';

export const ViceLauncherEvent = {
	closed: 'closed'
};

export class ViceLauncher extends EventEmitter {
	private viceProcess: ChildProcessWithoutNullStreams;

	public launch(program: string, cwd: string) {
		let config = getConfig();

		const args = ['-remotemonitor', '-logfile', changeExtension(program, '-vice.log') ,
			'-moncommands',  changeExtension(program, '.vs'),
			'-remotemonitoraddress', '127.0.0.1:6510',
			changeExtension(program, '.prg')
		];


		// A simple pid lookup
		ps.lookup({
			command: config.viceBin,
			}, function(err, resultList ) {
			if (err) {
				throw new Error( err );
			}

			resultList.forEach(function( process ){
				if( process ){

					console.log( 'PID: %s, COMMAND: %s, ARGUMENTS: %s', process.pid, process.command, process.arguments );
				}
			});
		});


		this.viceProcess = spawn(config.viceBin ,args, {cwd});

		this.viceProcess.stdout.on('data', (data) => {
			console.log(`stdout: ${data}`);
		});

		this.viceProcess.stderr.on('data', (data) => {
			console.error(`stderr: ${data}`);
		});

		this.viceProcess.on('close', (code) => {
			console.log('Vice exited with code:' + code)
			this.sendEvent(ViceLauncherEvent.closed);
		});

		this.viceProcess.on('exit', (code) => {
			console.log('Vice exited with code:' + code)
			this.sendEvent(ViceLauncherEvent.closed);
		});

		this.viceProcess.on('disconnect', (code) => {
			console.log('Vice exited with code:' + code)
			this.sendEvent(ViceLauncherEvent.closed);
		});

		this.viceProcess.on('message', (message) => {
			console.log('Vice message:' + message)
			this.sendEvent(ViceLauncherEvent.closed);
		});

		this.viceProcess.on('error', (err) => {
			console.log(JSON.stringify(err, null, '\t'));
		})
	}



	public close() {
		this.viceProcess.kill('SIGKILL');
		console.log(this.viceProcess.killed);
		this.viceProcess.kill('SIGKILL');
	}

	private sendEvent(event: string, ... args: any[]) {
		setImmediate(_ => {
			this.emit(event, ...args);
		});
	}
}