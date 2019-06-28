/*       IMPORTS        */

const Discord = require('discord.js');
const Express = require('express');
const ejs = require('ejs');
const socket = require('socket.io');
const generator = require('generate-password');
const unzipper = require('unzipper');
const webpanel = require('./src/web');
const ip = require('ip');
const fs = require('fs');
const redis = require("redis");
const log = require('./src/logging');
const vam = require('./src/addonmanager');
const Config = require('./configs/main-config.json')["config"];
const cookieParser = require('cookie-parser');
const os = require('os');
const sharp = require('sharp');
const gs = require('generate-schema');
const request = require('request').defaults({ encoding: null });

require('events').EventEmitter.prototype._maxListeners = 100;

/*       CODE           */

const cpuAverage = () => {

	let totalIdle = 0, totalTick = 0;
	let cpus = os.cpus();

	for (let i = 0, len = cpus.length; i < len; i++) {

		let cpu = cpus[i];

		for (let type in cpu.times) {
			totalTick += cpu.times[type];
		}

		totalIdle += cpu.times.idle;
	}

	return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
};

const client = new Discord.Client();
const web = Express();
let AddonPages = {};

let io;

let webserver = web.listen(Config["web interface port"], () => {

	/* SOCKET SETUP */
	io = socket(webserver);
	let cpuUsage = cpuAverage();

	let cpuPercent = ((cpuUsage["idle"] / cpuUsage["total"]) * 100) / 2;

	io.on('connection', (socket) => {
		socket.emit("usage", {
			"freeMem": os.freemem(),
			"totalMem": os.totalmem(),
			"cpu": cpuPercent
		});

		setInterval(() => {
			let cpuUsage = cpuAverage();

			let cpuPercent = ((cpuUsage["idle"] / cpuUsage["total"]) * 100) / 2;

			socket.emit("usage", {
				"freeMem": os.freemem(),
				"totalMem": os.totalmem(),
				"cpu": cpuPercent
			});
		}, 5 * 1000);
	});

	client.login(Config["discord bot token"])
		.then(() => {
			log('magenta', `* Discord bot (${client.user.tag}) is active`, io);

			if(Config.presence["use presence from config"]) {
				client.user.setPresence({
					status: Config.presence["status"],
					game: { name: Config.presence["text"], type: Config.presence["type"], url: Config.presence["url"]}
				});
			}
		})
		.catch((err) => {
			if (err) {
				let password = generator.generate({ length: 15, numbers: true });

				log('red', `Failed to authenticate bot due to invalid bot token. Edit main-config.json to provide your bot token given by the Discord developer portal or edit it through the venus webpanel http://${ip.address()}:${Config["web interface port"]}/panel#config`, io);
				log('blue', 'Temporary webpanel password: ' + password, io);
				db.set("venus_auth_" + password, 'offline', "EX", 60, (err, res) => {
					if (err) {
						// set the password
					} else {
						// error setting the password
					}
				});
				webpanel(web, db, client, AddonPages, io, false);
			}
		});
});

web.set('view engine', ejs);

web.use(cookieParser());

const db = redis.createClient(Config.database.port, Config.database.host);

db.on("error", (err) => {
	log("red", "Error with the db: " + err);
});

db.auth(Config.database.password, (err, reply) => {
	if (err) {
		log("red", "> Failed to authenticate with the redis database!", io);
	} else {
		log("magenta", "* Succesfully connected and authenticated with the database!", io);

		setInterval(() => {
			db.get("venus_uptime_data", (err, reply) => {
				if (err) return;
				if (reply == null) {
					db.set("venus_uptime_data", JSON.stringify({
						"times": [new Date()]
					}), (err, response) => {
						if (err) return;
						if (response != "OK") return;
						log("magenta", "* Added new uptime data to the database!");
					});
				} else {
					try {
						let times = JSON.parse(reply);
						times["times"].push(new Date());
						db.set("venus_uptime_data", JSON.stringify(times), (err, response) => {
							if (err) return;
							if (response != "OK") return;
							log("magenta", "* Added new uptime data to the database!");
						});
					} catch (e) {
						console.error(e);
					}
				}
			});
		}, 5 * 60 * 1000);
	}
});

