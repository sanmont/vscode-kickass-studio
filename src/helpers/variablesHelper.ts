import { IRegister } from '../vice/viceInspector';
import { DebugProtocol } from 'vscode-debugprotocol';

const varConvertValue = (val) => {

}

const registersNames = ['A', 'X', 'Y', 'SP'];

const sortArr =  (arr: string[]) => {
	return (({name},{name:nameB}) =>  arr.indexOf(name) - arr.indexOf(nameB));
};

const toHex = (val) => '$' + val;

const toDecimal = (val) => parseInt(val, 16).toString(10);

const toBinary = (val) => '%' + (parseInt(val, 16).toString(2)).padStart(8,'0');

const toBool = (val) => (val === '1').toString();


const filterRegisters = (registers: IRegister[], type: string, formatter:(val) => any): DebugProtocol.Variable[] => {
	return registers
		.filter(r => registersNames.includes(r.name))
		.map(({name, value})=> ({
			name: name,
			type,
			value: formatter(value),
			variablesReference: 0
		})).sort(sortArr(registersNames));
};


export const getRegistersHex = (registers: IRegister[]) => {
	return filterRegisters(registers, 'hex', toHex);
}

export const getRegistersDecimal = (registers: IRegister[]) => {
	const regs = filterRegisters(registers, 'integer', toDecimal);
	regs.pop();
	return regs;
}

export const getRegistersBinary = (registers: IRegister[]) => {
	const regs = filterRegisters(registers, 'binary', toBinary);
	regs.pop();
	return regs;
}


const FlagsRegister = 'NV-BDIZC';

const Flags = {
	'N': 'Negative',
	'V': 'Overflow',
	'B': 'Break Command',
	'D': 'Decimal Mode',
	'I': 'Interrupt Disable',
	'Z': 'Zero',
	'C': 'Carry',
	'-': '-'
}

export const getFlags = (registers: IRegister[]): DebugProtocol.Variable[]  => {
	const flags = <IRegister> registers.find( r => r.name === FlagsRegister);
	const flagsNames = flags.name.split('');
	const flagsVals = flags.value.split('');
	return flagsNames
		.map((f,i) => ({
			name: Flags[f],
			type: 'boolean',
			value: toBool(flagsVals[i]),
			variablesReference: 0
		}))
		.sort(sortArr(Object.values(Flags)));
}



const TimingRegisters = {
	'LIN': 'Raster Line',
	'CYC': 'Cycle',
	'STOPWATCH': 'Stop Watch'
}

export const getTimingVariables =  (registers: IRegister[]): DebugProtocol.Variable[]  => {
	const timingNames = Object.keys(TimingRegisters);

	return registers
		.filter(r => timingNames.includes(r.name))
		.map(({name, value})=> ({
			name: TimingRegisters[name],
			type: 'integer',
			value,
			variablesReference: 0
		}));
};

