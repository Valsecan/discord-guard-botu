const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');

// ===== ENV DEĞİŞKENLERİ =====
const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 3000;

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildRoles,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Channel, Partials.GuildMember]
});

// ===== WEB SERVER =====
const app = express();
app.get("/", (req, res) => res.send("Bot çalışıyor 😎"));
app.listen(PORT, () => console.log(`Web server ${PORT} portunda açık`));

// ===== LOG FONKSİYONU =====
function log(guild, msg) {
  const channel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (channel) channel.send(msg);
}

// ===== ROL CEZA FONKSİYONU =====
async function punish(member) {
  try {
    await member.roles.set([]); // tüm rolleri al
  } catch (err) {
    console.log("Rolleri alırken hata:", err);
  }
}

// ===== BACKUP =====
let backupChannels = {};
let backupRoles = {};

// ===== BOT READY =====
client.once('clientReady', () => {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return console.log("Sunucu bulunamadı!");

  console.log(`Bot açıldı: ${client.user.tag}`);

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
});

// ===== KANAL GUARD =====
client.on("channelDelete", async channel => {
  const guild = channel.guild;
  const data = backupChannels[channel.id];
  if (!data) return;
  
  // Sileni cezalandır
  const audit = (await guild.fetchAuditLogs({ type: 'CHANNEL_DELETE', limit: 1 })).entries.first();
  if (audit) punish(audit.executor);

  // Kanalı geri oluştur
  guild.channels.create({
    name: data.name,
    type: data.type,
    parent: data.parentId
  });
  
  log(guild, `🟢 Kanal geri oluşturuldu: ${data.name}`);
});

client.on("channelCreate", async channel => {
  const guild = channel.guild;
  const audit = (await guild.fetchAuditLogs({ type: 'CHANNEL_CREATE', limit: 1 })).entries.first();
  if (audit) punish(audit.executor);
  log(guild, `🟡 Kanal oluşturuldu: ${channel.name}`);
});

// ===== ROL GUARD =====
client.on("roleDelete", async role => {
  const guild = role.guild;
  const data = backupRoles[role.id];
  if (!data) return;

  const audit = (await guild.fetchAuditLogs({ type: 'ROLE_DELETE', limit: 1 })).entries.first();
  if (audit) punish(audit.executor);

  guild.roles.create({
    name: data.name,
    color: data.color,
    permissions: data.permissions,
    hoist: data.hoist,
    mentionable: data.mentionable
  });

  log(guild, `🟢 Rol geri oluşturuldu: ${data.name}`);
});

client.on("roleCreate", async role => {
  const guild = role.guild;
  const audit = (await guild.fetchAuditLogs({ type: 'ROLE_CREATE', limit: 1 })).entries.first();
  if (audit) punish(audit.executor);
  log(guild, `🟡 Rol oluşturuldu: ${role.name}`);
});

// ===== ÜYE GUARD =====
client.on("guildMemberRemove", async member => {
  const guild = member.guild;
  const audit = (await guild.fetchAuditLogs({ type: 'MEMBER_KICK', limit: 1 })).entries.first();
  if (audit) punish(audit.executor);
  log(guild, `🚨 Üye atıldı: ${member.user.tag}`);
});

client.on("guildBanAdd", async (guild, user) => {
  const audit = (await guild.fetchAuditLogs({ type: 'MEMBER_BAN_ADD', limit: 1 })).entries.first();
  if (audit) punish(audit.executor);
  log(guild, `🚨 Üye banlandı: ${user.tag}`);
});

// ===== ROL DEĞİŞİMİ =====
client.on("guildMemberUpdate", (oldMember, newMember) => {
  if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
    const audit = newMember.guild.fetchAuditLogs({ type: 'MEMBER_ROLE_UPDATE', limit: 1 }).then(logs => {
      const entry = logs.entries.first();
      if (entry) punish(entry.executor);
    });
  }
});

client.login(DISCORD_TOKEN);
