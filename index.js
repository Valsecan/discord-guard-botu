// index.js
const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const express = require('express');

const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Channel, Partials.GuildMember]
});

// ===== Web server =====
const app = express();
app.get('/', (req, res) => res.send('Bot çalışıyor 😎'));
app.listen(8080, () => console.log('Web server 8080 portunda açık'));

// ===== Backup =====
let backupChannels = {};
let backupRoles = {};

// ===== Ready =====
client.once('ready', async () => {
  console.log(`Bot açıldı: ${client.user.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);
  if (!guild) return console.log('Sunucu bulunamadı!');

  client.logChannel = await guild.channels.fetch(LOG_CHANNEL_ID);

  // Kanalları yedekle
  const channels = await guild.channels.fetch();
  channels.forEach(ch => {
    backupChannels[ch.id] = {
      name: ch.name,
      type: ch.type,
      parentId: ch.parentId,
      permissionOverwrites: ch.permissionOverwrites.cache.map(p => ({
        id: p.id,
        allow: p.allow.bitfield,
        deny: p.deny.bitfield
      }))
    };
  });

  // Rolleri yedekle
  const roles = await guild.roles.fetch();
  roles.forEach(r => {
    backupRoles[r.id] = {
      name: r.name,
      color: r.color,
      permissions: r.permissions.bitfield,
      hoist: r.hoist,
      mentionable: r.mentionable
    };
  });

  console.log('Kanallar ve roller yedeklendi.');
  if (client.logChannel) client.logChannel.send('Log kanalı set edildi ve yedekler hazır.');
});

// ===== Kanal guard =====
client.on(Events.ChannelDelete, async channel => {
  const guild = channel.guild;
  const audit = await guild.fetchAuditLogs({ type: 12, limit: 1 }); // CHANNEL_DELETE
  const executor = audit.entries.first()?.executor;

  if (executor) {
    // Executor’un rollerini al
    const member = guild.members.cache.get(executor.id);
    if (member && member.roles.cache.size > 0) {
      await member.roles.set([]);
    }
  }

  const data = backupChannels[channel.id];
  if (data) {
    await guild.channels.create({
      name: data.name,
      type: data.type,
      parent: data.parentId
    });
    if (client.logChannel) client.logChannel.send(`🟢 Kanal geri oluşturuldu: ${data.name}`);
  }
});

// ===== Rol guard =====
client.on(Events.RoleDelete, async role => {
  const guild = role.guild;
  const audit = await guild.fetchAuditLogs({ type: 32, limit: 1 }); // ROLE_DELETE
  const executor = audit.entries.first()?.executor;

  if (executor) {
    const member = guild.members.cache.get(executor.id);
    if (member && member.roles.cache.size > 0) {
      await member.roles.set([]);
    }
  }

  const data = backupRoles[role.id];
  if (data) {
    await guild.roles.create({
      name: data.name,
      color: data.color,
      permissions: data.permissions,
      hoist: data.hoist,
      mentionable: data.mentionable
    });
    if (client.logChannel) client.logChannel.send(`🟢 Rol geri oluşturuldu: ${data.name}`);
  }
});

// ===== Üye guard (kick/ban) =====
client.on(Events.GuildMemberRemove, async member => {
  const guild = member.guild;
  const audit = await guild.fetchAuditLogs({ type: 20, limit: 1 }); // MEMBER_KICK
  const executor = audit.entries.first()?.executor;

  if (executor) {
    const execMember = guild.members.cache.get(executor.id);
    if (execMember && execMember.roles.cache.size > 0) {
      await execMember.roles.set([]);
    }
    if (client.logChannel) client.logChannel.send(`⚠️ ${executor.tag} üyenin rollerini kaybetti.`);
  }
});

// ===== Bot login =====
client.login(TOKEN);
