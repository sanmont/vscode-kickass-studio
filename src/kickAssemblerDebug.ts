import { basename } from 'path';
import {
	Breakpoint,
	ContinuedEvent,
	DebugSession,
	InitializedEvent,
	Scope,
	Source,
	StackFrame,
	StoppedEvent,
	TerminatedEvent,
	Thread
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { changeExtension } from './helpers/pathHelper';
import { getFlags, getRegistersBinary, getRegistersDecimal, getRegistersHex, getTimingVariables } from './helpers/variablesHelper';
import { SourceLocation, SourceMap } from './kickass/sourceMap';
import { ViceInitializer } from './vice/viceInitialiazer';
import { ViceInspector, ViceInspectorEvent } from './vice/viceInspector';
import { ViceLauncher, ViceLauncherEvent } from './vice/viceLauncher';

import { Subject } from 'await-notify';

const Scopes = {
	Registers: 1,
	'Registers(Decimal)': 2,
	'Registers(Binary)': 3,
	Flags: 4,
	Timing: 5
};

interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	program: string;
	binDirectory: string;
}

const THREAD_ID = 0;

export class KickAssemblerDebugSession extends DebugSession {
	private viceLauncher: ViceLauncher;

	private viceInspector: ViceInspector;

	private configurationDone = new Subject();

	private viceInitializer = new ViceInitializer();

	private sourceMap = new SourceMap();

	public constructor() {
		super(true);
		this.setDebuggerLinesStartAt1(true);
		this.setDebuggerColumnsStartAt1(true);

		this.viceLauncher = new ViceLauncher();
		this.viceInspector = new ViceInspector();

		this.viceLauncher.on(ViceLauncherEvent.closed, () => {
			this.viceInspector.disconnect();
			this.sendEvent(new TerminatedEvent());
		});

		this.viceInspector.on(ViceInspectorEvent.stopped, () => {
			this.sendEvent(new StoppedEvent('stopped', THREAD_ID));
		});
	}

	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
		response.body = response.body || {};
		response.body.supportsConfigurationDoneRequest = true;
		response.body.supportTerminateDebuggee = true;
		response.body.supportsSetVariable = true;

		this.sendResponse(response);

		this.sendEvent(new InitializedEvent());
	}

	protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
		super.configurationDoneRequest(response, args);
		this.configurationDone.notify();
	}

	protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
		const path = <string>args.source.path;
		const clientLines = args.lines || [];

		const breakpoints = clientLines.map(l => {
			const { column } = this.sourceMap.getAddressFromSource(path, l) || {
				column: undefined
			};
			const bp = <DebugProtocol.Breakpoint>new Breakpoint(Boolean(column), l, column);
			return bp;
		});

		response.body = { breakpoints };

		let addresses = breakpoints.filter(p => p.verified).map(p => this.sourceMap.getAddressFromSource(path, <number>p.line)?.address);

		if (!this.viceInitializer.initialized) {
			this.viceInitializer.addBreakpoints(<[]>addresses);
			this.sendResponse(response);
		} else {
			(async () => {
				this.viceInspector.flushQueue();

				const createdBps = (await this.viceInspector.getBreakpoints()).filter(ck => this.sourceMap.isFromFilename(ck.address, path));

				await this.viceInspector.deleteBreakpoints(createdBps.map(bp => bp.id));
				let res = await this.viceInspector.setBreakpoints(<[]>addresses);

				if (this.viceInspector.isRunning) {
					this.viceInspector.continue();
				}

				this.sendResponse(response);
			})();
		}
	}

	protected async launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments) {
		this.sourceMap.loadGDB(changeExtension(args.program, '.dbg', args.binDirectory));

		await this.configurationDone.wait(1000);

		this.viceInitializer.saveVSFile(changeExtension(args.program, '.vs', args.binDirectory));
		this.viceInspector.connect();
		this.viceLauncher.launch(args.program, args.binDirectory);
		this.sendResponse(response);
	}

	protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
		response.body = {
			threads: [new Thread(THREAD_ID, 'Main thread')]
		};
		this.sendResponse(response);
	}

	protected async stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments) {
		const stack = await this.viceInspector.getStackTrace();
		const stackLocations = stack.map(add => this.sourceMap.getSourceLocation('$' + add));
		const stackFrames = <StackFrame[]>stackLocations.map(this.locationToStackFrame.bind(this));
		response.body = { stackFrames, totalFrames: stackFrames.length };
		this.sendResponse(response);
	}

	protected async pauseRequest(response: DebugProtocol.PauseResponse, args: DebugProtocol.PauseArguments, request?: DebugProtocol.PauseRequest | undefined) {
		this.viceInspector.pause();
		response.success = true;

		this.sendResponse(response);
	}

	protected async nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments, request?: DebugProtocol.NextRequest | undefined) {
		await this.viceInspector.next();
		response.success = true;
		this.sendResponse(response);
	}

	protected async stepInRequest(
		response: DebugProtocol.StepInResponse,
		args: DebugProtocol.StepInArguments,
		request?: DebugProtocol.StepInRequest | undefined
	) {
		await this.viceInspector.stepIn();
		response.success = true;
		this.sendResponse(response);
	}

	protected async stepOutRequest(
		response: DebugProtocol.StepOutResponse,
		args: DebugProtocol.StepOutArguments,
		request?: DebugProtocol.StepOutRequest | undefined
	) {
		this.sendEvent(new ContinuedEvent(THREAD_ID));
		await this.viceInspector.stepOut();
		response.success = true;
		this.sendResponse(response);
	}

	protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
		const scopes = Object.keys(Scopes).map(k => new Scope(k, Scopes[k]));
		response.body = { scopes };
		this.sendResponse(response);
	}

	protected async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments, request?: DebugProtocol.Request) {
		let variables: DebugProtocol.Variable[] = [];
		console.log(args.variablesReference); // Es el scope

		const registersVal = await this.viceInspector.registers();

		switch (args.variablesReference) {
			case 1:
				variables = getRegistersHex(registersVal);
				break;
			case 2:
				variables = getRegistersDecimal(registersVal);
				break;
			case 3:
				variables = getRegistersBinary(registersVal);
				break;
			case 4:
				variables = getFlags(registersVal);
				break;
			case 5:
				variables = getTimingVariables(registersVal);
				break;
		}

		response.body = {
			variables
		};

		this.sendResponse(response);
	}

	protected async evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments) {
		let body;

		switch (args.context) {
			case 'watch':
				try {
					const res = await this.viceInspector.readMemory(args.expression, this.sourceMap.labelsMap);
					body = {
						result: res,
						variablesReference: 0
					};
				} catch (e) {
					response.success = false;
					response.message = args.expression;
				}
				break;
			case 'repl': // debug console
				break;
			case 'hover': // on hovers
				break;
		}
		response.body = body;

		this.sendResponse(response);
	}

	protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
		this.viceInspector.continue();
		this.sendResponse(response);
	}

	protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request): void {
		this.viceInspector.disconnect();
		this.viceLauncher.close();
		this.sendResponse(response);
	}

	private locationToStackFrame(location: SourceLocation, index: number): StackFrame {
		const source = this.createSource(location.filename);
		const line = this.convertDebuggerLineToClient(location.line);
		const column = this.convertDebuggerColumnToClient(location.column);
		return new StackFrame(index, location.address, source, line, column);
	}

	private createSource(filePath: string): Source {
		return new Source(basename(filePath), this.convertDebuggerPathToClient(filePath), undefined, undefined, 'kickass-adapter-data');
	}
}
