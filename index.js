// index.js
const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const express = require('express');

// ===== ENV =====
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Channel, Partials.GuildMember]
});

// ===== WEB SERVER =====
const app = express();
app.get("/", (req, res) => res.send("Bot çalışıyor 😎"));
app.listen(8080, () => console.log("Web server 8080 portunda açık"));

// ===== LOG KANALI =====
let logChannel;

// ===== Yedekler =====
let backupRoles = {};
let backupChannels = {};

// ===== BOT READY =====
client.once(Events.ClientReady, async () => {
  console.log(`Bot açıldı: ${client.user.tag}`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return console.log("Sunucu bulunamadı!");

  logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);

  // Rolleri yedekle
  guild.roles.cache.forEach(r => {
    backupRoles[r.id] = {
      name: r.name,
      color: r.color,
      permissions: r.permissions.bitfield,
      hoist: r.hoist,
      mentionable: r.mentionable
    };
  });

  // Kanalları yedekle
  guild.channels.cache.forEach(ch => {
    backupChannels[ch.id] = {
      name: ch.name,
      type: ch.type,
      parentId: ch.parentId,
      permissions: ch.permissionOverwrites.cache.map(p => ({
        id: p.id,
        allow: p.allow.bitfield,
        deny: p.deny.bitfield
      }))
    };
  });

  logChannel?.send("Log kanalı set edildi. Kanallar ve roller yedeklendi!");
});

// ===== ROL VE KANAL EVENTLERİ =====

// Rol silme
client.on(Events.RoleDelete, async role => {
  const guild = role.guild;
  const audit = await guild.fetchAuditLogs({ type: 'ROLE_DELETE', limit: 1 });
  const executor = audit.entries.first()?.executor;
  if (executor) {
    executor.roles.cache.forEach(r => executor.roles.remove(r).catch(() => {}));
  }

  const data = backupRoles[role.id];
  if (data) {
    guild.roles.create({
      name: data.name,
      color: data.color,
      permissions: data.permissions,
      hoist: data.hoist,
      mentionable: data.mentionable
    });
    logChannel?.send(`🟢 Rol geri oluşturuldu: ${data.name}`);
  }
});

// Rol oluşturma
client.on(Events.RoleCreate, async role => {
  const guild = role.guild;
  const audit = await guild.fetchAuditLogs({ type: 'ROLE_CREATE', limit: 1 });
  const executor = audit.entries.first()?.executor;
  if (executor) {
    executor.roles.cache.forEach(r => executor.roles.remove(r).catch(() => {}));
  }
});

// Kanal silme
client.on(Events.ChannelDelete, async channel => {
  const guild = channel.guild;
  const audit = await guild.fetchAuditLogs({ type: 'CHANNEL_DELETE', limit: 1 });
  const executor = audit.entries.first()?.executor;
  if (executor) executor.roles.cache.forEach(r => executor.roles.remove(r).catch(() => {}));

  const data = backupChannels[channel.id];
  if (data) {
    guild.channels.create({
      name: data.name,
      type: data.type,
      parent: data.parentId
    });
    logChannel?.send(`🟢 Kanal geri oluşturuldu: ${data.name}`);
  }
});

// Kanal oluşturma
client.on(Events.ChannelCreate, async channel => {
  const guild = channel.guild;
  const audit = await guild.fetchAuditLogs({ type: 'CHANNEL_CREATE', limit: 1 });
  const executor = audit.entries.first()?.executor;
  if (executor) executor.roles.cache.forEach(r => executor.roles.remove(r).catch(() => {}));
});

// Üye atma/ban
client.on(Events.GuildMemberRemove, async member => {
  const guild = member.guild;
  const audit = await guild.fetchAuditLogs({ type: 'MEMBER_KICK', limit: 1 });
  const executor = audit.entries.first()?.executor;
  if (executor) executor.roles.cache.forEach(r => executor.roles.remove(r).catch(() => {}));
});

client.on(Events.GuildBanAdd, async (guild, ban) => {
  const audit = await guild.fetchAuditLogs({ type: 'MEMBER_BAN_ADD', limit: 1 });
  const executor = audit.entries.first()?.executor;
  if (executor) executor.roles.cache.forEach(r => executor.roles.remove(r).catch(() => {}));
});

// ===== BOT LOGIN =====
client.login(TOKEN);