/*
db.keys("venus_stats_*", (err, keys) => {
	keys.forEach(key => {
		console.log(key);
		db.del(key, (err, response) => {
			if (err) return console.err(err);
			console.log(response);
		});
	});
});
*/

client.on('ready', () => {
	const LoadedAddons = [];
	const LoadedCommands = [];

	/* LOADING ADDONS */

	fs.readdir('./src/temp_addon', async (err, files) => {
		if (err) return err;

		for (let f in files) {

			if (files[f].endsWith(".js")) {
				await fs.mkdir(`./src/addons/${files[f].split(".").pop()}`).promise();
				await fs.copyFile(`./src/temp_addon/${files[f]}`, `./src/addons/${files[f].split(".").pop()}/index.js`).promise();
				await fs.unlink(`./src/addons/${files[f]}`).promise();
				log("magenta", "* Installed js addon " + files[f], io);
			} else if (files[f].endsWith(".zip")) {
				await fs.createReadStream(`./src/temp_addon/${files[f]}`)
					.pipe(unzipper.Extract({ path: './addons' })).promise().then(() => {
						console.log("Extracted file " + files[f], io);
						fs.unlink(`./src/temp_addon/${files[f]}`, (err) => {
							if (err) {
								log("red", `> Error deleting ${files[f]}, ${err}`, io);
							} else {
								// deleted temp addon file succesfully
								log("blue", `- cleaning up...`, io);
							}
						});
					}).catch((err) => {
						console.error(err);
					});

				log('magenta', `* Found unextracted addon "${files[f]}", extracting it...`, io);
			} else {
				log("red", `Found unknown addon ${files[f]} with type ${files[f].split(".")[-1]}`, io);
			}
		}

		fs.readdir('./addons/', (err, addons) => {
			if (err) return log('red', String(err), io);

			addons.forEach((addon) => {

				let addCommandListener = (cmd, callback) => {
					client.on('message', (msg) => {


						if (Array.isArray(cmd)) {
							cmd.forEach((icmd) => {
								if (msg.content.split(' ')[0] === (Config.commands.prefix + icmd)) {
									db.get("venus_stats_" + addon, (err, reply) => {
							console.log("Addon " + addon + " Was Called ");
							if (err) return;
							if (reply == null) {

								let current_commandData = {};
								current_commandData["uses"] = {};
								current_commandData["uses"][new Date().toDateString()] = 1;

								db.set("venus_stats_" + addon, JSON.stringify(current_commandData), (err, response) => {
									if (err) return;
									if (response != "OK") return;
								});

								return;
							}

							try {
								let current_commandData = JSON.parse(reply);
								if (!current_commandData["uses"][new Date().toDateString()]) current_commandData["uses"][new Date().toDateString()] = 1;
								current_commandData["uses"][new Date().toDateString()]++;

								db.set("venus_stats_" + addon, JSON.stringify(current_commandData), (err, response) => {
									if (err) return;
									if (response != "OK") return;
								});

							} catch (e) {
								console.error(e);
							}
						});
									const args = msg.content.split(' '); args.shift();
									return callback(args, msg);
								}
							});
						}

						else if (msg.content.split(' ')[0] === (Config.commands.prefix + cmd)) {
							db.get("venus_stats_" + addon, (err, reply) => {
							console.log("Addon " + addon + " Was Called ");
							if (err) return;
							if (reply == null) {

								let current_commandData = {};
								current_commandData["uses"] = {};
								current_commandData["uses"][new Date().toDateString()] = 1;

								db.set("venus_stats_" + addon, JSON.stringify(current_commandData), (err, response) => {
									if (err) return;
									if (response != "OK") return;
								});

								return;
							}

							try {
								let current_commandData = JSON.parse(reply);
								if (!current_commandData["uses"][new Date().toDateString()]) current_commandData["uses"][new Date().toDateString()] = 1;
								current_commandData["uses"][new Date().toDateString()]++;

								db.set("venus_stats_" + addon, JSON.stringify(current_commandData), (err, response) => {
									if (err) return;
									if (response != "OK") return;
								});

							} catch (e) {
								console.error(e);
							}
						});
							const args = msg.content.split(' '); args.shift();
							return callback(args, msg);
						}

						/* DATA FOR STATISTICS
						db.get("venus_stats_" + addon, (err, reply) => {
							console.log("Addon " + addon + " Was Called ");
							if (err) return;
							if (reply == null) {

								let current_commandData = {};
								current_commandData["uses"] = {};
								current_commandData["uses"][new Date().toDateString()] = 1;

								db.set("venus_stats_" + addon, JSON.stringify(current_commandData), (err, response) => {
									if (err) return;
									if (response != "OK") return;
								});

								return;
							}

							try {
								let current_commandData = JSON.parse(reply);
								if (!current_commandData["uses"][new Date().toDateString()]) current_commandData["uses"][new Date().toDateString()] = 1;
								current_commandData["uses"][new Date().toDateString()]++;

								db.set("venus_stats_" + addon, JSON.stringify(current_commandData), (err, response) => {
									if (err) return;
									if (response != "OK") return;
								});

							} catch (e) {
								console.error(e);
							}
						});
						*/
						

					});

					let Cmd = { name: cmd, addon: addon };

					LoadedCommands.push(Cmd);
				};

				let load = require(`./addons/${addon}`);
				let props = new load();
				let session_id = Math.round(Math.random() * (100 * 100));
				let manifest = props.manifest();
				let webvars = {};
				let webprops = {
					options: {
						darktheme: false
					}
				};
				webprops.pass = (vars = {}) => {
					webvars = { ...webvars, ...vars };
				};

				if (!fs.existsSync(`./src/static/images/@addon-${addon.replace('.js', '')}.png`)) {
					request.get(manifest.image, function (err, res, body) {
						if (err) console.log(err);
						sharp(body)
							.resize(92)
							.toFile(`./src/static/images/@addon-${addon.replace('.js', '')}.png`, (err, info) => {
								if (err) console.log(err);
							});
					});
				}

				web.get(`/addon-api/${addon.toLowerCase() + '-' + session_id}/manifest`, (req, res) => res.send(props.manifest()));

				web.get(`/addon-api/pages`);

				/* WRITE CONFIG IF IT DOESN'T EXIST */
				if (!fs.existsSync(`./configs/${props.config().filename}.json`)) {
					log('magenta', `* [${addon}] Could not find config "${props.config().filename}", creating it...`, io);
					
					let json;
				
					if(typeof props.config().schema === 'object') {
						json = {
							config: props.config().json,
							schema: gs.json(addon.replace('.js', ''), props.config().json),
						};
					}
					else {
						json = {
							config: props.config().json,
							schema: props.config().schema
						};
					}
			
					fs.writeFile(`./configs/${props.config().filename}.json`, JSON.stringify(json, null, 4), () => {
						log('magenta', `* [${addon}] Config "${props.config().filename}" made`, io);
						props.execute(client, addCommandListener, require(`./configs/${props.config().filename}.json`)["config"], webprops);
					});
				}
				else props.execute(client, addCommandListener, require(`./configs/${props.config().filename}.json`)["config"], webprops);

				fs.exists(`./addons/${addon}/index.ejs`, (exists) => {
					if (exists) {
						LoadedAddons.push({ name: addon.replace('.js', ''), session_id, manifest, hasPage: true });
						web.get(`/addon-api/pages/${addon.toLowerCase()}-${session_id}`, (req, res) =>
							res.render(__dirname + `/addons/${addon}/index.ejs`, webvars));
					} else {
						LoadedAddons.push({ name: addon.replace('.js', ''), session_id, manifest, hasPage: false });
					}
				});

				log('green', `+ [${addon.replace('.js', '')}] loaded successfully`, io);

			});
			log('magenta', `* ${LoadedCommands.length} command(s) in use`, io);

			web.get('/command-api/all', (req, res) => res.send(LoadedCommands));
		});

		web.get('/addon-api/all', (req, res) => res.send(LoadedAddons));
	});


	client.on('message', (msg) => {

		/* LOG GLOBAL CHAT */

		if (Config["log global chat"] == true && msg.author !== client.user) {
			if (msg.channel.type === 'dm') {
				log('white', `<DM> ${msg.author.username} : ${msg.content}`, io);
			}
			else {
				log('white', `<${msg.guild}> <#${msg.channel.name}> ${msg.author.username} : ${msg.content}`, io);
			}
		}


		let args = msg.content.split(' ');

		if (args[0] === "<@" + client.user.id + ">") {
			args.shift();
			let embed;

			switch (args[0]) {
				case "addons":
					let i = 1;
					let desc = "";

					embed = new Discord.RichEmbed()
						.setColor(Config["vdjs embed theme color"])
						.setThumbnail(client.user.avatarURL)
						.addField('**Addons**', `See specific - **<@${client.user.id}> addons <Number>**\nFind more addons at https://marketplace.vdjs.io :package:`);

					LoadedAddons.forEach(entry => {

						desc += `\`#${i}\` **${entry.name.replace('.js', '')}** - ${entry.manifest.description}\n`;

						i++;
					});

					embed.setDescription(desc);

					msg.channel.send(embed);
					break;
				case "commands":

					let addons = {};
					embed = new Discord.RichEmbed()
						.setTitle(`**Command Listeners** | ${LoadedCommands.length} in use.`)
						.setColor(Config["embed theme color"]);

					LoadedCommands.forEach((cmd) => {

						if (!addons[cmd.addon]) addons[cmd.addon] = { name: cmd.addon, commands: [] };

						addons[cmd.addon].commands.push(cmd.name);

					});

					for (let addon in addons) {
						let cmdlist = "";

						addons[addon].commands.forEach(cmd => {

							if (Array.isArray(cmd)) cmd = cmd.join(' || ' + Config.commands.prefix);

							cmdlist += `\`#\` **${Config.commands.prefix + cmd}**\n`;
						});

						embed.addField(`**${addon}**`, cmdlist);
					}


					msg.channel.send(embed);

					break;
				case "auth":
					if (Config["operator users"].includes(msg.author.id)) {
						let password = generator.generate({ length: 15, numbers: true });
						db.set("venus_auth_" + password, msg.author.id, "EX", 60, (err, res) => {
							if (err) {
								// set the password
							} else {
								// error setting the password
							}
						});
						msg.channel.send('Sent DM :mailbox:');
						msg.author.send(`Login \`${password}\` @ http://${ip.address()}:${Config["web interface port"]}/login\n* _Expires in one minute._`).then(msg => {
							setTimeout(() => {
								msg.edit(`Login \`EXPIRED\` @ http://${ip.address()}:${Config["web interface port"]}/login`);
							}, 1000 * 60);
						});
					}
					else {
						msg.channel.send('Insufficient Permissions - <@' + msg.author.id + '>');
					}
					break;
				case "vam":
					vam(args, msg);
					break;
			}
		}
	});

	web.use('/api/info', (req, res) => {
		res.send({
			name: client.user.username,
			avatar: client.user.avatarURL
		});
	});
	webpanel(web, db, client, AddonPages, io, true);
});

