import { writeFileSync } from 'fs';


export class ViceInitializer {
	addBreakpoints(breakpoints: []) {
		this.breakpoints = this.breakpoints.concat(breakpoints);
	}
	private breakpoints: string[] = [];
	public initialized: boolean = false;


	public addBreakpoint(address) {
		this.breakpoints.push(address);
	}

	public saveVSFile(filename, logFilename = '') {
		writeFileSync(filename, this.mapBreakpoints()+'\n');
		this.initialized = true;
	}

	private mapBreakpoints():string {
		return this.breakpoints.map(b => 'break ' + b).join('\n');
	}

}