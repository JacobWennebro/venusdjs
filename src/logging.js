const fs = require("fs");
const logs = [];

module.exports = (color, message, io) => {
	if(typeof io === 'undefined') return;


	let printcolor

	switch(color) {
		case "blue": printcolor = "\x1b[34m"; break;
		case "magenta": printcolor = "\x1b[1m\x1b[35m"; break;
		case "red": printcolor = "\x1b[31m"; break;
		case "green": printcolor = "\x1b[32m"; break;

		break;

		default: printcolor = "\x1b[37m"; //WHITE
	}

	fs.stat("./logs", (err, stats) => {
		if (err && !stats.isDirectory()) {
			fs.mkdir("./logs", (err) => {
				if(err) {
					return console.error(err);
				}
				
				fs.appendFile("./logs/log.log", printcolor + message, (err) => {
					if(err) {
						console.log("* Failed to write to log");
					}
				});
			});
		} else {
			fs.appendFile("./logs/log.log", printcolor + message, (err) => {
				if(err) {
					console.log("* Failed to write to log");
				}
			});
		}
	});
	
	io.sockets.emit("fullLog", logs);
	logs.push({
		color: color,
		msg: message
	});
	
	io.sockets.emit('log', {
		color: color,
		msg: message
	});

	console.log(printcolor + message);
};