
export const log = (str) => {
	const d = new Date();
	const day = d.getDate().toString().padStart(2, '0') + '/'+ d.getMonth().toString().padStart(2, '0') + '/' + d.getFullYear();
	const time = d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0') + ':'+ d.getSeconds().toString().padStart(2,'0') + '.' + d.getMilliseconds() ;

	console.log(`${day} ${time} - ${str}`);
}