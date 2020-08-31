const Cooldown = require('../Utils/Cooldown');
const runCommand = require('../Handlers/CommandHandler');

const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = msg => {
  const client = msg.client;
  if (msg.author.bot) return;
  let args;
  if (msg.guild) {
    const prefixRegex = new RegExp(`^(<@!?${client.user.id}>|${escapeRegex('?')})\\s*`);
    if (!prefixRegex.test(msg.content)) return;

    const [
      ,
      matchedPrefix,
    ] = msg.content.match(prefixRegex);
    args = msg.content.slice(matchedPrefix.length).trim().split(/ +/);
  }
  else {
    args = msg.content.split(/\ +/);
  }
  let commandName = args.shift().toLowerCase();
  let cmd =
    client.getCommand(commandName)

  if (!cmd) {
    const firstArg = args.shift();
    if (!firstArg) return;
    commandName = firstArg.toLowerCase();
    const cmdTest =
      client.getCommand(commandName);
    if (cmdTest) {
      cmd = cmdTest;
    }
    else return;
  }

  if (cmd.guildOnly && msg.channel.type !== 'text') {
    return;
  }

  new Cooldown(
    cmd.name,
    msg.author,
    cmd.cooldown,
    () => {
      runCommand(msg, cmd, args);
    },
    timeLeft => {
      return msg.reply(`Please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${cmd.name}\` cmd.`);
    },
  );
};