/* CREATE INVITE TO LOCATE GUILDS */

client.on('guildCreate', guild => {
	//if (!guild.me.hasPermission('CREATE_INSTANT_INVITE') || !guild.me.hasPermission("ADMINISTRATOR")) return console.log('Insufficient permission.');

	db.get("venus_guilds_invites", (err, response) => {
		if(err) return console.error(err);
		if(response == null) {
			guild.channels.filter(channel => channel.type == "text").first().createInvite({maxAge:0,reason:`Created by ${client.user.tag}`}).then(invite => {
				let invites = {};
				invites[guild.id] = invite.code;
				db.set("venus_guilds_invites", JSON.stringify(invites), (err, reply) => {
					if(err) return console.error(err);
					if(reply != "OK") return;
				});
			}).catch(err =>{
			if(err) {
				console.error(err);
			}
		});
		} else {
			guild.channels.filter(channel => channel.type == "text").first().createInvite({maxAge:0,reason:`Created by ${client.user.tag}`}).then(invite => {
				let invites = JSON.parse(response);
				invites[guild.id] = invite.code;
				db.set("venus_guilds_invites", JSON.stringify(invites), (err, reply) => {
					if(err) return console.error(err);
					if(reply != "OK") return;
				});
			}).catch(console.error);
		}
	});
});