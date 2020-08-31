const EventEmitter = require('events');

class PageMenu {
  constructor (
    channel,
    userId,
    time,
    pageEmojis = Utils.Emojis.arrows,
    {
      data = [],
      start = 1,
      embed = {},
      end = message => {
        message
          .delete({
            timeout : 0,
            reson   : 'Free up clutter',
          })
          .catch(() => {
            return;
          });
      },
      error = error => console.error(error),
      trash = false,
      jump = false,
      plainText = false,
      pageNumbers = true,
      loop = true,
    },
    emojis = {},
  ) {
    this.events = new EventEmitter();
    this.channel = channel;
    this.userId = userId;
    this.time = time;
    this.data = data;
    this.start = start - 1;
    this.embed = embed;
    this.end = end;
    this.error = error;
    this.pageEmojis = pageEmojis;
    this.emojis = Object.keys(emojis);
    this.emojiFuncs = emojis;
    const extras = [];
    if (trash || jump) {
      if (jump) {
        extras.push(Utils.Emojis.jump);
      }
      if (trash) {
        extras.push(Utils.Emojis.trash);
      }
    }
    this.allEmojis = [
      this.pageEmojis[0],
      ...this.emojis,
      ...extras,
      this.pageEmojis[1],
    ];
    this.parsedData = [];
    this.plainText = plainText;
    this.pageNumbers = pageNumbers;
    this.trash = trash;
    this.jump = jump;
    this.loop = loop;
    this.setup();
    this.page = this.start;
    this.message;
  }

  setup () {
    const embed = this.embed;
    const pageNumbers = this.pageNumbers;
    const plainText = this.plainText;
    const data = this.data;
    data.forEach((el, index) => {
      let thisParsed;
      if (typeof el === 'object') {
        if (plainText) {
          thisParsed = el.toString();
        }
        else {
          if (pageNumbers) {
            thisParsed = {
              embed : {
                ...el,
                footer    : {
                  text     : `${
                    el.footer ? el.footer.text + ' • ' :
                    ''}${
                    embed.footer ? el.footer ? embed.footer.text + ' • ' :
                    embed.footer.text + ' • ' :
                    ''}${index + 1}/${data.length}`,
                  icon_url : (el.footer || embed.footer || { footer: { icon_url: undefined } }).icon_url,
                },
                timestamp : new Date(),
              },
            };
          }
          else {
            thisParsed = {
              embed : el,
            };
          }
        }
      }
      else {
        if (plainText) {
          thisParsed = el.toString();
        }
        else {
          if (pageNumbers) {
            thisParsed = {
              embed : {
                ...embed,
                description : el.toString(),
                footer      : {
                  text     : `${
                    el.footer ? el.footer.text + ' • ' :
                    ''}${
                    embed.footer ? el.footer ? embed.footer.text + ' • ' :
                    embed.footer.text + ' • ' :
                    ''}${index + 1}/${data.length}`,
                  icon_url : (el.footer || embed.footer || { footer: { icon_url: undefined } }).icon_url,
                },
                timestamp   : new Date(),
              },
            };
          }
          else {
            thisParsed = {
              embed : {
                ...this.embed,
                description : el.toString(),
              },
            };
          }
        }
      }
      this.parsedData.push(thisParsed);
    });
    this.channel.send(this.parsedData[this.start]).then(message => {
      this.message = message;
      this.allEmojis.forEach(emoji => message.react(emoji));
      this.reaction();
    });
  }

  async deleteReaction () {
    const user = this.userId;
    const userReactions = this.message.reactions.cache.filter(reactionUser => reactionUser.users.cache.has(user));
    try {
      for (const reactionEmoji of userReactions.values()) {
        await reactionEmoji.users.remove(user);
      }
    } catch (error) {
      this.error(error);
    }
  }

  changePage (number) {
    let page = number;
    if (this.loop) {
      if (page < 0) page = this.data.length - 1;
      if (page > this.data.length - 1) page = 0;
    }
    else {
      if (page < 0) page = 0;
      if (page > this.data.length - 1) page = this.data.length - 1;
    }
    this.page = page;
    this.message.edit(this.parsedData[this.page]);
    this.events.emit('changePage', page);
    this.deleteReaction();
  }

  forward () {
    this.changePage(this.page + 1);
    this.events.emit('forward', this.message);
  }

  back () {
    this.changePage(this.page - 1);
    this.events.emit('back', this.message);
  }

  reaction () {
    const message = this.message;
    const filter = (reaction, user) => {
      return this.allEmojis.includes(reaction.emoji.name || reaction.emoji.id) && user.id === this.userId;
    };
    message
      .awaitReactions(filter, {
        max    : 1,
        time   : this.time,
        errors : [
          'time',
        ],
      })
      .then(collected => {
        const reaction = collected.first();
        const pageEmojis = this.pageEmojis;
        if (!reaction) this.end(message, collected);
        const name = reaction.emoji.name || reaction.emoji.id;

        if (pageEmojis.includes(name)) {
          if (name === pageEmojis[0]) {
            this.back();
          }
          else {
            this.forward();
          }
        }
        else if (name === Utils.Emojis.trash) {
          if (this.trash) {
            message
              .delete({
                timeout : 0,
                reson   : 'Free up clutter',
              })
              .catch(() => {
                return;
              });
          }
        }
        else if (name === Utils.Emojis.jump) {
          if (this.jump) {
            const filter = response => {
              return !isNaN(parseInt(response, 10));
            };
            message.channel.send('Please say what page you would like to go to.').then(sent => {
              message.channel
                .awaitMessages(filter, {
                  max    : 1,
                  time   : 30000,
                  errors : [
                    'time',
                  ],
                })
                .then(collected => {
                  const num = parseInt(collected.first().content, 10);
                  if (num > this.data.length) {
                    collected
                      .first()
                      .delete({
                        timeout : 0,
                        reason  : '',
                      })
                      .catch(() => {
                        return;
                      });
                    sent
                      .delete({
                        timeout : 0,
                        reason  : '',
                      })
                      .catch(() => {
                        return;
                      });
                    return message.channel.send(`That is greater than ${this.data.length}.`).then(sentError =>
                      sentError
                        .delete({
                          timeout : 3000,
                          reason  : '',
                        })
                        .catch(() => {
                          return;
                        }),
                    );
                  }
                  this.changePage(num - 1);
                  collected
                    .first()
                    .delete({
                      timeout : 0,
                      reason  : '',
                    })
                    .catch(() => {
                      return;
                    });
                  sent
                    .delete({
                      timeout : 0,
                      reason  : '',
                    })
                    .catch(() => {
                      return;
                    });
                });
            });
          }
        }
        else {
          if (this.emojiFuncs.hasOwnProperty(name)) {
            try {
              this.emojiFuncs[name](this.message);
            } catch (error) {
              this.error(error);
            }
          }
          this.deleteReaction();
        }

        this.reaction();
      })
      .catch(collected => {
        this.end(message, collected);
      });
  }

  on (event, callback) {
    this.events.on(event, callback);
  }
}

module.exports = PageMenu;
