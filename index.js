// index.js
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');

// ===== ENV DEĞİŞKENLERİ =====
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const PORT = process.env.PORT || 3000;

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.Channel, Partials.GuildMember]
});

// ===== WEB SERVER =====
const app = express();
app.get('/', (req, res) => res.send('Bot çalışıyor 😎'));
app.listen(PORT, () => console.log(`Web server ${PORT} portunda açık`));

// ===== LOG KANALI =====
let logChannel;

// ===== READY EVENT =====
client.once('ready', () => {
  console.log(`Bot açıldı: ${client.user.tag}`);
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return console.log('Sunucu bulunamadı!');
  logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  console.log('Log kanalı set edildi.');
});

// ===== Yedekler =====
let backupChannels = {};
let backupRoles = {};

// ===== KANAL ROL GUARD =====
client.on('ready', () => {
  const guild = client.guilds.cache.get(GUILD_ID);

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

  console.log('Kanallar ve roller yedeklendi.');
});

// Kanal silindiğinde geri oluştur
client.on('channelDelete', async channel => {
  const guild = channel.guild;
  const data = backupChannels[channel.id];
  if (!data) return;
  guild.channels.create({
    name: data.name,
    type: data.type,
    parent: data.parentId
  }).then(ch => {
    if (logChannel) logChannel.send(`🟢 Kanal geri oluşturuldu: ${data.name}`);
  });
});

// Rol silindiğinde geri oluştur
client.on('roleDelete', async role => {
  const guild = role.guild;
  const data = backupRoles[role.id];
  if (!data) return;
  guild.roles.create({
    name: data.name,
    color: data.color,
    permissions: data.permissions,
    hoist: data.hoist,
    mentionable: data.mentionable
  }).then(r => {
    if (logChannel) logChannel.send(`🟢 Rol geri oluşturuldu: ${data.name}`);
  });
});

// Üye atılınca veya banlanınca atan kişinin rollerini al
client.on('guildMemberRemove', async member => {
  const guild = member.guild;
  const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: 'MEMBER_KICK' });
  const entry = auditLogs.entries.first();
  if (!entry) return;
  const executor = entry.executor;
  const roles = executor.roles.cache.map(r => r);
  try {
    await executor.roles.remove(roles);
    if (logChannel) logChannel.send(`❌ ${executor.tag} rollerini kaybetti çünkü ${member.user.tag} atıldı/banlandı.`);
  } catch {}
});

// Rol eklendiğinde alınması
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  if (oldMember.roles.cache.size < newMember.roles.cache.size) {
    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    try {
      await newMember.roles.remove(addedRoles);
      if (logChannel) logChannel.send(`❌ ${newMember.user.tag} yeni rol aldı, alındı.`);
    } catch {}
  }
});

// ===== BOT LOGIN =====
client.login(TOKEN);
