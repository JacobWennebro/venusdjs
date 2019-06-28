# Venus - a Discord.js framework 🤖

After a couple sleepless nights we're ready to release this for the Discord Hack Week event. The idea of Venus is something our team has visioned making for a long time, mainly for the efficiency of our own bot. Not everything is perfect as of yet but I think we managed pretty well on the four days we were given. This is definitely  a project we wanna make long-term.

~ Jaaack#0069, 00#1337, James.#3168, broken-admin#4243, Looda.#4618

![alt text](https://i.gyazo.com/9168847b2ba3502c04e6081eb9fb831c.gif)

Hello there Discord employee, got limited time? [Here](https://github.com/JacobWennebro/venusdjs-addons) you can find some example addons to load into your VenusDJS bot 😊

## Installation

Download the repository & install the dependencies using the node package manager, (npm)

```bash
cd /example/path/venusdjs
npm install
```

## Getting started

```
npm start
```

Once you start the process you will recieve a connection error to the Discord service, here you will need your Discord bot's token that can be found on the Discord developer portal. You can either edit main-config.json through traditional means or use the Venus web interface (default: ip/localhost:8085). After either way of editing the config you will need to restart the node process.

## Authentication to web interface
Venus makes it simple and secure to authenticate to your bot's interface, If you haven't yet set your bot token your interface can be accessed in "offline mode", where your login Secret-Key can be found in the terminal itself. However if you have gotten your bot connected to the Discord services then your Secret-Key can be accessed from the bot itself by typing `@BotName auth`. Your secret login key will be sent to your DM only if you are added to the "operator users" within main-config.json.

## Addons
Addons is an easy way for developers to implement features into Venus, it also makes Venus a more beginner friendly way of creating a Discord bot. Our goal is to make Venus an alternative for both non-coders & experts. We want to build a platform for sharing these addons and together create awesome & efficient Discord bots with ease. Read more about addons [here](https://github.com/JacobWennebro/venusdjs-addons)

## Commands
There are two types of commands in Venus, there are the built in commands that calls the bot by tagging it's username followed by an appropriate term. These commands are rather minimal and only provide core features such as `@BotName auth` or `@BotName addons`. The other type is from the command listener. By default the command listener will have 0 commands to listen for, this is where addons come into place. Addons can utilize the command listener to easily create commands, this way every command whether they're from the same addon or not will use the same prefix giving your bot a more organised environment. This universal prefix can also be changed inside main-config.json.

## License
[MIT](https://choosealicense.com/licenses/mit/)