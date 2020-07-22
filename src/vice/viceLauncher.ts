import * as vscode from 'vscode';
import { existsSync } from 'fs';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { changeExtension } from '../helpers/pathHelper';
import { getConfig } from '../helpers/extension';

export const ViceLauncherEvent = {
	closed: 'closed'
};

export class ViceLauncher extends EventEmitter {
	private viceProcess: ChildProcessWithoutNullStreams;

	public launch(program: string, cwd: string) {
		const args = ['-remotemonitor', '-logfile', changeExtension(program, '-vice.log') ,
			'-moncommands',  changeExtension(program, '.vs'),
			changeExtension(program, '.prg')
		];


		let config = getConfig();
		this.viceProcess = spawn(config.viceBin ,args, {cwd});

		if(!this.viceProcess.pid) {
			vscode.window.showErrorMessage("Vice not found. Check the extension configuration.");
			this.sendEvent(ViceLauncherEvent.closed);
			return;
		}


		this.viceProcess.stdout.on('data', (data) => {
			console.log(`stdout: ${data}`);
		});

		this.viceProcess.stderr.on('data', (data) => {
			console.error(`stderr: ${data}`);
		});

		this.viceProcess.on('close', (code) => this.sendEvent(ViceLauncherEvent.closed));
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