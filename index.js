const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const express = require('express');

// ===== ENV =====
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const PORT = process.env.PORT || 8080;

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.Channel, Partials.GuildMember]
});

// ===== WEB SERVER =====
const app = express();
app.get("/", (req, res) => res.send("Bot çalışıyor 😎"));
app.listen(PORT, () => console.log(`Web server ${PORT} portunda açık`));

// ===== BACKUP =====
let backupChannels = {};
let backupRoles = {};
let backupMembers = {};

// ===== BOT READY =====
client.once(Events.ClientReady, async () => {
  console.log(`Bot açıldı: ${client.user.tag}`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return console.log('Sunucu bulunamadı!');

  // Log kanalı
  client.logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (client.logChannel) console.log('Log kanalı set edildi.');

  // Kanalları yedekle
  guild.channels.cache.forEach(ch => {
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

// ===== CHANNEL GUARD =====
client.on(Events.ChannelDelete, async channel => {
  const guild = channel.guild;
  const log = client.logChannel;

  // Audit logdan kim sildi öğren
  const audit = await guild.fetchAuditLogs({ limit: 1, type: 12 }); // CHANNEL_DELETE = 12
  const executor = audit.entries.first()?.executor;

  // Silen kişinin rollerini al
  if (executor) {
    const member = guild.members.cache.get(executor.id);
    if (member && member.roles.cache.size > 0) {
      member.roles.set([]).catch(() => {});
      if (log) log.send(`⚠️ ${executor.tag} kanal silince rollerini kaybetti.`);
    }
  }

  // Kanalı geri oluştur
  const data = backupChannels[channel.id];
  if (data) {
    guild.channels.create({
      name: data.name,
      type: data.type,
      parent: data.parentId
    }).then(() => {
      if (log) log.send(`🟢 Kanal geri oluşturuldu: ${data.name}`);
    });
  }
});

// ===== ROLE GUARD =====
client.on(Events.RoleDelete, async role => {
  const guild = role.guild;
  const log = client.logChannel;

  const audit = await guild.fetchAuditLogs({ limit: 1, type: 32 }); // ROLE_DELETE = 32
  const executor = audit.entries.first()?.executor;

  if (executor) {
    const member = guild.members.cache.get(executor.id);
    if (member && member.roles.cache.size > 0) {
      member.roles.set([]).catch(() => {});
      if (log) log.send(`⚠️ ${executor.tag} rol sildi ve rollerini kaybetti.`);
    }
  }

  // Rolü geri oluştur
  const data = backupRoles[role.id];
  if (data) {
    guild.roles.create({
      name: data.name,
      color: data.color,
      permissions: data.permissions,
      hoist: data.hoist,
      mentionable: data.mentionable
    }).then(() => {
      if (log) log.send(`🟢 Rol geri oluşturuldu: ${data.name}`);
    });
  }
});

// ===== MEMBER GUARD (Kick/Ban) =====
client.on(Events.GuildMemberRemove, async member => {
  const guild = member.guild;
  const log = client.logChannel;

  const auditKick = await guild.fetchAuditLogs({ limit: 1, type: 20 }); // MEMBER_KICK = 20
  const auditBan = await guild.fetchAuditLogs({ limit: 1, type: 22 }); // MEMBER_BAN_ADD = 22
  const executor = auditKick.entries.first()?.executor || auditBan.entries.first()?.executor;

  if (executor) {
    const execMember = guild.members.cache.get(executor.id);
    if (execMember && execMember.roles.cache.size > 0) {
      execMember.roles.set([]).catch(() => {});
      if (log) log.send(`⚠️ ${executor.tag} bir üyeyi attı/banladı, rollerini kaybetti.`);
    }
  }
});

// ===== ROL VERMEDE GUARD =====
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  const guild = oldMember.guild;
  const log = client.logChannel;

  // Rollerde değişiklik varsa
  if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
    const audit = await guild.fetchAuditLogs({ limit: 1, type: 25 }); // MEMBER_ROLE_UPDATE = 25
    const executor = audit.entries.first()?.executor;

    if (executor) {
      const execMember = guild.members.cache.get(executor.id);
      if (execMember && execMember.roles.cache.size > 0) {
        execMember.roles.set([]).catch(() => {});
        if (log) log.send(`⚠️ ${executor.tag} rol verince rollerini kaybetti.`);
      }
    }
  }
});

// ===== BOT LOGIN =====
client.login(DISCORD_TOKEN);
